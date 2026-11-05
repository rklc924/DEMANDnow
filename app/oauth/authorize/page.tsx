import { redirect } from "next/navigation";
import { getUser, acct } from "@/lib/auth";
import { checkAuthorizeRequest, OAuthError } from "@/lib/oauth";
import { readDB } from "@/lib/store";
import { usage } from "@/lib/usage";

export const dynamic = "force-dynamic";

// OAuth consent screen. Claude or ChatGPT sends the user here when they add the Demand Now connector.
export default async function Authorize({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const qs = new URLSearchParams(Object.entries(searchParams).filter((e): e is [string, string] => typeof e[1] === "string"));
  let req: Awaited<ReturnType<typeof checkAuthorizeRequest>>;
  try {
    req = await checkAuthorizeRequest(searchParams);
  } catch (e) {
    const err = e as OAuthError;
    // Errors after the client and return address check out go back to the assistant, per OAuth.
    const client = searchParams.redirect_uri && err.code !== "invalid_client" && err.code !== "invalid_request" ? searchParams.redirect_uri : null;
    if (client) {
      const u = new URL(client);
      u.searchParams.set("error", err.code);
      u.searchParams.set("error_description", err.message);
      if (searchParams.state) u.searchParams.set("state", searchParams.state);
      redirect(u.toString());
    }
    return (
      <div className="card auth">
        <h1>Couldn't connect</h1>
        <div className="banner warn">{err.message ?? "This connection request isn't valid."}</div>
      </div>
    );
  }

  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${qs}`)}`);
  const db = await readDB(acct(user));
  const u = usage(db);
  const host = new URL(req.redirectUri).host;

  return (
    <div className="card auth" style={{ maxWidth: 480 }}>
      <h1>Connect {req.client.name}</h1>
      <p className="sub">{req.client.name} is asking to connect to your Demand Now account ({user.email}).</p>
      <p>Once connected, it can:</p>
      <ul>
        <li>Check how overdue an invoice is and where a claim would go (CRT, Small Claims or a lawyer)</li>
        <li>Add unpaid invoices you give it as new demand matters</li>
        <li>See your matters, their status and next steps</li>
      </ul>
      <p>It <b>can't</b> send letters, file anything, charge your card or see your password. You review and send every letter in Demand Now.</p>
      {!u.plan && <div className="banner warn">You don't have a plan yet. Demands it adds will wait in Demand Now until you pay for a one-off demand or subscribe.</div>}
      <p className="note">You'll be returned to <b>{host}</b>. You can disconnect it any time in Settings.</p>
      <form action="/api/oauth/approve" method="post">
        {[...qs.entries()].map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <div className="row" style={{ marginTop: 16, gap: 12 }}>
          <button className="btn" name="decision" value="allow">Allow</button>
          <button className="btn ghost" name="decision" value="deny">Cancel</button>
        </div>
      </form>
    </div>
  );
}
