import { go, withUser } from "@/lib/http";
import { billingLive, createPortal } from "@/lib/stripe";

export const POST = (req: Request) =>
  withUser(req, async (user) => {
    if (!billingLive()) return go(req, "/billing");
    const url = await createPortal(req, user.id);
    return go(req, url ?? "/billing");
  });
