import { acct, can, canSeeMatter } from "@/lib/auth";
import { loadRow } from "@/lib/ledger";
import { notifyOwner, rowLabel } from "@/lib/matters";
import { go, withUser } from "@/lib/http";
import { writeDB } from "@/lib/store";
import { recordCollection } from "@/lib/workflow";

// "Mark paid": the balance was collected in full today. Closes the matter like "Funds collected" does.
// Prototype stand-in for payment detection from the accounting sync.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const { db, row } = await loadRow(acct(user), params.id);
    if (!row) return go(req, "/");
    if (!canSeeMatter(user, db, params.id)) return go(req, "/?noAccess=1");
    if (!can(user, "markPaid", db)) return go(req, `/cases/${params.id}?noPermission=1`);
    if (!row.paid) {
      await recordCollection(db, user, { id: row.invoice.id, href: `/cases/${row.invoice.id}`, amountDue: row.invoice.amountDue }, {
        amount: row.balance,
        date: new Date().toISOString().slice(0, 10),
        full: true,
        method: "Marked paid",
      });
      await writeDB(acct(user), db);
      await notifyOwner(db, params.id, user, "Marked paid", rowLabel(row), req);
    }
    return go(req, `/cases/${params.id}?collected=full`);
  });
