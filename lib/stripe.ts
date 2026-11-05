import { publicOrigin } from "./origin";
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

const appUrl = (req: Request) => publicOrigin(req);

async function ensureCustomer(account: { id: string; email: string; company: string }) {
  const s = stripe()!;
  const db = await readDB(account.id);
  if (!db.stripeCustomerId) {
    const customer = await s.customers.create({ email: account.email, name: account.company, metadata: { accountId: account.id } });
    db.stripeCustomerId = customer.id;
    await writeDB(account.id, db);
  }
  return db.stripeCustomerId;
}

/** Stripe Checkout in setup mode: saves a card to the customer without charging it. */
export async function createCardSetup(req: Request, account: { id: string; email: string; company: string }, next: string) {
  const customer = await ensureCustomer(account);
  const session = await stripe()!.checkout.sessions.create({
    mode: "setup",
    customer,
    currency: "cad",
    payment_method_types: ["card"],
    client_reference_id: account.id,
    metadata: { accountId: account.id, purpose: "card" },
    success_url: `${appUrl(req)}/api/billing/card/confirm?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(next)}`,
    cancel_url: `${appUrl(req)}/billing/card`,
  });
  return session.url!;
}

/** Records the card from a completed setup session and makes it the customer's default. Idempotent. */
export async function saveCardFromSetup(sessionId: string): Promise<string | null> {
  const s = stripe()!;
  const session = await s.checkout.sessions.retrieve(sessionId, { expand: ["setup_intent.payment_method"] });
  const accountId = session.metadata?.accountId;
  const si = session.setup_intent as Stripe.SetupIntent | null;
  const pm = si?.payment_method as Stripe.PaymentMethod | null;
  if (!accountId || !pm?.card || session.status !== "complete") return null;
  await s.customers.update(session.customer as string, { invoice_settings: { default_payment_method: pm.id } });
  const db = await readDB(accountId);
  db.card = { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year, addedAt: new Date().toISOString(), paymentMethodId: pm.id };
  await writeDB(accountId, db);
  return accountId;
}

/** Charges the card on file off-session (process servers, add-ons). Throws with a customer-facing message on failure. */
export async function chargeCard(accountId: string, amountCad: number, description: string, metadata: Record<string, string>) {
  const db = await readDB(accountId);
  if (!db.card) throw new Error("Add a card on file first.");
  if (!billingLive() || db.card.demo) return { id: `demo_${Date.now()}`, demo: true };
  try {
    const pi = await stripe()!.paymentIntents.create({
      amount: Math.round(amountCad * 100),
      currency: "cad",
      customer: db.stripeCustomerId,
      payment_method: db.card.paymentMethodId,
      off_session: true,
      confirm: true,
      description,
      metadata: { accountId, ...metadata },
    });
    return { id: pi.id, demo: false };
  } catch (e) {
    const err = e as Stripe.errors.StripeError;
    throw new Error(err.type === "StripeCardError" ? `Your card was declined: ${err.message} Update your card in Billing.` : "Payment failed. Try again or update your card in Billing.");
  }
}

/** Creates a Stripe Checkout Session for plan x interval and returns its URL. Prices are defined inline in CAD. */
export async function createCheckout(req: Request, account: { id: string; email: string; company: string }, plan: PlanId, interval: Interval) {
  const s = stripe()!;
  const customer = await ensureCustomer(account);
  const p = PLANS[plan];
  const metadata = { accountId: account.id, plan, interval };
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer,
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
