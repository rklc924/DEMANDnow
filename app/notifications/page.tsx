import { requireUser, acct, isAdmin, orgUsers, ROLE_LABEL } from "@/lib/auth";
import { allStages, collectDeadlines, todayPacific } from "@/lib/deadlines";
import { loadRows } from "@/lib/ledger";
import { LEAD_CHOICES, activeIdsOf, forUser, orgReminderSettings, prefsFor, scopeFor, upcoming } from "@/lib/notify";
import { usage } from "@/lib/usage";

export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export default async function Notifications({ searchParams }: { searchParams: { saved?: string; test?: string; error?: string } }) {
  const user = await requireUser({ card: false });
  const { db, rows } = await loadRows(acct(user));
  const prefs = prefsFor(user);
  const stages = allStages();
  const today = todayPacific();
  const team = await orgUsers(acct(user));
  const org = orgReminderSettings(db);
  const admin = isAdmin(user);
  const scope = scopeFor(user, db);
  const canChooseScope = admin || org.memberScope === "all";
  const list = upcoming(forUser(collectDeadlines(db, rows, today), user, db, activeIdsOf(team)), prefs, today);
  const plan = usage(db).plan;
  const on = (n: number) => prefs.leadDays.includes(n);

  return (
    <>
      <h1>Email reminders</h1>
      <p className="sub">Demand Now emails you the steps to take on each matter, and reminds you before each deadline.</p>
      {searchParams.saved && <div className="banner good">Saved.</div>}
      {!org.enabled && <div className="banner warn">{admin ? "Reminder emails are switched off for your whole team. Turn them on under Team reminder settings below." : "Your admin has switched reminder emails off for your team."}</div>}
      {searchParams.test && <div className="banner good">Test email sent to {user.email}.</div>}
      {searchParams.error === "unverified" && <div className="banner warn">Confirm your email address first. We sent you a link when you signed up.</div>}
      {searchParams.error === "send" && <div className="banner bad">The test email couldn't be sent. Try again in a few minutes.</div>}
      {!plan && (
        <div className="banner warn">
          Reminder emails are included with a subscription. {isAdmin(user) ? <a href="/billing">Choose a plan</a> : "Ask your admin to choose a plan."}
        </div>
      )}
      {!user.emailVerifiedAt && <div className="banner warn">Reminders go only to a confirmed email address. Check your inbox for the confirmation link.</div>}

      <form action="/api/notifications" method="post">
        <div className="grid2">
          <div className="card">
            <h2>Your reminders</h2>
            <label className="check">
              <input type="checkbox" name="email" defaultChecked={prefs.email} />
              <span>Email me reminders at <b>{user.email}</b></span>
            </label>
            <p className="note">You get at most one email a day, listing everything that's due. These settings are yours alone. Each person on your team chooses their own.</p>
            <h3 style={{ marginTop: 16 }}>Which matters</h3>
            {canChooseScope ? (
              <>
                <label className="check"><input type="radio" name="scope" value="all" defaultChecked={scope === "all"} /> <span>Every matter in the organization</span></label>
                <label className="check"><input type="radio" name="scope" value="mine" defaultChecked={scope === "mine"} /> <span>Only matters assigned to me{admin ? ", plus matters nobody is assigned to" : ""}</span></label>
              </>
            ) : (
              <p className="note" style={{ marginTop: 0 }}>Matters assigned to you. Your admin decides this.</p>
            )}
            <h3 style={{ marginTop: 16 }}>Remind me before a deadline</h3>
            {LEAD_CHOICES.map((c) => (
              <label className="check" key={c.days}>
                <input type="checkbox" name={`lead${c.days}`} defaultChecked={on(c.days)} /> <span>{c.label}</span>
              </label>
            ))}
            <p className="note">When a new step opens (for example, the deadline to pay has passed and it's time to start a claim), you're emailed that day.</p>
          </div>
          <div className="card">
            <h2>What to remind me about</h2>
            {stages.map((s) => (
              <label className="check" key={s.id} style={{ marginBottom: 8 }}>
                <input type="checkbox" name={`stage_${s.id}`} defaultChecked={!prefs.mutedStages.includes(s.id)} />
                <span><b>{s.label}.</b> {s.description}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="row" style={{ gap: 10, marginBottom: 18 }}>
          <button className="btn">Save reminder settings</button>
        </div>
      </form>
      <form action="/api/notifications/test" method="post" style={{ marginBottom: 18 }}>
        <button className="btn ghost small">Send me a test email</button>
      </form>

      {admin && (
        <div className="card" id="team">
          <h2>Team reminder settings</h2>
          {searchParams.saved === "team" && <div className="banner good">Team settings saved.</div>}
          <form action="/api/notifications/team" method="post">
            <label className="check"><input type="checkbox" name="enabled" defaultChecked={org.enabled} /> <span>Send reminder emails to people on this team</span></label>
            <h3 style={{ marginTop: 14 }}>Regular users are reminded about</h3>
            <label className="check"><input type="radio" name="memberScope" value="assigned" defaultChecked={org.memberScope === "assigned"} /> <span>Only the matters assigned to them</span></label>
            <label className="check"><input type="radio" name="memberScope" value="all" defaultChecked={org.memberScope === "all"} /> <span>Every matter (each person can still narrow it to their own)</span></label>
            <p className="note">Admins always get reminders for matters nobody is assigned to, or whose assigned user has been blocked or deleted, so nothing is missed.</p>
            <div style={{ marginTop: 10 }}><button className="btn small">Save team settings</button></div>
          </form>
          <h3 style={{ marginTop: 16 }}>Who gets reminders</h3>
          <table className="agenda">
            <tbody>
              {team.map((u) => {
                const p = prefsFor(u);
                const status = u.disabled ? "Blocked" : !org.enabled ? "Off for the team" : !u.emailVerifiedAt ? "Email not confirmed" : !p.email ? "Turned off" : scopeFor(u, db) === "all" ? "Every matter" : "Assigned matters";
                return (
                  <tr key={u.id}>
                    <td>{u.name || u.email}<div className="note">{u.email} · {ROLE_LABEL[u.role ?? "admin"]}</div></td>
                    <td className="when">{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h2>Coming up in the next 60 days</h2>
        {list.length === 0 ? (
          <p className="note">No open deadlines or steps in the next 60 days.</p>
        ) : (
          <table className="agenda">
            <tbody>
              {list.map(({ d, muted, sendOn }) => (
                <tr key={d.key + d.date}>
                  <td className="when">{fmt(d.date)}</td>
                  <td>
                    <a href={d.href}>{d.title}</a>
                    <div className="note">
                      {muted || !prefs.email || !org.enabled
                        ? "No email (turned off)"
                        : sendOn.length
                          ? `${d.kind === "update" ? "Emailed" : "Reminders"} on ${sendOn.map(fmt).join(" and ")}`
                          : "No reminder (too close to the deadline for your settings)"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="note">Dates are worked out by the software from what you've entered. Check them against the court or tribunal's own rules. For advice on a matter, use Request lawyer review.</p>
      </div>
    </>
  );
}
