import type { EnforcementStep } from "./jurisdictions/types";

// Builders lien add-on (BC Builders Lien Act, S.B.C. 1997, c. 45). For contractors, subtrades, workers and
// suppliers who improved land and haven't been paid. Deadlines follow LSBC checklist E-6 (current to Sept 4, 2025):
//   s. 20: file the claim of lien no later than 45 days after a certificate of completion is filed, or the head
//          contract or improvement is completed, abandoned or terminated (next day the LTO is open if it falls on a weekend/holiday)
//   s. 33: start an action and register a certificate of pending litigation within 1 year of filing the lien,
//          or within 21 days after being served with a notice to commence an action
// Wording is our own summary. Items marked verify need a lawyer's check before launch.

// Filing service (Rocky, Nov 2026): we file the claim of lien by hand at the Land Title Office.
// $250 per lien plus LTSA filing fees at cost. Proof of filing within 5 business days.
// Rush: proof within 1 to 3 business days if ordered before 12 PM Pacific, for $100 more.
export const LIEN_FILING_FEE = 250;
export const LIEN_RUSH_FEE = 100;
export const LIEN_STANDARD_DAYS = 5;
export const LIEN_RUSH_DAYS = 3;
/** Post-registration title search: confirms the lien is on title and shows what ranks ahead of it. Plus LTSA costs. */
export const LIEN_TITLE_SEARCH_FEE = 50;

export interface LienFilingOrder {
  orderedAt: string;
  rush: boolean;
  fee: number;
  /** Latest business day we promise proof of filing by, YYYY-MM-DD. */
  proofBy: string;
  chargeId?: string;
  status: "ordered" | "filed";
}

const pacific = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
};
const isWeekday = (iso: string) => ![0, 6].includes(new Date(iso + "T12:00:00Z").getUTCDay());
const addDay = (iso: string) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
export function addBusinessDays(iso: string, n: number) {
  let d = iso;
  while (n > 0) { d = addDay(d); if (isWeekday(d)) n--; }
  return d;
}

/** When proof of filing is due if ordered at `now`. Orders after 12 PM Pacific, or on a weekend, count from the next business day. */
export function filingQuote(now = new Date()) {
  const { date, hour } = pacific(now);
  const sameDay = isWeekday(date) && hour < 12;
  const start = sameDay ? date : addBusinessDays(date, 1);
  // Counting from the start day: day 1 is the start day itself.
  const by = (n: number) => addBusinessDays(start, n - 1);
  return { beforeNoon: sameDay, standardBy: by(LIEN_STANDARD_DAYS), rushBy: by(LIEN_RUSH_DAYS) };
}

export type LienRole = "contractor" | "subcontractor" | "worker" | "supplier";

export interface Lien {
  id: string;
  createdAt: string;
  role: LienRole;
  claimant: string;
  hiredBy: string; // who you contracted with
  owner: string; // registered owner, from the title search
  civicAddress: string;
  pid: string;
  legalDescription: string;
  workDescription: string;
  amount: number;
  /** Critical dates, YYYY-MM-DD. */
  lastWorkDate: string;
  completionCertificateDate?: string;
  headContractEndDate?: string; // completed, abandoned or terminated
  strata?: boolean;
  filedDate?: string;
  noticeToCommenceServedDate?: string;
  satisfied?: boolean;
  filing?: LienFilingOrder;
  titleSearchOrder?: { orderedAt: string; fee: number; chargeId?: string };
}

export const LIEN_ROLE_LABEL: Record<LienRole, string> = {
  contractor: "General contractor (hired by the owner)",
  subcontractor: "Subcontractor or subtrade",
  worker: "Worker (wages owed)",
  supplier: "Material supplier",
};

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
/** Weekend roll-forward. Statutory holidays aren't modelled, so these are flagged "confirm". */
const nextOpenDay = (iso: string) => {
  let d = iso;
  while ([0, 6].includes(new Date(d + "T00:00:00Z").getUTCDay())) d = addDays(d, 1);
  return d;
};

export interface LienDate {
  key: string;
  label: string;
  date: string;
  basis: string;
  estimate?: boolean;
  done?: boolean;
}

export function lienDates(l: Lien): LienDate[] {
  const out: LienDate[] = [];
  const triggers = [l.completionCertificateDate, l.headContractEndDate].filter(Boolean) as string[];
  const trigger = triggers.sort()[0];
  const filingBase = trigger ?? l.lastWorkDate;
  out.push({
    key: "file",
    label: "Last day to file the claim of lien",
    date: nextOpenDay(addDays(filingBase, 45)),
    basis: trigger
      ? `45 days after ${trigger === l.completionCertificateDate ? "the certificate of completion was filed" : "the head contract ended"} (s. 20)`
      : "Estimated as 45 days after your last day of work. The real deadline runs from completion, abandonment or termination of the head contract, or a certificate of completion, which can be earlier. File sooner if you can.",
    estimate: !trigger,
    done: !!l.filedDate,
  });
  if (l.filedDate) {
    out.push({ key: "action", label: "Start a court action and register a certificate of pending litigation", date: addYears(l.filedDate, 1), basis: "1 year after the lien was filed, or the lien expires (s. 33)" });
  }
  if (l.noticeToCommenceServedDate) {
    out.push({ key: "notice", label: "Respond to the 21-day notice to commence an action", date: addDays(l.noticeToCommenceServedDate, 21), basis: "21 days after you were served (s. 33). If you miss it, the owner can clear the lien from title." });
  }
  if (l.headContractEndDate) {
    out.push({ key: "trust", label: "Last day for a trust claim", date: addYears(l.headContractEndDate, 1), basis: "1 year after the head contract was completed, abandoned or terminated", estimate: true });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export const LIEN_STEPS: EnforcementStep[] = [
  {
    id: "dates",
    title: "Confirm your critical dates",
    detail: "Your last day of work or supply, and whether a certificate of completion has been filed or the head contract has ended. These set the 45-day filing deadline.",
  },
  {
    id: "title",
    title: "Get a current title search for the property",
    detail: "Order it from LTSA (myLTSA) to confirm the registered owner, PID and legal description. The claim of lien must match the title exactly.",
    upload: {
      label: "Title search (LTSA)",
      requirements: [
        "Is a current BC Land Title Office title search",
        "Shows the parcel identifier (PID) and legal description",
        "Shows the registered owner, matching the owner named on this lien",
        "Is dated within the last 7 days",
      ],
    },
  },
  {
    id: "claim",
    title: "Prepare the Claim of Lien (Form 5)",
    detail: "The app fills Form 5 from your details: claimant, owner, PID and legal description, the work, and the amount owing. The person with knowledge of the facts signs it.",
    document: "Claim of Lien (Form 5) data sheet",
    verify: true,
    upload: {
      label: "Your signed Claim of Lien (Form 5)",
      requirements: [
        "Is a Builders Lien Act Form 5 Claim of Lien",
        "PID and legal description match the title search",
        "Owner's name matches the registered owner on title",
        "Claimant's full legal name and address for service are given",
        "Describes the work or materials and the period supplied",
        "Amount claimed matches the amount owing and is not inflated",
        "Is signed",
      ],
    },
  },
  {
    id: "file",
    title: "File the Claim of Lien at the Land Title Office before the deadline",
    detail: "File electronically through a myLTSA account or a filing agent and pay the fee. Enter the filing date here to start the one-year clock.",
    verify: true,
    upload: {
      label: "Registration confirmation or title showing the lien",
      requirements: [
        "Shows the claim of lien registered against the correct PID",
        "Shows the registration number and date",
        "Registration date is on or before the 45-day deadline",
      ],
    },
  },
  {
    id: "priority",
    title: "Pull a post-registration title search to see where your lien ranks",
    detail: "Once the lien is filed, get a fresh title search. It confirms your lien is registered against the right property, and shows every mortgage and charge registered ahead of it. Those generally get paid first if the property is sold, so this tells you how much security you really have and whether it's worth pushing to court. We can pull it for $50 plus Land Title Office costs.",
    upload: {
      label: "Post-registration title search",
      requirements: [
        "Is a BC Land Title Office title search dated on or after the lien's filing date",
        "Shows the claim of lien registered against the correct PID",
        "Lists the mortgages, liens and other charges registered on title, so priority can be assessed",
      ],
    },
  },
  {
    id: "notify",
    title: "Send the owner a copy and a demand for payment",
    detail: "Send a copy of the filed lien with a demand letter. Many liens are paid or bonded off at this stage.",
  },
  {
    id: "watch",
    title: "Watch for a 21-day notice to commence an action",
    detail: "If the owner serves one, you must start a court action within 21 days or the lien can be removed. Enter the date you were served here immediately.",
    verify: true,
  },
  {
    id: "action",
    title: "Start the court action and register a certificate of pending litigation",
    detail: "Within one year of filing (or 21 days after a notice to commence). This is Supreme Court work: send the file for lawyer review well before the deadline.",
    verify: true,
  },
];
