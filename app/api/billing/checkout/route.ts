import { go, withUser } from "@/lib/http";
import { PLANS, type Interval, type PlanId } from "@/lib/plans";
import { readDB, writeDB } from "@/lib/store";
import { billingLive, createCheckout, createPortal } from "@/lib/stripe";

// Live: sends the customer to Stripe Checkout; the webhook activates the plan after payment.
// A customer who already has a paid subscription changes plan in the Stripe customer portal.
// Demo mode (no STRIPE_SECRET_KEY): activates the plan directly.
export const POST = (req: Request) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const plan = String(f.get("plan")) as PlanId;
    const interval = String(f.get("interval")) as Interval;
    if (!PLANS[plan] || !["monthly", "annual"].includes(interval)) return go(req, "/billing?error=plan");

    const db = await readDB(user.id);
    if (billingLive()) {
      if (db.subscription?.status === "active" && db.subscription.stripeSubscriptionId) {
        return go(req, (await createPortal(req, user.id)) ?? "/billing");
      }
      return go(req, await createCheckout(req, { id: user.id, email: user.email, company: db.company.name }, plan, interval));
    }

    const now = new Date();
    const renews = new Date(now);
    if (interval === "monthly") renews.setMonth(renews.getMonth() + 1);
    else renews.setFullYear(renews.getFullYear() + 1);
    db.subscription = { plan, interval, status: "active", startedAt: now.toISOString(), renewsAt: renews.toISOString() };
    await writeDB(user.id, db);
    return go(req, "/billing?activated=1");
  });
