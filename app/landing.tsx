import { ONE_OFF_PRICE } from "@/lib/oneoff";
import { PLANS, priceLabel } from "@/lib/plans";

// Public cover page shown at / to signed-out visitors.

const WHO = [
  { icon: "🏪", t: "Small businesses", d: "A few unpaid invoices are the difference between a good month and a bad one." },
  { icon: "📈", t: "Growing companies with ageing AR", d: "Receivables piling up past 90 days, and no in-house collections team." },
  { icon: "🏗️", t: "Trade contractors and subtrades", d: "Chase progress payments and holdbacks, and protect lien rights before the 45-day window closes." },
  { icon: "🔧", t: "Home service providers", d: "Plumbers, electricians, HVAC, landscapers, renovators and cleaners with homeowners who stopped answering." },
  { icon: "💼", t: "Professional services", d: "Agencies, consultants, bookkeepers and designers with clients who went quiet after the work was delivered." },
  { icon: "🚚", t: "Suppliers and wholesalers", d: "Trade accounts that slid from net 30 to net never." },
];

const STEPS = [
  { n: "1", t: "Connect your books", d: "QuickBooks, Xero, FreshBooks, Sage or NetSuite. We watch your receivables for you." },
  { n: "2", t: "Demand at 90 days", d: "A firm, lawyer-drafted demand letter on your letterhead, sent from your own email. Automatically, or with one click." },
  { n: "3", t: "Follow-ups in your calendar", d: "Payment deadline, next step, limitation date. Nothing slips." },
  { n: "4", t: "Escalate the right way", d: "Still unpaid? Step-by-step through the CRT or Small Claims, with your forms prepared and checked." },
];

export function Landing() {
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-in">
          <div className="hero-copy">
            <span className="eyebrow">Built by BC enforcement lawyers</span>
            <h1>Stop writing off <span className="goldtext">what you've earned.</span></h1>
            <p className="lead">
              Demand Now turns overdue invoices into paid ones. Professional demand letters on your letterhead, sent the day an account hits 90 days,
              then a clear path to the CRT or Small Claims if they still don't pay. Without legal fees that cost more than the debt.
            </p>
            <div className="cta">
              <a className="btn big gold" href="/signup">Start collecting</a>
              <a className="btn big outline" href="/start">One demand for ${ONE_OFF_PRICE}</a>
            </div>
            <p className="fine">Plans from {priceLabel(PLANS.standard, "monthly")}. Fill in your first demand free; pay only when you generate it.</p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="paper">
              <div className="lh"><div className="logo-dot" /> <div><b>Northshore Mechanical Ltd.</b><span>Plumbing · Heating · Gas</span></div></div>
              <div className="line w40" /><div className="line w30" />
              <div className="re">RE: DEMAND FOR PAYMENT, INVOICE 1042</div>
              <div className="line" /><div className="line" /><div className="line w80" />
              <div className="amt"><span>Amount owing</span><b>$8,412.50</b></div>
              <div className="line" /><div className="line w60" />
              <div className="stamp">FINAL<br />DEMAND</div>
            </div>
            <div className="toast t1"><span className="dot ok" /> Sent from accounts@northshore.ca</div>
            <div className="toast t2"><span className="dot cal" /> BF added: payment deadline in 14 days</div>
            <div className="toast t3"><span className="dot paid" /> Invoice 1042 paid in full</div>
          </div>
        </div>
      </section>

      <section className="facts">
        <div><b>90 days</b><span>when your demand goes out</span></div>
        <div><b>Under $5,000</b><span>Civil Resolution Tribunal</span></div>
        <div><b>Up to $35,000</b><span>Small Claims Court</span></div>
        <div><b>2 years</b><span>limitation tracked on every invoice</span></div>
      </section>

      <section className="sec">
        <h2>How it works</h2>
        <div className="steps4">
          {STEPS.map((s) => (
            <div key={s.n} className="step"><div className="n">{s.n}</div><h3>{s.t}</h3><p>{s.d}</p></div>
          ))}
        </div>
      </section>

      <section className="sec alt">
        <h2>Who it's for</h2>
        <p className="sec-sub">Any business that does the work first and gets paid later.</p>
        <div className="who">
          {WHO.map((w) => (
            <div key={w.t} className="who-card"><div className="ic">{w.icon}</div><h3>{w.t}</h3><p>{w.d}</p></div>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="split">
          <div>
            <h2>A collections department, without the payroll</h2>
            <ul className="ticks">
              <li>Demand letters in our firm's own wording, on your letterhead</li>
              <li>Sent from your Outlook or Gmail, with follow-ups in your calendar</li>
              <li>A tick-box checklist for every matter, with uploaded documents checked for errors before you file</li>
              <li>Process servers at fixed fees, or a guide to serving it yourself</li>
              <li>Builders lien add-on for construction trades, with every deadline calculated</li>
              <li>A lawyer when the file justifies one, and only then</li>
            </ul>
          </div>
          <div className="quote">
            <p>"Most overdue invoices don't need a lawyer at every step. They need a firm demand, sent on time, and a clear plan if it's ignored."</p>
            <span>The enforcement lawyers behind Demand Now · <a href="/about">Our story</a></span>
          </div>
        </div>
      </section>

      <section className="final">
        <h2>Your invoices are getting older. Your claim is getting weaker.</h2>
        <p>Every month an invoice sits unpaid, it gets harder to collect and closer to the limitation date. Start today.</p>
        <div className="cta center">
          <a className="btn big gold" href="/signup">Start collecting</a>
          <a className="btn big outline" href="/pricing">See pricing</a>
        </div>
      </section>
    </div>
  );
}
