import type { User } from "@/lib/auth";

type Person = Pick<User, "id" | "name" | "email">;
const nameOf = (u: Person) => u.name || u.email;

/** "Assigned to" picker for the forms that create a matter. Regular users without assign access get their own name. */
export function AssigneeField({ me, users, canAssign }: { me: Person; users: Person[]; canAssign: boolean }) {
  if (!canAssign) return <p className="note">This matter will be assigned to you.</p>;
  return (
    <>
      <label>Assigned to</label>
      <select name="assignee" defaultValue={me.id}>
        {users.map((u) => <option key={u.id} value={u.id}>{nameOf(u)}{u.id === me.id ? " (you)" : ""}</option>)}
        <option value="">Nobody yet</option>
      </select>
      <p className="note" style={{ marginTop: 4 }}>They'll get an email now, and whenever someone else moves the matter forward.</p>
    </>
  );
}

/** Who a matter is assigned to, with a picker to reassign it for those allowed. */
export function AssignCard({ matterId, ownerId, me, users, canAssign, assigned, error }: { matterId: string; ownerId?: string; me: Person; users: Person[]; canAssign: boolean; assigned?: boolean; error?: string }) {
  const owner = users.find((u) => u.id === ownerId);
  return (
    <div className="card" id="assign">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <b>Assigned to:</b> {owner ? <>{nameOf(owner)}{owner.id === me.id ? " (you)" : ""}</> : <span className="note">Nobody yet</span>}
          <div className="note">The assigned user gets an email whenever someone else moves this matter forward.</div>
        </div>
        {canAssign && (
          <form action={`/api/matters/${matterId}/assign`} method="post" className="row" style={{ gap: 6 }}>
            <select name="assignee" defaultValue={ownerId ?? ""} aria-label="Assign to">
              {users.map((u) => <option key={u.id} value={u.id}>{nameOf(u)}{u.id === me.id ? " (you)" : ""}</option>)}
              <option value="">Nobody</option>
            </select>
            <button className="btn small ghost">Assign</button>
          </form>
        )}
      </div>
      {assigned && <div className="banner good" style={{ marginTop: 10 }}>Assignment saved.</div>}
      {error && <div className="banner bad" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}
