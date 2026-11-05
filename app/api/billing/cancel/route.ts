import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";
import { billingLive, createPortal } from "@/lib/stripe";

// Live: cancellation happens in the Stripe customer portal (cancel at period end) and comes back by webhook.
export const POST = (req: Request) =>
  withUser(req, async (user) => {
    if (billingLive()) return go(req, (await createPortal(req, user.id)) ?? "/billing");
    const db = await readDB(user.id);
    if (db.subscription) db.subscription.status = "canceled";
    await writeDB(user.id, db);
    return go(req, "/billing?canceled=1");
  });
