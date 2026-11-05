import { randomBytes } from "crypto";
import { money } from "@/lib/aging";
import { checkDocument } from "@/lib/doccheck";
import { go, withUser } from "@/lib/http";
import { LIEN_STEPS, lienDates } from "@/lib/liens";
import { readDB, saveUpload, writeDB, type DocCheck } from "@/lib/store";

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };

export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const back = (q = "") => go(req, `/liens/${params.id}${q}#steps`);
    const f = await req.formData();
    const stepId = String(f.get("step") ?? "");
    const file = f.get("file");
    const db = await readDB(user.id);
    const lien = db.liens?.find((l) => l.id === params.id);
    const step = LIEN_STEPS.find((s) => s.id === stepId);
    if (!lien || !step?.upload || !(file instanceof File) || file.size === 0) return back();

    const bytes = new Uint8Array(await file.arrayBuffer());
    const id = randomBytes(6).toString("hex");
    const saved = await saveUpload(user.id, `lien-${lien.id}-${stepId}-${id}.${EXT[file.type] ?? "bin"}`, bytes);
    const deadline = lienDates(lien).find((d) => d.key === "file");
    const result = await checkDocument({ bytes, mime: file.type, name: file.name }, step.upload, {
      claimant: lien.claimant,
      defendant: `${lien.owner} (registered owner)${lien.pid ? `, PID ${lien.pid}` : ""}${lien.legalDescription ? `, ${lien.legalDescription}` : ""}${lien.civicAddress ? `, ${lien.civicAddress}` : ""}`,
      amountOwing: money(lien.amount),
      invoiceNumber: `builders lien for ${lien.workDescription || "work on the property"}, last supplied ${lien.lastWorkDate}${deadline ? `; filing deadline ${deadline.date}` : ""}`,
      forum: "BC Land Title Office, Builders Lien Act",
    });
    const doc: DocCheck = { id, stepId, name: file.name, file: saved, mime: file.type, uploadedAt: new Date().toISOString(), ...result };
    const p = ((db.progress ??= {})[lien.id] ??= { done: [], docs: [] });
    p.docs.push(doc);
    if (doc.status === "pass") p.done = [...new Set([...p.done, stepId])];
    await writeDB(user.id, db);
    return back(`?checked=${stepId}`);
  });
