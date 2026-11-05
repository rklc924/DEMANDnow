import { go, withUser } from "@/lib/http";
import { saveCardFromSetup } from "@/lib/stripe";

// Return from Stripe's card setup page. The webhook records the card too; this makes it immediate.
export const GET = (req: Request) =>
  withUser(
    req,
    async (user) => {
      const url = new URL(req.url);
      const next = url.searchParams.get("next") ?? "/billing";
      const accountId = await saveCardFromSetup(url.searchParams.get("session_id") ?? "").catch(() => null);
      if (accountId !== user.id) return go(req, "/billing/card?error=1");
      return go(req, `${next.startsWith("/") ? next : "/billing"}${next.includes("?") ? "&" : "?"}card=1`);
    },
    { card: false },
  );
