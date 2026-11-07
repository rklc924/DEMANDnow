import { randomBytes } from "crypto";
import { acct, can } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { logActivity, readDB, writeDB } from "@/lib/store";
import { chargeCard } from "@/lib/stripe";
import { WITNESS_WHO, matterLabel, newWitnessJob, sendWitnessRequest, type WitnessKind, type WitnessMode } from "@/lib/witness";

// Books a mobile notary or commissioner ($50 a page, charged to the card on file; travel confirmed separately),
// or asks for a referral to a local partner (no charge). Used by any screen that renders <WitnessOptions>.
export const POST = (req: Request) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const str = (k: string) => String(f.get(k) ?? "").trim();
    // Only same-site paths, so the form can't redirect anywhere else.
    const backPath = /^\/[\w\-/]*$/.test(str("back")) ? str("back") : "/";
    const back = (q: string) => go(req, `${backPath}?${q}#witness`);
    if (!can(user, "orderServices")) return go(req, `${backPath}?noPermission=1`);

    const db = await readDB(acct(user));
    const matter = str("matter");
    const label = await matterLabel(acct(user), db, matter);
    if (!label) return back("witnessError=" + encodeURIComponent("We couldn't find that matter."));

    const kind: WitnessKind = str("kind") === "notary" ? "notary" : "commissioner";
    const mode: WitnessMode = str("mode") === "partner" ? "partner" : "mobile";
    const pages = Math.floor(Number(str("pages")));
    const address = str("address").split("\n").map((l) => l.trim()).filter(Boolean);
    const city = str("city");
    const document = str("document");
    if (!document) return back("witnessError=" + encodeURIComponent("Tell us which document needs to be sworn or notarized."));
    if (mode === "mobile") {
      if (!Number.isFinite(pages) || pages < 1 || pages > 200) return back("witnessError=" + encodeURIComponent("Enter how many pages need to be signed and stamped (1 to 200)."));
      if (!address.length) return back("witnessError=" + encodeURIComponent(`Enter the address where the ${WITNESS_WHO[kind]} should meet you.`));
    } else if (!city) {
      return back("witnessError=" + encodeURIComponent("Enter your city or postal code so we can find a partner near you."));
    }

    const job = newWitnessJob({
      matter,
      stepId: str("step") || undefined,
      document,
      kind,
      mode,
      pages: mode === "mobile" ? pages : 0,
      signer: str("signer"),
      address,
      city: city || address.at(-1) || "",
      times: str("times"),
      notes: str("notes"),
    });

    if (mode === "mobile") {
      try {
        const charge = await chargeCard(acct(user), job.fee, `Mobile ${WITNESS_WHO[kind]}: ${document} (${pages} pages)`, { witnessJobId: job.id, matter });
        job.chargeId = charge.id;
        (db.charges ??= []).push({
          id: randomBytes(4).toString("hex"),
          at: new Date().toISOString(),
          amount: job.fee,
          description: `Mobile ${WITNESS_WHO[kind]}: ${document}`,
          stripeId: charge.id,
          demo: charge.demo,
          kind: "service",
          extraFeesNote: "Travel costs, if any, are confirmed with you and charged separately.",
        });
      } catch (e) {
        return back("witnessError=" + encodeURIComponent((e as Error).message));
      }
    }

    try {
      await sendWitnessRequest(req, job, { company: db.company.name, clientEmail: db.company.email || user.email, clientPhone: db.company.phone, matterLabel: label, back: backPath });
    } catch {
      // Recorded either way; operations also sees the charge in Stripe.
    }
    (db.witnessJobs ??= []).push(job);
    logActivity(db, user, mode === "mobile" ? `Booked a mobile ${WITNESS_WHO[kind]} for ${document}` : `Asked for a partner ${WITNESS_WHO[kind]} for ${document}`, `${backPath}#witness`);
    await writeDB(acct(user), db);
    return back(mode === "mobile" ? "witnessBooked=1" : "witnessReferral=1");
  });
