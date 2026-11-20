import { PLANS, type PlanId } from "@/lib/plans";

export default function Signup({ searchParams }: { searchParams: { error?: string; plan?: string; draft?: string } }) {
  const plan = PLANS[searchParams.plan as PlanId];
  return (
    <div className="card auth">
      <h1>Create your account</h1>
      <p className="sub">{plan ? `You picked ${plan.name}. You'll choose monthly or annual next.` : "You'll choose a plan next."} You'll be your organization's admin, and can add your team as regular users afterwards.</p>
      {searchParams.error && <div className="banner warn">{searchParams.error}</div>}
      <form action="/api/auth/signup" method="post">
        {plan && <input type="hidden" name="plan" value={plan.id} />}
        {searchParams.draft && <input type="hidden" name="draft" value={searchParams.draft} />}
        <label>Your name</label>
        <input type="text" name="name" autoComplete="name" required />
        <label>Business name (as it appears on your letters)</label>
        <input type="text" name="company" autoComplete="organization" required />
        <label>Work email</label>
        <input type="text" name="email" autoComplete="email" required />
        <label>Password (10+ characters)</label>
        <input type="password" name="password" autoComplete="new-password" minLength={10} required />
        <p className="note" style={{ marginTop: 14 }}>By creating an account you agree to the <a href="/terms" target="_blank">terms of service</a> and <a href="/privacy" target="_blank">privacy policy</a>.</p>
        <div style={{ marginTop: 10 }}><button className="btn" style={{ width: "100%" }}>Create account</button></div>
      </form>
      <p className="note" style={{ marginTop: 16 }}>Already have an account? <a href="/login">Log in</a></p>
    </div>
  );
}
