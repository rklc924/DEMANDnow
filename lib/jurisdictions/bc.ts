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
        { id: "explorer", followUp: { days: 7, title: "Start your CRT claim in the Solution Explorer", detail: "Next step on your checklist. Tick it off in Demand Now once done." }, title: "Use the CRT Solution Explorer", detail: "Free guided tool that is the entry point to a CRT claim." },
        { id: "apply", startsClaim: true, followUp: { days: 7, title: "Apply to the CRT and pay the fee", detail: "Next step on your checklist. Upload the issued Dispute Notice in Demand Now once you have it." }, title: "Apply online and pay the fee", detail: "You file a Dispute Notice application with the claim amount, invoices and the demand letter.", document: "CRT application data sheet", upload: {"label":"Your CRT Dispute Notice (as issued)","requirements":["Is a CRT Dispute Notice, not just the application","Shows a CRT dispute or file number","Names the claimant and respondent exactly as on the invoice","Claim amount matches the amount owing, not over $5,000"]} },
        { id: "serve", followUp: { days: 7, title: "Serve the CRT Dispute Notice", detail: "Next step on your checklist. Upload your proof of service in Demand Now once it's served." }, title: "Serve the Dispute Notice on the debtor", detail: "Follow the CRT's service rules and record how and when you served it.", verify: true, upload: {"label":"Proof of service of the Dispute Notice","requirements":["Shows the date and method of service","Method is one the CRT allows (e.g. registered mail, email with acknowledgment, personal delivery)","Served on the respondent named in the Dispute Notice"]} },
        { id: "facilitate", title: "Facilitation", detail: "A CRT case manager tries to help you reach an agreement." },
        { id: "decision", title: "Tribunal decision", detail: "If there is no agreement, a tribunal member decides on the written evidence." },
        { id: "enforce", followUp: { days: 30, title: "Has the CRT order been paid?", detail: "If it's paid, record the funds collected in Demand Now. If not, file the order in Provincial Court to enforce it." }, title: "Enforce the order", detail: "File the CRT order in Provincial Court, then use Small Claims enforcement (payment hearing, garnishment).", verify: true, upload: {"label":"The CRT order","requirements":["Is a final CRT decision or default order","Shows the amount ordered and the date","Names the parties"]} },
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
        { id: "registry", followUp: { days: 7, title: "Choose the Small Claims registry and file", detail: "Next step on your checklist: pick the registry and file the Notice of Claim." }, title: "Choose the registry", detail: "Nearest to where the debtor lives or carries on business, or where the transaction took place (Small Claims Rule 1(2))." },
        { id: "notice", startsClaim: true, followUp: { days: 14, title: "File the Notice of Claim", detail: "Next step on your checklist. Upload the filed Notice of Claim in Demand Now once the registry stamps it." }, title: "File a Notice of Claim", detail: "The app fills the prescribed form from the invoice data. File at the registry or online and pay the fee.", document: "Notice of Claim (Form 1)", upload: {"label":"Your filed Notice of Claim","requirements":["Is a BC Small Claims Notice of Claim (Form 1)","Bears the registry's filing stamp or e-filing confirmation with a court file number","Names the claimant and defendant exactly as on the invoice, with full legal names","Amount claimed is $35,000 or less and matches the amount owing","Includes an address for service for the claimant"]} },
        { id: "serve", followUp: { days: 14, title: "Serve the Notice of Claim", detail: "Next step on your checklist. Book a process server or serve it yourself, then upload the Certificate of Service. It must be served within 12 months of filing." }, title: "Serve the Notice of Claim", detail: "Hire a process server at a fixed fee, or serve it yourself and file a Certificate of Service. See \"Serving the Notice of Claim\" below.", document: "Certificate of Service", verify: true, upload: {"label":"Your signed Certificate of Service","requirements":["Is a Small Claims Certificate of Service (Form 4)","Names the party served by the same legal name as the Notice of Claim","States the date, place and method of service","Lists the Notice of Claim, the claimant's Address for Service, and a blank Reply and Address for Service","Method is one the form allows for that kind of party (individual: left with them or registered mail; company: registered office, place of business, or a director or officer)","If served by registered mail, Canada Post's signature or delivery confirmation is attached","Is signed by the person who served","Was served within 12 months of the Notice of Claim being filed"]} },
        { id: "reply", followUp: { days: 15, title: "Reply deadline: did the defendant reply?", detail: "14 days after service (30 if served outside BC) the Reply is due. If none arrived, apply for a default order. Tick the step in Demand Now." }, title: "Wait for the Reply", detail: "The debtor has 14 days after service to reply (30 days if served outside BC). If no reply, apply for default order.", document: "Application for default order", verify: true, upload: {"label":"The defendant's Reply, if you received one","optional":true,"requirements":["Is a Small Claims Reply","Shows whether the defendant disputes all, part or none of the claim"]} },
        { id: "settlement", title: "Settlement conference or mediation", detail: "If the debtor disputes, the registry schedules a settlement conference or mediation." },
        { id: "trial", title: "Trial", detail: "Bring the invoices, contract, demand letter and delivery proof." },
        { id: "payment-hearing", followUp: { days: 30, title: "Has the judgment been paid?", detail: "If it's paid, record the funds collected in Demand Now. If not, summon the debtor to a payment hearing." }, title: "Payment hearing", detail: "If the order is unpaid, summon the debtor to a payment hearing to examine their finances.", document: "Summons to a payment hearing", verify: true },
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
          { title: "Get the name and address right first", detail: "Serve the party named on the Notice of Claim, by its exact legal name. For a company, that means its registered office from a current BC Registry company search. For a person, where they live now. See \"Who you're pursuing\" at the top of this page." },
          { title: "You can serve it yourself", detail: "You, an employee, or any adult can deliver the documents. You don't need a process server." },
          { title: "What to serve", detail: "A copy of the filed Notice of Claim, your filed Address for Service (Form 38), a blank Reply (Form 2) and a blank Address for Service (Form 38)." },
          { title: "Serving an individual", detail: "Leave a copy with the person, or mail it to them by registered mail. Registered mail only counts once it's delivered, and you need Canada Post's signature or delivery confirmation as proof." },
          { title: "Serving a company", detail: "Mail it by registered mail to, or leave it at, the company's registered office; leave it at a place of business with a receptionist or the person who appears to be in charge; or leave it with a director or officer." },
          { title: "Write it down on the spot", detail: "Record the date, the address, who you handed it to and how you knew it was them. Take a photo of the location if you can." },
          { title: "Serve within 12 months", detail: "A Notice of Claim must be served within 12 months after it is filed.", verify: true },
        ],
        proof: {
          document: "Certificate of Service (Form 4)",
          detail: "Complete the Certificate of Service (Form 4) as soon as you've served, sign it, and file it at the registry. Download it below, pre-filled for an individual or a company. If you served by registered mail, attach a copy of Canada Post's signature or the delivery confirmation print-out.",
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
        { id: "handoff", followUp: { days: 3, title: "Send the file to the firm", detail: "This claim is over the Small Claims limit. Send the file for lawyer review from Demand Now." }, title: "Send the file to the firm", detail: "The app assembles invoices, contract, letters, delivery proof and the contact log." },
        { id: "review", title: "Lawyer review and retainer", detail: "Conflict check, client verification, limitation and security review (LSBC checklist E-4)." },
        { id: "claim", startsClaim: true, title: "Notice of Civil Claim and enforcement", detail: "Handled by the firm, including prejudgment garnishment where available." },
      ],
    },
  ],
};
