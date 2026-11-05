export default function Login({ searchParams }: { searchParams: { error?: string; next?: string } }) {
  return (
    <div className="card auth">
      <h1>Log in</h1>
      <p className="sub">Welcome back.</p>
      {searchParams.error === "1" && <div className="banner warn">That email and password don't match.</div>}
      {searchParams.error === "locked" && <div className="banner bad">Too many attempts. Wait 15 minutes, or reset your password.</div>}
      {searchParams.error === "link" && <div className="banner warn">That link has expired or was already used. Log in, or request a new one.</div>}
      {searchParams.next?.startsWith("/oauth/") && <div className="banner good">Log in to connect your AI assistant to Demand Now. New here? Create an account, then connect again from your assistant.</div>}
      <form action="/api/auth/login" method="post">
        {searchParams.next && <input type="hidden" name="next" value={searchParams.next} />}
        <label>Email</label>
        <input type="text" name="email" autoComplete="email" required />
        <label>Password</label>
        <input type="password" name="password" autoComplete="current-password" required />
        <div style={{ marginTop: 16 }}><button className="btn" style={{ width: "100%" }}>Log in</button></div>
      </form>
      <p className="note" style={{ marginTop: 16 }}><a href="/forgot">Forgot your password?</a></p>
      <p className="note">New here? <a href="/signup">Create an account</a></p>
    </div>
  );
}
