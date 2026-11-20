import { requireUser, acct, can, canSeeMatter, isAdmin } from "@/lib/auth";
import { assignableUsers } from "@/lib/matters";
import { AssigneeField } from "../assign";
import { money } from "@/lib/aging";
import { LIEN_FILING_FEE, LIEN_ROLE_LABEL, LIEN_RUSH_FEE, LIEN_STANDARD_DAYS, lienDates } from "@/lib/liens";
import { readDB } from "@/lib/store";

export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
const daysTo = (iso: string) => Math.ceil((new Date(iso + "T23:59:59").getTime() - Date.now()) / 86_400_000);

export default async function Liens({ searchParams }: { searchParams: { error?: string; noPermission?: string } }) {
  const user = await requireUser();
  const db = await readDB(acct(user));

  if (!db.addons?.liens) {
    return (
      <div className="about">
        <h1>Builders Lien add-on</h1>
        <p className="sub">For contractors, subtrades, workers and suppliers in BC who improved a property and haven't been paid.</p>
        <div className="card">
          <h2>Protect your right to be paid before the 45-day window closes</h2>
          <p>Under the BC <i>Builders Lien Act</i>, you can register a lien against the property you worked on. It must be filed within 45 days after the job is completed, abandoned or terminated, or a certificate of completion is filed. Miss it and the lien is gone.</p>
          <ul className="selfserve">
            <li>Collects your critical dates and calculates every deadline: filing, the one-year action deadline, and the 21-day notice to commence</li>
            <li>Fills the Claim of Lien (Form 5) data from your details and the title search</li>
            <li>Tick-box checklist through filing at the Land Title Office, with document checks that flag errors before you file</li>
            <li>Deadlines and reminders in your calendar, plus a lawyer hand-off for the court action</li>
            <li>Optional: we file it by hand for ${LIEN_FILING_FEE} per lien plus Land Title Office fees, with proof of filing within {LIEN_STANDARD_DAYS} business days (rush 1 to 3 business days for ${LIEN_RUSH_FEE} more if ordered before 12 PM)</li>
          </ul>
          {isAdmin(user) ? (
          <form action="/api/addons/liens" method="post" className="row" style={{ marginTop: 14 }}>
            <button className="btn">Turn on Builders Liens</button>
            <span className="note">Deadline tools are included. You only pay when we file a lien for you.</span>
          </form>
          ) : <p className="note" style={{ marginTop: 14 }}>Ask your organization's admin to turn on Builders Liens.</p>}
        </div>
      </div>
    );
  }

  const liens = (db.liens ?? []).filter((l) => canSeeMatter(user, db, l.id));
  const users = await assignableUsers(acct(user));
  const nameOf = (id?: string) => { const u = users.find((x) => x.id === id); return u ? u.name || u.email : "Nobody"; };
  return (
    <>
      <h1>Builders liens</h1>
      <p className="sub">Each lien has hard deadlines. The most urgent are at the top.</p>
      {liens.length > 0 && (
        <div className="card">
          <table className="agenda">
            <tbody>
              {liens
                .map((l) => ({ l, next: lienDates(l).find((d) => !d.done) }))
                .sort((a, b) => (a.next?.date ?? "9").localeCompare(b.next?.date ?? "9"))
                .map(({ l, next }) => {
                  const d = next ? daysTo(next.date) : null;
                  return (
                    <tr key={l.id} className={d !== null && d < 0 ? "late" : ""}>
                      <td><a href={`/liens/${l.id}`}><b>{l.civicAddress || l.pid || "Property"}</b></a><div className="note">Owner {l.owner} · {money(l.amount)} · assigned to {nameOf(db.owners?.[l.id])}</div></td>
                      <td>{l.satisfied ? <span className="chip collected">Paid</span> : next ? <>{next.label}<div className="note">{fmt(next.date)}</div></> : null}</td>
                      <td style={{ textAlign: "right" }}>{!l.satisfied && d !== null && <span className={`pill ${d < 0 ? "bad" : d <= 7 ? "warn" : "blue"}`}>{d < 0 ? `${-d} days late` : `${d} days left`}</span>}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {searchParams.noPermission && <div className="banner bad">Your admin hasn't given you access to do that.</div>}
      {!can(user, "addMatters", db) ? null : (
      <div className="card" id="new">
        <h2>Start a lien</h2>
        {searchParams.error && <div className="banner bad">{searchParams.error}</div>}
        <form action="/api/liens" method="post">
          <div className="grid2">
            <div>
              <label>You are a</label>
              <select name="role" defaultValue="subcontractor">{Object.entries(LIEN_ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <label>Your legal name (claimant)</label><input type="text" name="claimant" defaultValue={db.company.name} />
              <label>Who hired you</label><input type="text" name="hiredBy" placeholder="e.g. ABC Contracting Ltd." />
              <label>What you supplied</label><input type="text" name="workDescription" placeholder="e.g. electrical rough-in and finishing" />
              <label>Amount owing (CAD)</label><input type="text" name="amount" inputMode="decimal" required />
            </div>
            <div>
              <label>Property address</label><input type="text" name="civicAddress" />
              <label>PID (from the title search)</label><input type="text" name="pid" placeholder="000-000-000" />
              <label>Legal description</label><input type="text" name="legalDescription" placeholder="Lot 1, Section 2, Plan EPP12345" />
              <label>Registered owner (exactly as on title)</label><input type="text" name="owner" required />
              <label className="check" style={{ marginTop: 12 }}><input type="checkbox" name="strata" /> <span>It's a strata property</span></label>
            </div>
          </div>
          <h3 style={{ margin: "18px 0 4px" }}>Critical dates</h3>
          <p className="note" style={{ marginTop: 0 }}>These set your deadlines. Fill in every one you know.</p>
          <div className="grid3">
            <div><label>Last day you worked or supplied materials *</label><input type="date" name="lastWorkDate" required /></div>
            <div><label>Certificate of completion filed (if any)</label><input type="date" name="completionCertificateDate" /></div>
            <div><label>Head contract completed, abandoned or terminated (if known)</label><input type="date" name="headContractEndDate" /></div>
          </div>
          <div style={{ maxWidth: 360 }}><AssigneeField me={user} users={users} canAssign={can(user, "assignMatters", db)} /></div>
          <div style={{ marginTop: 14 }}><button className="btn">Work out my deadlines</button></div>
        </form>
      </div>
      )}
    </>
  );
}
