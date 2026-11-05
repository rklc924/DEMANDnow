import { acct, isAdmin } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";
import { billingLive, createPortal } from "@/lib/stripe";

// Live: cancellation happens in the Stripe customer portal (cancel at period end) and comes back by webhook.
export const POST = (req: Request) =>
  withUser(req, async (user) => {
    if (!isAdmin(user)) return go(req, "/?adminOnly=1");
    if (billingLive()) return go(req, (await createPortal(req, acct(user))) ?? "/billing");
    const db = await readDB(acct(user));
    if (db.subscription) db.subscription.status = "canceled";
    await writeDB(acct(user), db);
    return go(req, "/billing?canceled=1");
  });
