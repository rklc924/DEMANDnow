import { money } from "../aging";
import { BC } from "../jurisdictions/bc";
import { routeForum } from "../jurisdictions";
import type { Forum } from "../jurisdictions/types";
import { BC_TENANCY } from "./bc";
import type { Charge, ServiceMethod, ServiceRecord, Tenancy, TenancyDate, TenancyRules } from "./types";

export * from "./types";

export const TENANCY_RULES: Record<string, TenancyRules> = { BC: BC_TENANCY };

export function tenancyRules(code = "BC"): TenancyRules {
  const r = TENANCY_RULES[code];
  if (!r) throw new Error(`No landlord rules pack for jurisdiction ${code}`);
  return r;
}

export const KIND_LABEL = { residential: "Residential tenancy", commercial: "Commercial lease" } as const;

/** Days a rent demand letter gives the tenant to pay. */
export const RENT_DEMAND_DAYS = { residential: 5, commercial: 10 } as const;

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const addYears = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

export const unitAddress = (t: Pick<Tenancy, "unit" | "street" | "city" | "postalCode">) =>
  [[t.unit, t.street].filter(Boolean).join(" - "), [t.city, "BC", t.postalCode].filter(Boolean).join(" ")].filter(Boolean);

export const unitLine = (t: Pick<Tenancy, "unit" | "street" | "city" | "postalCode">) => unitAddress(t).join(", ");

export interface LedgerLine extends Charge {
  paid: number;
  owing: number;
  lastPaidOn?: string;
}

/** Applies payments to the oldest charges first, the way the RTB worksheet reads. */
export function ledger(t: Tenancy, asOf = today()) {
  const charges = [...t.charges].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const payments = [...t.payments].sort((a, b) => a.date.localeCompare(b.date));
  const lines: LedgerLine[] = charges.map((c) => ({ ...c, paid: 0, owing: c.amount }));
  for (const p of payments) {
    let left = p.amount;
    for (const l of lines) {
      if (left <= 0) break;
      if (l.owing <= 0) continue;
      const take = Math.min(l.owing, left);
      l.paid = round(l.paid + take);
      l.owing = round(l.owing - take);
      l.lastPaidOn = p.date;
      left = round(left - take);
    }
  }
  const due = lines.filter((l) => l.dueDate <= asOf);
  const owing = (k?: Charge["kind"]) => round(due.filter((l) => !k || l.kind === k).reduce((s, l) => s + l.owing, 0));
  const unpaid = due.filter((l) => l.owing > 0);
  const credit = round(Math.max(0, payments.reduce((s, p) => s + p.amount, 0) - lines.reduce((s, l) => s + l.amount, 0)));
  return {
    lines,
    total: owing(),
    rent: owing("rent"),
    utilities: owing("utilities"),
    other: owing("other"),
    credit,
    /** Oldest unpaid due date: when the arrears started. */
    oldest: unpaid[0]?.dueDate,
    unpaid,
  };
}
const round = (n: number) => Math.round(n * 100) / 100;

/** Rent charges for each month from `from` (a due date) for `months` months. */
export function monthlyCharges(from: string, months: number, rent: number, dueDay: number): Charge[] {
  const out: Charge[] = [];
  const [y, m] = from.split("-").map(Number);
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    const due = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(dueDay, last)).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });
    out.push({ id: `C${due}${i}`, dueDate: due, kind: "rent", description: `Rent for ${label}`, amount: rent });
  }
  return out;
}

/** The day a served document counts as received. */
export function deemedReceived(rules: TenancyRules, s?: ServiceRecord) {
  if (!s?.date || !s.method) return undefined;
  return addDays(s.date, rules.residential.deemedDays[s.method]);
}

/** Earliest effective date for a 10 Day Notice served today (or on `serveOn`) by `method`. */
export function earliestEffectiveDate(rules: TenancyRules, method: ServiceMethod, serveOn = today()) {
  return addDays(addDays(serveOn, rules.residential.deemedDays[method]), rules.residential.noticeDays);
}

/** Forum for a commercial arrears claim. Rocky's BC rule: CRT under $5,000, Small Claims to $35,000, lawyer above. */
export function commercialForum(t: Tenancy): Forum {
  return routeForum(BC, Math.max(0, ledger(t).total));
}

export function tenancyDates(t: Tenancy): TenancyDate[] {
  const rules = tenancyRules(t.jurisdiction);
  const r = rules.residential;
  const out: TenancyDate[] = [];
  const l = ledger(t);
  if (t.demandDeadline) {
    out.push({ key: "demand", label: "Payment deadline in your rent demand letter", date: t.demandDeadline, basis: "The date you gave the tenant to pay", done: l.total <= 0 });
  }

  if (t.kind === "residential") {
    if (t.utilitiesDemandDate) {
      out.push({ key: "utilities", label: "Unpaid utilities can go on a 10 Day Notice", date: addDays(t.utilitiesDemandDate, r.utilitiesDemandDays), basis: `${r.utilitiesDemandDays} days after your written demand for utilities`, done: !!t.noticeService?.date });
    }
    const received = deemedReceived(rules, t.noticeService);
    if (received && t.noticeService?.method) {
      const payBy = addDays(received, r.payOrDisputeDays);
      out.push({ key: "received", label: "Tenant is treated as having received the 10 Day Notice", date: received, basis: `${r.methodLabel[t.noticeService.method]}: counts as received ${r.deemedDays[t.noticeService.method] === 0 ? "the same day" : `${r.deemedDays[t.noticeService.method]} days after service`}`, done: true, estimate: true });
      out.push({ key: "pay-or-dispute", label: "Tenant's last day to pay in full or dispute the notice", date: payBy, basis: `${r.payOrDisputeDays} days after receiving the notice`, done: payBy < today() });
      out.push({ key: "effective", label: "Notice takes effect (tenant must move out)", date: t.noticeEffectiveDate && t.noticeEffectiveDate > addDays(received, r.noticeDays) ? t.noticeEffectiveDate : addDays(received, r.noticeDays), basis: `No earlier than ${r.noticeDays} days after the tenant receives it. An earlier date on the form is corrected automatically to this date.`, estimate: true });
      if (!t.applicationDate && !t.tenantDisputed) {
        out.push({ key: "apply", label: "Earliest day to apply for a Direct Request", date: addDays(payBy, 1), basis: "Once the 5 days pass without full payment or a dispute", done: false });
      }
    }
    if (t.packageAvailableDate) {
      out.push({ key: "serve-package", label: "Serve the Direct Request package on each tenant", date: addDays(t.packageAvailableDate, r.packageServeDays), basis: `Within ${r.packageServeDays} days after the RTB makes the package available`, done: !!t.packageService?.date });
    }
    if (t.tenancyEndDate) {
      const base = [t.tenancyEndDate, t.forwardingAddressDate].filter(Boolean).sort().at(-1)!;
      if (t.forwardingAddressDate) {
        out.push({ key: "deposit", label: "Return the deposits or apply to the RTB to keep them", date: addDays(base, r.depositDays), basis: `${r.depositDays} days after the later of the end of the tenancy and the tenant's forwarding address in writing`, estimate: true });
      }
      out.push({ key: "limitation", label: "Last day to apply to the RTB for the unpaid rent", date: addYears(t.tenancyEndDate, r.limitationYears), basis: `${r.limitationYears} years after the tenancy ends`, estimate: true });
    }
  } else {
    const grace = t.graceDays ?? rules.commercial.defaultGraceDays;
    if (l.oldest) {
      out.push({ key: "reentry", label: "Lease's re-entry right may arise", date: addDays(l.oldest, grace), basis: `Rent unpaid ${grace} days after it was due (check your lease's own default clause)`, estimate: true, done: !!t.remedyDate });
      out.push({ key: "limitation", label: "Limitation date for the oldest unpaid rent", date: addYears(l.oldest, BC.limitation.years), basis: `${BC.limitation.years} years after the rent was due (Limitation Act). Part payment or a written acknowledgment can extend it.`, estimate: true });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---- RTB form data sheets -------------------------------------------------------------------------
// Everything a landlord needs to fill each RTB form, from the details on the matter page. Missing values
// are flagged so the landlord can fill them in before printing or applying.

export interface SheetField {
  label: string;
  value?: string;
  /** Where on the page to fill it in, shown when missing. */
  fix?: string;
}

export interface FormSheet {
  code: string;
  title: string;
  use: string;
  url?: string;
  fields: SheetField[];
  table?: { head: string[]; rows: string[][] };
}

const fmt = (iso?: string) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) : undefined;
const yes = (b?: boolean) => (b === undefined ? undefined : b ? "Yes" : "No");
const lines = (s?: string) => (s ? s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).join(", ") : undefined);

function serviceFields(rules: TenancyRules, s: ServiceRecord | undefined, section: string): SheetField[] {
  const r = rules.residential;
  return [
    { label: "Date served", value: fmt(s?.date), fix: section },
    { label: "Time served", value: s?.time, fix: section },
    { label: "How it was served", value: s?.method ? r.methodLabel[s.method] : undefined, fix: section },
    { label: "Served by", value: s?.servedBy, fix: section },
    { label: "Name of the person served", value: s?.servedTo ?? (s?.method === "door" || s?.method === "mail-slot" ? "Not applicable (attached or left at the unit)" : undefined), fix: section },
    { label: "Address where served or mailed (or email address)", value: s?.address, fix: section },
    ...(s?.method === "registered-mail" ? [{ label: "Registered mail tracking number", value: s?.trackingNumber, fix: section }] : []),
    { label: "Witness (recommended)", value: s?.witness ?? "", fix: section },
  ];
}

export function rtbSheets(t: Tenancy): FormSheet[] {
  const rules = tenancyRules(t.jurisdiction);
  const r = rules.residential;
  const f = r.forms;
  const l = ledger(t);
  const addr = unitLine(t);
  const tenants = t.tenants.join("; ");
  const rentDue = l.unpaid.filter((x) => x.kind === "rent");
  const lastRentDue = rentDue.at(-1)?.dueDate;
  const effective = t.noticeService?.date && t.noticeService.method ? tenancyDates(t).find((d) => d.key === "effective")?.date : t.noticeEffectiveDate;
  const fullAddress = (s: string) => lines(s);

  const landlordFields: SheetField[] = [
    { label: "Landlord name(s)", value: t.landlord, fix: "Landlord" },
    { label: "Agent (if one acts for the landlord)", value: t.landlordAgent ?? "", fix: "Landlord" },
    { label: "Landlord address for service", value: fullAddress(t.landlordAddress), fix: "Landlord" },
    { label: "Landlord phone", value: t.landlordPhone, fix: "Landlord" },
    { label: "Landlord email", value: t.landlordEmail ?? "", fix: "Landlord" },
  ];

  const sheets: FormSheet[] = [
    {
      ...f["RTB-30"],
      fields: [
        { label: "Tenant name(s), every tenant on the agreement", value: tenants || undefined, fix: "Tenants" },
        { label: "Rental unit address (unit, street, city, postal code)", value: t.street && t.city && t.postalCode ? addr : undefined, fix: "Rental unit" },
        { label: "Rent owing", value: l.rent > 0 ? money(l.rent) : undefined, fix: "Rent ledger" },
        { label: "Rent was due on", value: fmt(lastRentDue ?? l.oldest), fix: "Rent ledger" },
        { label: "Utilities owing (after a written demand)", value: l.utilities > 0 ? money(l.utilities) : "None", fix: "Rent ledger" },
        ...(l.utilities > 0 ? [{ label: "Date of the written demand for utilities", value: fmt(t.utilitiesDemandDate), fix: "Utilities" }] : []),
        { label: "Effective date (tenant must move out by)", value: fmt(effective), fix: "10 Day Notice" },
        ...landlordFields,
        { label: "Date signed", value: fmt(t.noticeSignedDate), fix: "10 Day Notice" },
        { label: "Signature", value: "Sign by hand on the printed form" },
      ],
    },
    {
      ...f["RTB-34"],
      fields: [
        { label: "Document served", value: l.utilities > 0 ? "10 Day Notice to End Tenancy (RTB-30) and written demand to pay utilities" : "10 Day Notice to End Tenancy (RTB-30)" },
        { label: "Tenant(s) served", value: tenants || undefined, fix: "Tenants" },
        { label: "Rental unit address", value: addr || undefined, fix: "Rental unit" },
        ...serviceFields(rules, t.noticeService, "10 Day Notice"),
        { label: "Signature of the person who served", value: "Sign by hand" },
      ],
    },
    {
      ...f["RTB-46"],
      fields: [
        { label: "Landlord", value: t.landlord, fix: "Landlord" },
        { label: "Tenant(s)", value: tenants || undefined, fix: "Tenants" },
        { label: "Rental unit address", value: addr || undefined, fix: "Rental unit" },
        { label: "Monthly rent under the tenancy agreement", value: t.monthlyRent ? money(t.monthlyRent) : undefined, fix: "Tenancy terms" },
        { label: "Rent is due on day", value: t.rentDueDay ? String(t.rentDueDay) : undefined, fix: "Tenancy terms" },
        { label: "Rent increased since the agreement? Date of the last Notice of Rent Increase", value: t.lastRentIncrease ? fmt(t.lastRentIncrease) : "No increase", fix: "Tenancy terms" },
        { label: "Date the 10 Day Notice was served, and how", value: t.noticeService?.date && t.noticeService.method ? `${fmt(t.noticeService.date)}, ${r.methodLabel[t.noticeService.method].toLowerCase()}` : undefined, fix: "10 Day Notice" },
        { label: "Total rent owing", value: money(l.rent) },
        { label: "Total utilities owing", value: money(l.utilities) },
      ],
      table: {
        head: ["Rent or utility period", "Date due", "Amount due", "Amount paid", "Date paid", "Balance owing"],
        rows: l.lines.filter((x) => x.kind !== "other").map((x) => [x.description, fmt(x.dueDate)!, money(x.amount), money(x.paid), x.paid ? fmt(x.lastPaidOn) ?? "" : "", money(x.owing)]),
      },
    },
    {
      ...f["RTB-12L-DR"],
      fields: [
        ...landlordFields,
        { label: "Tenant name(s)", value: tenants || undefined, fix: "Tenants" },
        { label: "Tenant phone", value: t.tenantPhone ?? "", fix: "Tenants" },
        { label: "Tenant email", value: t.tenantEmail ?? "", fix: "Tenants" },
        { label: "Dispute address (rental unit)", value: t.street && t.city && t.postalCode ? addr : undefined, fix: "Rental unit" },
        { label: "Tenancy start date", value: fmt(t.startDate), fix: "Tenancy terms" },
        { label: "Written tenancy agreement", value: yes(t.writtenAgreement), fix: "Tenancy terms" },
        { label: "Monthly rent and day due", value: t.monthlyRent ? `${money(t.monthlyRent)}, due on day ${t.rentDueDay}` : undefined, fix: "Tenancy terms" },
        { label: "Security deposit held, and date paid", value: t.securityDeposit ? `${money(t.securityDeposit)}${t.securityDepositPaid ? `, paid ${fmt(t.securityDepositPaid)}` : ""}` : "None", fix: "Tenancy terms" },
        { label: "Pet damage deposit held, and date paid", value: t.petDeposit ? `${money(t.petDeposit)}${t.petDepositPaid ? `, paid ${fmt(t.petDepositPaid)}` : ""}` : "None", fix: "Tenancy terms" },
        { label: "Is the tenant still living in the unit?", value: yes(t.stillOccupied), fix: "Tenancy terms" },
        { label: "10 Day Notice served on, and how", value: t.noticeService?.date && t.noticeService.method ? `${fmt(t.noticeService.date)}, ${r.methodLabel[t.noticeService.method].toLowerCase()}` : undefined, fix: "10 Day Notice" },
        { label: "Did the tenant pay in full or dispute within 5 days?", value: t.tenantDisputed ? "Disputed: a Direct Request isn't available, apply for a hearing (RTB-12L-CT)" : l.total > 0 ? "No" : "Paid in full", fix: "10 Day Notice" },
        { label: "Claim: order of possession for unpaid rent or utilities", value: "Yes" },
        { label: "Claim: monetary order for unpaid rent", value: money(l.rent) },
        { label: "Claim: monetary order for unpaid utilities", value: money(l.utilities) },
        { label: "Claim: recover the filing fee", value: money(r.filingFee) },
        { label: "Documents to upload", value: "10 Day Notice (RTB-30), Proof of Service (RTB-34), Direct Request Worksheet (RTB-46), tenancy agreement and addenda, any Notices of Rent Increase" + (l.utilities > 0 ? ", the written utilities demand and the bills" : "") },
      ],
    },
    {
      ...f["RTB-44"],
      fields: [
        { label: "RTB file number", value: t.rtbFileNumber, fix: "Direct Request" },
        { label: "Date the package became available", value: fmt(t.packageAvailableDate), fix: "Direct Request" },
        { label: "Tenant(s) served", value: tenants || undefined, fix: "Tenants" },
        ...serviceFields(rules, t.packageService, "Direct Request"),
        { label: "Documents served", value: "Notice of Dispute Resolution Proceeding (Direct Request) with copies of every document you submitted" },
        { label: "Signature of the person who served", value: "Sign by hand" },
      ],
    },
  ];
  return sheets;
}

export const missingCount = (s: FormSheet) => s.fields.filter((f) => f.value === undefined).length;
