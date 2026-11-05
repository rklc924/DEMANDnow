import { acct, isAdmin } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { billingLive, createPortal } from "@/lib/stripe";

export const POST = (req: Request) =>
  withUser(req, async (user) => {
    if (!isAdmin(user)) return go(req, "/?adminOnly=1");
    if (!billingLive()) return go(req, "/billing");
    const url = await createPortal(req, acct(user));
    return go(req, url ?? "/billing");
  });
