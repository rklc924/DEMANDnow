import { requireUser, acct, can } from "@/lib/auth";
import { redirect } from "next/navigation";
import { assignableUsers } from "@/lib/matters";
import { AssigneeField } from "../../assign";
import { readDB } from "@/lib/store";

export const dynamic = "force-dynamic";

const today = () => new Date().toISOString().slice(0, 10);

export default async function NewInvoice({ searchParams }: { searchParams: { error?: string } }) {
  const user = await requireUser();
  const db = await readDB(acct(user));
  if (!can(user, "addMatters", db)) redirect("/?noPermission=1");
  const users = await assignableUsers(acct(user));
  const customers = (db.manual?.customers ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="about">
      <p className="note"><a href="/">← Receivables</a></p>
      <h1>Add an invoice</h1>
      <p className="sub">Enter invoices as they go out. They're tracked with your synced ones, and the demand workflow starts automatically once they're overdue.</p>
      {searchParams.error && <div className="banner bad">{searchParams.error}</div>}
      <form action="/api/invoices" method="post" className="card">
        <h2>Customer</h2>
        {customers.length > 0 && (
          <>
            <label>Existing customer</label>
            <select name="customerId" defaultValue="">
              <option value="">New customer (enter below)</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="note">Pick one you've entered before, or leave it on "New customer" and fill in the details.</p>
          </>
        )}
        <div className="grid2">
          <div>
            <label>Customer name</label>
            <input type="text" name="name" placeholder="As it appears on your invoice" />
            <label>Customer type</label>
            <select name="kind" defaultValue="business">
              <option value="business">Business</option>
              <option value="consumer">Individual (consumer)</option>
            </select>
            <label>Email</label>
            <input type="email" name="email" placeholder="accounts@customer.com" />
          </div>
          <div>
            <label>Mailing address, one line each</label>
            <textarea name="address" rows={4} placeholder={"123 Main Street\nVancouver BC V6B 1A1"} />
          </div>
        </div>

        <h2 style={{ marginTop: 20 }}>Invoice</h2>
        <div className="grid2">
          <div>
            <label>Invoice number</label>
            <input type="text" name="number" required />
            <label>Amount owing (CAD)</label>
            <input type="text" name="amount" inputMode="decimal" required placeholder="e.g. 4,250.00" />
            <label>What it was for</label>
            <input type="text" name="description" placeholder="e.g. HVAC install, 4410 Marine Drive" />
          </div>
          <div>
            <label>Invoice date</label>
            <input type="date" name="issueDate" defaultValue={today()} required />
            <label>Due date</label>
            <input type="date" name="dueDate" />
            <p className="note" style={{ marginTop: 4 }}>Leave blank for 30 days after the invoice date.</p>
            <label>Interest on overdue amounts (% per year, if your terms say so)</label>
            <input type="text" name="interestRate" inputMode="decimal" placeholder="e.g. 24" />
          </div>
        </div>
        <div style={{ maxWidth: 360 }}><AssigneeField me={user} users={users} canAssign={can(user, "assignMatters", db)} /></div>
        <div className="row" style={{ marginTop: 16 }}><button className="btn">Add invoice</button></div>
      </form>
    </div>
  );
}
