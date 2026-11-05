import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { markDraftPaid } from "@/lib/oneoff";
import { saveCardFromSetup, stripe, syncSubscription } from "@/lib/stripe";

// Stripe webhook. Subscribe the endpoint to: checkout.session.completed,
// customer.subscription.created, customer.subscription.updated, customer.subscription.deleted.
export async function POST(req: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return NextResponse.json({ error: "Billing not configured" }, { status: 503 });

  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "setup" && session.metadata?.purpose === "card") await saveCardFromSetup(session.id);
      if (session.metadata?.oneoffId && session.payment_status === "paid") await markDraftPaid(session.metadata.oneoffId, session.id);
      if (typeof session.subscription === "string") await syncSubscription(await s.subscriptions.retrieve(session.subscription));
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      break;
  }
  return NextResponse.json({ received: true });
}
