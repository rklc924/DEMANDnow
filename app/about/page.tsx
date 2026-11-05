// Public "About us" page: who built Demand Now and why.
export const metadata = { title: "About us · Demand Now" };

export default function About() {
  return (
    <div className="about">
      <section className="about-hero">
        <img src="/brand/demand-now-logo.svg" alt="Demand Now" width={300} />
        <h1>Built by enforcement lawyers, for the invoices that don't need one</h1>
        <p className="sub">
          Demand Now was created by creditor-enforcement lawyers in British Columbia who kept seeing the same problem:
          good businesses writing off money they were owed because collecting it through a lawyer cost more than the debt was worth.
        </p>
      </section>

      <div className="card">
        <h2>The gap we saw</h2>
        <p>
          Our practice is collecting debts and enforcing judgments. Again and again, clients came to us with an overdue invoice
          of a few hundred or a few thousand dollars. A lawyer's demand letter, a claim, service and enforcement can quickly cost more than the
          amount owing, so the honest advice was often to let it go.
        </p>
        <p>
          But most of those files didn't need a lawyer at every step. They needed a firm, properly worded demand, sent on time,
          and a clear map of what to do if the debtor still didn't pay. Not every uncollected or aged receivable needs expensive
          legal fees that outweigh what's at stake.
        </p>
      </div>

      <div className="grid3 about-points">
        <div className="card">
          <h3>Our own wording</h3>
          <p>The demand letters are based on the precedents we use in our own collections practice, adapted for businesses to send on their own letterhead.</p>
        </div>
        <div className="card">
          <h3>The right forum, every time</h3>
          <p>Each matter is routed by amount: the Civil Resolution Tribunal up to $5,000, Small Claims up to $35,000, and a lawyer above that.</p>
        </div>
        <div className="card">
          <h3>A lawyer when you need one</h3>
          <p>Every case has a "Request lawyer review" option, so you can bring in an enforcement lawyer for the files that justify it, and only those.</p>
        </div>
      </div>

      <div className="card">
        <h2>How we think about it</h2>
        <p>
          Collecting a debt shouldn't depend on whether you can afford a law firm. Demand Now handles the routine work that makes up most collection
          files: watching your receivables, sending demands once accounts pass 90 days, tracking limitation dates, and preparing the information for
          your court forms, with step-by-step guidance on filing and serving. When a file becomes complex or the amount justifies it, we tell you
          that too.
        </p>
        <p className="note">
          Demand Now provides legal information and document preparation tools, not legal advice. Using it does not create a lawyer-client
          relationship unless you request and we accept a lawyer review.
        </p>
      </div>

      <div className="row" style={{ justifyContent: "center", gap: 12, margin: "28px 0 8px" }}>
        <a className="btn" href="/pricing">See plans</a>
        <a className="btn ghost" href="/start">Send one demand</a>
      </div>
    </div>
  );
}
