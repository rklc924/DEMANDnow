import { notFound } from "next/navigation";
import { money } from "@/lib/aging";
import { getJurisdiction } from "@/lib/jurisdictions";
import { loadRow } from "@/lib/ledger";

export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });

export default async function CasePage({ params, searchParams }: { params: { id: string }; searchParams: { sent?: string; review?: string } }) {
  const { db, row } = await loadRow(params.id);
  if (!row) notFound();
  const j = getJurisdiction(db.company.jurisdiction);
  const { invoice, customer, forum, letter } = row;
  const deadlinePassed = letter ? new Date(letter.deadline + "T23:59:59") < new Date() : false;
  const reviewRequested = db.reviewRequests?.some((r) => r.invoiceId === invoice.id);
  const consumerNeedsReview = customer.kind === "consumer";

  return (
    <>
      <p className="note"><a href="/">← Receivables</a></p>
      <h1>{invoice.number} · {customer.name}</h1>
      <p className="sub">{money(invoice.amountDue)} · {row.days} days past due · {customer.kind} customer</p>
      {searchParams.sent && <div className="banner good">Demand letter sent by email. Deadline to pay: {letter && fmt(letter.deadline)}.</div>}
      {searchParams.review && <div className="banner good">Sent to the firm for review. A lawyer will contact you within one business day.</div>}
      {row.paid && <div className="banner good">Marked paid. The workflow has stopped.</div>}
      {row.daysToLimitation <= 120 && row.daysToLimitation > 0 && (
        <div className="banner warn">Limitation date is close: {fmt(row.limitation)} ({row.daysToLimitation} days). A claim must be started before then.</div>
      )}

      <div className="grid2">
        <div className="card">
          <h2>1. Demand letter</h2>
          {letter ? (
            <p>Sent {fmt(letter.sentAt)} by {letter.channel} ({letter.mode === "auto" ? "auto-sent" : "sent by you"}). Pay-by deadline {fmt(letter.deadline)}{deadlinePassed ? ", now passed." : "."}</p>
          ) : (
            <p>Not sent yet. {consumerNeedsReview ? "This is a consumer debt, so it is never auto-sent: review it before sending." : "Review the letter, then send."}</p>
          )}
          <div className="row">
            <a className="btn ghost" href={`/api/letters/${invoice.id}`} target="_blank">Open PDF</a>
            {!letter && !row.paid && (
              <form action={`/api/letters/${invoice.id}`} method="post"><button className="btn">Send demand letter</button></form>
            )}
            {!row.paid && (
              <form action={`/api/paid/${invoice.id}`} method="post"><button className="btn ghost">Mark paid</button></form>
            )}
          </div>
        </div>

        <div className="card">
          <h2>2. If it stays unpaid: {forum.name}</h2>
          <p>{forum.summary}</p>
          <dl className="kv">
            <dt>Claim amount</dt><dd>{money(invoice.amountDue)}{invoice.interestRate ? ` plus contractual interest at ${invoice.interestRate}%/yr` : " plus court-ordered interest"}</dd>
            <dt>Limitation date</dt><dd>{fmt(row.limitation)} <span className="note">(approximate: {j.limitation.note})</span></dd>
          </dl>
          <div className="row" style={{ marginTop: 14 }}>
            {reviewRequested ? <span className="pill good">Lawyer review requested</span> : (
              <form action={`/api/review/${invoice.id}`} method="post"><button className="btn ghost">{forum.selfServe ? "Request lawyer review (add-on)" : "Send file to the firm"}</button></form>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Step-by-step: {forum.name}</h2>
        <ol className="steps">
          {forum.steps.map((s, i) => (
            <li key={s.id} className={i === 0 && letter && deadlinePassed ? "done" : ""}>
              <div className="t">{s.title} {s.verify && <span className="pill grey" title="Confirm against current rules before relying on it">confirm</span>}</div>
              <div className="d">{s.detail}{s.document ? <> · <b>App prepares:</b> {s.document}</> : null}</div>
            </li>
          ))}
        </ol>
        <p className="note">{j.disclaimer}</p>
      </div>

      {forum.id === "small-claims" && (
        <div className="card">
          <h2>Notice of Claim: data the app will put on the form</h2>
          <dl className="kv">
            <dt>Claimant</dt><dd>{db.company.name}, {db.company.phone}, {db.company.email}</dd>
            <dt>Defendant</dt><dd>{customer.name}, {customer.address.join(", ")}</dd>
            <dt>Registry</dt><dd>Nearest to {customer.address.at(-1)} (defendant's location) — confirm</dd>
            <dt>What happened</dt><dd>The claimant provided {invoice.description.toLowerCase()} to the defendant and billed it on invoice {invoice.number} dated {fmt(invoice.issueDate)}, payable by {fmt(invoice.dueDate)}. The defendant has not paid. A written demand was {letter ? `sent on ${fmt(letter.sentAt)}` : "not yet sent"}.</dd>
            <dt>Amount claimed</dt><dd>{money(invoice.amountDue)} plus interest{invoice.interestRate ? ` at the contract rate of ${invoice.interestRate}%` : " under the Court Order Interest Act"}, and filing and service fees</dd>
            <dt>Attachments</dt><dd>Invoice, contract or terms, demand letter, proof of delivery</dd>
          </dl>
          <p className="note">Phase 4 fills the official fillable PDF with these fields.</p>
        </div>
      )}
    </>
  );
}
