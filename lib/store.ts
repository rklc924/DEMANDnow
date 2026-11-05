import { getDoc, getFile, putDoc, putFile } from "./db";
import type { Customer, Invoice } from "./accounting/types";
import type { Lien } from "./liens";
import type { Interval, PlanId } from "./plans";

// Minimal JSON file store for the prototype, one file per account. Swap for Postgres (Prisma)
// in phase 2; callers only use these functions.

export interface Company {
  name: string;
  signatory: string;
  signatoryTitle: string;
  phone: string;
  email: string;
  paymentInstructions: string;
  jurisdiction: string;
  letterhead?: { file: string; mime: string };
}

export interface Settings {
  autoSend: boolean; // business debtors only; consumers always need review
  thresholdDays: number;
  responseDays: number;
}

export interface LetterRecord {
  id: string;
  invoiceId: string;
  sentAt: string;
  channel: "email" | "mail";
  mode: "manual" | "auto";
  deadline: string;
  /** Set when the letter was emailed from the customer's own connected mailbox. */
  emailedVia?: MailProvider | "demo";
  emailedTo?: string;
  deliveryError?: string;
}

export interface DocCheck {
  id: string;
  stepId: string;
  name: string;
  file: string;
  mime: string;
  uploadedAt: string;
  /** pass = every requirement met; issues = at least one not met or unclear; unchecked = automatic check unavailable. */
  status: "pass" | "issues" | "unchecked";
  summary: string;
  checks: { requirement: string; result: "met" | "not_met" | "unclear"; note: string }[];
}

export interface CaseProgress {
  done: string[]; // step ids
  docs: DocCheck[];
}

export type MailProvider = "microsoft" | "google";

/** The customer's own mailbox and calendar, connected by OAuth. Tokens are stored encrypted (lib/crypto.ts). */
export interface Mailbox {
  provider: MailProvider;
  address: string;
  connectedAt: string;
  demo?: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number; // epoch ms
  sendEmail: boolean;
  addReminders: boolean;
}

export interface Reminder {
  id: string;
  invoiceId: string;
  date: string; // YYYY-MM-DD, all-day
  title: string;
  detail: string;
  eventId?: string; // id in the connected calendar
}

export interface Subscription {
  plan: PlanId;
  interval: Interval;
  status: "active" | "canceled";
  startedAt: string;
  renewsAt: string;
  stripeSubscriptionId?: string;
}

export interface DB {
  company: Company;
  settings: Settings;
  subscription?: Subscription;
  stripeCustomerId?: string;
  /** Card on file, required for every account. Only display details are stored; Stripe holds the card. */
  card?: { brand: string; last4: string; expMonth?: number; expYear?: number; addedAt: string; paymentMethodId?: string; demo?: boolean };
  /** Process-server bookings (full records live in the jobs table). */
  serviceJobs?: { id: string; invoiceId: string; createdAt: string; status: string; total: number; areaId: string; servedAt?: string }[];
  /** Date the starting document was served, per matter (from the server's report or entered by the client). */
  servedDates?: Record<string, string>;
  /** One-time charges against the card on file (process servers, add-ons). */
  charges?: { id: string; at: string; amount: number; description: string; stripeId?: string; demo?: boolean }[];
  letters: LetterRecord[];
  paidInvoiceIds: string[];
  reviewRequests?: { invoiceId: string; requestedAt: string }[];
  mailbox?: Mailbox;
  reminders?: Reminder[];
  /** Paid add-ons. */
  addons?: { liens?: { since: string } };
  liens?: Lien[];
  /** Per matter (invoice id or lien id): ticked steps and documents uploaded for steps that need outside proof. */
  progress?: Record<string, CaseProgress>;
  /** Demo mode only: what would have been emailed. */
  outbox?: { to: string; subject: string; at: string }[];
  /** Matters entered by hand (or imported from a one-off), alongside the accounting sync. */
  manual?: { customers: Customer[]; invoices: Invoice[] };
}

export { DATA_DIR } from "./db";

const defaultDB = (companyName: string): DB => ({
  company: {
    name: companyName,
    signatory: "",
    signatoryTitle: "",
    phone: "",
    email: "",
    paymentInstructions: `Pay by e-transfer, or by cheque payable to ${companyName}.`,
    jurisdiction: "BC",
  },
  settings: { autoSend: false, thresholdDays: 90, responseDays: 14 },
  letters: [],
  paidInvoiceIds: [],
});

export async function readDB(accountId: string): Promise<DB> {
  return (await getDoc<DB>("accounts", accountId)) ?? defaultDB("Your company");
}

export async function writeDB(accountId: string, db: DB): Promise<void> {
  await putDoc("accounts", accountId, db);
}

export async function createAccountDB(accountId: string, companyName: string, email: string) {
  const db = defaultDB(companyName);
  db.company.email = email;
  await writeDB(accountId, db);
}

const MIME: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg" };

/** Saves an uploaded file for an account and returns the key to store on the record. */
export async function saveUpload(accountId: string, name: string, bytes: Uint8Array): Promise<string> {
  const ext = name.split(".").pop() ?? "";
  return putFile(`${accountId.replace(/[^a-zA-Z0-9_-]/g, "")}/${name}`, bytes, MIME[ext] ?? "application/octet-stream");
}

export const readUpload = (key: string) => getFile(key);
