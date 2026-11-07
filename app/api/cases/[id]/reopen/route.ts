import { acct } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";
import { removePayment, reopenMatter } from "@/lib/workflow";

// Admin only: reopen a closed matter, or remove a payment recorded by mistake.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const db = await readDB(acct(user));
    const matter = { id: params.id, href: `/cases/${params.id}` };
    const paymentId = String(f.get("payment") ?? "");
    if (paymentId) removePayment(db, user, matter, paymentId);
    if (f.get("reopen") === "1" || paymentId) reopenMatter(db, user, matter);
    await writeDB(acct(user), db);
    return go(req, `/cases/${params.id}?reopened=1#collected`);
  }, { admin: true });
