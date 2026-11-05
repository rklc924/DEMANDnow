import { money } from "@/lib/aging";
import type { Jurisdiction } from "@/lib/jurisdictions/types";
import type { Row } from "@/lib/ledger";
import type { Company } from "@/lib/store";

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
