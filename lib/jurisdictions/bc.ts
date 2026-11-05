import type { Jurisdiction } from "./types";

// Built from the firm's CLEBC "BC Creditors' Remedies" guide (ch. 1, current to July 2022)
// and LSBC Practice Checklist E-4 Collections Procedure (current to Sept 4, 2025).
// Wording here is our own summary, not CLEBC text. Items marked verify need a lawyer's check
// against current rules before launch.

export const BC: Jurisdiction = {
  code: "BC",
  name: "British Columbia",
  limitation: {
    years: 2,
    note:
      "Limitation Act, s. 6: two years from when the claim is discovered. For an unpaid invoice we count from the due date. Acknowledgment of the debt or part payment can extend it.",
  },
  disclaimer:
    "This is legal information about BC procedure, not legal advice about your dispute. For advice, use the lawyer review option.",
  forums: [
    {
      id: "crt",
      name: "Civil Resolution Tribunal",
      maxClaim: 4999.99,
      selfServe: true,
      summary: "Debt claims under $5,000 must start at the CRT. It runs online.",
      steps: [
        { id: "demand", title: "Send the demand letter and let the deadline pass", detail: "Keep the letter and proof of delivery. The CRT will ask what you did to resolve it." },
        { id: "explorer", title: "Use the CRT Solution Explorer", detail: "Free guided tool that is the entry point to a CRT claim." },
        { id: "apply", title: "Apply online and pay the fee", detail: "You file a Dispute Notice application with the claim amount, invoices and the demand letter.", document: "CRT application data sheet" },
        { id: "serve", title: "Serve the Dispute Notice on the debtor", detail: "Follow the CRT's service rules and record how and when you served it.", verify: true },
        { id: "facilitate", title: "Facilitation", detail: "A CRT case manager tries to help you reach an agreement." },
        { id: "decision", title: "Tribunal decision", detail: "If there is no agreement, a tribunal member decides on the written evidence." },
        { id: "enforce", title: "Enforce the order", detail: "File the CRT order in Provincial Court, then use Small Claims enforcement (payment hearing, garnishment).", verify: true },
      ],
    },
    {
      id: "small-claims",
      name: "Small Claims Court (Provincial Court)",
      maxClaim: 35000,
      selfServe: true,
      summary:
        "Claims from $5,000 to $35,000. Over $35,000 you may abandon the excess to stay in Small Claims (Small Claims Rule 1(4)).",
      steps: [
        { id: "demand", title: "Send the demand letter and let the deadline pass", detail: "Keep the letter and proof of delivery for the court file." },
        { id: "registry", title: "Choose the registry", detail: "Nearest to where the debtor lives or carries on business, or where the transaction took place (Small Claims Rule 1(2))." },
        { id: "notice", title: "File a Notice of Claim", detail: "The app fills the prescribed form from the invoice data. File at the registry or online and pay the fee.", document: "Notice of Claim (Form 1)" },
        { id: "serve", title: "Serve the Notice of Claim", detail: "Individuals: personal service or registered mail. Companies: registered mail or delivery to the registered office, or personal service on a director. Serve within 12 months of filing.", document: "Certificate of Service", verify: true },
        { id: "reply", title: "Wait for the Reply", detail: "The debtor has 14 days after service to reply (30 days if served outside BC). If no reply, apply for default order.", document: "Application for default order", verify: true },
        { id: "settlement", title: "Settlement conference or mediation", detail: "If the debtor disputes, the registry schedules a settlement conference or mediation." },
        { id: "trial", title: "Trial", detail: "Bring the invoices, contract, demand letter and delivery proof." },
        { id: "payment-hearing", title: "Payment hearing", detail: "If the order is unpaid, summon the debtor to a payment hearing to examine their finances.", document: "Summons to a payment hearing", verify: true },
        { id: "garnish", title: "Garnishing order after judgment", detail: "Garnish wages or bank accounts through the Court Order Enforcement Act process.", document: "Garnishing order data sheet", verify: true },
      ],
    },
    {
      id: "supreme",
      name: "Supreme Court of BC (lawyer hand-off)",
      maxClaim: null,
      selfServe: false,
      summary:
        "Claims over $35,000, contested claims, secured debts and guarantees go to a lawyer. Note Supreme Court costs limits for claims within Small Claims range (SCCR 14-1(10)).",
      steps: [
        { id: "handoff", title: "Send the file to the firm", detail: "The app assembles invoices, contract, letters, delivery proof and the contact log." },
        { id: "review", title: "Lawyer review and retainer", detail: "Conflict check, client verification, limitation and security review (LSBC checklist E-4)." },
        { id: "claim", title: "Notice of Civil Claim and enforcement", detail: "Handled by the firm, including prejudgment garnishment where available." },
      ],
    },
  ],
};
