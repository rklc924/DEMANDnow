import { Fragment } from "react";
import { money } from "@/lib/aging";
import type { EnforcementStep, Jurisdiction } from "@/lib/jurisdictions/types";
import type { Row } from "@/lib/ledger";
import type { CaseProgress, Company, DocCheck } from "@/lib/store";

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
        <dt>Amount claimed</dt><dd>{money(invoice.amountDue)} plus interest{invoice.interestRate ? ` at the contract rate of ${invoice.interestRate}%` : " under the Court Order Interest Act"}, and filing and service fees</dd>
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
export function ServiceOptions({ forum, served, action }: { forum: Row["forum"]; served?: string; action: string }) {
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
          {s.serverFees.placeholder && <p className="note"><span className="pill grey">sample prices</span> Booking from the app opens at launch.</p>}
        </div>
        <div className="opt">
          <h3>Option 2: Serve it yourself</h3>
          <ul className="selfserve">
            {s.selfServe.map((x) => (
              <li key={x.title}><b>{x.title}.</b> {x.detail} {x.verify && <span className="pill grey" title="Confirm against current rules before relying on it">confirm</span>}</li>
            ))}
          </ul>
          <p><b>Proof of service: {s.proof.document}.</b> {s.proof.detail} {s.proof.verify && <span className="pill grey">confirm</span>}</p>
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

/** The matter's steps as a tick-box checklist. Steps that need outside proof take an upload, which is checked. */
export function CaseChecklist({ row, j, progress, autoDone }: { row: Row; j: Jurisdiction; progress?: CaseProgress; autoDone?: string[] }) {
  return <Checklist title={`Checklist: ${row.forum.name}`} steps={row.forum.steps} api={`/api/cases/${row.invoice.id}`} progress={progress} autoDone={autoDone} disclaimer={j.disclaimer} />;
}

export function Checklist({ title, steps, api, progress, autoDone, disclaimer }: { title: string; steps: EnforcementStep[]; api: string; progress?: CaseProgress; autoDone?: string[]; disclaimer: string }) {
  const done = new Set([...(progress?.done ?? []), ...(autoDone ?? [])]);
  const total = steps.length;
  const count = steps.filter((s) => done.has(s.id)).length;
  return (
    <div className="card" id="steps">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <span className="pill blue">{count} of {total} done</span>
      </div>
      <div className="meter" style={{ margin: "10px 0 14px" }}><div style={{ width: `${(count / total) * 100}%` }} /></div>
      <ol className="checklist">
        {steps.map((s) => {
          const isDone = done.has(s.id);
          const docs = (progress?.docs ?? []).filter((d) => d.stepId === s.id);
          const latest = docs.at(-1);
          return (
            <li key={s.id} className={isDone ? "done" : ""}>
              <form action={`${api}/step`} method="post" className="tick">
                <input type="hidden" name="step" value={s.id} />
                <input type="hidden" name="done" value={isDone ? "0" : "1"} />
                <button className={`box ${isDone ? "on" : ""}`} aria-label={isDone ? "Mark not done" : "Mark done"} title={isDone ? "Mark not done" : "Mark done"}>{isDone ? "✓" : ""}</button>
              </form>
              <div className="body">
                <div className="t">{s.title} {s.verify && <span className="pill grey" title="Confirm against current rules before relying on it">confirm</span>}</div>
                <div className="d">{s.detail}{s.document ? <> · <b>Prepared for you:</b> {s.document}</> : null}</div>
                {s.upload && (
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
              </div>
            </li>
          );
        })}
      </ol>
      <p className="note">{disclaimer} Automatic document checks help catch common mistakes; they are not a guarantee the court will accept a document.</p>
    </div>
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
