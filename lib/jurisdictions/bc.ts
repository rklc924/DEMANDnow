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
        { id: "demand", title: "Send the demand letter and let the deadline pass", detail: "Keep the letter and proof of delivery. The CRT will ask what you did to resolve it.", upload: {"label":"Proof the demand letter was delivered","requirements":["Shows the demand was sent to the debtor named on the claim","Shows a delivery or sent date","Delivery date is on or after the demand letter date"]} },
        { id: "explorer", title: "Use the CRT Solution Explorer", detail: "Free guided tool that is the entry point to a CRT claim." },
        { id: "apply", title: "Apply online and pay the fee", detail: "You file a Dispute Notice application with the claim amount, invoices and the demand letter.", document: "CRT application data sheet", upload: {"label":"Your CRT Dispute Notice (as issued)","requirements":["Is a CRT Dispute Notice, not just the application","Shows a CRT dispute or file number","Names the claimant and respondent exactly as on the invoice","Claim amount matches the amount owing, not over $5,000"]} },
        { id: "serve", title: "Serve the Dispute Notice on the debtor", detail: "Follow the CRT's service rules and record how and when you served it.", verify: true, upload: {"label":"Proof of service of the Dispute Notice","requirements":["Shows the date and method of service","Method is one the CRT allows (e.g. registered mail, email with acknowledgment, personal delivery)","Served on the respondent named in the Dispute Notice"]} },
        { id: "facilitate", title: "Facilitation", detail: "A CRT case manager tries to help you reach an agreement." },
        { id: "decision", title: "Tribunal decision", detail: "If there is no agreement, a tribunal member decides on the written evidence." },
        { id: "enforce", title: "Enforce the order", detail: "File the CRT order in Provincial Court, then use Small Claims enforcement (payment hearing, garnishment).", verify: true, upload: {"label":"The CRT order","requirements":["Is a final CRT decision or default order","Shows the amount ordered and the date","Names the parties"]} },
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
        { id: "demand", title: "Send the demand letter and let the deadline pass", detail: "Keep the letter and proof of delivery for the court file.", upload: {"label":"Proof the demand letter was delivered","requirements":["Shows the demand was sent to the debtor named on the claim","Shows a delivery or sent date","Delivery date is on or after the demand letter date"]} },
        { id: "registry", title: "Choose the registry", detail: "Nearest to where the debtor lives or carries on business, or where the transaction took place (Small Claims Rule 1(2))." },
        { id: "notice", title: "File a Notice of Claim", detail: "The app fills the prescribed form from the invoice data. File at the registry or online and pay the fee.", document: "Notice of Claim (Form 1)", upload: {"label":"Your filed Notice of Claim","requirements":["Is a BC Small Claims Notice of Claim (Form 1)","Bears the registry's filing stamp or e-filing confirmation with a court file number","Names the claimant and defendant exactly as on the invoice, with full legal names","Amount claimed is $35,000 or less and matches the amount owing","Includes an address for service for the claimant"]} },
        { id: "serve", title: "Serve the Notice of Claim", detail: "Hire a process server at a fixed fee, or serve it yourself and file a Certificate of Service. See \"Serving the Notice of Claim\" below.", document: "Certificate of Service", verify: true, upload: {"label":"Your signed Certificate of Service","requirements":["Is a Small Claims Certificate of Service","States the date, place and method of service","Method is personal service, or registered mail with the recipient's signature, or (for a company) the registered office","Is signed by the person who served","Was served within 12 months of the Notice of Claim being filed"]} },
        { id: "reply", title: "Wait for the Reply", detail: "The debtor has 14 days after service to reply (30 days if served outside BC). If no reply, apply for default order.", document: "Application for default order", verify: true, upload: {"label":"The defendant's Reply, if you received one","optional":true,"requirements":["Is a Small Claims Reply","Shows whether the defendant disputes all, part or none of the claim"]} },
        { id: "settlement", title: "Settlement conference or mediation", detail: "If the debtor disputes, the registry schedules a settlement conference or mediation." },
        { id: "trial", title: "Trial", detail: "Bring the invoices, contract, demand letter and delivery proof." },
        { id: "payment-hearing", title: "Payment hearing", detail: "If the order is unpaid, summon the debtor to a payment hearing to examine their finances.", document: "Summons to a payment hearing", verify: true },
        { id: "garnish", title: "Garnishing order after judgment", detail: "Garnish wages or bank accounts through the Court Order Enforcement Act process.", document: "Garnishing order data sheet", verify: true },
      ],
      service: {
        document: "Notice of Claim",
        serverFees: {
          // PLACEHOLDER prices: replace with the rates agreed with the process-serving partner.
          placeholder: true,
          includes: "Up to three attempts, GPS-stamped photos, and a completed Certificate of Service returned to you.",
          bookingFee: 50, // Demand Now's fee on every booking (Rocky, 2026-11-05)
          fees: [
            { id: "lower-mainland", area: "Lower Mainland (Metro Vancouver and Fraser Valley)", price: 95, dispatch: true },
            { id: "bc-cities", area: "Other BC cities (Victoria, Kelowna, Kamloops, Nanaimo, Prince George and similar)", price: 125 },
            { id: "remote", area: "Rural and remote BC", price: null, note: "Quoted before booking" },
            { id: "rush", area: "Rush (attempt within 24 hours)", price: 60, note: "Added to the area fee", addOn: true },
          ],
        },
        selfServe: [
          { title: "You can serve it yourself", detail: "You, an employee, or any adult can deliver the Notice of Claim. You don't need a process server.", verify: true },
          { title: "Serving a person", detail: "Hand the filed Notice of Claim (and a blank Reply) to the person directly. Telling them what it is is enough; they don't have to take it. Or send it by registered mail; it only counts once they sign for it.", verify: true },
          { title: "Serving a company", detail: "Send it by registered mail to, or leave it at, the company's registered office (look it up on a BC Registry company search), or hand it to a director.", verify: true },
          { title: "Write it down on the spot", detail: "Record the date, time and address, how you knew it was the right person, and what was handed over. Take a photo of the location if you can." },
          { title: "Serve within 12 months", detail: "A Notice of Claim must be served within 12 months after it is filed.", verify: true },
        ],
        proof: {
          document: "Certificate of Service",
          detail: "Complete the Certificate of Service as soon as you've served, and file it at the registry. The app pre-fills it from your service details. Check with the registry whether it must be sworn or affirmed. Keep the registered-mail signature card with it if you served by mail.",
          verify: true,
        },
        afterService: [
          { label: "Reply due from the defendant", days: 14, outsideProvinceDays: 30 },
          { label: "Earliest date to apply for a default order if no Reply", days: 15, outsideProvinceDays: 31 },
        ],
        officialGuides: [
          { label: "BC Government: Small Claims how-to guides (service)", url: "https://www2.gov.bc.ca/gov/content/justice/courthouse-services/small-claims/how-to-guides" },
          { label: "Small Claims Rules, BC Reg 261/93 (Rule 2: service)", url: "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/261_93" },
        ],
      },
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
