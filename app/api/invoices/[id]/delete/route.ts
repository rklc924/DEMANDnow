import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

// Removes an invoice that was entered by hand. Synced invoices are managed in the accounting system.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const db = await readDB(user.id);
    const inv = db.manual?.invoices.find((i) => i.id === params.id);
    if (!inv) return go(req, `/cases/${params.id}`);
    db.manual!.invoices = db.manual!.invoices.filter((i) => i.id !== params.id);
    await writeDB(user.id, db);
    return go(req, `/?removed=${encodeURIComponent(inv.number)}`);
  });
