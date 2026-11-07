import { randomBytes } from "crypto";
import { money } from "./aging";
import { appUrl, sendEmail } from "./email";
import { loadRows } from "./ledger";
import type { DB } from "./store";

// Swearing, affirming and notarizing (Rocky, Nov 2026). Any document that has to be sworn or affirmed before a
// commissioner for taking affidavits, or notarized, gets two options:
//   1. Go to a local partner (listed below, or we refer one near the user). No charge from us.
//   2. Book a mobile notary or commissioner who comes to the user: $50 per page, plus travel costs, which
//      we confirm before the appointment and which may be extra.
//
// Reusable: mark a checklist step with `witness` (EnforcementStep in lib/jurisdictions/types.ts) and the
// Checklist renders the options under it. Any other screen can render <WitnessOptions> from app/witness.tsx.
// New kinds of matter (e.g. landlord files) add a resolver to MATTERS so bookings are tied to a real record.
//
// Env (set in Render, never in the repo): WITNESS_OPS_EMAIL (falls back to SERVICE_OPS_EMAIL).

export const WITNESS_PAGE_FEE = 50;

export type WitnessKind = "commissioner" | "notary";

/** What a step's document needs. Put this on an EnforcementStep as `witness`. */
export interface WitnessNeed {
  kind: WitnessKind;
  /** The document to be sworn or notarized, as the user knows it. */
  document: string;
  /** One line on what the signer does in front of the commissioner or notary. */
  note?: string;
}

export const WITNESS_KIND_LABEL: Record<WitnessKind, string> = {
  commissioner: "sworn or affirmed before a commissioner for taking affidavits",
  notary: "notarized by a notary public",
};

export const WITNESS_WHO: Record<WitnessKind, string> = {
  commissioner: "commissioner",
  notary: "notary",
};

/** Local partners who swear and notarize documents. Add real partners here as agreements are signed. */
export interface WitnessPartner {
  name: string;
  city: string;
  address: string;
  phone?: string;
  url?: string;
  kinds: WitnessKind[];
}
export const WITNESS_PARTNERS: WitnessPartner[] = [];

export type WitnessMode = "mobile" | "partner";

export interface WitnessJob {
  id: string;
  createdAt: string;
  /** The matter it belongs to, e.g. "case:<invoiceId>" or "lien:<lienId>". */
  matter: string;
  stepId?: string;
  document: string;
  kind: WitnessKind;
  mode: WitnessMode;
  pages: number;
  /** Page fee charged at booking. Travel is confirmed and charged separately. */
  fee: number;
  chargeId?: string;
  signer: string;
  address: string[];
  city: string;
  times: string;
  notes: string;
  status: "booked" | "referral";
}

type MatterResolver = (accountId: string, db: DB, id: string) => Promise<string | null>;

/** Looks up a matter so bookings can only be made against the account's own records. Returns a label, or null. */
const MATTERS: Record<string, MatterResolver> = {
  case: async (accountId, db, id) => {
    const { rows } = await loadRows(accountId, db);
    const row = rows.find((r) => r.invoice.id === id);
    return row ? `invoice ${row.invoice.number}, ${row.customer.name}` : null;
  },
  lien: async (_a, db, id) => {
    const l = db.liens?.find((x) => x.id === id);
    return l ? `builders lien at ${l.civicAddress || `PID ${l.pid}`}` : null;
  },
};

/** Lets another part of the app (e.g. landlord files) register its kind of matter. */
export function registerWitnessMatter(type: string, resolve: MatterResolver) {
  MATTERS[type] = resolve;
}

export async function matterLabel(accountId: string, db: DB, matter: string): Promise<string | null> {
  const [type, id, ...rest] = matter.split(":");
  if (!type || !id || rest.length || !/^[\w-]+$/.test(id)) return null;
  return (await MATTERS[type]?.(accountId, db, id)) ?? null;
}

export const witnessFee = (pages: number) => pages * WITNESS_PAGE_FEE;

export function newWitnessJob(input: Omit<WitnessJob, "id" | "createdAt" | "status" | "fee">): WitnessJob {
  return {
    ...input,
    id: randomBytes(6).toString("hex"),
    createdAt: new Date().toISOString(),
    status: input.mode === "mobile" ? "booked" : "referral",
    fee: input.mode === "mobile" ? witnessFee(input.pages) : 0,
  };
}

/** Emails operations to arrange the appointment or the referral, and confirms to the client. */
export async function sendWitnessRequest(req: Request, job: WitnessJob, ctx: { company: string; clientEmail: string; clientPhone?: string; matterLabel: string; back: string }) {
  const to = process.env.WITNESS_OPS_EMAIL ?? process.env.SERVICE_OPS_EMAIL ?? "ops@example.com";
  const who = WITNESS_WHO[job.kind];
  const mobile = job.mode === "mobile";
  const lines = [
    mobile ? `Mobile ${who} booking ${job.id}` : `Partner referral request ${job.id}`,
    ``,
    `Client: ${ctx.company} (${ctx.clientEmail}${ctx.clientPhone ? `, ${ctx.clientPhone}` : ""})`,
    `Matter: ${ctx.matterLabel}`,
    `Document: ${job.document} (${WITNESS_KIND_LABEL[job.kind]})`,
    mobile ? `Pages: ${job.pages}. Page fee charged: ${money(job.fee)}.` : "",
    job.signer ? `Person signing: ${job.signer}` : "",
    mobile ? `Attend at:` : `Near: ${job.city}`,
    ...(mobile ? job.address.map((a) => `  ${a}`) : []),
    job.times ? `Preferred times: ${job.times}` : "",
    job.notes ? `Notes: ${job.notes}` : "",
    ``,
    mobile
      ? `Assign a ${who}, confirm the appointment and any travel cost with the client before attending. The signer must bring government photo ID and the unsigned document.`
      : `Reply to the client with a partner ${who} near ${job.city}.`,
  ].filter((l) => l !== "");
  await sendEmail({ to, subject: mobile ? `Mobile ${who}: ${ctx.company}, ${job.city || job.address.at(-1) || ""}` : `Partner ${who} referral: ${ctx.company}, ${job.city}`, text: lines.join("\n"), replyTo: ctx.clientEmail });
  await sendEmail({
    to: ctx.clientEmail,
    subject: mobile ? `Mobile ${who} booked: ${job.document}` : `We'll refer you to a ${who} near ${job.city}`,
    text: mobile
      ? `We've asked a mobile ${who} to come to you for your ${job.document}.\n\nCharged to your card on file: ${money(job.fee)} (${job.pages} page${job.pages === 1 ? "" : "s"} at ${money(WITNESS_PAGE_FEE)}), plus applicable tax. If travel costs apply, we'll tell you the amount and confirm the appointment time with you before anything more is charged.\n\nOn the day, have the unsigned document and government photo ID ready. Don't sign it before the ${who} arrives.\n\n${appUrl(req)}${ctx.back}\n\nDemand Now`
      : `We'll email you the name and address of a partner ${who} near ${job.city}, usually within one business day. Take the unsigned document and government photo ID with you, and don't sign it before you're in front of the ${who}.\n\n${appUrl(req)}${ctx.back}\n\nDemand Now`,
  }).catch(() => undefined);
}
