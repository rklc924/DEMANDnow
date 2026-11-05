import { requireUser, acct } from "@/lib/auth";
import { readDB } from "@/lib/store";
import { billingLive } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function CardPage({ searchParams }: { searchParams: { plan?: string; error?: string } }) {
  const user = await requireUser({ card: false, admin: true });
  const db = await readDB(acct(user));
  return (
    <div className="card auth" style={{ maxWidth: 520 }}>
      <h1>{db.card ? "Update your card" : "Add a card to your account"}</h1>
      <p className="sub">Every Demand Now account keeps a card on file. It pays for your plan and anything you book, such as a process server or lawyer review. You're never charged without choosing something first.</p>
      {searchParams.error && <div className="banner bad">We couldn't confirm your card. Please try again.</div>}
      {db.card && <p><span className="pill good">On file</span> {db.card.brand.toUpperCase()} ending {db.card.last4}</p>}
      <form action="/api/billing/card" method="post">
        <input type="hidden" name="plan" value={searchParams.plan ?? ""} />
        <button className="btn" style={{ width: "100%" }}>{db.card ? "Replace card" : "Add card securely"}</button>
      </form>
      <p className="note" style={{ marginTop: 12 }}>
        {billingLive() ? "Card details are entered on Stripe's secure page and never touch our servers." : "Demo mode: a test card (Visa ending 4242) is added without a payment page."}
      </p>
      {!user.emailVerifiedAt && <p className="note">We've also sent a confirmation link to {user.email}.</p>}
    </div>
  );
}
