import { promises as fs } from "fs";
import path from "path";
import type { Customer, Invoice } from "./accounting/types";
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
  letters: LetterRecord[];
  paidInvoiceIds: string[];
  reviewRequests?: { invoiceId: string; requestedAt: string }[];
  /** Matters entered by hand (or imported from a one-off), alongside the accounting sync. */
  manual?: { customers: Customer[]; invoices: Invoice[] };
}

// DATA_DIR points at a persistent disk in hosting (Render: /var/data); defaults to ./data locally.
export const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const accountDir = (accountId: string) =>
  path.join(DATA_DIR, "accounts", accountId.replace(/[^a-zA-Z0-9_-]/g, ""));

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
  try {
    return JSON.parse(await fs.readFile(path.join(accountDir(accountId), "db.json"), "utf8")) as DB;
  } catch {
    return defaultDB("Your company");
  }
}

export async function writeDB(accountId: string, db: DB): Promise<void> {
  const dir = accountDir(accountId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "db.json"), JSON.stringify(db, null, 2));
}

export async function createAccountDB(accountId: string, companyName: string, email: string) {
  const db = defaultDB(companyName);
  db.company.email = email;
  await writeDB(accountId, db);
}

export async function saveUpload(accountId: string, name: string, bytes: Uint8Array): Promise<string> {
  const dir = path.join(accountDir(accountId), "uploads");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await fs.writeFile(file, bytes);
  return file;
}

export const readUpload = (file: string) => fs.readFile(file);
