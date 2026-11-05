import { randomBytes } from "crypto";
import type { Customer, Invoice } from "./accounting/types";
import { newDraftId, saveDraft, type Draft } from "./oneoff";
import { readDB, writeDB, type Company } from "./store";
import { usage } from "./usage";

// Matters handed in from outside the portal: an AI assistant over MCP (lib/mcp.ts) or a prefilled
// /start link. The same payment rules apply as in the portal: subscribers get the matter on their
// dashboard (and it counts against the plan when the letter is sent); everyone else gets a one-off
// draft that unlocks after the $75 payment or a subscription. Nothing is generated or sent here.

export interface MatterInput {
  debtorName: string;
  debtorKind: "business" | "consumer";
  debtorEmail?: string;
  debtorAddress?: string[];
  amount: number;
  dueDate: string;
  invoiceNumber?: string;
  issueDate?: string;
  interestRate?: number;
  description?: string;
  /** Used when the account has no company details yet (one-off drafts). */
  creditor?: Partial<Pick<Company, "name" | "signatory" | "signatoryTitle" | "phone" | "email" | "paymentInstructions">>;
}

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const num = (v: unknown) => (typeof v === "number" ? v : Number(String(v ?? "").replace(/[$,\s]/g, "")));

/** Normalises loose input (from an AI tool call or query string). Throws a message the caller can show. */
export function parseMatter(a: Record<string, unknown>): MatterInput {
  const debtorName = str(a.debtor_name, 160);
  const amount = num(a.amount_owing);
  const dueDate = str(a.due_date, 10);
  const problems: string[] = [];
  if (!debtorName) problems.push("debtor_name is required");
  if (!(amount > 0) || amount > 10_000_000) problems.push("amount_owing must be a positive amount in CAD");
  if (!isDate(dueDate)) problems.push("due_date must be a date in YYYY-MM-DD format");
  const issueDate = str(a.invoice_date, 10);
  if (issueDate && !isDate(issueDate)) problems.push("invoice_date must be YYYY-MM-DD");
  const rate = a.interest_rate === undefined || a.interest_rate === "" ? undefined : num(a.interest_rate);
  if (rate !== undefined && !(rate >= 0 && rate <= 60)) problems.push("interest_rate must be an annual percentage between 0 and 60");
  if (problems.length) throw new Error(`Some details are missing or invalid: ${problems.join("; ")}.`);

  // An address on one line ("123 Main St, Kelowna, BC V1Y 1A1") becomes street + city lines.
  let addr = Array.isArray(a.debtor_address) ? a.debtor_address.map((l) => str(l)) : str(a.debtor_address, 400).split(/\r?\n/);
  if (addr.length === 1 && addr[0].includes(",")) addr = [addr[0].slice(0, addr[0].indexOf(",")), addr[0].slice(addr[0].indexOf(",") + 1)];
  const c = (a.creditor ?? {}) as Record<string, unknown>;
  return {
    debtorName,
    debtorKind: ["individual", "consumer", "person"].includes(str(a.debtor_type).toLowerCase()) ? "consumer" : "business",
    debtorEmail: str(a.debtor_email, 160) || undefined,
    debtorAddress: addr.map((l) => l.trim()).filter(Boolean).slice(0, 6),
    amount: Math.round(amount * 100) / 100,
    dueDate,
    invoiceNumber: str(a.invoice_number, 60) || undefined,
    issueDate: issueDate || undefined,
    interestRate: rate && rate > 0 ? rate : undefined,
    description: str(a.description, 200) || undefined,
    creditor: {
      name: str(c.name, 160) || undefined,
      signatory: str(c.signatory, 120) || undefined,
      signatoryTitle: str(c.signatory_title, 120) || undefined,
      phone: str(c.phone, 40) || undefined,
      email: str(c.email, 160) || undefined,
      paymentInstructions: str(c.payment_instructions, 400) || undefined,
    },
  };
}

function records(m: MatterInput, id: string): { debtor: Customer; invoice: Invoice } {
  const debtor: Customer = { id: `c-${id}`, name: m.debtorName, kind: m.debtorKind, email: m.debtorEmail ?? "", address: m.debtorAddress ?? [] };
  const invoice: Invoice = {
    id: `m-${id}`,
    number: m.invoiceNumber || "the account",
    customerId: debtor.id,
    issueDate: m.issueDate || m.dueDate,
    dueDate: m.dueDate,
    amountDue: m.amount,
    interestRate: m.interestRate,
    description: m.description || "goods and services",
  };
  return { debtor, invoice };
}

export type IntakeResult =
  | { kind: "matter"; invoiceId: string; path: string; duplicate: boolean; lettersLeft: number | null; companyIncomplete: string[] }
  | { kind: "draft"; draftId: string; path: string };

/** Adds the matter for a signed-in user: to their dashboard with an active plan, otherwise as a one-off draft. */
export async function createMatterForUser(userId: string, m: MatterInput, source: string): Promise<IntakeResult> {
  const db = await readDB(userId);
  const u = usage(db);

  if (!u.plan) {
    const id = newDraftId();
    const { debtor, invoice } = records(m, id);
    const company: Company = {
      ...db.company,
      name: db.company.name === "Your company" && m.creditor?.name ? m.creditor.name : db.company.name,
      signatory: db.company.signatory || m.creditor?.signatory || "",
      signatoryTitle: db.company.signatoryTitle || m.creditor?.signatoryTitle || "",
      phone: db.company.phone || m.creditor?.phone || "",
      email: db.company.email || m.creditor?.email || "",
      paymentInstructions: m.creditor?.paymentInstructions || db.company.paymentInstructions,
    };
    const draft: Draft = { id, createdAt: new Date().toISOString(), paid: false, company, debtor, invoice };
    await saveDraft(draft);
    return { kind: "draft", draftId: id, path: `/start/${id}` };
  }

  // Same debtor, amount and invoice number already entered: return it rather than adding a second matter.
  const manual = (db.manual ??= { customers: [], invoices: [] });
  const existing = manual.invoices.find((i) => {
    const c = manual.customers.find((x) => x.id === i.customerId);
    return c?.name.toLowerCase() === m.debtorName.toLowerCase() && i.amountDue === m.amount && i.number === (m.invoiceNumber || "the account");
  });
  const companyIncomplete = [
    !db.company.signatory && "the signer's name",
    !db.company.phone && "a phone number",
    !db.company.letterhead && "a letterhead",
  ].filter((x): x is string => !!x);
  const lettersLeft = u.remaining === Infinity ? null : u.remaining;
  if (existing) return { kind: "matter", invoiceId: existing.id, path: `/cases/${existing.id}`, duplicate: true, lettersLeft, companyIncomplete };

  const { debtor, invoice } = records(m, randomBytes(6).toString("hex"));
  manual.customers.push(debtor);
  manual.invoices.push(invoice);
  (db.matterSource ??= {})[invoice.id] = source;
  await writeDB(userId, db);
  return { kind: "matter", invoiceId: invoice.id, path: `/cases/${invoice.id}`, duplicate: false, lettersLeft, companyIncomplete };
}

/** Query-string keys /start accepts to prefill the one-off form, for assistants and sites without the connector. */
export const PREFILL_KEYS = [
  "companyName", "signatory", "signatoryTitle", "phone", "email", "paymentInstructions",
  "debtorName", "debtorKind", "debtorEmail", "debtorAddress",
  "invoiceNumber", "amount", "dueDate", "issueDate", "interestRate", "description",
] as const;
