import { PLANS, priceLabel, type Interval, type PlanId } from "@/lib/plans";

// Shared by the public pricing page and the signed-in billing page.
export function PlanCards({ interval, current, mode, highlight }: { interval: Interval; current?: { plan: PlanId; interval: Interval }; mode: "public" | "checkout"; highlight?: PlanId }) {
  return (
    <div className="plans">
      {Object.values(PLANS).map((p) => {
        const isCurrent = current?.plan === p.id && current.interval === interval;
        return (
          <div key={p.id} className={`card plan ${highlight === p.id || (!highlight && p.id === "unlimited") ? "featured" : ""}`}>
            <div className="plan-name">{p.name}</div>
            <div className="plan-price">{priceLabel(p, interval)}</div>
            <div className="note">{interval === "annual" ? `Billed yearly · equals $${Math.round(p.price.annual / 12)}/month` : "Billed monthly · cancel anytime"}</div>
            <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
            {mode === "public" ? (
              <a className="btn" href={`/signup?plan=${p.id}`}>Choose {p.name}</a>
            ) : isCurrent ? (
              <span className="pill good">Current plan</span>
            ) : (
              <form action="/api/billing/checkout" method="post">
                <input type="hidden" name="plan" value={p.id} />
                <input type="hidden" name="interval" value={interval} />
                <button className="btn">{current ? "Switch to" : "Subscribe to"} {p.name} {interval}</button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function IntervalToggle({ interval, base }: { interval: Interval; base: string }) {
  const sep = base.includes("?") ? "&" : "?";
  return (
    <div className="toggle">
      <a className={interval === "monthly" ? "on" : ""} href={`${base}${sep}interval=monthly`}>Monthly</a>
      <a className={interval === "annual" ? "on" : ""} href={`${base}${sep}interval=annual`}>Annual <span className="note">2 months free</span></a>
    </div>
  );
}
