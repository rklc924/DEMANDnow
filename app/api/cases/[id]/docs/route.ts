import { randomBytes } from "crypto";
import { checkDocument } from "@/lib/doccheck";
import { go, withUser } from "@/lib/http";
import { money } from "@/lib/aging";
import { loadRow } from "@/lib/ledger";
import { saveUpload, writeDB, type DocCheck } from "@/lib/store";

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };

// Upload proof for a step (filed claim, certificate of service, ...), check it, and tick the step if it passes.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const back = (q = "") => go(req, `/cases/${params.id}${q}#steps`);
    const f = await req.formData();
    const stepId = String(f.get("step") ?? "");
    const file = f.get("file");
    const { db, row } = await loadRow(user.id, params.id);
    const step = row?.forum.steps.find((s) => s.id === stepId);
    if (!row || !step?.upload || !(file instanceof File) || file.size === 0) return back();

    const bytes = new Uint8Array(await file.arrayBuffer());
    const id = randomBytes(6).toString("hex");
    const saved = await saveUpload(user.id, `case-${params.id.replace(/\W/g, "")}-${stepId}-${id}.${EXT[file.type] ?? "bin"}`, bytes);
    const result = await checkDocument({ bytes, mime: file.type, name: file.name }, step.upload, {
      claimant: db.company.name,
      defendant: row.customer.name,
      amountOwing: money(row.invoice.amountDue),
      invoiceNumber: row.invoice.number,
      demandLetterDate: row.letter?.sentAt.slice(0, 10),
      forum: row.forum.name,
    });
    const doc: DocCheck = { id, stepId, name: file.name, file: saved, mime: file.type, uploadedAt: new Date().toISOString(), ...result };
    const p = ((db.progress ??= {})[params.id] ??= { done: [], docs: [] });
    p.docs.push(doc);
    if (doc.status === "pass") p.done = [...new Set([...p.done, stepId])];
    await writeDB(user.id, db);
    return back(`?checked=${stepId}`);
  });
