import { money } from "../aging";
import type { Row } from "../ledger";
import type { Company } from "../store";

// Firm-authored demand letter wording (placeholder pending the firm's final text).
// Structure follows the elements of a BC demand for debt: amount as of a date, contractual
// interest only if the terms provide it, a firm deadline, and the lawful next step.
// It deliberately contains no threats beyond a step the creditor can lawfully take.

export interface LetterContent {
  date: string;
  via: string;
  recipient: string[];
  subject: string;
  paragraphs: string[];
  signoff: string[];
}

const longDate = (d: Date) => d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

export function deadlineFrom(responseDays: number, from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + responseDays);
  return d;
}

export function buildDemandLetter(row: Row, company: Company, responseDays: number, sentOn = new Date()): LetterContent {
  const { invoice, customer, forum } = row;
  const deadline = deadlineFrom(responseDays, sentOn);
  const due = longDate(new Date(invoice.dueDate + "T00:00:00"));
  const nextStep = forum.selfServe
    ? `start a claim against you in the ${forum.name} to recover the amount owing, together with any interest and costs the ${forum.id === "crt" ? "tribunal" : "court"} allows`
    : "refer this matter to our lawyers to commence legal proceedings to recover the amount owing, together with interest and costs";

  const paragraphs = [
    `Our records show that invoice ${invoice.number} for ${invoice.description.toLowerCase()}, due on ${due}, remains unpaid. As of today, ${row.days} days past the due date, the outstanding balance is ${money(invoice.amountDue)}.`,
    invoice.interestRate
      ? `Under the terms of the invoice, interest accrues on the overdue balance at ${invoice.interestRate}% per year until paid.`
      : "",
    `We ask that you pay ${money(invoice.amountDue)} in full on or before ${longDate(deadline)}. ${company.paymentInstructions}`,
    `If payment is not received by that date, or we do not hear from you with a proposal we can accept, we intend to ${nextStep}.`,
    `If you believe this amount is not owing, or you have already paid it, please contact ${company.signatory} at ${company.phone} or ${company.email} before the deadline so we can review your records together.`,
  ].filter(Boolean);

  return {
    date: longDate(sentOn),
    via: customer.kind === "consumer" ? "BY EMAIL AND MAIL" : "BY EMAIL AND REGISTERED MAIL",
    recipient: [customer.name, ...customer.address],
    subject: `Re: Demand for payment of invoice ${invoice.number} (${money(invoice.amountDue)})`,
    paragraphs,
    signoff: ["Yours truly,", "", company.name, "", "", company.signatory, company.signatoryTitle],
  };
}
