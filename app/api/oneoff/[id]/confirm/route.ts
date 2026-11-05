import { go } from "@/lib/http";
import { markDraftPaid } from "@/lib/oneoff";
import { stripe } from "@/lib/stripe";

// Stripe returns here after payment. Verify the session server-side before unlocking
// (the webhook also unlocks it, in case the customer closes the tab).
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const sessionId = new URL(req.url).searchParams.get("session_id");
  const s = stripe();
  if (s && sessionId) {
    const session = await s.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid" && session.metadata?.oneoffId === params.id) {
      await markDraftPaid(params.id, session.id);
      return go(req, `/start/${params.id}?paid=1`);
    }
  }
  return go(req, `/start/${params.id}`);
}
