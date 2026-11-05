import Anthropic from "@anthropic-ai/sdk";
import type { Customer } from "./accounting/types";

// The other party's legal identity. A demand letter, Notice of Claim, service and any judgment must name the
// debtor by its exact legal name and use an address the rules accept, or the claim can fail or a default order
// can be set aside. For a company that means a BC Registry company search: legal name, incorporation number,
// status, registered and records offices, and directors.

export const COMPANY_SEARCH_FEE = 50; // plus BC Registries fees at cost

export type PartyType = "company" | "individual" | "sole-prop";

export const PARTY_TYPE_LABEL: Record<PartyType, string> = {
  company: "Company (Ltd., Inc., Corp. or similar)",
  individual: "Individual",
  "sole-prop": "Individual trading under a business name (sole proprietor)",
};

export interface Party {
  type: PartyType;
  legalName: string;
  /** Trade name for a sole proprietor ("doing business as"). */
  tradeName?: string;
  incNumber?: string;
  status?: string;
  registeredOffice?: string[];
  recordsOffice?: string[];
  directors?: { name: string; address?: string }[];
  /** Date the company search was printed, YYYY-MM-DD. */
  searchDate?: string;
  searchFile?: string;
  searchOrder?: { orderedAt: string; fee: number; chargeId?: string };
  /** Individual: where they live now. */
  homeAddress?: string[];
  howConfirmed?: string;
  confirmedAt?: string;
}

/** Name to put on letters and court forms. */
export function partyName(p: Party) {
  return p.type === "sole-prop" && p.tradeName ? `${p.legalName}, doing business as ${p.tradeName}` : p.legalName;
}

/** Address to send to and serve at: the registered office for a company, the home address for a person. */
export function partyAddress(p: Party) {
  return (p.type === "company" ? p.registeredOffice : p.homeAddress) ?? [];
}

export function applyParty(c: Customer, p?: Party): Customer {
  if (!p?.confirmedAt || !p.legalName) return c;
  const address = partyAddress(p);
  return { ...c, name: partyName(p), address: address.length ? address : c.address, invoiceName: c.name };
}

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso + "T00:00:00").getTime()) / 86_400_000);

/** Problems to show in red before the client relies on these details. */
export function partyWarnings(p: Party | undefined, invoiceName: string): string[] {
  if (!p) return [];
  const w: string[] = [];
  if (p.type === "company") {
    if (!p.searchDate) w.push("No company search on file. The registry needs one with a claim against a company.");
    else if (daysSince(p.searchDate) > 30) w.push(`The company search is ${daysSince(p.searchDate)} days old. Get a fresh one before you file or serve, in case the registered office has moved.`);
    if (p.status && !/^active$/i.test(p.status.trim())) w.push(`The company's status is "${p.status}". If it's dissolved or struck off it can't be sued as it is. Send this for lawyer review.`);
    if (!p.registeredOffice?.length) w.push("Add the registered office address from the company search.");
    if (p.legalName && !/\b(ltd|limited|inc|incorporated|corp|corporation|ltée|ULC|LLP)\.?\s*$/i.test(p.legalName.trim()) && !/^\d{7}\s+B\.?C\.?\s+(ltd|inc)/i.test(p.legalName))
      w.push("A BC company's legal name normally ends in Ltd., Inc., Corp. or Limited. Check the name against the company search.");
  } else {
    if (!p.homeAddress?.length) w.push("Add the address where the person lives now.");
    if (/\b(ltd|limited|inc|corp)\.?\b/i.test(p.legalName)) w.push("This looks like a company name. If it's incorporated, choose Company and get a company search.");
  }
  if (p.legalName && invoiceName && norm(p.legalName) !== norm(invoiceName) && !(p.tradeName && norm(p.tradeName) === norm(invoiceName)))
    w.push(`Your invoices say "${invoiceName}". Letters and court forms will use "${partyName(p)}". Make sure that's the party you contracted with.`);
  return w;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface CompanySearchResult {
  legalName: string;
  incNumber: string;
  status: string;
  searchDate: string;
  registeredOffice: string[];
  recordsOffice: string[];
  directors: { name: string; address: string }[];
  notes: string;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["isCompanySearch", "legalName", "incNumber", "status", "searchDate", "registeredOffice", "recordsOffice", "directors", "notes"],
  properties: {
    isCompanySearch: { type: "boolean", description: "True if this is a BC Registry company search, business summary or corporate summary." },
    legalName: { type: "string", description: "Exact legal name, with punctuation, as shown." },
    incNumber: { type: "string", description: "Incorporation number, e.g. BC1234567." },
    status: { type: "string", description: "Status as shown, e.g. Active, Historical, Dissolved." },
    searchDate: { type: "string", description: "Date the search was printed or is current to, YYYY-MM-DD, or empty." },
    registeredOffice: { type: "array", items: { type: "string" }, description: "Registered office DELIVERY address, one line per item." },
    recordsOffice: { type: "array", items: { type: "string" }, description: "Records office delivery address, one line per item." },
    directors: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "address"], properties: { name: { type: "string" }, address: { type: "string" } } } },
    notes: { type: "string", description: "Anything a creditor should know: liquidation, receivership, recent office change, extraprovincial registration. Empty if nothing." },
  },
} as const;

/** Reads a BC company search PDF. Returns null when automatic reading isn't available. Throws if it isn't a company search. */
export async function readCompanySearch(bytes: Uint8Array, mime: string): Promise<CompanySearchResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const data = Buffer.from(bytes).toString("base64");
  const file: Anthropic.ContentBlockParam =
    mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: mime as "image/png" | "image/jpeg", data } };
  const res = await new Anthropic().messages.create({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    system: "You read British Columbia company search printouts (BC Registries business summaries) for a debt collection app. Copy names and addresses exactly as printed. Never guess: leave a field empty if it is not shown.",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: [file, { type: "text", text: "Extract the company's details from this search." }] }],
  });
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const r = JSON.parse(text) as CompanySearchResult & { isCompanySearch: boolean };
  if (!r.isCompanySearch) throw new Error("That file doesn't look like a BC company search. Upload the business summary from BC Registries.");
  return r;
}

export const lines = (v: FormDataEntryValue | null) =>
  typeof v === "string" ? v.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
