import { applyParty } from "./party";
import { sampleProvider } from "./accounting/sample";
import type { Customer, Invoice } from "./accounting/types";
import { bucketFor, daysOverdue, type Bucket } from "./aging";
import { getJurisdiction, limitationDate, routeForum } from "./jurisdictions";
import type { Forum } from "./jurisdictions/types";
import { readDB, type DB, type LetterRecord } from "./store";
import { collectedOn } from "./workflow";

export interface Row {
  invoice: Invoice;
  customer: Customer;
  days: number;
  bucket: Bucket;
  letter?: LetterRecord;
  forum: Forum;
  limitation: string; // YYYY-MM-DD
  daysToLimitation: number;
  paid: boolean;
  /** Money received after the matter opened, and what is still owing (lib/workflow.ts). */
  collected: number;
  balance: number;
}

const provider = sampleProvider; // phase 2: the unified accounting API connector

export function buildRow(db: DB, invoice: Invoice, customer: Customer, today = new Date()): Row {
  const j = getJurisdiction(db.company.jurisdiction);
  const days = daysOverdue(invoice.dueDate, today);
  const lim = limitationDate(j, invoice.dueDate);
  const { collected, balance } = collectedOn(db, invoice.id, invoice.amountDue);
  // Route by what's still owing, until the claim is under way: then it stays where it was started.
  const pinned = j.forums.find((f) => f.id === db.progress?.[invoice.id]?.forumId);
  return {
    invoice,
    customer,
    days,
    bucket: bucketFor(days),
    letter: db.letters.findLast((l) => l.invoiceId === invoice.id),
    forum: pinned ?? routeForum(j, collected > 0 && balance > 0 ? balance : invoice.amountDue),
    limitation: lim.toISOString().slice(0, 10),
    daysToLimitation: Math.ceil((lim.getTime() - today.getTime()) / 86_400_000),
    paid: db.paidInvoiceIds.includes(invoice.id),
    collected,
    balance,
  };
}

export async function loadRows(accountId: string, db?: DB): Promise<{ db: DB; rows: Row[] }> {
  db ??= await readDB(accountId);
  const [synced, syncedInvoices] = await Promise.all([provider.fetchCustomers(), provider.fetchOpenInvoices()]);
  const customers = [...synced, ...(db.manual?.customers ?? [])];
  const invoices = [...syncedInvoices, ...(db.manual?.invoices ?? [])];
  const byId = new Map(customers.map((c) => [c.id, c]));
  const today = new Date();
  const rows = invoices.filter((i) => byId.has(i.customerId)).map((i) => buildRow(db!, i, applyParty(byId.get(i.customerId)!, db!.parties?.[i.customerId]), today));
  rows.sort((a, b) => b.days - a.days);
  return { db, rows };
}

export async function loadRow(accountId: string, invoiceId: string) {
  const { db, rows } = await loadRows(accountId);
  return { db, row: rows.find((r) => r.invoice.id === invoiceId) };
}
