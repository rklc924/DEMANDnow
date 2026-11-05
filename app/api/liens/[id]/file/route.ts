import { randomBytes } from "crypto";
import { money } from "@/lib/aging";
import { appUrl, sendEmail } from "@/lib/email";
import { go, withUser } from "@/lib/http";
import { LIEN_FILING_FEE, LIEN_ROLE_LABEL, LIEN_RUSH_FEE, LIEN_TITLE_SEARCH_FEE, filingQuote, lienDates } from "@/lib/liens";
import { readDB, readUpload, writeDB } from "@/lib/store";
import { chargeCard } from "@/lib/stripe";

// "Have us file it": we file the signed Claim of Lien by hand at the Land Title Office.
// Charges $250 (+$100 rush) now; LTSA filing fees are charged at cost once filed.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const back = (q: string) => go(req, `/liens/${params.id}?${q}#filing`);
    const err = (m: string) => back("fileError=" + encodeURIComponent(m));
    const f = await req.formData();
    const db = await readDB(user.id);
    const lien = db.liens?.find((l) => l.id === params.id);
    if (!lien) return go(req, "/liens");
    const where = lien.civicAddress || `PID ${lien.pid}`;
    const ops = process.env.LIEN_FILING_EMAIL ?? process.env.SERVICE_OPS_EMAIL ?? "ops@demandnow.local";

    if (f.get("action") === "title") {
      if (lien.titleSearchOrder) return back("");
      try {
        const charge = await chargeCard(user.id, LIEN_TITLE_SEARCH_FEE, `Post-registration title search: ${where}`, { lienId: lien.id });
        lien.titleSearchOrder = { orderedAt: new Date().toISOString(), fee: LIEN_TITLE_SEARCH_FEE, chargeId: charge.id };
        (db.charges ??= []).push({ id: randomBytes(4).toString("hex"), at: new Date().toISOString(), amount: LIEN_TITLE_SEARCH_FEE, description: `Title search: ${where}`, stripeId: charge.id, demo: charge.demo });
      } catch (e) {
        return err((e as Error).message);
      }
      await writeDB(user.id, db);
      await sendEmail({
        to: ops,
        replyTo: db.company.email || user.email,
        subject: `Post-registration title search ${lien.id}: ${where}`,
        text: `Pull a post-registration title search.\n\nPID: ${lien.pid}\nLegal description: ${lien.legalDescription}\nRegistered owner: ${lien.owner}\nLien filed: ${lien.filedDate ?? "(not recorded yet)"}\n\nClient: ${db.company.name}, ${db.company.email || user.email}\nPaid ${money(LIEN_TITLE_SEARCH_FEE)}. Charge the LTSA costs at cost. Email the search to the client.`,
      });
      return back("title=1");
    }
    if (lien.filing) return back("");
    if (lien.filedDate) return err("This lien is already marked as filed.");
    if (!lien.pid || !lien.legalDescription) return err("Add the PID and legal description from the title search first.");

    const docs = db.progress?.[lien.id]?.docs ?? [];
    const form5 = docs.filter((d) => d.stepId === "claim").at(-1);
    const title = docs.filter((d) => d.stepId === "title").at(-1);
    if (!form5) return err("Upload your signed Claim of Lien (Form 5) in the checklist first, so we have the original to file.");
    if (form5.status === "issues") return err("Your Claim of Lien has problems flagged in red. Fix them and upload it again before we file.");

    const rush = f.get("rush") === "on";
    const quote = filingQuote();
    const proofBy = rush ? quote.rushBy : quote.standardBy;
    const deadline = lienDates(lien).find((d) => d.key === "file")!.date;
    if (proofBy > deadline && !rush && quote.rushBy <= deadline) return err(`Standard filing could land after your ${deadline} deadline. Choose rush.`);
    if (proofBy > deadline && f.get("lateOk") !== "on") return err(`We can't promise proof of filing before your ${deadline} deadline. File it yourself today through myLTSA, or send it for lawyer review.`);

    const withTitle = f.get("titleSearch") === "on";
    const fee = LIEN_FILING_FEE + (rush ? LIEN_RUSH_FEE : 0) + (withTitle ? LIEN_TITLE_SEARCH_FEE : 0);
    let chargeId: string;
    try {
      const charge = await chargeCard(user.id, fee, `Builders lien filing${rush ? " (rush)" : ""}: ${where}`, { lienId: lien.id });
      chargeId = charge.id;
      (db.charges ??= []).push({ id: randomBytes(4).toString("hex"), at: new Date().toISOString(), amount: fee, description: `Lien filing${rush ? " (rush)" : ""}: ${where}`, stripeId: charge.id, demo: charge.demo });
    } catch (e) {
      return err((e as Error).message);
    }
    lien.filing = { orderedAt: new Date().toISOString(), rush, fee, proofBy, chargeId, status: "ordered" };
    if (withTitle) lien.titleSearchOrder = { orderedAt: lien.filing.orderedAt, fee: LIEN_TITLE_SEARCH_FEE, chargeId };
    await writeDB(user.id, db);

    const ext = (m: string) => (m === "application/pdf" ? "pdf" : m === "image/png" ? "png" : "jpg");
    const attachments = [{ filename: `Claim of Lien (Form 5).${ext(form5.mime)}`, content: await readUpload(form5.file) }];
    if (title) attachments.push({ filename: `Title search.${ext(title.mime)}`, content: await readUpload(title.file) });
    await sendEmail({
      to: ops,
      replyTo: db.company.email || user.email,
      subject: `Lien filing ${rush ? "RUSH " : ""}${lien.id}: ${where}. Proof due ${proofBy}`,
      text: [
        `File this claim of lien by hand at the Land Title Office.${rush ? " RUSH." : ""}`,
        `Proof of filing due to the client by: ${proofBy}`,
        `Statutory filing deadline: ${deadline}`,
        "",
        `Claimant: ${lien.claimant} (${LIEN_ROLE_LABEL[lien.role]})`,
        `Registered owner: ${lien.owner}`,
        `PID: ${lien.pid}`,
        `Legal description: ${lien.legalDescription}`,
        lien.civicAddress ? `Civic address: ${lien.civicAddress}` : "",
        `Amount claimed: ${money(lien.amount)}`,
        lien.strata ? "STRATA PROPERTY: check the Strata Property Act s. 88 rules." : "",
        "",
        `Client: ${db.company.name}, ${db.company.email || user.email}${db.company.phone ? `, ${db.company.phone}` : ""}`,
        withTitle ? "ALSO pull a post-registration title search once filed and send it with the proof of filing." : "",
        `Paid: ${money(fee)}. Charge the LTSA fees at cost once filed.`,
        "Signed Form 5 and title search attached.",
      ].filter((l) => l !== "").join("\n"),
      attachments,
    });
    await sendEmail({
      to: db.company.email || user.email,
      subject: `We're filing your builders lien: ${where}`,
      text: `We've received your Claim of Lien for ${where} and will file it by hand at the Land Title Office.\n\nYou'll get proof of filing by ${proofBy}${rush ? " (rush)" : ""}.\n\n${withTitle ? "With the proof of filing you'll also get a post-registration title search showing where your lien ranks.\n\n" : ""}Charged to your card on file: ${money(fee)} ($${LIEN_FILING_FEE} filing service${rush ? ` + $${LIEN_RUSH_FEE} rush` : ""}${withTitle ? ` + $${LIEN_TITLE_SEARCH_FEE} title search` : ""}), plus applicable tax. The Land Title Office's filing fees are charged at cost once it's filed.\n\nTrack it here: ${appUrl(req)}/liens/${lien.id}\n\nDemand Now`,
    }).catch(() => undefined);
    return back("ordered=1");
  });
