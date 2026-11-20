import { requireUser, acct } from "@/lib/auth";
import { visibleTo } from "@/lib/matters";
import { buildEvents, type CalEvent } from "@/lib/calendar";
import { money } from "@/lib/aging";
import { loadRows } from "@/lib/ledger";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<CalEvent["kind"], string> = { deadline: "Payment deadline", followup: "Next step", limitation: "Limitation", collected: "Collected", lien: "Builders lien" };
const fmt = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

type View = "all" | "overdue" | "upcoming" | "collected";

export default async function CalendarPage({ searchParams }: { searchParams: { m?: string; view?: string } }) {
  const user = await requireUser();
  const { db, rows } = await loadRows(acct(user)).then((all) => visibleTo(user, all.db, all.rows));
  const todayIso = new Date().toISOString().slice(0, 10);
  const events = buildEvents(db, rows, todayIso);

  const month = /^\d{4}-\d{2}$/.test(searchParams.m ?? "") ? searchParams.m! : todayIso.slice(0, 7);
  const [y, mo] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const daysIn = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const shift = (n: number) => new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7);
  const monthName = first.toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });

  const view: View = (["overdue", "upcoming", "collected"] as const).find((v) => v === searchParams.view) ?? "all";
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const overdue = events.filter((e) => e.overdue);
  const upcoming = events.filter((e) => !e.overdue && e.kind !== "collected" && e.date >= todayIso);
  const collected = rows.filter((r) => r.paid);
  const list = view === "overdue" ? overdue : view === "upcoming" ? upcoming : view === "collected" ? events.filter((e) => e.kind === "collected") : events;
  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) if (e.date.startsWith(month)) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const tab = (v: View, label: string) => (
    <a className={`tab ${view === v ? "on" : ""}`} href={`/calendar?m=${month}&view=${v}#list`}>{label}</a>
  );

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Calendar</h1>
          <p className="sub">Every deadline, next step and limitation date across your matters.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <a className="btn ghost small" href="/notifications">Email reminders</a>
          <a className="btn ghost small" href="/api/reminders/all">Add all to my calendar (.ics)</a>
        </div>
      </div>

      <div className="tiles">
        <a className="tile bad" href={`/calendar?m=${month}&view=overdue#list`}><div className="n">{overdue.length}</div><div>Overdue items</div></a>
        <a className="tile" href={`/calendar?m=${month}&view=upcoming#list`}><div className="n">{upcoming.filter((e) => e.date <= in30).length}</div><div>Due in the next 30 days</div></a>
        <a className="tile good" href={`/calendar?m=${month}&view=collected#list`}><div className="n">{collected.length}</div><div>Collected · {money(collected.reduce((s, r) => s + r.invoice.amountDue, 0))}</div></a>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <a className="btn ghost small" href={`/calendar?m=${shift(-1)}&view=${view}`}>← {new Date(shift(-1) + "-01T00:00:00").toLocaleDateString("en-CA", { month: "short" })}</a>
          <h2 style={{ margin: 0 }}>{monthName}</h2>
          <a className="btn ghost small" href={`/calendar?m=${shift(1)}&view=${view}`}>{new Date(shift(1) + "-01T00:00:00").toLocaleDateString("en-CA", { month: "short" })} →</a>
        </div>
        <div className="cal">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="dow">{d}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={`l${i}`} className="day empty" />)}
          {Array.from({ length: daysIn }, (_, i) => {
            const d = `${month}-${String(i + 1).padStart(2, "0")}`;
            const evs = byDay.get(d) ?? [];
            return (
              <div key={d} className={`day ${d === todayIso ? "today" : ""}`}>
                <div className="num">{i + 1}</div>
                {evs.slice(0, 3).map((e, k) => (
                  <a key={k} href={e.href} className={`chip ${e.kind} ${e.overdue ? "late" : ""}`} title={`${e.title} · ${e.who}`}>{e.who}</a>
                ))}
                {evs.length > 3 && <div className="more">+{evs.length - 3} more</div>}
              </div>
            );
          })}
        </div>
        <div className="legend">
          <span className="chip deadline">Payment deadline</span><span className="chip followup">Next step</span>
          <span className="chip limitation">Limitation</span><span className="chip lien">Builders lien</span><span className="chip collected">Collected</span><span className="chip late">Overdue</span>
        </div>
      </div>

      <div className="card" id="list">
        <div className="tabs">{tab("all", "All")}{tab("overdue", `Overdue (${overdue.length})`)}{tab("upcoming", "Upcoming")}{tab("collected", "Collected")}</div>
        {list.length === 0 ? <p className="note">Nothing here.</p> : (
          <table className="agenda">
            <tbody>
              {list.map((e, i) => (
                <tr key={i} className={e.overdue ? "late" : ""}>
                  <td className="when">{fmt(e.date)}</td>
                  <td><span className={`chip ${e.kind} ${e.overdue ? "late" : ""}`}>{e.overdue ? "Overdue" : KIND_LABEL[e.kind]}</span></td>
                  <td><a href={e.href}>{e.title}</a><div className="note">{e.who}{e.amount ? ` · ${e.amount}` : ""}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
