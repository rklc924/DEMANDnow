import { acct, can, canSeeMatter } from "@/lib/auth";
import { loadRow } from "@/lib/ledger";
import { notifyOwner, rowLabel } from "@/lib/matters";
import { logActivity } from "@/lib/store";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

// Paid add-on: sends the assembled file to the firm for review. Prototype records the request;
// phase 5 opens the matter in the firm's practice management system and notifies a lawyer.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const db = await readDB(acct(user));
    if (!canSeeMatter(user, db, params.id)) return go(req, "/?noAccess=1");
    if (!can(user, "requestReview", db)) return go(req, `/cases/${params.id}?noPermission=1`);
    db.reviewRequests ??= [];
    const fresh = !db.reviewRequests.some((r) => r.invoiceId === params.id);
    if (!db.reviewRequests.some((r) => r.invoiceId === params.id))
      db.reviewRequests.push({ invoiceId: params.id, requestedAt: new Date().toISOString() });
    if (fresh) logActivity(db, user, "Requested lawyer review", `/cases/${params.id}`);
    await writeDB(acct(user), db);
    const { row } = await loadRow(acct(user), params.id);
    if (fresh && row) await notifyOwner(db, params.id, user, "Lawyer review requested", rowLabel(row), req);
    return go(req, `/cases/${params.id}?review=1`);
  });
