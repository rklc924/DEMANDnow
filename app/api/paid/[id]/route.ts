import { acct, can, canSeeMatter } from "@/lib/auth";
import { loadRow } from "@/lib/ledger";
import { notifyOwner, rowLabel } from "@/lib/matters";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB, logActivity } from "@/lib/store";

// Prototype stand-in for payment detection from the accounting sync.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const db = await readDB(acct(user));
    if (!canSeeMatter(user, db, params.id)) return go(req, "/?noAccess=1");
    if (!can(user, "markPaid", db)) return go(req, `/cases/${params.id}?noPermission=1`);
    if (!db.paidInvoiceIds.includes(params.id)) db.paidInvoiceIds.push(params.id);
    logActivity(db, user, `Marked invoice paid`, `/cases/${params.id}`);
    await writeDB(acct(user), db);
    const { row } = await loadRow(acct(user), params.id);
    if (row) await notifyOwner(db, params.id, user, "Marked paid", rowLabel(row), req);
    return go(req, `/cases/${params.id}`);
  });
