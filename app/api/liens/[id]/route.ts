import { acct } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

const date = (v: FormDataEntryValue | null) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

// Updates a lien's critical dates (only fields present in the form) or marks it satisfied.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const db = await readDB(acct(user));
    const l = db.liens?.find((x) => x.id === params.id);
    if (!l) return go(req, "/liens");
    for (const k of ["lastWorkDate", "completionCertificateDate", "headContractEndDate", "filedDate", "noticeToCommenceServedDate"] as const) {
      if (f.has(k)) {
        const v = date(f.get(k));
        if (k === "lastWorkDate") l.lastWorkDate = v ?? l.lastWorkDate;
        else l[k] = v;
      }
    }
    if (f.has("satisfied")) l.satisfied = f.get("satisfied") === "1";
    if (l.filedDate) {
      const p = ((db.progress ??= {})[l.id] ??= { done: [], docs: [] });
      p.done = [...new Set([...p.done, "dates", "file"])];
    }
    await writeDB(acct(user), db);
    return go(req, `/liens/${l.id}?saved=1`);
  });
