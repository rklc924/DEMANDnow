import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { money } from "@/lib/aging";
import { getJurisdiction } from "@/lib/jurisdictions";
import { loadRow } from "@/lib/ledger";
import { CaseChecklist, ClaimSheet, ServiceOptions } from "../../guide";
import { PartyCard } from "./party";

export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });

export default async function CasePage({ params, searchParams }: { params: { id: string }; searchParams: { sent?: string; review?: string; limit?: string; served?: string; booked?: string; quote?: string; serveError?: string; verified?: string; party?: string; partyError?: string } }) {
  const user = await requireUser();
  const { db, row } = await loadRow(user.id, params.id);
  if (!row) notFound();
  const j = getJurisdiction(db.company.jurisdiction);
  const { invoice, customer, forum, letter } = row;
  const deadlinePassed = letter ? new Date(letter.deadline + "T23:59:59") < new Date() : false;
  const reviewRequested = db.reviewRequests?.some((r) => r.invoiceId === invoice.id);
  const consumerNeedsReview = customer.kind === "consumer";
  const reminders = (db.reminders ?? []).filter((r) => r.invoiceId === invoice.id && (!letter || r.id.startsWith(letter.id)));

  return (
    <>
      <p className="note"><a href="/">← Receivables</a></p>
      <h1>{invoice.number} · {customer.name}</h1>
      <p className="sub">{money(invoice.amountDue)} · {row.days} days past due · {customer.kind} customer</p>
      {searchParams.sent && <div className="banner good">Demand letter sent{letter?.emailedTo ? ` by email to ${letter.emailedTo}` : ""}. Deadline to pay: {letter && fmt(letter.deadline)}.{db.mailbox?.addReminders ? " Follow-up reminders added to your calendar." : ""}</div>}
      {searchParams.limit && <div className="banner warn">{searchParams.limit} <a href="/billing">See plans</a></div>}
      {searchParams.review && <div className="banner good">Sent to the firm for review. A lawyer will contact you within one business day.</div>}
      {row.paid && <div className="banner good">Marked paid. The workflow has stopped.</div>}
      {row.daysToLimitation <= 120 && row.daysToLimitation > 0 && (
        <div className="banner warn">Limitation date is close: {fmt(row.limitation)} ({row.daysToLimitation} days). A claim must be started before then.</div>
      )}

      <PartyCard
        action={`/api/cases/${invoice.id}/party`}
        party={db.parties?.[customer.id]}
        invoiceName={customer.invoiceName ?? customer.name}
        isBusiness={customer.kind === "business"}
        status={searchParams.party}
        error={searchParams.partyError}
      />

      <div className="grid2">
        <div className="card">
          <h2>1. Demand letter</h2>
          {!letter && !db.parties?.[customer.id]?.confirmedAt && <div className="banner warn">Confirm the debtor's legal name and address above before sending, so the letter matches the claim you may file later.</div>}
          {letter ? (
            <p>Sent {fmt(letter.sentAt)} by {letter.channel} ({letter.mode === "auto" ? "auto-sent" : "sent by you"}). Pay-by deadline {fmt(letter.deadline)}{deadlinePassed ? ", now passed." : "."}</p>
          ) : (
            <p>Not sent yet. {consumerNeedsReview ? "This is a consumer debt, so it is never auto-sent: review it before sending." : "Review the letter, then send."}</p>
          )}
          {letter?.emailedTo && <p className="note">Emailed to {letter.emailedTo} from your {letter.emailedVia === "google" ? "Gmail" : letter.emailedVia === "microsoft" ? "Outlook" : "connected (demo)"} mailbox.</p>}
          {letter?.deliveryError && <div className="banner bad">Delivery problem: {letter.deliveryError}</div>}
          {letter && reminders.length > 0 && (
            <p className="note">Follow-ups: {reminders.map((r) => `${fmt(r.date)} ${r.title.split(":")[0].split(" (")[0]}`).join(" · ")}. {reminders.some((r) => r.eventId) ? "Added to your calendar." : ""} <a href={`/api/reminders/${invoice.id}`}>Download .ics</a></p>
          )}
          <div className="row">
            <a className="btn ghost" href={`/api/letters/${invoice.id}`} target="_blank">Open PDF</a>
            {!letter && !row.paid && (
              <form action={`/api/letters/${invoice.id}`} method="post"><button className="btn">Send demand letter</button></form>
            )}
            {!row.paid && (
              <form action={`/api/paid/${invoice.id}`} method="post"><button className="btn ghost">Mark paid</button></form>
            )}
            {db.manual?.invoices.some((i) => i.id === invoice.id) && !letter && (
              <form action={`/api/invoices/${invoice.id}/delete`} method="post"><button className="btn ghost">Delete invoice</button></form>
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
            {(reviewRequested || !forum.selfServe) && (
              <a className="btn ghost" href={`/api/letters/${invoice.id}?variant=firm`} target="_blank">Firm demand letter</a>
            )}
            {reviewRequested ? <span className="pill good">Lawyer review requested</span> : (
              <form action={`/api/review/${invoice.id}`} method="post"><button className="btn ghost">{forum.selfServe ? "Request lawyer review (add-on)" : "Send file to the firm"}</button></form>
            )}
          </div>
        </div>
      </div>

      {Object.values(db.progress?.[invoice.id]?.docs ?? []).some((d) => d.status === "issues") && (
        <div className="banner bad">A document you uploaded has problems. See the red box in the checklist below.</div>
      )}
      <CaseChecklist row={row} j={j} progress={db.progress?.[invoice.id]} autoDone={letter && deadlinePassed ? ["demand"] : []} />
      {forum.id === "small-claims" && <ClaimSheet row={row} company={db.company} letterSent={letter?.sentAt} />}
      <ServiceOptions
        forum={forum}
        served={searchParams.served ?? db.servedDates?.[invoice.id]}
        action={`/cases/${params.id}#service`}
        booking={{
          action: `/api/cases/${invoice.id}/serve`,
          certificate: `/api/cases/${invoice.id}/certificate`,
          isCompany: (db.parties?.[customer.id]?.type ?? (customer.kind === "business" ? "company" : "individual")) === "company",
          serveOn: customer.name,
          address: customer.address,
          hasNotice: (db.progress?.[invoice.id]?.docs ?? []).some((d) => d.stepId === "notice"),
          card: db.card ? `${db.card.brand.toUpperCase()} ending ${db.card.last4}` : undefined,
          jobs: (db.serviceJobs ?? []).filter((j) => j.invoiceId === invoice.id),
          message: searchParams.booked
            ? { kind: "good", text: "Booked. Your card was charged and the process server has the documents. We'll email you when it's served." }
            : searchParams.quote
              ? { kind: "good", text: "Quote requested. We'll email you a price before anything is charged." }
              : searchParams.serveError
                ? { kind: "bad", text: searchParams.serveError }
                : undefined,
        }}
      />
    </>
  );
}
