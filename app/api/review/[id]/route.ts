import { acct } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

// Paid add-on: sends the assembled file to the firm for review. Prototype records the request;
// phase 5 opens the matter in the firm's practice management system and notifies a lawyer.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const db = await readDB(acct(user));
    db.reviewRequests ??= [];
    if (!db.reviewRequests.some((r) => r.invoiceId === params.id))
      db.reviewRequests.push({ invoiceId: params.id, requestedAt: new Date().toISOString() });
    await writeDB(acct(user), db);
    return go(req, `/cases/${params.id}?review=1`);
  });
