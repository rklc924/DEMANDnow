import { promises as fs } from "fs";
import path from "path";

// Minimal JSON file store for the prototype. Swap for Postgres (Prisma) in phase 2; callers only use these functions.

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

export interface DB {
  company: Company;
  settings: Settings;
  letters: LetterRecord[];
  paidInvoiceIds: string[];
  reviewRequests?: { invoiceId: string; requestedAt: string }[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const DEFAULT_DB: DB = {
  company: {
    name: "Coastal Millwork & Supply Ltd.",
    signatory: "Alex Morgan",
    signatoryTitle: "Accounts Receivable Manager",
    phone: "604-555-0142",
    email: "ar@coastalmillwork.example",
    paymentInstructions: "Pay by e-transfer to ar@coastalmillwork.example, or by cheque payable to Coastal Millwork & Supply Ltd.",
    jurisdiction: "BC",
  },
  settings: { autoSend: false, thresholdDays: 90, responseDays: 14 },
  letters: [],
  paidInvoiceIds: [],
};

export async function readDB(): Promise<DB> {
  try {
    return JSON.parse(await fs.readFile(DB_FILE, "utf8")) as DB;
  } catch {
    return structuredClone(DEFAULT_DB);
  }
}

export async function writeDB(db: DB): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

export async function saveUpload(name: string, bytes: Uint8Array): Promise<string> {
  const dir = path.join(DATA_DIR, "uploads");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await fs.writeFile(file, bytes);
  return file;
}

export const readUpload = (file: string) => fs.readFile(file);
