import { BUCKETS, money } from "@/lib/aging";
import { getUser, requireUser } from "@/lib/auth";
import { Landing } from "./landing";
import { loadRows, type Row } from "@/lib/ledger";
import { usage } from "@/lib/usage";

export const dynamic = "force-dynamic";

function status(r: Row) {
  if (r.paid) return <span className="pill good">Paid</span>;
  if (r.daysToLimitation <= 0) return <span className="pill bad">Limitation passed</span>;
  if (r.letter) {
    const past = new Date(r.letter.deadline) < new Date();
    return past ? <span className="pill warn">Deadline passed</span> : <span className="pill blue">Letter sent</span>;
  }
  if (r.bucket === "90+") return <span className="pill warn">Ready for demand</span>;
  return <span className="pill grey">Watching</span>;
}

export default async function Dashboard({ searchParams }: { searchParams: { autosent?: string; held?: string } }) {
  if (!(await getUser())) return <Landing />;
  const user = await requireUser();
  const { db, rows } = await loadRows(user.id);
  const u = usage(db);
  const open = rows.filter((r) => !r.paid);
  const totals = BUCKETS.map((b) => {
    const rs = open.filter((r) => r.bucket === b);
    return { b, n: rs.length, sum: rs.reduce((s, r) => s + r.invoice.amountDue, 0) };
  });
  const queue = rows.filter((r) => r.days >= db.settings.thresholdDays);
  const watching = rows.filter((r) => r.days < db.settings.thresholdDays && r.days > 0);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Receivables</h1>
          <p className="sub">Synced from: sample ledger · {db.company.name} · auto-send is {db.settings.autoSend ? "on for business debtors" : "off"}</p>
        </div>
        <form action="/api/sync" method="post">
          <button className="btn ghost">Run nightly sync</button>
        </form>
      </div>
      {searchParams.autosent && (
        <div className="banner good">Nightly sync ran. {searchParams.autosent} letter(s) auto-sent.{Number(searchParams.held) > 0 && ` ${searchParams.held} held back: monthly plan limit reached.`}</div>
      )}
      {!u.plan && <div className="banner warn">You're on no plan yet. <a href="/billing">Choose a plan</a> to send demand letters.</div>}
      {!db.company.letterhead && (
        <div className="banner warn">No letterhead uploaded yet. Letters use a plain page until you <a href="/settings">upload one</a>.</div>
      )}

      <div className="tiles">
        {totals.map((t) => (
          <div key={t.b} className={`tile ${t.b === "90+" ? "hot" : ""}`}>
            <div className="label">{t.b === "current" ? "Not yet due" : `${t.b} days`}</div>
            <div className="val">{money(t.sum)}</div>
            <div className="n">{t.n} invoice{t.n === 1 ? "" : "s"}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Over {db.settings.thresholdDays} days: demand queue</h2>
        <table>
          <thead>
            <tr><th>Invoice</th><th>Customer</th><th className="num">Days late</th><th className="num">Balance</th><th>Route if unpaid</th><th>Limitation</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {queue.map((r) => (
              <tr key={r.invoice.id}>
                <td><a href={`/cases/${r.invoice.id}`}>{r.invoice.number}</a></td>
                <td>{r.customer.name} {r.customer.kind === "consumer" && <span className="pill grey">consumer</span>}</td>
                <td className="num">{r.days}</td>
                <td className="num">{money(r.invoice.amountDue)}</td>
                <td>{r.forum.name.replace(" (Provincial Court)", "").replace(" (lawyer hand-off)", "")}</td>
                <td>{r.daysToLimitation > 0 ? `${r.daysToLimitation} days left` : "Expired"}</td>
                <td>{status(r)}</td>
                <td><a className="btn small ghost" href={`/cases/${r.invoice.id}`}>{r.letter ? "Next steps" : "Review letter"}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Coming up</h2>
        <table>
          <thead><tr><th>Invoice</th><th>Customer</th><th className="num">Days late</th><th className="num">Balance</th><th>Reaches {db.settings.thresholdDays} days in</th></tr></thead>
          <tbody>
            {watching.map((r) => (
              <tr key={r.invoice.id}>
                <td>{r.invoice.number}</td><td>{r.customer.name}</td><td className="num">{r.days}</td>
                <td className="num">{money(r.invoice.amountDue)}</td><td>{db.settings.thresholdDays - r.days} days</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
