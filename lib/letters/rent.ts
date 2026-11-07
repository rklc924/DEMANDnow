import { money } from "../aging";
import type { Company } from "../store";
import { RENT_DEMAND_DAYS, ledger, tenancyRules, unitAddress, unitLine, type Tenancy } from "../tenancy";
import type { LetterContent } from "./template";

// Rent demand letters for the Landlord section, in the same voice as the firm's demand letters
// (lib/letters/template.ts). The software generates them from the rent ledger.
//   Residential: a demand for rent, not a notice to end the tenancy. It names the next lawful step
//   (the RTB's 10 Day Notice and an RTB application) and nothing beyond it.
//   Commercial: a demand under the lease to the tenant, copied to any indemnifier, reserving the
//   landlord's lease remedies.

const longDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

export const rentDemandDeadline = (t: Tenancy, sentOn = new Date()) => addDays(sentOn, RENT_DEMAND_DAYS[t.kind]);

export function buildRentDemand(t: Tenancy, company: Company, sentOn = new Date()): LetterContent {
  const asOfIso = sentOn.toISOString().slice(0, 10);
  const asOf = longDate(asOfIso);
  const deadline = longDate(t.demandDeadline && t.demandSentAt ? t.demandDeadline : rentDemandDeadline(t, sentOn));
  const l = ledger(t, asOfIso);
  const rules = tenancyRules(t.jurisdiction);
  const landlord = t.landlord || company.name;
  const residential = t.kind === "residential";
  const premises = unitLine(t);

  const statement = [
    ...l.unpaid.map((x) => ({ label: `${x.description}, due ${longDate(x.dueDate)}${x.paid ? ` (${money(x.paid)} paid)` : ""}`, amount: money(x.owing) })),
    ...(l.credit ? [{ label: "Less: unapplied payments", amount: `(${money(l.credit)})` }] : []),
    { label: `TOTAL OWING as of ${asOf}`, amount: money(Math.max(0, l.total - l.credit)), total: true },
  ];
  const contact = [company.signatory || landlord, company.phone || t.landlordPhone, company.email || t.landlordEmail].filter(Boolean).join(", ");

  const paragraphs = residential
    ? [
        `Our records show that as of ${asOf}, you owe ${landlord} ${money(l.total)} in unpaid ${l.utilities > 0 ? "rent and utilities" : "rent"} for the rental unit at ${premises}, under your tenancy agreement, as follows:`,
        `Under your tenancy agreement, rent of ${money(t.monthlyRent)} is due on day ${t.rentDueDay} of each month. We hereby demand payment of the total outstanding amount on or before ${deadline}. ${company.paymentInstructions}`,
        `If the full amount is not paid, the landlord may serve a 10 Day Notice to End Tenancy for Unpaid Rent or Utilities under the Residential Tenancy Act and apply to the ${rules.residential.tribunal} for an order of possession and a monetary order for the amount owing, including the filing fee. This letter is not a notice to end your tenancy.`,
        `If you believe this amount is not owing, or you have already paid it, please contact ${contact} before that date.`,
        "We trust you will give this matter your immediate attention.",
      ]
    : [
        `Our records show that as of ${asOf}, you owe ${landlord} ${money(l.total)} in rent and other amounts payable under the lease of the premises at ${premises}, as follows:`,
        `We hereby demand payment of the total outstanding amount on or before the close of business on ${deadline}. ${company.paymentInstructions}`,
        `If payment is not received by that date, the landlord intends to exercise its rights under the lease and at law without further notice to you, which may include distress, re-entry and termination of the lease, and a legal proceeding against you${t.guarantors?.length ? " and the indemnifier" + (t.guarantors.length > 1 ? "s" : "") : ""} to recover the arrears together with interest and costs.`,
        "Nothing in this letter, and no acceptance of any partial payment, waives any default or any of the landlord's rights under the lease, all of which are reserved.",
        `If you believe this amount is not owing, or you have already paid it, please contact ${contact} before that date.`,
        "We trust you will give this matter your immediate attention.",
      ];

  return {
    date: asOf,
    via: "VIA EMAIL & REGISTERED MAIL",
    recipient: [`ATTN: ${t.tenants.join(" and ") || "Tenant"}`, ...unitAddress(t)],
    salutation: "Dear Sir/Madam:",
    subject: residential ? `RE: Demand for payment of rent: ${premises}` : `RE: Demand for payment of rent under lease: ${premises}`,
    paragraphs,
    statement,
    statementAfter: 0,
    signoff: [
      "Yours truly,",
      "",
      landlord,
      "",
      "",
      company.signatory || t.landlordAgent || "",
      company.signatoryTitle,
      ...(t.guarantors?.length ? ["", `c: ${t.guarantors.join(", ")} (indemnifier${t.guarantors.length > 1 ? "s" : ""})`] : []),
    ],
  };
}
