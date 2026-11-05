// Shared details for the privacy policy, terms and support pages.
// LEGAL_ENTITY_NAME: the registered company that operates Demand Now (set once incorporated).
// SUPPORT_EMAIL: shown publicly; support form messages go here (falls back to SERVICE_OPS_EMAIL).

export const LEGAL_UPDATED = "November 5, 2026";

export const legalEntity = () => process.env.LEGAL_ENTITY_NAME || "Demand Now";
export const supportEmail = () => process.env.SUPPORT_EMAIL || "";
export const supportInbox = () => process.env.SUPPORT_EMAIL || process.env.SERVICE_OPS_EMAIL || "";

/** Service providers that process personal information for us, for the privacy policy. */
export const PROCESSORS = [
  { name: "Render", purpose: "Hosting and database (servers in Oregon, United States)" },
  { name: "Stripe", purpose: "Card storage and payments. We never see or store your full card number." },
  { name: "Resend", purpose: "Account and notification emails" },
  { name: "Twilio", purpose: "Text messages to process servers" },
  { name: "Anthropic", purpose: "AI checks of documents you upload (Claude). Not used to train models." },
  { name: "Microsoft and Google", purpose: "Only if you connect Outlook or Gmail: sending letters from your mailbox and adding calendar reminders" },
  { name: "Our process server and filing agents", purpose: "Only for services you book: the documents and addresses needed to serve or file" },
  { name: "BC Registries and the Land Title and Survey Authority", purpose: "Only for searches or filings you order" },
];
