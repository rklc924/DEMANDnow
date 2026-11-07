import type { ServiceMethod, ServiceRecord, Tenancy } from "./types";

// Reads the landlord forms. Only fields present in the submitted form are changed, so each card on the
// matter page can save its own section.

const METHODS: ServiceMethod[] = ["in-person", "adult", "door", "mail-slot", "registered-mail", "email"];
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const date = (v: FormDataEntryValue | null) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const num = (v: FormDataEntryValue | null) => {
  const n = Number(str(v).replace(/[$,\s]/g, ""));
  return str(v) && Number.isFinite(n) && n >= 0 ? n : undefined;
};
const list = (v: FormDataEntryValue | null) => str(v).split(/\r?\n|;/).map((x) => x.trim()).filter(Boolean);
const bool = (v: FormDataEntryValue | null) => (str(v) === "yes" ? true : str(v) === "no" ? false : undefined);

export { str, date, num };

const TEXT = ["landlord", "landlordAgent", "landlordAddress", "landlordPhone", "landlordEmail", "tenantPhone", "tenantEmail", "unit", "street", "city", "postalCode", "rtbFileNumber", "forwardingAddress"] as const;
const DATES = ["startDate", "securityDepositPaid", "petDepositPaid", "lastRentIncrease", "utilitiesDemandDate", "noticeSignedDate", "noticeEffectiveDate", "applicationDate", "packageAvailableDate", "orderDate", "possessionDate", "ordersServedDate", "remedyDate", "tenancyEndDate", "forwardingAddressDate"] as const;
const NUMS = ["monthlyRent", "securityDeposit", "petDeposit", "monetaryOrderAmount"] as const;
const BOOLS = ["writtenAgreement", "stillOccupied", "tenantDisputed", "emailServiceAgreed"] as const;

function service(f: FormData, prefix: string, cur?: ServiceRecord): ServiceRecord | undefined {
  const keys = ["date", "time", "method", "servedBy", "servedTo", "address", "trackingNumber", "witness"] as const;
  if (!keys.some((k) => f.has(`${prefix}.${k}`))) return cur;
  const s: ServiceRecord = { ...cur };
  for (const k of keys) {
    const name = `${prefix}.${k}`;
    if (!f.has(name)) continue;
    if (k === "date") s.date = date(f.get(name));
    else if (k === "method") s.method = METHODS.includes(str(f.get(name)) as ServiceMethod) ? (str(f.get(name)) as ServiceMethod) : undefined;
    else s[k] = str(f.get(name)) || undefined;
  }
  return s;
}

export function applyForm(t: Tenancy, f: FormData) {
  const rec = t as unknown as Record<string, unknown>;
  for (const k of TEXT) if (f.has(k)) rec[k] = k === "landlord" || k === "street" || k === "city" || k === "landlordAddress" ? str(f.get(k)) : str(f.get(k)) || undefined;
  for (const k of DATES) if (f.has(k)) rec[k] = date(f.get(k));
  for (const k of NUMS) if (f.has(k)) rec[k] = k === "monthlyRent" ? num(f.get(k)) ?? t.monthlyRent : num(f.get(k));
  for (const k of BOOLS) if (f.has(k)) rec[k] = bool(f.get(k));
  if (f.has("tenants")) t.tenants = list(f.get("tenants"));
  if (f.has("guarantors")) t.guarantors = list(f.get("guarantors"));
  if (f.has("rentDueDay")) {
    const d = Math.round(num(f.get("rentDueDay")) ?? t.rentDueDay);
    t.rentDueDay = Math.min(31, Math.max(1, d || 1));
  }
  if (f.has("graceDays")) t.graceDays = num(f.get("graceDays"));
  if (f.has("remedy")) t.remedy = (["distress", "reentry", "sue"] as const).find((r) => r === str(f.get("remedy")));
  t.noticeService = service(f, "notice", t.noticeService);
  t.packageService = service(f, "package", t.packageService);
}
