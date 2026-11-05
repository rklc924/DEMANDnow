import { acct, can } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB, logActivity } from "@/lib/store";

// Prototype stand-in for payment detection from the accounting sync.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    if (!can(user, "manageInvoices")) return go(req, `/cases/${params.id}?noPermission=1`);
    const db = await readDB(acct(user));
    if (!db.paidInvoiceIds.includes(params.id)) db.paidInvoiceIds.push(params.id);
    logActivity(db, user, `Marked invoice paid`, `/cases/${params.id}`);
    await writeDB(acct(user), db);
    return go(req, `/cases/${params.id}`);
  });
