import { Fragment } from "react";
import { money } from "@/lib/aging";
import type { EnforcementStep, Jurisdiction } from "@/lib/jurisdictions/types";
import type { Row } from "@/lib/ledger";
import type { CaseProgress, Company, DocCheck, Payment } from "@/lib/store";
import { stageOf } from "@/lib/workflow";

// The step-by-step enforcement guide and Notice of Claim data sheet, shared by subscriber cases and one-offs.

const fmt = (iso: string) =>
  new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });

export function StepGuide({ row, j, firstDone, locked }: { row: Row; j: Jurisdiction; firstDone?: boolean; locked?: boolean }) {
  const { forum } = row;
  return (
    <div className="card">
      <h2>Step-by-step: {forum.name}</h2>
      <ol className={`steps ${locked ? "locked" : ""}`}>
        {forum.steps.map((s, i) => (
          <li key={s.id} className={i === 0 && firstDone ? "done" : ""}>
            <div className="t">{s.title} {s.verify && !locked && <span className="pill grey" title="Confirm against current rules before relying on it">confirm</span>}</div>
            {!locked && <div className="d">{s.detail}{s.document ? <> · <b>Prepared for you:</b> {s.document}</> : null}</div>}
          </li>
        ))}
      </ol>
      <p className="note">{j.disclaimer}</p>
    </div>
  );
}

export function ClaimSheet({ row, company, letterSent }: { row: Row; company: Company; letterSent?: string }) {
  const { invoice, customer } = row;
  return (
    <div className="card">
      <h2>Notice of Claim: what goes on the form</h2>
      <dl className="kv">
        <dt>Claimant</dt><dd>{[company.name, company.phone, company.email].filter(Boolean).join(", ")}</dd>
        <dt>Defendant</dt><dd>{customer.name}, {customer.address.join(", ")}</dd>
        <dt>Registry</dt><dd>Nearest to {customer.address.at(-1) ?? "the defendant"} (defendant's location), or where the transaction took place</dd>
        <dt>What happened</dt><dd>The claimant provided {invoice.description.toLowerCase()} to the defendant and billed it on invoice {invoice.number}, payable by {fmt(invoice.dueDate)}. The defendant has not paid. A written demand was {letterSent ? `sent on ${fmt(letterSent)}` : "sent before filing"}.</dd>
        <dt>Amount claimed</dt><dd>{money(row.collected > 0 ? row.balance : invoice.amountDue)}{row.collected > 0 ? ` (the invoice was ${money(invoice.amountDue)}, less ${money(row.collected)} paid)` : ""} plus interest{invoice.interestRate ? ` at the contract rate of ${invoice.interestRate}%` : " under the Court Order Interest Act"}, and filing and service fees</dd>
        <dt>Attachments</dt><dd>Invoice, contract or terms, demand letter, proof of delivery</dd>
      </dl>
    </div>
  );
}

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Two ways to serve: a fixed-fee process server, or do it yourself and file proof. Then dates counted from service. */
export interface BookingProps {
  action: string; // POST endpoint
  serveOn: string;
  address: string[];
  hasNotice: boolean;
  card?: string; // "VISA ending 4242"
  jobs: { id: string; createdAt: string; status: string; total: number; servedAt?: string }[];
  message?: { kind: "good" | "bad"; text: string };
  /** Pre-filled Certificate of Service download, plus ?kind=individual|company. */
  certificate?: string;
  isCompany?: boolean;
}

export function ServiceOptions({ forum, served, action, booking }: { forum: Row["forum"]; served?: string; action: string; booking?: BookingProps }) {
  const s = forum.service;
  if (!s) return null;
  const servedOk = served && /^\d{4}-\d{2}-\d{2}$/.test(served) ? served : undefined;
  return (
    <div className="card" id="service">
      <h2>Serving the {s.document}</h2>
      <p className="note" style={{ marginTop: 0 }}>The defendant has to receive the filed {s.document} before the case can move forward. Choose one:</p>
      <div className="grid2 service-opts">
        <div className="opt">
          <h3>Option 1: Use a process server, fixed fee</h3>
          <table className="fees">
            <tbody>
              {s.serverFees.fees.map((f) => (
                <tr key={f.area}>
                  <td>{f.area}{f.note ? <div className="note">{f.note}</div> : null}</td>
                  <td className="amt">{f.price === null ? "Quote" : `${f.area.startsWith("Rush") ? "+" : ""}$${f.price}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">{s.serverFees.includes} Prices in CAD plus tax. Service costs can usually be claimed back from the defendant as part of your expenses.</p>
          <p className="note">A ${s.serverFees.bookingFee} Demand Now booking fee is added to each job. {s.serverFees.placeholder && <span className="pill grey">sample prices</span>}</p>
          {booking ? <BookingForm s={s} b={booking} /> : <p className="note"><a href="/signup?plan=standard">Subscribe</a> to book a process server from your account.</p>}
        </div>
        <div className="opt">
          <h3>Option 2: Serve it yourself</h3>
          <ul className="selfserve">
            {s.selfServe.map((x) => (
              <li key={x.title}><b>{x.title}.</b> {x.detail} {x.verify && <span className="pill grey" title="Confirm against current rules before relying on it">confirm</span>}</li>
            ))}
          </ul>
          <p><b>Proof of service: {s.proof.document}.</b> {s.proof.detail} {s.proof.verify && <span className="pill grey">confirm</span>}</p>
          {booking?.certificate && (
            <div className="row">
              <a className={`btn ${booking.isCompany ? "" : "ghost"}`} href={`${booking.certificate}?kind=company`} target="_blank">Certificate of Service: company</a>
              <a className={`btn ${booking.isCompany ? "ghost" : ""}`} href={`${booking.certificate}?kind=individual`} target="_blank">Certificate of Service: individual</a>
            </div>
          )}
        </div>
      </div>

      <h3 style={{ marginTop: 18 }}>Once served: your next dates</h3>
      <form method="get" action={action} className="row" style={{ gap: 10, alignItems: "end" }}>
        <div><label>Date the {s.document} was served</label><input type="date" name="served" defaultValue={servedOk} required /></div>
        <button className="btn small">Work out my dates</button>
      </form>
      {servedOk && (
        <dl className="kv" style={{ marginTop: 12 }}>
          <dt>Served</dt><dd>{fmt(servedOk)}</dd>
          {s.afterService.map((a) => (
            <Fragment key={a.label}>
              <dt>{a.label}</dt>
              <dd>{fmt(addDays(servedOk, a.days))}{a.outsideProvinceDays ? ` (${fmt(addDays(servedOk, a.outsideProvinceDays))} if served outside BC)` : ""}</dd>
            </Fragment>
          ))}
          <dt>Next</dt><dd>File your {s.proof.document} now if you haven't. If no Reply arrives by the deadline, apply for a default order.</dd>
        </dl>
      )}
      <p className="note" style={{ marginTop: 14 }}>
        Follow the court's own service guidelines:{" "}
        {s.officialGuides.map((g, i) => (<span key={g.url}>{i ? " · " : ""}<a href={g.url} target="_blank" rel="noreferrer">{g.label}</a></span>))}
      </p>
    </div>
  );
}

function BookingForm({ s, b }: { s: NonNullable<Row["forum"]["service"]>; b: BookingProps }) {
  const areas = s.serverFees.fees.filter((f) => !f.addOn);
  const rush = s.serverFees.fees.find((f) => f.addOn);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  return (
    <div className="booking">
      {b.message && <div className={`banner ${b.message.kind}`}>{b.message.text}</div>}
      {b.jobs.length > 0 && (
        <ul className="jobs">
          {b.jobs.map((j) => (
            <li key={j.id}>
              <span className={`pill ${j.status === "served" ? "good" : j.status === "failed" ? "bad" : "blue"}`}>
                {j.status === "served" ? `Served ${j.servedAt}` : j.status === "dispatched" ? "With the process server" : j.status === "quote" ? "Quote requested" : j.status}
              </span>{" "}
              Booked {fmtDate(j.createdAt)}{j.total ? ` · $${j.total}` : ""}
            </li>
          ))}
        </ul>
      )}
      <details open={b.jobs.length === 0}>
        <summary className="btn small">Book a process server</summary>
        <form action={b.action} method="post" encType="multipart/form-data" style={{ marginTop: 10 }}>
          <label>Where is the defendant?</label>
          <select name="area" defaultValue={areas[0]?.id}>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.area}: {a.price === null ? "quote" : `$${a.price} + $${s.serverFees.bookingFee} booking`}</option>)}
          </select>
          {rush && <label className="check" style={{ marginTop: 8 }}><input type="checkbox" name="rush" /> <span>Rush, attempt within 24 hours (+${rush.price})</span></label>}
          <label>Serve on</label><input type="text" name="serveOn" defaultValue={b.serveOn} />
          <label>Last known address (one line per row)</label><textarea name="address" defaultValue={b.address.join(NL)} required />
          <label>Notes for the server (best times, description, buzzer)</label><input type="text" name="notes" />
          <div className="grid2" style={{ gap: 10 }}>
            <div><label>Court file number</label><input type="text" name="courtFileNo" /></div>
            <div><label>Registry</label><input type="text" name="registry" placeholder="e.g. Vancouver (Robson Square)" /></div>
          </div>
          {!b.hasNotice && (<><label>Your filed {s.document} (PDF or photo)</label><input type="file" name="file" accept="application/pdf,image/png,image/jpeg" required /></>)}
          {b.hasNotice && <p className="note">We'll send the filed {s.document} you uploaded in the checklist, with a pre-filled Certificate of Service for the server to sign.</p>}
          <button className="btn" style={{ marginTop: 10 }}>Book and charge my card{b.card ? ` (${b.card})` : ""}</button>
          <p className="note">Lower Mainland jobs go straight to our process server by email and text. Other areas: we email you a quote first, and nothing is charged until you accept.</p>
        </form>
      </details>
    </div>
  );
}

const NL = String.fromCharCode(10);

/** The matter's steps as a tick-box checklist. Ticking a step moves the workflow on to the next one (lib/workflow.ts).
 *  Steps that need outside proof take an upload, which is checked. The last box records funds collected. */
export function CaseChecklist({ row, j, progress, autoDone, collect, ticked }: { row: Row; j: Jurisdiction; progress?: CaseProgress; autoDone?: string[]; collect?: CollectProps; ticked?: string }) {
  return <Checklist title={`Checklist: ${row.forum.name}`} steps={row.forum.steps} api={`/api/cases/${row.invoice.id}`} progress={progress} autoDone={autoDone} disclaimer={j.disclaimer} collect={collect} ticked={ticked} />;
}

export interface CollectProps {
  action: string; // POST: record a payment
  reopenAction: string; // POST, admin only
  amountDue: number;
  collected: number;
  balance: number;
  payments: Payment[];
  closed: boolean;
  closedAt?: string;
  /** Regular users need the "Add, delete and mark invoices paid" permission. */
  canRecord: boolean;
  isAdmin: boolean;
  message?: { kind: "good" | "bad"; text: string };
}

export function Checklist({ title, steps, api, progress, autoDone, disclaimer, collect, ticked }: { title: string; steps: EnforcementStep[]; api: string; progress?: CaseProgress; autoDone?: string[]; disclaimer: string; collect?: CollectProps; ticked?: string }) {
  const done = new Set([...(progress?.done ?? []), ...(autoDone ?? [])]);
  const auto = new Set(autoDone ?? []);
  const closed = collect ? collect.closed : !!progress?.closedAt;
  const { current, skipped, doneCount } = stageOf(steps, done);
  const total = steps.length + (collect ? 1 : 0);
  const count = doneCount + (collect && closed ? 1 : 0);
  const justTicked = ticked ? steps.find((s) => s.id === ticked) : undefined;
  return (
    <div className="card" id="steps">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <span className={`pill ${closed ? "good" : "blue"}`}>{closed ? "Closed: funds collected" : `${count} of ${total} done`}</span>
      </div>
      <div className="meter" style={{ margin: "10px 0 14px" }}><div style={{ width: `${(closed ? 1 : count / total) * 100}%` }} /></div>
      {!closed && (
        <p className="stage">
          {justTicked && <><b>✓ {justTicked.title}.</b>{" "}</>}
          {current ? <>Current step: <a href={`#step-${current.id}`}>{current.title}</a>{current.followUp ? <span className="note"> · reminder in {current.followUp.days} days</span> : null}</> : <>Every step is ticked.{collect ? " Record the funds collected below to close the matter." : ""}</>}
        </p>
      )}
      {closed && <p className="stage good">Funds collected in full. Enforcement has stopped, and the remaining steps and reminders are switched off.</p>}
      <ol className={`checklist ${closed ? "locked" : ""}`}>
        {steps.map((s) => {
          const isDone = done.has(s.id);
          const isAuto = auto.has(s.id) && !progress?.done.includes(s.id);
          const isCurrent = !closed && current?.id === s.id;
          const docs = (progress?.docs ?? []).filter((d) => d.stepId === s.id);
          const latest = docs.at(-1);
          return (
            <li key={s.id} id={`step-${s.id}`} className={[isDone ? "done" : "", isCurrent ? "current" : ""].join(" ")}>
              {closed || isAuto ? (
                <span className={`box static ${isDone ? "on" : ""}`} title={isAuto ? "Done automatically" : "Matter closed"}>{isDone ? "✓" : ""}</span>
              ) : (
                <form action={`${api}/step`} method="post" className="tick">
                  <input type="hidden" name="step" value={s.id} />
                  <input type="hidden" name="done" value={isDone ? "0" : "1"} />
                  <button className={`box ${isDone ? "on" : ""}`} aria-label={isDone ? `Mark "${s.title}" not done` : `Mark "${s.title}" done`} title={isDone ? "Mark not done" : "Mark done"}>{isDone ? "✓" : ""}</button>
                </form>
              )}
              <div className="body">
                <div className="t">
                  {s.title} {isCurrent && <span className="pill blue">Current step</span>} {skipped.has(s.id) && !closed && <span className="pill grey" title="A later step is ticked. Tick this one too if you did it.">Skipped</span>}{" "}
                  {s.verify && <span className="pill grey" title="Confirm against current rules before relying on it">confirm</span>}
                </div>
                <div className="d">{s.detail}{s.document ? <> · <b>Prepared for you:</b> {s.document}</> : null}{isAuto ? " · Ticked automatically." : ""}</div>
                {s.upload && !closed && (
                  <div className="upload">
                    {latest && <DocResult doc={latest} />}
                    {(!latest || latest.status !== "pass") && (
                      <form action={`${api}/docs`} method="post" encType="multipart/form-data" className="row" style={{ gap: 8, marginTop: 8 }}>
                        <input type="hidden" name="step" value={s.id} />
                        <span className="note"><b>Upload:</b> {s.upload.label}{s.upload.optional ? " (optional)" : ""}</span>
                        <input type="file" name="file" accept="application/pdf,image/png,image/jpeg" required />
                        <button className="btn small">{latest ? "Upload a corrected copy" : "Upload and check"}</button>
                      </form>
                    )}
                    {!latest && (
                      <details className="reqs"><summary>What we check</summary><ul>{s.upload.requirements.map((r) => <li key={r}>{r}</li>)}</ul></details>
                    )}
                  </div>
                )}
                {s.upload && closed && latest && <DocResult doc={latest} />}
              </div>
            </li>
          );
        })}
        {collect && <FundsCollected c={collect} />}
      </ol>
      <p className="note">{disclaimer} Automatic document checks help catch common mistakes; they are not a guarantee the court will accept a document.</p>
    </div>
  );
}

const cents = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The last box on every debt checklist: money received, full or partial. Full payment closes the matter. */
function FundsCollected({ c }: { c: CollectProps }) {
  const closed = c.closed;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <li id="collected" className={`collect ${closed ? "done" : ""}`}>
      <span className={`box static ${closed ? "on" : ""}`} aria-hidden>{closed ? "✓" : ""}</span>
      <div className="body">
        <div className="t">Funds collected {c.collected > 0 && !closed && <span className="pill warn">Part paid</span>}</div>
        <div className="d">
          {closed
            ? <>Closed{c.closedAt ? ` ${fmt(c.closedAt)}` : ""}. {cents(c.collected)} collected of {cents(c.amountDue)}.</>
            : c.collected > 0
              ? <>{cents(c.collected)} collected so far. <b>{cents(c.balance)} still owing</b>; the checklist carries on for the balance.</>
              : <>Record any money you receive, at any step. Paid in full closes the matter and stops every further step and reminder. A part payment lowers the balance and the workflow carries on.</>}
        </div>
        {c.message && <div className={`banner ${c.message.kind}`} style={{ marginTop: 8 }}>{c.message.text}</div>}
        {c.payments.length > 0 && (
          <table className="payments">
            <tbody>
              {c.payments.map((p) => (
                <tr key={p.id}>
                  <td>{fmt(p.date)}</td>
                  <td className="amt">{cents(p.amount)}</td>
                  <td className="note">{[p.method, p.note, `recorded by ${p.recordedBy}`].filter(Boolean).join(" · ")}</td>
                  <td>{c.isAdmin && (
                    <form action={c.reopenAction} method="post"><input type="hidden" name="payment" value={p.id} /><button className="link" title="Remove this payment (recorded by mistake)">Remove</button></form>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!closed && c.collected > 0 && <p className="note">A part payment can restart the two-year limitation period (Limitation Act, s. 24). <span className="pill grey" title="Confirm against current rules before relying on it">confirm</span></p>}
        {!closed && (c.canRecord ? (
          <details className="collect-form" open={!!c.message && c.message.kind === "bad"}>
            <summary className="btn small">Record funds collected</summary>
            <form action={c.action} method="post" style={{ marginTop: 10 }}>
              <div className="grid2" style={{ gap: 10 }}>
                <div><label>Amount received</label><input type="text" name="amount" inputMode="decimal" placeholder={cents(c.balance)} /></div>
                <div><label>Date received</label><input type="date" name="date" defaultValue={today} max={today} required /></div>
                <div><label>How it was paid (optional)</label><input type="text" name="method" placeholder="e.g. e-transfer, cheque, garnishment" /></div>
                <div><label>Note (optional)</label><input type="text" name="note" placeholder="e.g. settlement agreed at mediation" /></div>
              </div>
              <label className="check" style={{ marginTop: 8 }}><input type="checkbox" name="full" /> <span>Paid in full: close the matter (also for a settlement for less than the full amount)</span></label>
              <button className="btn" style={{ marginTop: 10 }}>Save payment</button>
              <p className="note">Leave the amount blank with "Paid in full" ticked to record the whole balance of {cents(c.balance)}.</p>
            </form>
          </details>
        ) : <p className="note">Your admin hasn't given you access to record payments.</p>)}
        {closed && c.isAdmin && (
          <form action={c.reopenAction} method="post" style={{ marginTop: 8 }}>
            <input type="hidden" name="reopen" value="1" />
            <button className="btn ghost small">Reopen matter</button> <span className="note">For example, if a payment bounced.</span>
          </form>
        )}
      </div>
    </li>
  );
}

function DocResult({ doc }: { doc: DocCheck }) {
  const problems = doc.checks.filter((c) => c.result !== "met");
  if (doc.status === "pass") {
    return <div className="docbox ok"><b>✓ {doc.name} passed every check.</b> {doc.summary}</div>;
  }
  if (doc.status === "unchecked") {
    return <div className="docbox wait"><b>{doc.name}</b>: {doc.summary}</div>;
  }
  return (
    <div className="docbox err" role="alert">
      <b>⚠ Problems found in {doc.name}</b>
      <p>{doc.summary}</p>
      <ul>
        {problems.map((c) => (
          <li key={c.requirement}><b>{c.result === "not_met" ? "Error" : "Can't confirm"}:</b> {c.requirement}. {c.note}</li>
        ))}
      </ul>
      <p className="note" style={{ margin: 0 }}>Fix these and upload a corrected copy before relying on this document.</p>
    </div>
  );
}
