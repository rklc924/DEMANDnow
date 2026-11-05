import { acct, isAdmin } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";
import { billingLive, createCardSetup } from "@/lib/stripe";

// Adds (or replaces) the card on file. Live: Stripe Checkout in setup mode. Demo: records a test card.
export const POST = (req: Request) =>
  withUser(
    req,
    async (user) => {
    if (!isAdmin(user)) return go(req, "/?adminOnly=1");
      const f = await req.formData();
      const plan = String(f.get("plan") ?? "");
      const next = plan ? `/billing?plan=${encodeURIComponent(plan)}` : "/billing";
      const db = await readDB(acct(user));
      if (billingLive()) return go(req, await createCardSetup(req, { id: acct(user), email: user.email, company: db.company.name }, next));
      db.card = { brand: "visa", last4: "4242", addedAt: new Date().toISOString(), demo: true };
      await writeDB(acct(user), db);
      return go(req, `${next}${next.includes("?") ? "&" : "?"}card=1`);
    },
    { card: false },
  );
