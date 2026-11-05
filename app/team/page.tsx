import { PERMISSION_LABEL, ROLE_LABEL, acct, isAdmin, orgUsers, requireUser, type Permission } from "@/lib/auth";
import { readDB } from "@/lib/store";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function Team({ searchParams }: { searchParams: { ok?: string; error?: string; temp?: string; for?: string } }) {
  const me = await requireUser({ admin: true });
  const org = acct(me);
  const db = await readDB(org);
  const users = await orgUsers(org);
  const activity = (db.activity ?? []).slice(-40).reverse();

  return (
    <>
      <h1>Team</h1>
      <p className="sub">Everyone who logs in to <b>{db.company.name}</b>. Admins control billing, settings, add-ons and the team, and can change or undo anything on any matter. Regular users work on matters, within the limits you set.</p>
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
                      {(Object.keys(PERMISSION_LABEL) as Permission[]).map((p) => (
                        <label key={p} className="check"><input type="checkbox" name={p} defaultChecked={u.permissions?.[p] !== false} /> <span>{PERMISSION_LABEL[p]}</span></label>
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
