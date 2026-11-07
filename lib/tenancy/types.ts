import type { EnforcementStep } from "../jurisdictions/types";

// Landlord section: rent arrears for residential tenancies (tribunal route, the RTB in BC) and commercial
// leases (debt claim routed by amount, plus lease remedies). Each province gets a rules pack like
// lib/tenancy/bc.ts; adding Alberta means adding ab.ts and listing it in lib/tenancy/index.ts.

export type TenancyKind = "residential" | "commercial";

/** How a notice or package was served. Deemed-received days come from the rules pack. */
export type ServiceMethod = "in-person" | "adult" | "door" | "mail-slot" | "registered-mail" | "email";

export interface Charge {
  id: string;
  /** YYYY-MM-DD the amount was due. */
  dueDate: string;
  kind: "rent" | "utilities" | "other";
  description: string;
  amount: number;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

/** Who served a document, when and how. Feeds the proof-of-service forms. */
export interface ServiceRecord {
  date?: string;
  time?: string;
  method?: ServiceMethod;
  servedBy?: string;
  /** Name of the person the document was handed to (tenant, or the adult who lives with them). */
  servedTo?: string;
  /** Address where it was served or mailed. */
  address?: string;
  trackingNumber?: string;
  witness?: string;
}

export interface Tenancy {
  id: string;
  createdAt: string;
  kind: TenancyKind;
  jurisdiction: string;

  // Landlord (the applicant)
  landlord: string;
  landlordAgent?: string;
  landlordAddress: string; // address for service, one line per row
  landlordPhone?: string;
  landlordEmail?: string;

  // Tenant(s)
  tenants: string[];
  tenantPhone?: string;
  tenantEmail?: string;
  /** Residential: the tenant agreed in writing to be served by email (tenancy agreement or RTB-51). */
  emailServiceAgreed?: boolean;
  /** Commercial: indemnifiers or guarantors named in the lease. */
  guarantors?: string[];

  // Rental unit or premises
  unit?: string;
  street: string;
  city: string;
  postalCode?: string;

  // Tenancy terms
  startDate?: string;
  writtenAgreement?: boolean;
  monthlyRent: number;
  rentDueDay: number;
  securityDeposit?: number;
  securityDepositPaid?: string;
  petDeposit?: number;
  petDepositPaid?: string;
  /** Residential: date of the last Notice of Rent Increase, if rent has gone up since the agreement. */
  lastRentIncrease?: string;
  stillOccupied?: boolean;
  /** Commercial: days rent may be unpaid before the lease allows re-entry (lease's proviso). */
  graceDays?: number;

  charges: Charge[];
  payments: Payment[];

  // Utilities (residential): written demand, then 30 days before they can go on the 10 Day Notice
  utilitiesDemandDate?: string;

  // Rent demand letter
  demandSentAt?: string;
  demandDeadline?: string;

  // Residential: 10 Day Notice (RTB-30) and its service (RTB-34)
  noticeSignedDate?: string;
  noticeEffectiveDate?: string;
  noticeService?: ServiceRecord;
  tenantDisputed?: boolean;

  // Residential: Direct Request (RTB-12L-DR, RTB-46) and service of the package (RTB-44)
  applicationDate?: string;
  rtbFileNumber?: string;
  packageAvailableDate?: string;
  packageService?: ServiceRecord;

  // Decision
  orderDate?: string;
  possessionDate?: string;
  monetaryOrderAmount?: number;
  ordersServedDate?: string;

  // Commercial lease remedy chosen
  remedy?: "distress" | "reentry" | "sue";
  remedyDate?: string;

  // End of tenancy
  tenancyEndDate?: string;
  forwardingAddress?: string;
  forwardingAddressDate?: string;

  satisfied?: boolean;
  reviewRequestedAt?: string;
}

export interface TenancyDate {
  key: string;
  label: string;
  date: string;
  basis: string;
  done?: boolean;
  estimate?: boolean;
}

export interface RtbForm {
  code: string;
  title: string;
  use: string;
  url?: string;
}

export interface ResidentialRules {
  tribunal: string;
  tribunalShort: string;
  /** Days after service each method is treated as received. */
  deemedDays: Record<ServiceMethod, number>;
  methodLabel: Record<ServiceMethod, string>;
  /** Tenant's window to pay in full or dispute after receiving the notice. */
  payOrDisputeDays: number;
  /** Earliest effective date of the notice, counted from receipt. */
  noticeDays: number;
  /** Days after a written demand before unpaid utilities can be treated as rent. */
  utilitiesDemandDays: number;
  /** Days to serve the tribunal's package once it is available. */
  packageServeDays: number;
  filingFee: number;
  /** Days after the later of tenancy end and forwarding address to return or claim the deposit. */
  depositDays: number;
  limitationYears: number;
  /** Most a tenancy agreement can set as a late-payment fee. */
  maxLateFee: number;
  forms: Record<string, RtbForm>;
  steps: EnforcementStep[];
  links: { label: string; url: string }[];
}

export interface CommercialRules {
  defaultGraceDays: number;
  steps: EnforcementStep[];
  remedies: { id: "distress" | "reentry" | "sue"; title: string; detail: string; verify?: boolean }[];
  links: { label: string; url: string }[];
}

export interface TenancyRules {
  code: string;
  name: string;
  residential: ResidentialRules;
  commercial: CommercialRules;
  disclaimer: string;
}
