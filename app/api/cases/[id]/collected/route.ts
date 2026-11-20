import { acct, can, canSeeMatter } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { loadRow } from "@/lib/ledger";
import { notifyOwner, rowLabel } from "@/lib/matters";
import { writeDB } from "@/lib/store";
import { recordCollection } from "@/lib/workflow";

// "Funds collected" on a matter's checklist: a part payment lowers the balance; payment in full closes the matter.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const back = (q: string) => go(req, `/cases/${params.id}?${q}#collected`);
    const f = await req.formData();
    const { db, row } = await loadRow(acct(user), params.id);
    if (!row) return go(req, "/");
    if (!canSeeMatter(user, db, params.id)) return go(req, "/?noAccess=1");
    if (!can(user, "markPaid", db)) return go(req, `/cases/${params.id}?noPermission=1#collected`);
    if (row.paid) return back("closed=1");
    const full = f.get("full") === "on" || f.get("full") === "1";
    const raw = String(f.get("amount") ?? "").replace(/[$,\s]/g, "");
    const amount = raw === "" && full ? row.balance : Number(raw);
    const date = String(f.get("date") ?? "");
    if (!Number.isFinite(amount) || amount < 0 || (!full && amount <= 0)) return back("collectError=" + encodeURIComponent("Enter the amount you received."));
    if (amount > row.balance + 0.005 && !full) return back("collectError=" + encodeURIComponent("That's more than the balance owing. Tick \"Paid in full\" if this settles the debt."));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > new Date().toISOString().slice(0, 10)) return back("collectError=" + encodeURIComponent("Enter the date you received the money (not a future date)."));
    const res = await recordCollection(db, user, { id: row.invoice.id, href: `/cases/${row.invoice.id}`, amountDue: row.invoice.amountDue }, {
      amount,
      date,
      full,
      method: String(f.get("method") ?? "").slice(0, 60),
      note: String(f.get("note") ?? "").slice(0, 300),
    });
    await writeDB(acct(user), db);
    await notifyOwner(db, params.id, user, res.closed ? "Recorded funds collected in full" : "Recorded a part payment", rowLabel(row), req);
    return back(res.closed ? "collected=full" : "collected=part");
  });
