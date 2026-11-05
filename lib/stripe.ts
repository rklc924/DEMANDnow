import Stripe from "stripe";
import { PLANS, type Interval, type PlanId } from "./plans";
import { readDB, writeDB, type Subscription } from "./store";

// Stripe Billing. Live when STRIPE_SECRET_KEY is set; otherwise the app runs in demo mode and
// plans activate without payment.
//
// Env:
//   STRIPE_SECRET_KEY       sk_test_... / sk_live_...
//   STRIPE_WEBHOOK_SECRET   whsec_... from the webhook endpoint pointing at /api/billing/webhook
//   STRIPE_AUTOMATIC_TAX=1  charge GST/PST through Stripe Tax (register for GST/PST first)
//   APP_URL                 public base URL, e.g. https://app.demandnow.ca

let client: Stripe | null | undefined;
export function stripe(): Stripe | null {
  if (client === undefined) client = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
  return client;
}

export const billingLive = () => stripe() !== null;

const appUrl = (req: Request) => process.env.APP_URL ?? new URL(req.url).origin;

/** Creates a Stripe Checkout Session for plan x interval and returns its URL. Prices are defined inline in CAD. */
export async function createCheckout(req: Request, account: { id: string; email: string; company: string }, plan: PlanId, interval: Interval) {
  const s = stripe()!;
  const db = await readDB(account.id);
  if (!db.stripeCustomerId) {
    const customer = await s.customers.create({ email: account.email, name: account.company, metadata: { accountId: account.id } });
    db.stripeCustomerId = customer.id;
    await writeDB(account.id, db);
  }
  const p = PLANS[plan];
  const metadata = { accountId: account.id, plan, interval };
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer: db.stripeCustomerId,
    client_reference_id: account.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: p.price[interval] * 100,
          recurring: { interval: interval === "monthly" ? "month" : "year" },
          product_data: { name: `Demand Now ${p.name} (${interval})` },
          tax_behavior: "exclusive",
        },
      },
    ],
    automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "1" },
    customer_update: process.env.STRIPE_AUTOMATIC_TAX === "1" ? { address: "auto" } : undefined,
    subscription_data: { metadata },
    metadata,
    allow_promotion_codes: true,
    success_url: `${appUrl(req)}/billing?activated=1`,
    cancel_url: `${appUrl(req)}/billing`,
  });
  return session.url!;
}

/** Stripe-hosted page where the customer changes plan, updates their card, downloads invoices or cancels. */
export async function createPortal(req: Request, accountId: string) {
  const db = await readDB(accountId);
  if (!db.stripeCustomerId) return null;
  const session = await stripe()!.billingPortal.sessions.create({ customer: db.stripeCustomerId, return_url: `${appUrl(req)}/billing` });
  return session.url;
}

/** Writes a Stripe subscription onto the account it belongs to. Called from the webhook. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const { accountId, plan, interval } = sub.metadata as { accountId?: string; plan?: PlanId; interval?: Interval };
  if (!accountId || !plan || !PLANS[plan]) return;
  const db = await readDB(accountId);
  const active = sub.status === "active" || sub.status === "trialing";
  const next: Subscription = {
    plan,
    interval: interval === "annual" ? "annual" : "monthly",
    status: active ? "active" : "canceled",
    startedAt: new Date(sub.start_date * 1000).toISOString(),
    renewsAt: new Date(sub.current_period_end * 1000).toISOString(),
    stripeSubscriptionId: sub.id,
  };
  db.subscription = next;
  await writeDB(accountId, db);
}
