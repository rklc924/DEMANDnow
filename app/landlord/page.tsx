import { requireUser, acct } from "@/lib/auth";
import { money } from "@/lib/aging";
import { readDB } from "@/lib/store";
import { KIND_LABEL, ledger, tenancyDates, tenancyRules, type TenancyKind } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
const daysTo = (iso: string) => Math.ceil((new Date(iso + "T23:59:59").getTime() - Date.now()) / 86_400_000);

export default async function Landlord({ searchParams }: { searchParams: { kind?: string; error?: string } }) {
  const user = await requireUser();
  const db = await readDB(acct(user));
  const rules = tenancyRules(db.company.jurisdiction || "BC");
  const kind: TenancyKind | undefined = searchParams.kind === "commercial" ? "commercial" : searchParams.kind === "residential" ? "residential" : undefined;
  const files = db.tenancies ?? [];

  return (
    <>
      <h1>Landlord</h1>
      <p className="sub">Collect unpaid rent. Choose the kind of tenancy: the rules and the forum are different.</p>

      <div className="grid2">
        <div className={`card ${kind === "residential" ? "picked" : ""}`}>
          <h2>Residential tenancy</h2>
          <p>Homes, suites and apartments under the <i>Residential Tenancy Act</i>. Rent disputes go to the {rules.residential.tribunal} ({rules.residential.tribunalShort}), not the CRT or Small Claims.</p>
          <ul className="selfserve">
            <li>Rent ledger with every payment, and a rent demand letter generated from it</li>
            <li>Every detail the RTB forms ask for, with data sheets for the 10 Day Notice (RTB-30), Proof of Service (RTB-34), Direct Request Worksheet (RTB-46), Direct Request application (RTB-12L-DR) and its Proof of Service (RTB-44)</li>
            <li>Service methods and the dates they create: when the tenant is treated as receiving the notice, their 5 days to pay or dispute, and the effective date</li>
            <li>Step-by-step filing with the RTB, and what to do after the decision</li>
          </ul>
          <a className="btn" href="/landlord?kind=residential#new">Start a residential file</a>
        </div>
        <div className={`card ${kind === "commercial" ? "picked" : ""}`}>
          <h2>Commercial lease</h2>
          <p>Shops, offices and industrial space. The RTB doesn't cover these. You can sue for the arrears, or use the lease's remedies (distress or re-entry).</p>
          <ul className="selfserve">
            <li>Rent ledger and a rent demand letter to the tenant, copied to any indemnifier</li>
            <li>Arrears claims routed by amount: Civil Resolution Tribunal under $5,000, Small Claims up to $35,000, and referred to a lawyer above that</li>
            <li>The lease remedies explained, and when re-entry may become available</li>
          </ul>
          <a className="btn" href="/landlord?kind=commercial#new">Start a commercial file</a>
        </div>
      </div>

      {files.length > 0 && (
        <div className="card">
          <h2>Your rent arrears files</h2>
          <table className="agenda">
            <tbody>
              {files
                .map((t) => ({ t, l: ledger(t), next: tenancyDates(t).find((d) => !d.done && daysTo(d.date) >= -30) }))
                .sort((a, b) => Number(!!a.t.satisfied) - Number(!!b.t.satisfied) || (a.next?.date ?? "9").localeCompare(b.next?.date ?? "9"))
                .map(({ t, l, next }) => {
                  const d = next ? daysTo(next.date) : null;
                  return (
                    <tr key={t.id} className={!t.satisfied && d !== null && d < 0 ? "late" : ""}>
                      <td>
                        <a href={`/landlord/${t.id}`}><b>{[t.unit, t.street].filter(Boolean).join(" - ")}</b></a>
                        <div className="note">{KIND_LABEL[t.kind]} · {t.tenants.join(", ")} · {money(l.total)} owing</div>
                      </td>
                      <td>{t.satisfied ? <span className="chip collected">Settled</span> : next ? <>{next.label}<div className="note">{fmt(next.date)}</div></> : <span className="note">Next: send the rent demand</span>}</td>
                      <td style={{ textAlign: "right" }}>{!t.satisfied && d !== null && <span className={`pill ${d < 0 ? "bad" : d <= 3 ? "warn" : "blue"}`}>{d < 0 ? `${-d} days ago` : `${d} days left`}</span>}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {kind && (
        <div className="card" id="new">
          <h2>Start a {kind === "residential" ? "residential" : "commercial"} rent arrears file</h2>
          {searchParams.error && <div className="banner bad">{searchParams.error}</div>}
          <form action="/api/landlord" method="post">
            <input type="hidden" name="kind" value={kind} />
            <div className="grid2">
              <div>
                <h3>Landlord</h3>
                <label>Landlord's legal name{kind === "residential" ? " (as on the tenancy agreement)" : " (as on the lease)"}</label>
                <input type="text" name="landlord" defaultValue={db.company.name} required />
                <label>Agent or property manager acting for the landlord (if any)</label><input type="text" name="landlordAgent" />
                <label>Landlord's address for service (one line per row)</label><textarea name="landlordAddress" placeholder={"Suite, street\nCity, BC  Postal code"} />
                <div className="grid2" style={{ gap: 10 }}>
                  <div><label>Phone</label><input type="text" name="landlordPhone" defaultValue={db.company.phone} /></div>
                  <div><label>Email</label><input type="email" name="landlordEmail" defaultValue={db.company.email} /></div>
                </div>
                <h3 style={{ marginTop: 16 }}>{kind === "residential" ? "Tenant(s)" : "Tenant"}</h3>
                <label>{kind === "residential" ? "Every tenant's full name, one per line, exactly as on the tenancy agreement" : "Tenant's legal name, exactly as on the lease"}</label>
                <textarea name="tenants" required />
                {kind === "commercial" && (<><label>Indemnifiers or guarantors (one per line, if any)</label><textarea name="guarantors" /></>)}
                <div className="grid2" style={{ gap: 10 }}>
                  <div><label>Tenant phone</label><input type="text" name="tenantPhone" /></div>
                  <div><label>Tenant email</label><input type="email" name="tenantEmail" /></div>
                </div>
              </div>
              <div>
                <h3>{kind === "residential" ? "Rental unit" : "Premises"}</h3>
                <div className="grid2" style={{ gap: 10 }}>
                  <div><label>Unit or suite</label><input type="text" name="unit" placeholder="e.g. Basement, 204" /></div>
                  <div><label>Postal code</label><input type="text" name="postalCode" /></div>
                </div>
                <label>Street address</label><input type="text" name="street" required />
                <label>City</label><input type="text" name="city" required />
                <h3 style={{ marginTop: 16 }}>Rent</h3>
                <div className="grid2" style={{ gap: 10 }}>
                  <div><label>Monthly rent (CAD){kind === "commercial" ? ", including additional rent" : ""}</label><input type="text" name="monthlyRent" inputMode="decimal" required /></div>
                  <div><label>Rent is due on day</label><input type="number" name="rentDueDay" min={1} max={31} defaultValue={1} /></div>
                </div>
                <div className="grid3">
                  <div><label>First unpaid rent was due on</label><input type="date" name="firstUnpaid" required /></div>
                  <div><label>Months unpaid so far</label><input type="number" name="months" min={1} max={36} defaultValue={1} required /></div>
                  <div><label>Paid toward those months</label><input type="text" name="paidSoFar" inputMode="decimal" placeholder="0" /></div>
                </div>
                {kind === "residential" ? (
                  <div className="grid2" style={{ gap: 10 }}>
                    <div><label>Unpaid utilities owed to you (if any)</label><input type="text" name="utilities" inputMode="decimal" /></div>
                    <div><label>Date you gave a written demand for them</label><input type="date" name="utilitiesDemandDate" /></div>
                  </div>
                ) : (
                  <><label>Days rent can be unpaid before the lease allows re-entry</label><input type="number" name="graceDays" min={0} max={90} defaultValue={rules.commercial.defaultGraceDays} /></>
                )}
                <p className="note">You can add more charges and payments, and fill in every form detail, on the next page.</p>
              </div>
            </div>
            <div style={{ marginTop: 14 }}><button className="btn">Open the file</button></div>
          </form>
        </div>
      )}
      <p className="note">{rules.disclaimer}</p>
    </>
  );
}
