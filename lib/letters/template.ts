import { money } from "../aging";
import type { Row } from "../ledger";
import type { Company } from "../store";

// Demand letter wording adapted from Rocky Kim Law Corporation's own demand letters
// (general debt demand and mortgage demand precedents). Two variants:
//   "company": first-party letter on the subscriber's letterhead, in the subscriber's voice (default).
//   "firm":    lawyer letter under the firm's name, used for the review add-on and hand-offs.
// No threat goes beyond a step the creditor can lawfully take.

export type LetterVariant = "company" | "firm";

export interface LetterContent {
  date: string;
  via: string;
  recipient: string[];
  salutation: string;
  subject: string;
  paragraphs: string[];
  /** Itemized statement of the amount owing, printed as a two-column table after the first paragraphs. */
  statement: { label: string; amount: string; total?: boolean }[];
  statementAfter: number; // index of the paragraph the table follows
  signoff: string[];
}

export const FIRM = {
  name: "Rocky Kim Law Corporation",
  lawyer: "Rocky Kim",
  trustPayee: "Rocky Kim Law Corporation in Trust",
};

const longDate = (d: Date) => d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

export function deadlineFrom(responseDays: number, from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + responseDays);
  return d;
}

/** Simple contractual interest from the due date to `asOf`. Zero when the invoice terms give no rate. */
export function accruedInterest(row: Row, asOf: Date) {
  const rate = row.invoice.interestRate ?? 0;
  const due = new Date(row.invoice.dueDate + "T00:00:00");
  const days = Math.max(0, Math.floor((asOf.getTime() - due.getTime()) / 86_400_000));
  const perDiem = (row.invoice.amountDue * rate) / 100 / 365;
  return { rate, days, perDiem, amount: Math.round(perDiem * days * 100) / 100 };
}

export function buildDemandLetter(
  row: Row,
  company: Company,
  responseDays: number,
  sentOn = new Date(),
  variant: LetterVariant = "company",
): LetterContent {
  const { invoice, customer, forum } = row;
  const deadline = longDate(deadlineFrom(responseDays, sentOn));
  const asOf = longDate(sentOn);
  const interest = accruedInterest(row, sentOn);
  const total = invoice.amountDue + interest.amount;
  const firm = variant === "firm";
  const creditor = firm ? company.name : "us";

  const statement = [
    { label: `Invoice ${invoice.number}, due ${longDate(new Date(invoice.dueDate + "T00:00:00"))}`, amount: money(invoice.amountDue) },
    ...(interest.rate
      ? [{ label: `Interest at ${interest.rate}% per annum for ${interest.days} days`, amount: money(interest.amount) }]
      : []),
    { label: `TOTAL OWING as of ${asOf}`, amount: money(total), total: true },
  ];

  const consequence = forum.selfServe
    ? `a legal proceeding be brought in the ${forum.name} to recover the outstanding indebtedness together with interest and costs`
    : "a legal proceeding be brought to recover the outstanding indebtedness together with interest and costs";

  const paragraphs = firm
    ? [
        `We are the solicitors for ${company.name.replace(/\.$/, "")}. We are not your lawyers and encourage you to seek legal counsel immediately.`,
        `We are instructed by our client that as of ${asOf}, you are indebted to our client in the amount of ${money(total)}, arising out of ${invoice.description.toLowerCase()} supplied to you and invoiced under invoice ${invoice.number}, as follows:`,
        interest.rate ? `Interest continues to accrue at ${money(interest.perDiem)} per day to the date of payment.` : "",
        `On the instructions of our client, we hereby make demand for payment of the above amount. If we are not in receipt of your certified cheque or bank draft in the above noted amount, payable to ${FIRM.trustPayee}, sent to the attention of the undersigned, on or before the close of business on ${deadline}, we intend to recommend to our client that ${consequence}.`,
        "We trust you will give this matter your immediate attention.",
      ]
    : [
        `Our records show that as of ${asOf}, you are indebted to ${creditor} in the amount of ${money(total)}, arising out of ${invoice.description.toLowerCase()} supplied to you and invoiced under invoice ${invoice.number}, as follows:`,
        interest.rate ? `Interest continues to accrue under the terms of the invoice at ${money(interest.perDiem)} per day to the date of payment.` : "",
        `We hereby make demand for payment of the total outstanding amount. ${company.paymentInstructions} If payment is not received on or before the close of business on ${deadline}, we intend to take such steps without further notice to you as are necessary to recover the debt, including starting ${consequence.replace("a legal proceeding be brought", "a legal proceeding")}.`,
        `If you believe this amount is not owing, or you have already paid it, please contact ${company.signatory} at ${company.phone} or ${company.email} before that date.`,
        "We trust you will give this matter your immediate attention.",
      ];

  const kept = paragraphs.filter(Boolean);
  return {
    date: asOf,
    via: customer.kind === "consumer" ? "VIA EMAIL & MAIL" : "VIA EMAIL & REGISTERED MAIL",
    recipient: [`ATTN: ${customer.name}`, ...customer.address],
    salutation: "Dear Sir/Madam:",
    subject: firm
      ? `RE: Debt owing to ${company.name}: invoice ${invoice.number}`
      : `RE: Demand for payment: invoice ${invoice.number}`,
    paragraphs: kept,
    statement,
    statementAfter: firm ? 1 : 0,
    signoff: firm
      ? ["Yours truly,", "", FIRM.name, "", "", FIRM.lawyer, "", `c: ${company.name}`]
      : ["Yours truly,", "", company.name, "", "", company.signatory, company.signatoryTitle],
  };
}
