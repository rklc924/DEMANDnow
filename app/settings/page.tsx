import { requireUser } from "@/lib/auth";
import { providerLabel, providerLive } from "@/lib/mailbox";
import { mcpUrl } from "@/lib/oauth";
import { readDB } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Settings({ searchParams }: { searchParams: { saved?: string; mailError?: string; ai?: string } }) {
  const user = await requireUser();
  const { company: c, settings: s, mailbox: m, aiConnections: ai = [] } = await readDB(user.id);
  const server = mcpUrl();
  return (
    <>
      <h1>Company &amp; letterhead</h1>
      <p className="sub">Letters go out in your company's name, on your letterhead.</p>
      {searchParams.saved && <div className="banner good">Saved.</div>}
      <div className="grid2">
        <div className="card">
          <h2>Letterhead</h2>
          <p className="note">Upload your letterhead as a one-page PDF (best) or a full-page PNG/JPG. The letter text is placed below the top 2 inches, so keep your header in that band.</p>
          <form action="/api/letterhead" method="post" encType="multipart/form-data">
            <input type="file" name="letterhead" accept="application/pdf,image/png,image/jpeg" required />
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn">Upload</button>
              {c.letterhead && <span className="pill good">Letterhead on file</span>}
            </div>
          </form>
        </div>
        <div className="card">
          <h2>Sending rules</h2>
          <form action="/api/settings" method="post">
            <input type="hidden" name="name" value={c.name} />
            <input type="hidden" name="signatory" value={c.signatory} />
            <input type="hidden" name="signatoryTitle" value={c.signatoryTitle} />
            <input type="hidden" name="phone" value={c.phone} />
            <input type="hidden" name="email" value={c.email} />
            <input type="hidden" name="paymentInstructions" value={c.paymentInstructions} />
            <label className="check"><input type="checkbox" name="autoSend" defaultChecked={s.autoSend} /> <span>Auto-send demand letters to <b>business</b> customers once an invoice passes the threshold. Consumer customers always wait for your review.</span></label>
            <label>Threshold (days past due)</label>
            <input type="number" name="thresholdDays" defaultValue={s.thresholdDays} min={30} />
            <label>Days to pay after the letter</label>
            <input type="number" name="responseDays" defaultValue={s.responseDays} min={7} />
            <div style={{ marginTop: 14 }}><button className="btn">Save rules</button></div>
          </form>
        </div>
      </div>
      <div className="card" id="mailbox">
        <h2>Email and calendar</h2>
        {searchParams.mailError && <div className="banner bad">{searchParams.mailError}</div>}
        {m ? (
          <>
            <p>
              <span className="pill good">Connected</span> {providerLabel(m.provider)} · <b>{m.address}</b>
              {m.demo && <span className="pill grey" style={{ marginLeft: 8 }}>demo</span>}
            </p>
            <form action="/api/connect/prefs" method="post">
              <label className="check"><input type="checkbox" name="sendEmail" defaultChecked={m.sendEmail} /> <span>Email each demand letter from this address, with the PDF attached, the moment it's sent</span></label>
              <label className="check"><input type="checkbox" name="addReminders" defaultChecked={m.addReminders} /> <span>Add follow-up reminders (BF dates) to this calendar: payment deadline, next step, filing check and limitation warning</span></label>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn small">Save</button>
              </div>
            </form>
            <form action="/api/connect/disconnect" method="post" style={{ marginTop: 8 }}><button className="btn small ghost">Disconnect</button></form>
          </>
        ) : (
          <>
            <p className="note" style={{ marginTop: 0 }}>Connect once and demand letters go out from your own mailbox, and the follow-up dates land in your own calendar. You can turn either off.</p>
            <div className="row" style={{ gap: 10 }}>
              <form action="/api/connect/microsoft" method="post"><button className="btn">Connect Outlook / Microsoft 365</button></form>
              <form action="/api/connect/google" method="post"><button className="btn ghost">Connect Gmail / Google</button></form>
            </div>
            <p className="note">Using another email app? Letters still go out from Demand Now, and each matter has an .ics file you can add to Apple Calendar or any other calendar.{!providerLive("microsoft") && !providerLive("google") ? " Demo mode: connecting simulates a mailbox." : ""}</p>
          </>
        )}
      </div>
      <div className="card" id="ai">
        <h2>AI assistants (Claude and ChatGPT)</h2>
        {searchParams.ai === "disconnected" && <div className="banner good">Disconnected. That assistant can no longer reach your account.</div>}
        <p className="note" style={{ marginTop: 0 }}>Connect Claude or ChatGPT and you can ask it about an unpaid invoice, then have it add the matter here for you to review and send. It can't send letters or charge your card.</p>
        <label>Connector URL</label>
        <input type="text" value={server} readOnly />
        <div className="grid2" style={{ marginTop: 12 }}>
          <div>
            <b>Claude</b>
            <ol className="note" style={{ paddingLeft: 18 }}>
              <li>In Claude, open Settings, then Connectors.</li>
              <li>Choose Add custom connector, name it Demand Now and paste the URL above.</li>
              <li>Click Connect, log in here and choose Allow.</li>
            </ol>
          </div>
          <div>
            <b>ChatGPT</b>
            <ol className="note" style={{ paddingLeft: 18 }}>
              <li>In ChatGPT, open Settings, then Apps &amp; Connectors (turn on Developer mode under Advanced if you don't see Create).</li>
              <li>Choose Create, name it Demand Now, paste the URL above and pick OAuth.</li>
              <li>Log in here and choose Allow.</li>
            </ol>
          </div>
        </div>
        <p className="note">Then ask something like: "Acme Ltd owes us $7,800 on invoice 1042, due June 3. Start a demand in Demand Now."</p>
        {ai.length > 0 && (
          <>
            <h3 style={{ marginTop: 16 }}>Connected</h3>
            {ai.map((a) => (
              <div className="row" key={a.grantId} style={{ justifyContent: "space-between", padding: "6px 0" }}>
                <span><span className="pill good">Connected</span> {a.clientName} · since {new Date(a.connectedAt).toLocaleDateString("en-CA")}</span>
                <form action="/api/ai/disconnect" method="post"><input type="hidden" name="grantId" value={a.grantId} /><button className="btn small ghost">Disconnect</button></form>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="card">
        <h2>Company details on the letter</h2>
        <form action="/api/settings" method="post">
          {s.autoSend && <input type="hidden" name="autoSend" value="on" />}
          <input type="hidden" name="thresholdDays" value={s.thresholdDays} />
          <input type="hidden" name="responseDays" value={s.responseDays} />
          <div className="grid2">
            <div><label>Legal business name</label><input type="text" name="name" defaultValue={c.name} /></div>
            <div><label>Phone</label><input type="text" name="phone" defaultValue={c.phone} /></div>
            <div><label>Signed by</label><input type="text" name="signatory" defaultValue={c.signatory} /></div>
            <div><label>Title</label><input type="text" name="signatoryTitle" defaultValue={c.signatoryTitle} /></div>
            <div><label>Reply email</label><input type="text" name="email" defaultValue={c.email} /></div>
            <div><label>Jurisdiction</label><input type="text" value="British Columbia" disabled /></div>
          </div>
          <label>Payment instructions</label>
          <textarea name="paymentInstructions" defaultValue={c.paymentInstructions} />
          <div style={{ marginTop: 14 }}><button className="btn">Save details</button></div>
        </form>
      </div>
    </>
  );
}
