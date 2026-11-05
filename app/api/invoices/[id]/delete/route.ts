import { acct, can } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB, logActivity } from "@/lib/store";

// Removes an invoice that was entered by hand. Synced invoices are managed in the accounting system.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    if (!can(user, "manageInvoices")) return go(req, "/?noPermission=1");
    const db = await readDB(acct(user));
    const inv = db.manual?.invoices.find((i) => i.id === params.id);
    if (!inv) return go(req, `/cases/${params.id}`);
    db.manual!.invoices = db.manual!.invoices.filter((i) => i.id !== params.id);
    logActivity(db, user, `Deleted invoice ${inv.number}`);
    await writeDB(acct(user), db);
    return go(req, `/?removed=${encodeURIComponent(inv.number)}`);
  });
