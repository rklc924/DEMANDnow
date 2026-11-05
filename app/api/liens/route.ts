import { acct } from "@/lib/auth";
import { randomBytes } from "crypto";
import { go, withUser } from "@/lib/http";
import type { Lien, LienRole } from "@/lib/liens";
import { readDB, writeDB } from "@/lib/store";

const date = (v: FormDataEntryValue | null) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export const POST = (req: Request) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const db = await readDB(acct(user));
    if (!db.addons?.liens) return go(req, "/liens");
    const lastWorkDate = date(f.get("lastWorkDate"));
    const amount = Number(text(f.get("amount")).replace(/[$,]/g, ""));
    if (!lastWorkDate || !text(f.get("owner")) || !(amount > 0)) {
      return go(req, `/liens?error=${encodeURIComponent("Owner, amount owing and your last day of work are required.")}#new`);
    }
    const lien: Lien = {
      id: `LN${randomBytes(4).toString("hex")}`,
      createdAt: new Date().toISOString(),
      role: (["contractor", "subcontractor", "worker", "supplier"].includes(text(f.get("role"))) ? text(f.get("role")) : "subcontractor") as LienRole,
      claimant: text(f.get("claimant")) || db.company.name,
      hiredBy: text(f.get("hiredBy")),
      owner: text(f.get("owner")),
      civicAddress: text(f.get("civicAddress")),
      pid: text(f.get("pid")),
      legalDescription: text(f.get("legalDescription")),
      workDescription: text(f.get("workDescription")),
      amount,
      lastWorkDate,
      completionCertificateDate: date(f.get("completionCertificateDate")),
      headContractEndDate: date(f.get("headContractEndDate")),
      strata: f.get("strata") === "on",
    };
    (db.liens ??= []).push(lien);
    await writeDB(acct(user), db);
    return go(req, `/liens/${lien.id}`);
  });
