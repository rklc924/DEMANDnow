export default function Reset({ searchParams }: { searchParams: { token?: string; error?: string } }) {
  return (
    <div className="card auth">
      <h1>Choose a new password</h1>
      {searchParams.error && <div className="banner bad">{searchParams.error}</div>}
      <form action="/api/auth/reset" method="post">
        <input type="hidden" name="token" value={searchParams.token ?? ""} />
        <label>New password (at least 10 characters)</label>
        <input type="password" name="password" autoComplete="new-password" minLength={10} required />
        <label>Confirm new password</label>
        <input type="password" name="confirm" autoComplete="new-password" minLength={10} required />
        <div style={{ marginTop: 16 }}><button className="btn" style={{ width: "100%" }}>Save password</button></div>
      </form>
    </div>
  );
}
