import { acct } from "@/lib/auth";
import { randomBytes } from "crypto";
import { money } from "@/lib/aging";
import { checkDocument } from "@/lib/doccheck";
import { go, withUser } from "@/lib/http";
import { readDB, saveUpload, writeDB, type DocCheck } from "@/lib/store";
import { commercialForum, ledger, tenancyRules, unitLine } from "@/lib/tenancy";

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };

// Uploads proof for a checklist step (signed RTB-30, proof of service, RTB decision...) and checks it.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const back = (q = "") => go(req, `/landlord/${params.id}${q}#steps`);
    const f = await req.formData();
    const stepId = String(f.get("step") ?? "");
    const file = f.get("file");
    const db = await readDB(acct(user));
    const t = db.tenancies?.find((x) => x.id === params.id);
    if (!t) return go(req, "/landlord");
    const rules = tenancyRules(t.jurisdiction);
    const step = rules[t.kind].steps.find((s) => s.id === stepId);
    if (!step?.upload || !(file instanceof File) || file.size === 0) return back();

    const bytes = new Uint8Array(await file.arrayBuffer());
    const id = randomBytes(6).toString("hex");
    const saved = await saveUpload(acct(user), `tenancy-${t.id}-${stepId}-${id}.${EXT[file.type] ?? "bin"}`, bytes);
    const l = ledger(t);
    const result = await checkDocument({ bytes, mime: file.type, name: file.name }, step.upload, {
      claimant: `${t.landlord} (landlord)`,
      defendant: `${t.tenants.join(", ")} (tenant${t.tenants.length > 1 ? "s" : ""}), ${unitLine(t)}`,
      amountOwing: `${money(l.total)} (rent ${money(l.rent)}, utilities ${money(l.utilities)})`,
      invoiceNumber: `rent arrears since ${l.oldest ?? "n/a"}, monthly rent ${money(t.monthlyRent)} due on day ${t.rentDueDay}${t.rtbFileNumber ? `; RTB file ${t.rtbFileNumber}` : ""}`,
      demandLetterDate: t.demandSentAt?.slice(0, 10),
      forum: t.kind === "residential" ? `BC ${rules.residential.tribunal}, Residential Tenancy Act` : `Commercial lease; arrears claim in the ${commercialForum(t).name}`,
    });
    const doc: DocCheck = { id, stepId, name: file.name, file: saved, mime: file.type, uploadedAt: new Date().toISOString(), ...result };
    const p = ((db.progress ??= {})[t.id] ??= { done: [], docs: [] });
    p.docs.push(doc);
    if (doc.status === "pass") p.done = [...new Set([...p.done, stepId])];
    await writeDB(acct(user), db);
    return back(`?checked=${stepId}`);
  });
