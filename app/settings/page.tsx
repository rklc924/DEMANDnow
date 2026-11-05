import { requireUser } from "@/lib/auth";
import { readDB } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Settings({ searchParams }: { searchParams: { saved?: string } }) {
  const user = await requireUser();
  const { company: c, settings: s } = await readDB(user.id);
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
