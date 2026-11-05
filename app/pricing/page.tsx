import { ONE_OFF_PRICE } from "@/lib/oneoff";
import type { Interval } from "@/lib/plans";
import { IntervalToggle, PlanCards } from "../plan-cards";

export default function Pricing({ searchParams }: { searchParams: { interval?: string } }) {
  const interval: Interval = searchParams.interval === "annual" ? "annual" : "monthly";
  return (
    <>
      <div style={{ textAlign: "center" }}>
        <h1>Get paid on overdue invoices</h1>
        <p className="sub">Demand letters on your letterhead, then a guided path through the CRT, Small Claims, or to a lawyer. Prices in CAD.</p>
        <IntervalToggle interval={interval} base="/pricing" />
      </div>
      <PlanCards interval={interval} mode="public" />
      <div className="card oneoff-strip">
        <div>
          <div className="plan-name">Just one invoice?</div>
          <div className="note">One demand letter plus the step-by-step enforcement guide, no subscription. Fill in the details free, pay ${ONE_OFF_PRICE} when you generate.</div>
        </div>
        <a className="btn ghost" href="/start">One-off demand · ${ONE_OFF_PRICE}</a>
      </div>
      <p className="note" style={{ textAlign: "center" }}>Each demand letter sent counts as one matter. Lawyer review is a separate add-on.</p>
    </>
  );
}
