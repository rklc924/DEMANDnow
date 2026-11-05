import { requireUser } from "@/lib/auth";
import { PLANS, priceLabel, type Interval, type PlanId } from "@/lib/plans";
import { readDB } from "@/lib/store";
import { billingLive } from "@/lib/stripe";
import { usage } from "@/lib/usage";
import { IntervalToggle, PlanCards } from "../plan-cards";

export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

export default async function Billing({ searchParams }: { searchParams: { interval?: string; plan?: string; activated?: string; canceled?: string; card?: string } }) {
  const user = await requireUser();
  const db = await readDB(user.id);
  const u = usage(db);
  const interval: Interval = searchParams.interval === "annual" ? "annual" : searchParams.interval === "monthly" ? "monthly" : (u.sub?.interval ?? "monthly");
  const pct = u.limit ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
  const base = searchParams.plan ? `/billing?plan=${searchParams.plan}` : "/billing";

  return (
    <>
      <h1>Plan &amp; billing</h1>
      <p className="sub">{db.company.name}</p>
      {searchParams.card && <div className="banner good">Card saved. {u.sub ? "" : "Now choose a plan."}</div>}
      {db.card && (
        <div className="card row" style={{ justifyContent: "space-between" }}>
          <div><b>Card on file</b><div className="note">{db.card.brand.toUpperCase()} ending {db.card.last4}{db.card.expMonth ? `, expires ${db.card.expMonth}/${db.card.expYear}` : ""}{db.card.demo ? " (demo)" : ""}</div></div>
          <a className="btn small ghost" href="/billing/card">Update card</a>
        </div>
      )}
      {(db.charges ?? []).length > 0 && (
        <div className="card">
          <h2>One-time charges</h2>
          <table className="agenda"><tbody>{db.charges!.slice().reverse().map((c) => <tr key={c.id}><td className="when">{new Date(c.at).toLocaleDateString("en-CA")}</td><td>{c.description}</td><td style={{ textAlign: "right" }}>${c.amount.toFixed(2)}</td></tr>)}</tbody></table>
        </div>
      )}
      {searchParams.activated && <div className="banner good">Your plan is active. You can send demand letters now.</div>}
      {searchParams.canceled && <div className="banner warn">Your plan is canceled. Existing cases stay available; sending is paused.</div>}

      {u.sub && u.plan ? (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>{u.plan.name} · {u.sub.interval}</h2>
              <div className="note">{priceLabel(u.plan, u.sub.interval)} · renews {fmt(u.sub.renewsAt)}</div>
            </div>
            <div className="row">
              {billingLive() && <form action="/api/billing/portal" method="post"><button className="btn small ghost">Manage billing &amp; invoices</button></form>}
              <form action="/api/billing/cancel" method="post"><button className="btn small ghost">Cancel plan</button></form>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: "space-between", fontSize: 14 }}>
              <span>Demand letters this month</span>
              <b>{u.limit === null ? `${u.used} sent · unlimited` : `${u.used} of ${u.limit}`}</b>
            </div>
            {u.limit !== null && <div className="meter"><div style={{ width: `${pct}%` }} className={pct >= 100 ? "full" : ""} /></div>}
          </div>
        </div>
      ) : (
        <div className="banner warn">Choose a plan to start sending demand letters.</div>
      )}

      <div style={{ textAlign: "center", margin: "8px 0 16px" }}>
        <IntervalToggle interval={interval} base={base} />
      </div>
      <PlanCards interval={interval} mode="checkout" current={u.sub ? { plan: u.sub.plan, interval: u.sub.interval } : undefined} highlight={PLANS[searchParams.plan as PlanId]?.id} />
      <p className="note" style={{ textAlign: "center" }}>
        {billingLive()
          ? "Payments are processed securely by Stripe. Prices in CAD, plus applicable GST/PST."
          : "Demo mode: subscribing activates the plan without a card. Add Stripe keys to take real payments."}
      </p>
    </>
  );
}
