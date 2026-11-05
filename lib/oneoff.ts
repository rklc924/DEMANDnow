import { randomBytes } from "crypto";
import type { Customer, Invoice } from "./accounting/types";
import { buildRow, type Row } from "./ledger";
import { getDoc, putDoc } from "./db";
import type { Company, DB } from "./store";

// One-off demand: no account needed. The user fills in the details (trial mode), sees what they
// will get, then pays a single fee or subscribes before the letter and the guide unlock.

export const ONE_OFF_PRICE = 75; // CAD

export interface Draft {
  id: string; // random, unguessable: the link is the access key
  createdAt: string;
  paid: boolean;
  paidAt?: string;
  paymentRef?: string;
  importedTo?: string; // account id, when converted to a subscription
  company: Company;
  debtor: Customer;
  invoice: Invoice;
}

export async function saveDraft(d: Draft) {
  await putDoc("drafts", d.id, d);
}

export async function readDraft(id: string): Promise<Draft | null> {
  return /^[a-f0-9]{24}$/.test(id) ? getDoc<Draft>("drafts", id) : null;
}

export const newDraftId = () => randomBytes(12).toString("hex");

export async function markDraftPaid(id: string, ref: string) {
  const d = await readDraft(id);
  if (!d || d.paid) return;
  d.paid = true;
  d.paidAt = new Date().toISOString();
  d.paymentRef = ref;
  await saveDraft(d);
}

/** A DB-shaped view of the draft so the same letter and rules code serves one-offs and subscribers. */
export function draftDB(d: Draft): DB {
  return {
    company: d.company,
    settings: { autoSend: false, thresholdDays: 90, responseDays: 14 },
    letters: [],
    paidInvoiceIds: [],
  };
}

export const draftRow = (d: Draft): Row => buildRow(draftDB(d), d.invoice, d.debtor);
