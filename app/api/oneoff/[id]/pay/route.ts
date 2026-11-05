import { publicOrigin } from "@/lib/origin";
import { go } from "@/lib/http";
import { markDraftPaid, ONE_OFF_PRICE, readDraft } from "@/lib/oneoff";
import { billingLive, stripe } from "@/lib/stripe";

// Live: Stripe Checkout one-time payment of $75 CAD. Demo mode: unlocks directly.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const d = await readDraft(params.id);
  if (!d) return go(req, "/start");
  if (d.paid) return go(req, `/start/${d.id}`);

  if (!billingLive()) {
    await markDraftPaid(d.id, "demo");
    return go(req, `/start/${d.id}?paid=1`);
  }

  const base = publicOrigin(req);
  const session = await stripe()!.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: ONE_OFF_PRICE * 100,
          product_data: { name: `Demand Now one-off demand: ${d.invoice.number} (${d.debtor.name})` },
          tax_behavior: "exclusive",
        },
      },
    ],
    automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "1" },
    customer_email: d.company.email || undefined,
    metadata: { oneoffId: d.id },
    success_url: `${base}/api/oneoff/${d.id}/confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/start/${d.id}`,
  });
  return go(req, session.url!);
}
