import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

// Prototype stand-in for payment detection from the accounting sync.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const db = await readDB(user.id);
    if (!db.paidInvoiceIds.includes(params.id)) db.paidInvoiceIds.push(params.id);
    await writeDB(user.id, db);
    return go(req, `/cases/${params.id}`);
  });
