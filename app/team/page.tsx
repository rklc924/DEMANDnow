import { PERMISSIONS, ROLE_LABEL, acct, can, isAdmin, orgDefault, orgUsers, requireUser } from "@/lib/auth";
import { money } from "@/lib/aging";
import { loadRows } from "@/lib/ledger";
import { lienStage, rowStage } from "@/lib/matters";

// Things only admins can do, shown in the access table so the split is clear. Not adjustable.
const ADMIN_ONLY = [
  "Billing, plans and the card on file",
  "Company settings, letterhead and auto-send",
  "Email and calendar connection",
  "Turn on add-ons such as Builders Liens",
  "Run nightly sync",
  "The Team page: users, roles and access",
];

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function Team({ searchParams }: { searchParams: { ok?: string; error?: string; temp?: string; for?: string } }) {
  const me = await requireUser({ admin: true });
  const org = acct(me);
  const { db, rows } = await loadRows(org);
  const users = await orgUsers(org);
  // Team overview: every open matter grouped by who it's assigned to, with where it's up to.
  type Item = { id: string; link: string; title: string; amount: number; stage: string };
  const items: (Item & { owner?: string })[] = [
    ...rows.filter((r) => !r.paid && (r.letter || r.days >= db.settings.thresholdDays || db.owners?.[r.invoice.id])).map((r) => ({
      id: r.invoice.id, link: `/cases/${r.invoice.id}`, title: `${r.invoice.number} · ${r.customer.name}`, amount: r.invoice.amountDue, stage: rowStage(db, r), owner: db.owners?.[r.invoice.id],
    })),
    ...(db.liens ?? []).filter((l) => !l.satisfied).map((l) => ({
      id: l.id, link: `/liens/${l.id}`, title: `Lien: ${l.civicAddress || l.pid || "property"}`, amount: l.amount, stage: lienStage(db, l), owner: db.owners?.[l.id],
    })),
  ];
  const lastBy = (id: string) => (db.activity ?? []).findLast((a) => a.userId === id);
  const groups = [
    ...users.filter((u) => !u.disabled).map((u) => ({ key: u.id, name: u.name || u.email, last: lastBy(u.id), items: items.filter((i) => i.owner === u.id) })),
    { key: "none", name: "Not assigned yet", last: undefined, items: items.filter((i) => !i.owner || !users.some((u) => u.id === i.owner && !u.disabled)) },
  ];
  const activity = (db.activity ?? []).slice(-40).reverse();

  return (
    <>
      <h1>Team</h1>
      <p className="sub">Everyone who logs in to <b>{db.company.name}</b>. Admins control billing, settings, add-ons and the team, and can change or undo anything on any matter. Regular users work on the matters assigned to them, within the limits you set below.</p>
      {searchParams.ok && <div className="banner good">{searchParams.ok}</div>}
      {searchParams.temp && (
        <div className="banner warn">
          Temporary password for {searchParams.for}: <code style={{ fontSize: 15 }}>{searchParams.temp}</code>. Give it to them privately; it isn't shown again. They can change it with "Forgot password".
        </div>
      )}
      {searchParams.error && <div className="banner bad">{searchParams.error}</div>}

      <div className="grid2">
        <div className="card">
          <h2>Organization</h2>
          <form action="/api/team" method="post">
            <input type="hidden" name="action" value="org" />
            <label>Organization name (shown on letters and to your team)</label>
            <input type="text" name="orgName" defaultValue={db.company.name} />
            <div className="row" style={{ marginTop: 10 }}><button className="btn ghost">Save name</button></div>
          </form>
        </div>
        <div className="card">
          <h2>Add a user</h2>
          <form action="/api/team" method="post">
            <input type="hidden" name="action" value="add" />
            <div className="grid2">
              <div><label>Name</label><input type="text" name="name" required /></div>
              <div><label>Email</label><input type="email" name="email" required /></div>
            </div>
            <div className="grid2">
              <div>
                <label>Role</label>
                <select name="role" defaultValue="member">
                  <option value="member">Regular user</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div><label>Temporary password (optional)</label><input type="text" name="password" placeholder="Leave blank to generate one" /></div>
            </div>
            <div className="row" style={{ marginTop: 10 }}><button className="btn">Add user</button></div>
          </form>
        </div>
      </div>

      <div className="card" id="overview">
        <h2>Who's working on what</h2>
        <p className="note">Open matters by the person they're assigned to, and where each one is up to. Open a matter to reassign it.</p>
        <div className="team-list">
          {groups.filter((g) => g.key !== "none" || g.items.length > 0).map((g) => (
            <div key={g.key} className="team-row">
              <div className="member-info">
                <b>{g.name}</b> <span className="pill grey">{g.items.length} open</span>
                {g.key !== "none" && <div className="note">{g.last ? <>Last active {when(g.last.at)}: {g.last.action.charAt(0).toLowerCase() + g.last.action.slice(1)}</> : "No activity yet"}</div>}
              </div>
              <div>
                {g.items.length === 0 ? <span className="note">Nothing assigned.</span> : (
                  <table className="agenda">
                    <tbody>
                      {g.items.map((i) => (
                        <tr key={i.id}>
                          <td><a href={i.link}>{i.title}</a></td>
                          <td className="num">{money(i.amount)}</td>
                          <td>{i.stage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" id="access">
        <h2>What regular users can do</h2>
        <p className="note">This applies to every regular user. You can still set something different for one person under Users below. Admins can always do everything.</p>
        <form action="/api/team" method="post">
          <input type="hidden" name="action" value="defaults" />
          <table className="access">
            <thead><tr><th>Action</th><th>Admin</th><th>Regular user</th></tr></thead>
            <tbody>
              <tr><td>Open matters assigned to them, work through the checklist, upload documents and confirm the debtor's legal name</td><td>✓</td><td>✓</td></tr>
              {PERMISSIONS.map((p) => (
                <tr key={p.key}>
                  <td><label htmlFor={`d-${p.key}`} style={{ margin: 0, fontWeight: "normal" }}>{p.label}</label></td>
                  <td>✓</td>
                  <td><input id={`d-${p.key}`} type="checkbox" name={p.key} defaultChecked={orgDefault(db, p.key)} /></td>
                </tr>
              ))}
              {ADMIN_ONLY.map((a) => <tr key={a}><td>{a}</td><td>✓</td><td className="note">Admins only</td></tr>)}
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 10 }}><button className="btn ghost">Save for all regular users</button></div>
        </form>
      </div>

      <div className="card">
        <h2>Users ({users.length})</h2>
        <div className="team-list">
          {users.map((u) => {
            const self = u.id === me.id;
            return (
              <div key={u.id} className={`team-row ${u.disabled ? "off" : ""}`}>
                <div className="member-info">
                  <b>{u.name || u.email}</b> {self && <span className="pill grey">you</span>}{" "}
                  <span className={`pill ${isAdmin(u) ? "blue" : "grey"}`}>{ROLE_LABEL[u.role ?? "admin"]}</span>{" "}
                  {u.disabled && <span className="pill bad">Blocked</span>}
                  <div className="note">{u.email} · joined {when(u.createdAt)}{u.emailVerifiedAt ? "" : " · email not confirmed"}</div>
                </div>
                <div className="controls">
                  <form action="/api/team" method="post" className="row">
                    <input type="hidden" name="action" value="role" />
                    <input type="hidden" name="userId" value={u.id} />
                    <select name="role" defaultValue={u.role ?? "admin"} aria-label="Role">
                      <option value="member">Regular user</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button className="btn small ghost">Set role</button>
                  </form>
                  {!isAdmin(u) && (
                    <form action="/api/team" method="post" className="perms">
                      <input type="hidden" name="action" value="perms" />
                      <input type="hidden" name="userId" value={u.id} />
                      {PERMISSIONS.map((p) => (
                        <label key={p.key} className="check">
                          <input type="checkbox" name={p.key} defaultChecked={can(u, p.key, db)} /> <span>{p.label}</span>
                          {u.permissions?.[p.key] !== undefined && u.permissions[p.key] !== orgDefault(db, p.key) && <span className="pill grey" title="Different from what you set for all regular users">just for them</span>}
                        </label>
                      ))}
                      <button className="btn small ghost">Save access</button>
                    </form>
                  )}
                  {!self && (
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <form action="/api/team" method="post" className="row" style={{ gap: 6 }}>
                        <input type="hidden" name="action" value="password" />
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="text" name="password" placeholder="New temporary password" minLength={10} required style={{ width: 210 }} />
                        <button className="btn small ghost">Reset password</button>
                      </form>
                      <form action="/api/team" method="post">
                        <input type="hidden" name="action" value={u.disabled ? "enable" : "disable"} />
                        <input type="hidden" name="userId" value={u.id} />
                        <button className="btn small ghost">{u.disabled ? "Restore access" : "Block access"}</button>
                      </form>
                      {u.id !== org && (
                        <form action="/api/team" method="post">
                          <input type="hidden" name="action" value="delete" />
                          <input type="hidden" name="userId" value={u.id} />
                          <button className="btn small danger">Delete user</button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2>Recent activity</h2>
        {activity.length === 0 ? <p className="note">Nothing yet. Letters sent, invoices added or deleted, orders and team changes show up here.</p> : (
          <table className="agenda">
            <tbody>
              {activity.map((a, i) => (
                <tr key={i}>
                  <td className="when" style={{ whiteSpace: "nowrap" }}>{when(a.at)}</td>
                  <td><b>{a.name}</b> {a.action.charAt(0).toLowerCase() + a.action.slice(1)}{a.link && <> · <a href={a.link}>open</a></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="note">As an admin you can open any matter from here to change or undo what was done.</p>
      </div>
    </>
  );
}
