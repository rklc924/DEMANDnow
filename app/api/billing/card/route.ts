import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";
import { billingLive, createCardSetup } from "@/lib/stripe";

// Adds (or replaces) the card on file. Live: Stripe Checkout in setup mode. Demo: records a test card.
export const POST = (req: Request) =>
  withUser(
    req,
    async (user) => {
      const f = await req.formData();
      const plan = String(f.get("plan") ?? "");
      const next = plan ? `/billing?plan=${encodeURIComponent(plan)}` : "/billing";
      const db = await readDB(user.id);
      if (billingLive()) return go(req, await createCardSetup(req, { id: user.id, email: user.email, company: db.company.name }, next));
      db.card = { brand: "visa", last4: "4242", addedAt: new Date().toISOString(), demo: true };
      await writeDB(user.id, db);
      return go(req, `${next}${next.includes("?") ? "&" : "?"}card=1`);
    },
    { card: false },
  );
