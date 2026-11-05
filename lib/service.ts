import { createHash, randomBytes } from "crypto";
import { certificateOfServicePdf } from "./certificate";
import { getDoc, putDoc } from "./db";
import { appUrl, sendEmail, sendSms } from "./email";
import type { Row } from "./ledger";
import type { Company } from "./store";

// Process-server bookings. A Lower Mainland booking is charged to the client's card on file, then sent to our
// process server by email (documents attached, last known address, pre-filled Certificate of Service) and by
// text (with a secure link to the job page, where the server can also upload the signed certificate).
// Other areas go to the operations inbox for a quote.
//
// Env: PROCESS_SERVER_EMAIL, PROCESS_SERVER_PHONE (E.164, e.g. +16045551234), SERVICE_OPS_EMAIL.

export interface ServiceJob {
  id: string;
  accountId: string;
  invoiceId: string;
  createdAt: string;
  areaId: string;
  rush: boolean;
  serverFee: number;
  bookingFee: number;
  total: number;
  chargeId?: string;
  status: "requested" | "quote" | "dispatched" | "served" | "failed";
  serveOn: string;
  isCompany: boolean;
  address: string[];
  contactNotes: string;
  courtFileNo: string;
  registry: string;
  claimant: string;
  clientEmail: string;
  clientPhone: string;
  /** Upload keys for the documents to serve, plus the generated certificate. */
  files: { name: string; key: string; mime: string }[];
  /** Hash of the token in the server's link. */
  tokenHash: string;
  servedAt?: string;
  signedCertificateKey?: string;
  dispatchLog: string[];
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export const readJob = (id: string) => getDoc<ServiceJob>("jobs", id);
export const saveJob = (j: ServiceJob) => putDoc("jobs", j.id, j);

/** Looks up a job from the token in the process server's link. */
export async function jobFromToken(token: string): Promise<ServiceJob | null> {
  const [id, raw] = token.split(".");
  if (!id || !raw) return null;
  const job = await readJob(id);
  return job && job.tokenHash === sha(raw) ? job : null;
}

export function newJob(input: Omit<ServiceJob, "id" | "createdAt" | "tokenHash" | "dispatchLog" | "status" | "files">): { job: ServiceJob; token: string } {
  const id = randomBytes(6).toString("hex");
  const raw = randomBytes(24).toString("base64url");
  return {
    job: { ...input, id, createdAt: new Date().toISOString(), tokenHash: sha(raw), dispatchLog: [], status: "requested", files: [] },
    token: `${id}.${raw}`,
  };
}

export async function buildCertificate(job: ServiceJob, documents: string[]) {
  return certificateOfServicePdf({
    courtFileNo: job.courtFileNo,
    registry: job.registry,
    claimant: job.claimant,
    defendant: job.serveOn,
    serveOn: job.serveOn,
    address: job.address,
    documents,
    isCompany: job.isCompany,
  });
}

/** Sends the job to the process server by email and text. Records what happened on the job. */
export async function dispatch(req: Request, job: ServiceJob, token: string, attachments: { filename: string; content: Uint8Array }[]) {
  const link = `${appUrl(req)}/serve/${encodeURIComponent(token)}`;
  const to = process.env.PROCESS_SERVER_EMAIL ?? "process-server@example.com";
  const phone = process.env.PROCESS_SERVER_PHONE;
  const lines = [
    `New service job ${job.id}${job.rush ? " (RUSH: attempt within 24 hours)" : ""}`,
    ``,
    `Serve: ${job.serveOn}${job.isCompany ? " (company)" : ""}`,
    `Last known address:`,
    ...job.address.map((a) => `  ${a}`),
    job.contactNotes ? `Notes from the client: ${job.contactNotes}` : "",
    ``,
    `Court file no.: ${job.courtFileNo || "see the filed Notice of Claim"}${job.registry ? `, ${job.registry} registry` : ""}`,
    `Claimant: ${job.claimant}`,
    ``,
    `Attached: ${attachments.map((a) => a.filename).join(", ")}.`,
    `The Certificate of Service is pre-filled. Complete the blanks, sign it, and upload it (or a photo of it) here once served:`,
    link,
    ``,
    `Fee: $${job.serverFee}${job.rush ? " including rush" : ""}. Client contact: ${job.clientEmail}${job.clientPhone ? `, ${job.clientPhone}` : ""}.`,
  ].filter((l) => l !== "");
  try {
    await sendEmail({ to, subject: `Service job ${job.id}: ${job.serveOn}${job.rush ? " (RUSH)" : ""}`, text: lines.join("\n"), attachments, replyTo: job.clientEmail });
    job.dispatchLog.push(`${new Date().toISOString()} email sent to ${to}`);
  } catch (e) {
    job.dispatchLog.push(`${new Date().toISOString()} email FAILED: ${(e as Error).message}`);
  }
  if (phone) {
    try {
      await sendSms(phone, `Demand Now service job${job.rush ? " (RUSH)" : ""}: ${job.serveOn}, ${job.address.join(", ")}. Documents and certificate: ${link}`);
      job.dispatchLog.push(`${new Date().toISOString()} text sent to ${phone}`);
    } catch (e) {
      job.dispatchLog.push(`${new Date().toISOString()} text FAILED: ${(e as Error).message}`);
    }
  } else {
    job.dispatchLog.push(`${new Date().toISOString()} no PROCESS_SERVER_PHONE set; text not sent`);
  }
  job.status = job.dispatchLog.some((l) => l.includes("email sent")) ? "dispatched" : "failed";
}

/** For areas outside the Lower Mainland: send the request to operations for a quote. No charge yet. */
export async function requestQuote(req: Request, job: ServiceJob, row: Row, company: Company) {
  const to = process.env.SERVICE_OPS_EMAIL ?? process.env.PROCESS_SERVER_EMAIL ?? "ops@example.com";
  await sendEmail({
    to,
    subject: `Quote request: service on ${job.serveOn} (${job.areaId})`,
    text: `${company.name} (${job.clientEmail}) asks for a quote to serve ${job.serveOn} at:\n${job.address.join("\n")}\n\nInvoice ${row.invoice.number}. Notes: ${job.contactNotes || "none"}\nRush: ${job.rush ? "yes" : "no"}\n\nReply to the client with a price.`,
    replyTo: job.clientEmail,
  });
  job.status = "quote";
  job.dispatchLog.push(`${new Date().toISOString()} quote request sent to ${to}`);
}
