import { acct, can } from "@/lib/auth";
import { randomBytes } from "crypto";
import { money } from "@/lib/aging";
import { appUrl, sendEmail } from "@/lib/email";
import { go, withUser } from "@/lib/http";
import { loadRow } from "@/lib/ledger";
import { COMPANY_SEARCH_FEE, lines, readCompanySearch, type Party, type PartyType } from "@/lib/party";
import { saveUpload, writeDB, logActivity, readDB } from "@/lib/store";
import { chargeCard } from "@/lib/stripe";

const TYPES: PartyType[] = ["company", "individual", "sole-prop"];
const EXT: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

// The other party's legal name and address: save it, read an uploaded company search, or order one ($50 + registry fees).
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const back = (q: string) => go(req, `/cases/${params.id}?${q}#party`);
    const f = await req.formData();
    const { db, row } = await loadRow(acct(user), params.id);
    if (!row) return go(req, "/");
    const cid = row.customer.id;
    const parties = (db.parties ??= {});
    const fallbackType: PartyType = row.customer.kind === "business" ? "company" : "individual";
    const p: Party = (parties[cid] ??= { type: fallbackType, legalName: "" });
    const action = str(f.get("action"));

    if (action === "order") {
      if (!can(user, "orderServices")) return back("partyError=" + encodeURIComponent("Your admin hasn't given you access to order paid services."));
      if (p.searchOrder) return back("party=ordered");
      const name = str(f.get("searchName")) || p.legalName || row.customer.name;
      try {
        const charge = await chargeCard(acct(user), COMPANY_SEARCH_FEE, `Company search: ${name}`, { invoiceId: row.invoice.id });
        p.searchOrder = { orderedAt: new Date().toISOString(), fee: COMPANY_SEARCH_FEE, chargeId: charge.id };
        (db.charges ??= []).push({ id: randomBytes(4).toString("hex"), at: new Date().toISOString(), amount: COMPANY_SEARCH_FEE, description: `Company search: ${name}`, stripeId: charge.id, demo: charge.demo });
      } catch (e) {
        return back("partyError=" + encodeURIComponent((e as Error).message));
      }
      logActivity(db, user, `Ordered a company search for ${name}`, `/cases/${row.invoice.id}#party`);
      p.type = "company";
      await writeDB(acct(user), db);
      await sendEmail({
        to: process.env.SERVICE_OPS_EMAIL ?? "ops@demandnow.local",
        replyTo: db.company.email || user.email,
        subject: `Company search order: ${name}`,
        text: `Run a BC Registry company search (business summary) for:\n\n  ${name}\n  Invoice name: ${row.customer.name}\n  Address on file: ${row.customer.address.join(", ")}\n\nClient: ${db.company.name}, ${db.company.email || user.email}\nPaid: ${money(COMPANY_SEARCH_FEE)}. Charge the registry fees at cost.\n\nEmail the search PDF to the client. They upload it here and the app reads the details: ${appUrl(req)}/cases/${row.invoice.id}#party`,
      });
      await sendEmail({
        to: db.company.email || user.email,
        subject: `Company search ordered: ${name}`,
        text: `We're running a BC Registry company search for "${name}". You'll get the search by email, usually within one business day. Upload it on the matter page and we'll fill in the legal name, registered office and directors for you.\n\nCharged to your card on file: ${money(COMPANY_SEARCH_FEE)}, plus applicable tax. The registry's own search fees are charged at cost.\n\nDemand Now`,
      }).catch(() => undefined);
      return back("party=ordered");
    }

    if (action === "upload") {
      const file = f.get("file");
      if (!(file instanceof File) || file.size === 0) return back("partyError=" + encodeURIComponent("Choose the company search file."));
      const bytes = new Uint8Array(await file.arrayBuffer());
      p.searchFile = await saveUpload(acct(user), `party-${cid}-search-${randomBytes(4).toString("hex")}.${EXT[file.type] ?? "bin"}`, bytes);
      p.type = "company";
      try {
        const r = await readCompanySearch(bytes, file.type);
        if (!r) {
          await writeDB(acct(user), db);
          return back("party=manual");
        }
        Object.assign(p, {
          legalName: r.legalName || p.legalName,
          incNumber: r.incNumber || p.incNumber,
          status: r.status || p.status,
          searchDate: r.searchDate || p.searchDate,
          registeredOffice: r.registeredOffice.length ? r.registeredOffice : p.registeredOffice,
          recordsOffice: r.recordsOffice.length ? r.recordsOffice : p.recordsOffice,
          directors: r.directors.length ? r.directors : p.directors,
          howConfirmed: r.notes ? `Company search. ${r.notes}` : "Company search",
          confirmedAt: undefined, // the client reviews and confirms
        });
      } catch (e) {
        await writeDB(acct(user), db);
        return back("partyError=" + encodeURIComponent((e as Error).message));
      }
      await writeDB(acct(user), db);
      return back("party=read");
    }

    // Save and confirm.
    const type = TYPES.includes(str(f.get("type")) as PartyType) ? (str(f.get("type")) as PartyType) : p.type;
    const legalName = str(f.get("legalName"));
    if (!legalName) return back("partyError=" + encodeURIComponent("Enter the exact legal name."));
    Object.assign(p, {
      type,
      legalName,
      tradeName: str(f.get("tradeName")) || undefined,
      incNumber: str(f.get("incNumber")) || undefined,
      status: str(f.get("status")) || p.status,
      searchDate: str(f.get("searchDate")) || p.searchDate,
      registeredOffice: lines(f.get("registeredOffice")),
      recordsOffice: lines(f.get("recordsOffice")),
      directors: str(f.get("directors")).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
        const [name, ...rest] = l.split(/\s+[-–—:]\s+/);
        return { name: name.trim(), address: rest.join(" - ").trim() || undefined };
      }),
      homeAddress: lines(f.get("homeAddress")),
      howConfirmed: str(f.get("howConfirmed")) || p.howConfirmed,
      confirmedAt: new Date().toISOString(),
    });
    if (type === "company" && !p.registeredOffice?.length) return back("partyError=" + encodeURIComponent("Add the registered office address from the company search."));
    if (type !== "company" && !p.homeAddress?.length) return back("partyError=" + encodeURIComponent("Add the address where the person lives now."));
    logActivity(db, user, `Confirmed legal name: ${p.legalName}`, `/cases/${row.invoice.id}#party`);
    await writeDB(acct(user), db);
    return back("party=saved");
  });
