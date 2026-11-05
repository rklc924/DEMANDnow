import { notFound } from "next/navigation";
import { money } from "@/lib/aging";
import { getJurisdiction } from "@/lib/jurisdictions";
import { accruedInterest } from "@/lib/letters/template";
import { draftRow, ONE_OFF_PRICE, readDraft } from "@/lib/oneoff";
import { PLANS, priceLabel } from "@/lib/plans";
import { billingLive } from "@/lib/stripe";
import { ClaimSheet, StepGuide } from "../../guide";

export const dynamic = "force-dynamic";

// One-off demand, step 2: a summary of what they'll get, then pay $75 or subscribe.
// After payment the same page unlocks the letter download and the full guide.
export default async function OneOff({ params, searchParams }: { params: { id: string }; searchParams: { paid?: string } }) {
  const d = await readDraft(params.id);
  if (!d) notFound();
  const row = draftRow(d);
  const j = getJurisdiction("BC");
  const interest = accruedInterest(row, new Date());
  const total = d.invoice.amountDue + interest.amount;

  return (
    <>
      <p className="note"><a href="/start">← Start a different demand</a></p>
      <h1>Demand to {d.debtor.name}</h1>
      <p className="sub">{money(total)} owing{interest.amount ? ` including ${money(interest.amount)} interest` : ""} · {row.days > 0 ? `${row.days} days past due` : "not yet due"} · from {d.company.name}</p>
      {searchParams.paid && d.paid && <div className="banner good">Payment received. Your letter and guide are ready below.</div>}
      {row.daysToLimitation <= 0 && <div className="banner warn">This debt may be past the two-year limitation period. Speak to a lawyer before sending a demand.</div>}

      <div className="grid2">
        <div className="card">
          <h2>Your demand letter</h2>
          <dl className="kv">
            <dt>To</dt><dd>{d.debtor.name}{d.debtor.kind === "consumer" ? " (consumer)" : ""}</dd>
            <dt>Amount demanded</dt><dd>{money(total)}{interest.rate ? `, then ${money(interest.perDiem)}/day` : ""}</dd>
            <dt>Pay-by date</dt><dd>14 days from the letter date</dd>
            <dt>Letterhead</dt><dd>{d.company.letterhead ? "Your uploaded letterhead" : "Plain page (no letterhead uploaded)"}</dd>
            <dt>If unpaid</dt><dd>{row.forum.name}</dd>
          </dl>
          {d.paid && (
            <div className="row" style={{ marginTop: 16 }}>
              <a className="btn" href={`/api/oneoff/${d.id}/letter`}>Download letter (PDF)</a>
            </div>
          )}
        </div>

        {!d.paid ? (
          <div className="card paywall">
            <h2>Generate your letter and guide</h2>
            <p>Your details are saved. Choose how you'd like to continue:</p>
            <form action={`/api/oneoff/${d.id}/pay`} method="post">
              <button className="btn" style={{ width: "100%" }}>Pay ${ONE_OFF_PRICE} for this demand</button>
            </form>
            <p className="note" style={{ margin: "6px 0 14px" }}>One letter on your letterhead, plus the full {row.forum.selfServe ? `${row.forum.name} ` : ""}step-by-step guide{row.forum.id === "small-claims" ? " and Notice of Claim details" : ""}.</p>
            <a className="btn ghost" style={{ width: "100%", textAlign: "center" }} href={`/signup?plan=standard&draft=${d.id}`}>Subscribe instead · from {priceLabel(PLANS.standard, "monthly")}</a>
            <p className="note" style={{ marginTop: 6 }}>Up to 10 demands a month, accounting sync and 90-day alerts. This demand carries over to your account.</p>
            <p className="note" style={{ marginTop: 12 }}>{billingLive() ? "Secure payment by Stripe. Prices in CAD plus applicable GST/PST." : "Demo mode: payment is skipped."}</p>
          </div>
        ) : (
          <div className="card">
            <h2>What happens next</h2>
            <p>Send the letter by email and registered mail and keep proof of delivery. If you're not paid by the deadline, follow the guide below.</p>
            <p className="note">Have more overdue invoices? <a href={`/signup?plan=standard&draft=${d.id}`}>Subscribe</a> and this demand carries over to your account.</p>
          </div>
        )}
      </div>

      <StepGuide row={row} j={j} locked={!d.paid} />
      {d.paid && row.forum.id === "small-claims" && <ClaimSheet row={row} company={d.company} />}
    </>
  );
}
