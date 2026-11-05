import { LIEN_FILING_FEE } from "@/lib/liens";
import { LEGAL_UPDATED, legalEntity, supportEmail } from "@/lib/legal";
import { ONE_OFF_PRICE } from "@/lib/oneoff";
import { PLANS } from "@/lib/plans";

export const metadata = { title: "Terms of service · Demand Now" };
export const dynamic = "force-dynamic";

export default function Terms() {
  const co = legalEntity();
  const email = supportEmail();
  const contact = email ? <a href={`mailto:${email}`}>{email}</a> : <a href="/support">our support page</a>;
  return (
    <div className="about legal">
      <h1>Terms of service</h1>
      <p className="note">Last updated {LEGAL_UPDATED}</p>

      <div className="card">
        <p>
          These terms are an agreement between you and {co} ("Demand Now", "we", "us") for the use of the Demand Now website, app and connectors
          (the "Service"). By creating an account, buying a one-off demand or using the Service, you agree to them. If you use the Service for a
          business, you confirm that you can bind that business, and "you" means the business.
        </p>
      </div>

      <div className="card">
        <h2>1. What Demand Now is, and isn't</h2>
        <p>
          Demand Now is software. It prepares demand letters from your information, tracks deadlines, fills court forms from your data and gives
          general legal information about the British Columbia collection process. <b>Demand Now is not a law firm and does not give legal advice.</b>{" "}
          Using it does not create a lawyer-client relationship. The guidance is general and may not fit your situation; deadlines and rules can
          change, and items marked "confirm" have not yet been verified against current rules.
        </p>
        <p>
          If you request a lawyer review, it is provided by an independent lawyer licensed in British Columbia under a separate engagement with you.
          A lawyer-client relationship exists only between you and that lawyer, and only once they accept the engagement.
        </p>
      </div>

      <div className="card">
        <h2>2. Your responsibilities</h2>
        <ul>
          <li>You may use the Service only to collect debts owed to you or your business, not debts owed to others. Collecting for others may require a licence as a collection agent.</li>
          <li>You are responsible for the accuracy of what you enter: the debtor's legal name and address, amounts, dates and interest rates. Letters and forms are only as accurate as your information.</li>
          <li>You review each letter and document before it is sent, filed or served, and you decide whether to send, file or serve it. Demands to consumers always wait for your review.</li>
          <li>You will follow the laws that apply to collecting debts, including the <i>Business Practices and Consumer Protection Act</i> rules on contacting debtors, and you will not use the Service to harass, threaten or mislead anyone.</li>
          <li>You have a lawful basis to give us your debtors' personal information and to use it to collect the debt.</li>
          <li>You keep your password private and are responsible for activity on your account, including actions by AI assistants you connect.</li>
        </ul>
      </div>

      <div className="card">
        <h2>3. Plans, payment and cancellation</h2>
        <ul>
          <li>Every account needs a valid card on file.</li>
          <li>
            Subscriptions: {PLANS.standard.name} (up to {PLANS.standard.letterLimit} demand letters a month) at ${PLANS.standard.price.monthly}/month or $
            {PLANS.standard.price.annual}/year, and {PLANS.unlimited.name} at ${PLANS.unlimited.price.monthly}/month or ${PLANS.unlimited.price.annual}/year.
            Prices are in Canadian dollars plus applicable taxes. A letter counts toward the monthly limit when it is sent; unused letters don't carry over.
          </li>
          <li>Subscriptions renew automatically at the end of each month or year until cancelled. You can cancel any time in Billing; cancellation takes effect at the end of the paid period, and we don't refund partial periods.</li>
          <li>A one-off demand is ${ONE_OFF_PRICE}. Once the letter has been generated it is non-refundable.</li>
          <li>Add-on services, such as process serving, company searches, builders lien filing (${LIEN_FILING_FEE} plus government fees) and title searches, are charged to your card when you book them, at the price shown at booking. Government and registry fees are passed through at cost.</li>
          <li>We may change prices with at least 30 days' notice by email. Changes apply from your next renewal.</li>
        </ul>
      </div>

      <div className="card">
        <h2>4. Booked services</h2>
        <p>
          When you book process serving or a filing, we arrange it with an independent process server or filing agent. Turnaround times are targets,
          not guarantees, and depend on the registry and on finding the person to be served. You are responsible for giving a correct address. If
          service can't be completed after the included attempts, we will tell you your options.
        </p>
      </div>

      <div className="card">
        <h2>5. Connected accounts and AI assistants</h2>
        <p>
          You can connect your email, calendar, accounting software and AI assistants such as Claude or ChatGPT. We act through those connections only
          as you set them up. An AI assistant you connect can add matters and read their status, but cannot send letters, file documents or make
          payments. AI output, including document checks, can be wrong; check it before you rely on it. Third-party services are governed by their own
          terms.
        </p>
      </div>

      <div className="card">
        <h2>6. Acceptable use</h2>
        <p>
          Don't misuse the Service: no unlawful, false or harassing demands; no attempts to access other accounts or disrupt the Service; no reverse
          engineering, scraping or reselling it without our permission. We may suspend or close accounts that break these terms.
        </p>
      </div>

      <div className="card">
        <h2>7. Your content and ours</h2>
        <p>
          You own the information and documents you put into the Service, and you give us permission to use them to provide it. We own the Service,
          including its software, templates, letter wording and guides. You may use the letters and documents it produces for your own matters.
        </p>
      </div>

      <div className="card">
        <h2>8. Disclaimers and limits on liability</h2>
        <p>
          The Service is provided "as is". We don't promise that any debt will be collected, that a court or tribunal will rule in your favour, or that
          the Service will be uninterrupted or error-free. To the extent the law allows, we are not liable for indirect or consequential losses, lost
          profits or uncollected debts, and our total liability for any claim is limited to the fees you paid us in the 12 months before the claim.
          Nothing in these terms limits rights you have that can't be limited by law.
        </p>
        <p>
          You agree to compensate us for claims by others, including your debtors, that arise from information you provided or from how you used the
          Service in breach of these terms.
        </p>
      </div>

      <div className="card">
        <h2>9. Ending the agreement</h2>
        <p>
          You can close your account at any time. We may close it with notice, or right away for a serious breach. After closing, you can download your
          letters and documents for 30 days, and we then handle your data as described in our <a href="/privacy">privacy policy</a>.
        </p>
      </div>

      <div className="card">
        <h2>10. General</h2>
        <p>
          These terms are governed by the laws of British Columbia and the federal laws of Canada that apply there, and the courts of British Columbia
          have exclusive jurisdiction. If we change these terms, we will post the new version here and email you about significant changes; continuing to
          use the Service means you accept them. Questions: {contact}.
        </p>
      </div>
    </div>
  );
}
