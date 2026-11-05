import { randomBytes } from "crypto";
import { money } from "@/lib/aging";
import { putFile } from "@/lib/db";
import { checkDocument } from "@/lib/doccheck";
import { appUrl, sendEmail } from "@/lib/email";
import { go } from "@/lib/http";
import { loadRow } from "@/lib/ledger";
import { jobFromToken, saveJob } from "@/lib/service";
import { writeDB, type DocCheck } from "@/lib/store";

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };

// The process server reports service: date served and the signed Certificate of Service.
// This files the certificate on the client's matter, checks it, ticks the step, sets the service date
// (which drives the Reply and default dates) and emails the client.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const token = decodeURIComponent(params.token);
  const back = (q: string) => go(req, `/serve/${encodeURIComponent(token)}?${q}`);
  const job = await jobFromToken(token);
  if (!job) return back("error=" + encodeURIComponent("This link is no longer valid."));
  const f = await req.formData();
  const servedAt = String(f.get("servedAt") ?? "");
  const file = f.get("file");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(servedAt)) return back("error=" + encodeURIComponent("Enter the date served."));
  if (!(file instanceof File) || file.size === 0 || !EXT[file.type]) return back("error=" + encodeURIComponent("Upload the signed certificate as a PDF or photo."));

  const bytes = new Uint8Array(await file.arrayBuffer());
  const key = await putFile(`${job.accountId}/serve-${job.id}-signed.${EXT[file.type]}`, bytes, file.type);
  job.signedCertificateKey = key;
  job.servedAt = servedAt;
  job.status = "served";
  job.dispatchLog.push(`${new Date().toISOString()} served ${servedAt}, certificate uploaded`);
  await saveJob(job);

  const { db, row } = await loadRow(job.accountId, job.invoiceId);
  if (row) {
    const step = row.forum.steps.find((s) => s.id === "serve");
    const p = ((db.progress ??= {})[row.invoice.id] ??= { done: [], docs: [] });
    if (step?.upload) {
      const result = await checkDocument({ bytes, mime: file.type, name: "Signed Certificate of Service" }, step.upload, {
        claimant: db.company.name,
        defendant: row.customer.name,
        amountOwing: money(row.invoice.amountDue),
        invoiceNumber: row.invoice.number,
        demandLetterDate: row.letter?.sentAt.slice(0, 10),
        forum: row.forum.name,
      });
      const doc: DocCheck = { id: randomBytes(6).toString("hex"), stepId: "serve", name: "Signed Certificate of Service (from process server)", file: key, mime: file.type, uploadedAt: new Date().toISOString(), ...result };
      p.docs.push(doc);
      if (doc.status === "pass") p.done = [...new Set([...p.done, "serve"])];
    }
    (db.servedDates ??= {})[row.invoice.id] = servedAt;
    const rec = db.serviceJobs?.find((j) => j.id === job.id);
    if (rec) {
      rec.status = "served";
      rec.servedAt = servedAt;
    }
    await writeDB(job.accountId, db);
  }
  await sendEmail({
    to: job.clientEmail,
    subject: `Served: ${job.serveOn}`,
    text: `Good news: ${job.serveOn} was served on ${servedAt}. The signed Certificate of Service is on your matter, and your Reply deadline and default-order dates are updated:\n${appUrl(req)}/cases/${job.invoiceId}#service\n\nFile the Certificate of Service at the registry.\n\nDemand Now`,
  }).catch(() => undefined);
  return back("done=1");
}
