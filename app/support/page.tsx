import { getUser } from "@/lib/auth";
import { supportEmail } from "@/lib/legal";
import { ONE_OFF_PRICE } from "@/lib/oneoff";

export const metadata = { title: "Support · Demand Now" };
export const dynamic = "force-dynamic";

const FAQ = [
  { q: "Is Demand Now a law firm?", a: "No. Demand Now is software that prepares letters and documents and explains the BC process. It doesn't give legal advice. Every matter has a Request lawyer review option if you want a lawyer to look at it." },
  { q: "How do I cancel or change my plan?", a: "Go to Billing. Cancelling stops renewal at the end of the period you've paid for." },
  { q: "Can I get a refund on a one-off demand?", a: `The $${ONE_OFF_PRICE} one-off fee can't be refunded once the letter has been generated. If something went wrong with it, contact us below and we'll make it right.` },
  { q: "My letter has the wrong name or address on it.", a: "Open the matter and use \"Who you're pursuing\" to set the debtor's legal name and address, then download the letter again. For a company, use the name and registered office from a BC company search." },
  { q: "How do I connect Claude or ChatGPT?", a: "Go to Settings > AI assistants. Copy the connector URL and follow the steps for your assistant. You can disconnect it there at any time." },
  { q: "How do I delete my account or get a copy of my data?", a: "Send us a request with the form below from the email on your account. We'll reply within 30 days, usually much sooner." },
];

export default async function Support({ searchParams }: { searchParams: { sent?: string; error?: string } }) {
  const user = await getUser();
  const email = supportEmail();
  return (
    <div className="about legal">
      <h1>Support</h1>
      <p className="sub">
        We usually reply within one business day (Pacific time).
        {email && <> Email <a href={`mailto:${email}`}>{email}</a> or use the form below.</>}
      </p>
      {searchParams.sent && <div className="banner good">Thanks, we've got your message and will reply by email.</div>}
      {searchParams.error && <div className="banner warn">{searchParams.error}</div>}

      <div className="card">
        <h2>Common questions</h2>
        {FAQ.map((f) => (
          <details key={f.q} className="faq">
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>

      <div className="card" id="contact">
        <h2>Contact us</h2>
        <form action="/api/support" method="post">
          <div className="grid2" style={{ gap: 12 }}>
            <div><label>Your name</label><input type="text" name="name" defaultValue={user?.name} required /></div>
            <div><label>Email</label><input type="text" name="email" defaultValue={user?.email} required /></div>
          </div>
          <label>Topic</label>
          <select name="topic" defaultValue="question">
            <option value="question">A question about using Demand Now</option>
            <option value="billing">Billing or payments</option>
            <option value="service">Process serving or filing I booked</option>
            <option value="privacy">Privacy, my data or deleting my account</option>
            <option value="problem">Something isn't working</option>
          </select>
          <label>Message</label>
          <textarea name="message" required rows={6} placeholder="Include the debtor or invoice number if it's about a matter." />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ display: "none" }} aria-hidden="true" />
          <p className="note">We can't give legal advice by email. For advice on a matter, use Request lawyer review on that matter.</p>
          <div style={{ marginTop: 12 }}><button className="btn">Send</button></div>
        </form>
      </div>
      <p className="note">See also our <a href="/terms">terms of service</a> and <a href="/privacy">privacy policy</a>.</p>
    </div>
  );
}
