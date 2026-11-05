import { Fragment } from "react";
import { LEGAL_UPDATED, legalEntity, PROCESSORS, supportEmail } from "@/lib/legal";

export const metadata = { title: "Privacy policy · Demand Now" };
export const dynamic = "force-dynamic";

export default function Privacy() {
  const co = legalEntity();
  const email = supportEmail();
  const contact = email ? <a href={`mailto:${email}`}>{email}</a> : <a href="/support">our support page</a>;
  return (
    <div className="about legal">
      <h1>Privacy policy</h1>
      <p className="note">Last updated {LEGAL_UPDATED}</p>

      <div className="card">
        <p>
          {co} ("Demand Now", "we", "us") makes software that helps businesses send demand letters for overdue invoices and follow the British Columbia
          collection process. This policy explains what personal information we collect, why, who we share it with and your choices. We follow British
          Columbia's <i>Personal Information Protection Act</i> (PIPA) and, where it applies, the federal <i>Personal Information Protection and Electronic
          Documents Act</i> (PIPEDA).
        </p>
      </div>

      <div className="card">
        <h2>What we collect</h2>
        <ul>
          <li><b>Your account:</b> name, business name, email, password (stored only as a salted hash), and your company details and letterhead.</li>
          <li><b>Billing:</b> your plan and payment history. Your card is held by Stripe; we keep only the card brand, last four digits and expiry.</li>
          <li><b>Your customers and debtors:</b> names, addresses, emails and invoice details you enter, sync from your accounting software, or add through an AI assistant, plus the letters, court documents and proof of service for each matter.</li>
          <li><b>Connected accounts:</b> if you connect Outlook, Gmail, an accounting platform, or an AI assistant such as Claude or ChatGPT, the access tokens needed to act for you. Tokens are encrypted or stored only as hashes.</li>
          <li><b>Usage and technical data:</b> log-in times, IP address and basic server logs used for security and troubleshooting.</li>
        </ul>
        <p>We don't use advertising trackers and we don't sell personal information.</p>
      </div>

      <div className="card">
        <h2>Information about your debtors</h2>
        <p>
          When you add a debtor, you are the organization responsible for that information and for having a lawful reason to use it to collect a debt
          owed to you. We process it on your behalf, only to provide the service: preparing and sending your letters, tracking deadlines, preparing court
          documents and performing services you book. If a debtor contacts us about their information, we will refer them to you and help you respond.
        </p>
      </div>

      <div className="card">
        <h2>How we use it</h2>
        <ul>
          <li>To run your account and provide the features you use, including letters, reminders, document checks and booked services</li>
          <li>To take payment and send receipts</li>
          <li>To send service emails, such as verification, password resets and deadline reminders</li>
          <li>To keep the service secure, prevent fraud and fix problems</li>
          <li>To meet legal, tax and accounting obligations</li>
        </ul>
        <p>We use information only for these purposes, or for a new purpose you consent to.</p>
      </div>

      <div className="card">
        <h2>AI features</h2>
        <p>
          When you upload a document for a check, it is sent to Anthropic's Claude to compare it against the requirements for that step. Anthropic
          processes it under commercial terms that do not allow it to train models on your data.
        </p>
        <p>
          If you connect Claude, ChatGPT or another AI assistant, it can add matters and read your matters' status, but only after you approve the
          connection. What you type into that assistant is handled under its provider's privacy policy. You can disconnect it any time in Settings.
        </p>
      </div>

      <div className="card">
        <h2>Who we share it with</h2>
        <p>We share personal information only with service providers who process it for us under contract, and only what each one needs:</p>
        <dl className="kv">
          {PROCESSORS.map((p) => (
            <Fragment key={p.name}><dt>{p.name}</dt><dd>{p.purpose}</dd></Fragment>
          ))}
        </dl>
        <p style={{ marginTop: 12 }}>
          If you request a lawyer review, we send that matter's file to the reviewing lawyer. We may also disclose information when the law requires it,
          or as part of a sale or reorganization of our business, under the same protections.
        </p>
      </div>

      <div className="card">
        <h2>Storage outside Canada</h2>
        <p>
          Our servers are in the United States, and some of our service providers are based there. Your information may therefore be accessed by courts,
          law enforcement and national security authorities of the United States under its laws. We choose providers that protect information to a
          standard comparable to Canadian law.
        </p>
      </div>

      <div className="card">
        <h2>How long we keep it</h2>
        <p>
          We keep your account information while your account is open. After you close it, we delete or anonymize your matters within 90 days, except
          for billing records, which we keep for seven years for tax purposes, and anything we must keep by law. Backups roll off within 30 days after
          that.
        </p>
      </div>

      <div className="card">
        <h2>Security</h2>
        <p>
          We use encrypted connections, hashed passwords and tokens, encrypted storage of connected-account credentials, and limited staff access. No
          system is perfectly secure. If a breach creates a real risk of significant harm, we will notify you and the Privacy Commissioner as the law
          requires.
        </p>
      </div>

      <div className="card">
        <h2>Your choices and rights</h2>
        <p>
          You can see and correct most of your information in the app. You can ask us for access to the personal information we hold about you, to
          correct it, or to withdraw consent, which may mean we can no longer provide the service. We'll respond within 30 days. If you're not satisfied
          with our answer, you can contact the Office of the Information and Privacy Commissioner for British Columbia.
        </p>
      </div>

      <div className="card">
        <h2>Contact our Privacy Officer</h2>
        <p>Questions or requests: {contact}. We may update this policy; we'll post the new date here and tell you by email about significant changes.</p>
      </div>
    </div>
  );
}
