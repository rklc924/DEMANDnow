export default function Login({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="card auth">
      <h1>Log in</h1>
      <p className="sub">Welcome back.</p>
      {searchParams.error && <div className="banner warn">That email and password don't match.</div>}
      <form action="/api/auth/login" method="post">
        <label>Email</label>
        <input type="text" name="email" autoComplete="email" required />
        <label>Password</label>
        <input type="password" name="password" autoComplete="current-password" required />
        <div style={{ marginTop: 16 }}><button className="btn" style={{ width: "100%" }}>Log in</button></div>
      </form>
      <p className="note" style={{ marginTop: 16 }}>New here? <a href="/signup">Create an account</a></p>
    </div>
  );
}
