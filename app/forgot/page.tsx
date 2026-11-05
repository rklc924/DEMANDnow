export default function Forgot({ searchParams }: { searchParams: { sent?: string } }) {
  return (
    <div className="card auth">
      <h1>Reset your password</h1>
      {searchParams.sent ? (
        <div className="banner good">If that email has an account, a reset link is on its way. It works for one hour.</div>
      ) : (
        <>
          <p className="sub">We'll email you a link to set a new password.</p>
          <form action="/api/auth/forgot" method="post">
            <label>Email</label>
            <input type="text" name="email" autoComplete="email" required />
            <div style={{ marginTop: 16 }}><button className="btn" style={{ width: "100%" }}>Send reset link</button></div>
          </form>
        </>
      )}
      <p className="note" style={{ marginTop: 16 }}><a href="/login">Back to log in</a></p>
    </div>
  );
}
