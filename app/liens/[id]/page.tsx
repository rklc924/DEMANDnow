import { notFound } from "next/navigation";
import { requireUser, acct } from "@/lib/auth";
import { money } from "@/lib/aging";
import { LIEN_FILING_FEE, LIEN_ROLE_LABEL, LIEN_RUSH_FEE, LIEN_STANDARD_DAYS, LIEN_STEPS, LIEN_TITLE_SEARCH_FEE, filingQuote, lienDates } from "@/lib/liens";
import { readDB } from "@/lib/store";
import { Checklist } from "../../guide";

export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-CA", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
const daysTo = (iso: string) => Math.ceil((new Date(iso + "T23:59:59").getTime() - Date.now()) / 86_400_000);

export default async function LienPage({ params, searchParams }: { params: { id: string }; searchParams: { saved?: string; ordered?: string; fileError?: string; title?: string; noPermission?: string } }) {
  const user = await requireUser();
  const db = await readDB(acct(user));
  const l = db.liens?.find((x) => x.id === params.id);
  if (!l) notFound();
  const dates = lienDates(l);
  const fileBy = dates.find((d) => d.key === "file")!;
  const left = daysTo(fileBy.date);
  const progress = db.progress?.[l.id];
  const quote = filingQuote();
  const hasForm5 = !!progress?.docs.some((d) => d.stepId === "claim" && d.status !== "issues");
  const standardLate = quote.standardBy > fileBy.date;
  const rushLate = quote.rushBy > fileBy.date;
  const hasIssues = progress?.docs.some((d) => d.status === "issues");

  return (
    <>
      <p className="note"><a href="/liens">← Builders liens</a></p>
      {searchParams.noPermission && <div className="banner bad">Your admin hasn't given you access to do that.</div>}
      <h1>Lien: {l.civicAddress || l.pid || "property"}</h1>
      <p className="sub">{money(l.amount)} owing · {LIEN_ROLE_LABEL[l.role]} · registered owner {l.owner}</p>
      {searchParams.saved && <div className="banner good">Dates saved. Deadlines updated below and in your calendar.</div>}
      {!l.filedDate && !l.satisfied && left < 0 && <div className="banner bad"><b>The filing deadline appears to have passed ({fmt(fileBy.date)}).</b> Send this to a lawyer today: there may still be other remedies, such as a trust claim or a debt action.</div>}
      {!l.filedDate && !l.satisfied && left >= 0 && left <= 10 && <div className="banner bad"><b>{left} days left to file your claim of lien</b> (by {fmt(fileBy.date)}). File as soon as possible.</div>}
      {hasIssues && <div className="banner bad">A document you uploaded has problems. See the red box in the checklist below.</div>}
      {l.strata && <div className="banner warn">Strata property: special timing and filing rules apply (Strata Property Act, s. 88). Have a lawyer confirm the deadline.</div>}

      <div className="grid2">
        <div className="card">
          <h2>Your deadlines</h2>
          <table className="agenda">
            <tbody>
              {dates.map((d) => {
                const n = daysTo(d.date);
                return (
                  <tr key={d.key} className={!d.done && n < 0 ? "late" : ""}>
                    <td className="when">{fmt(d.date)}</td>
                    <td>
                      <b>{d.label}</b> {d.estimate && <span className="pill grey">estimate</span>}
                      <div className="note">{d.basis}</div>
                    </td>
                    <td style={{ textAlign: "right" }}>{d.done ? <span className="pill good">Done</span> : <span className={`pill ${n < 0 ? "bad" : n <= 10 ? "warn" : "blue"}`}>{n < 0 ? `${-n}d late` : `${n}d left`}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="note">Weekend deadlines roll to the next business day. Statutory holidays aren't counted yet, so confirm any deadline that falls near one.</p>
        </div>

        <div className="card">
          <h2>Critical dates</h2>
          <form action={`/api/liens/${l.id}`} method="post">
            <label>Last day you worked or supplied materials</label><input type="date" name="lastWorkDate" defaultValue={l.lastWorkDate} />
            <label>Certificate of completion filed</label><input type="date" name="completionCertificateDate" defaultValue={l.completionCertificateDate} />
            <label>Head contract completed, abandoned or terminated</label><input type="date" name="headContractEndDate" defaultValue={l.headContractEndDate} />
            <label>Date you filed the claim of lien</label><input type="date" name="filedDate" defaultValue={l.filedDate} />
            <label>Date you were served a 21-day notice to commence an action</label><input type="date" name="noticeToCommenceServedDate" defaultValue={l.noticeToCommenceServedDate} />
            <div className="row" style={{ marginTop: 14 }}><button className="btn">Save dates</button></div>
          </form>
          <form action={`/api/liens/${l.id}`} method="post" style={{ marginTop: 10 }}>
            <input type="hidden" name="satisfied" value={l.satisfied ? "0" : "1"} />
            <button className="btn ghost small">{l.satisfied ? "Reopen" : "Mark paid (lien satisfied)"}</button>
          </form>
        </div>
      </div>

      <div className="card">
        <h2>Claim of Lien (Form 5): what goes on the form</h2>
        <dl className="kv">
          <dt>Claimant</dt><dd>{l.claimant}</dd>
          <dt>Owner</dt><dd>{l.owner}</dd>
          <dt>Land</dt><dd>{[l.pid && `PID ${l.pid}`, l.legalDescription, l.civicAddress].filter(Boolean).join(" · ") || "Add the PID and legal description from the title search"}</dd>
          <dt>Work or materials</dt><dd>{l.workDescription || "Describe what you supplied"}{l.hiredBy ? `, under a contract with ${l.hiredBy}` : ""}</dd>
          <dt>Last supplied</dt><dd>{fmt(l.lastWorkDate)}</dd>
          <dt>Amount claimed</dt><dd>{money(l.amount)}: only what is owed for work and materials actually supplied. An inflated lien can make you liable for the owner's costs.</dd>
        </dl>
      </div>

      {!l.satisfied && (l.filing || !l.filedDate) && (
        <div className="card" id="filing">
          <h2>Have us file it for you</h2>
          {searchParams.ordered && <div className="banner good">Order received. We'll file it by hand and send you proof of filing by {fmt(l.filing!.proofBy)}.</div>}
          {searchParams.fileError && <div className="banner bad">{searchParams.fileError}</div>}
          {l.filing ? (
            <p>
              {l.filedDate ? <span className="pill good">Filed {fmt(l.filedDate)}</span> : <span className="pill blue">In progress</span>}{" "}
              Ordered {fmt(l.filing.orderedAt.slice(0, 10))}{l.filing.rush ? " (rush)" : ""}. Proof of filing by <b>{fmt(l.filing.proofBy)}</b>. Paid {money(l.filing.fee)}; Land Title Office fees are charged at cost once filed.
            </p>
          ) : (
            <>
              <p>We file your signed Claim of Lien by hand at the Land Title Office.</p>
              <ul className="selfserve">
                <li><b>${LIEN_FILING_FEE}</b> per lien plus the Land Title Office filing fees at cost</li>
                <li>Proof of filing within {LIEN_STANDARD_DAYS} business days: by {fmt(quote.standardBy)} if you order now</li>
                <li>Rush: proof within 1 to 3 business days if ordered before 12 PM, for <b>${LIEN_RUSH_FEE}</b> more: by {fmt(quote.rushBy)}{!quote.beforeNoon && " (it's past noon, so the clock starts next business day)"}</li>
              </ul>
              {!hasForm5 && <div className="banner warn">Upload your signed Claim of Lien (Form 5) in the checklist below first. We file the original you sign.</div>}
              {standardLate && !rushLate && <div className="banner bad">Standard filing could land after your {fmt(fileBy.date)} deadline. Choose rush.</div>}
              {rushLate && <div className="banner bad">Even rush may not beat your {fmt(fileBy.date)} deadline. File it yourself today through myLTSA, or send it for lawyer review.</div>}
              <form action={`/api/liens/${l.id}/file`} method="post">
                <label className="check"><input type="checkbox" name="rush" defaultChecked={standardLate} /> <span>Rush (+${LIEN_RUSH_FEE})</span></label>
                <label className="check"><input type="checkbox" name="titleSearch" defaultChecked /> <span>Add a post-registration title search (+${LIEN_TITLE_SEARCH_FEE} plus Land Title Office costs). Recommended: it confirms the lien is on title and shows what ranks ahead of you.</span></label>
                {rushLate && <label className="check"><input type="checkbox" name="lateOk" /> <span>I understand it may be filed after the deadline</span></label>}
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn" disabled={!hasForm5}>Order filing · charge my card</button>
                  <span className="note">Charged to your card on file, plus applicable tax.</span>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {(l.filedDate || l.filing) && !l.satisfied && (
        <div className="card" id="priority">
          <h2>Where does your lien rank?</h2>
          {searchParams.title && <div className="banner good">Title search ordered. We'll email it to you. Then upload it in the checklist below.</div>}
          <p>Filing the lien doesn't put you first in line. Mortgages and other charges registered before you usually get paid first if the property is sold. A <b>post-registration title search</b> confirms your lien is on the right title and shows everything ahead of it, so you know how much security you really have before spending money on a court action.</p>
          {l.titleSearchOrder ? (
            <p className="note"><span className="pill blue">Ordered {fmt(l.titleSearchOrder.orderedAt.slice(0, 10))}</span> We'll send it to you. Upload it under "Pull a post-registration title search" in the checklist.</p>
          ) : (
            <form action={`/api/liens/${l.id}/file`} method="post" className="row">
              <input type="hidden" name="action" value="title" />
              <button className="btn">Pull it for me · ${LIEN_TITLE_SEARCH_FEE} + Land Title Office costs</button>
              <span className="note">Charged to your card on file, plus applicable tax.</span>
            </form>
          )}
        </div>
      )}

      <Checklist title="Lien checklist" steps={LIEN_STEPS} api={`/api/liens/${l.id}`} progress={progress} autoDone={l.filedDate ? ["dates", "file"] : []} disclaimer="This is legal information about BC builders liens, not legal advice. A lawyer should handle the court action." />
    </>
  );
}
