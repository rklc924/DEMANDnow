import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireUser, acct } from "@/lib/auth";
import { money } from "@/lib/aging";
import { readDB } from "@/lib/store";
import {
  KIND_LABEL, RENT_DEMAND_DAYS, commercialForum, earliestEffectiveDate, ledger, missingCount, rtbSheets, tenancyDates, tenancyRules,
  type ServiceRecord, type Tenancy, type TenancyRules,
} from "@/lib/tenancy";
import { Checklist } from "../../guide";

export const dynamic = "force-dynamic";

const fmt = (iso?: string) => (iso ? new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("en-CA", { weekday: "short", year: "numeric", month: "short", day: "numeric" }) : "");
const daysTo = (iso: string) => Math.ceil((new Date(iso + "T23:59:59").getTime() - Date.now()) / 86_400_000);
const NL = String.fromCharCode(10);

type SP = { saved?: string; sent?: string; review?: string; letterError?: string; ledgerError?: string; noPermission?: string; checked?: string };

export default async function TenancyPage({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const user = await requireUser();
  const db = await readDB(acct(user));
  const t = db.tenancies?.find((x) => x.id === params.id);
  if (!t) notFound();
  const rules = tenancyRules(t.jurisdiction);
  const residential = t.kind === "residential";
  const l = ledger(t);
  const dates = tenancyDates(t);
  const progress = db.progress?.[t.id];
  const hasIssues = progress?.docs.some((d) => d.status === "issues");
  const payBy = dates.find((d) => d.key === "pay-or-dispute");
  const forum = !residential ? commercialForum(t) : undefined;
  const sheets = residential ? rtbSheets(t) : [];
  const missing = sheets.reduce((n, s) => n + missingCount(s), 0);

  return (
    <>
      <p className="note"><a href="/landlord">← Landlord</a></p>
      {searchParams.noPermission && <div className="banner bad">Your admin hasn't given you access to do that.</div>}
      <h1>{[t.unit, t.street].filter(Boolean).join(" - ")}</h1>
      <p className="sub">{KIND_LABEL[t.kind]} · {t.tenants.join(", ")} · <b>{money(l.total)}</b> owing{l.oldest ? ` since ${fmt(l.oldest)}` : ""}</p>
      {searchParams.saved && <div className="banner good">Saved. Dates, data sheets and your calendar are updated.</div>}
      {searchParams.review && <div className="banner good">Sent to the firm for review. A lawyer will contact you within one business day.</div>}
      {hasIssues && <div className="banner bad">A document you uploaded has problems. See the red box in the checklist below.</div>}
      {t.satisfied && <div className="banner good">Marked settled.</div>}
      {residential && payBy && !t.satisfied && daysTo(payBy.date) >= 0 && <div className="banner warn">The tenant has until <b>{fmt(payBy.date)}</b> to pay in full or dispute the 10 Day Notice. Don't apply to the RTB before then.</div>}
      {residential && t.tenantDisputed && <div className="banner warn">The tenant disputed the notice, so a Direct Request isn't available. The RTB will hold a hearing: apply with the Landlord's Application for Dispute Resolution (RTB-12L-CT) if the tenant's application doesn't already cover your claim, and request lawyer review.</div>}
      {forum && !forum.selfServe && !t.satisfied && <div className="banner warn">The arrears are over the Small Claims limit, so this claim is referred to a lawyer. Use <b>Request lawyer review</b> below.</div>}

      <div className="grid2">
        <div className="card">
          <h2>Key dates</h2>
          {dates.length === 0 ? (
            <p className="note">{residential ? "Dates appear once you send a rent demand or record how the 10 Day Notice was served." : "Dates appear once there's unpaid rent on the ledger."}</p>
          ) : (
            <table className="agenda">
              <tbody>
                {dates.map((d) => {
                  const n = daysTo(d.date);
                  return (
                    <tr key={d.key} className={!d.done && n < 0 ? "late" : ""}>
                      <td className="when">{fmt(d.date)}</td>
                      <td><b>{d.label}</b> {d.estimate && <span className="pill grey" title="Confirm against current rules before relying on it">confirm</span>}<div className="note">{d.basis}</div></td>
                      <td style={{ textAlign: "right" }}>{d.done ? <span className="pill good">Done</span> : <span className={`pill ${n < 0 ? "bad" : n <= 3 ? "warn" : "blue"}`}>{n < 0 ? `${-n}d ago` : `${n}d left`}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {residential && <p className="note">Days are calendar days. If a deadline lands on a weekend or holiday, check the RTB's rules before relying on it.</p>}
        </div>

        <div className="card" id="letter">
          <h2>Rent demand letter</h2>
          {searchParams.sent && <div className="banner good">Sent. {t.tenantEmail && db.mailbox?.sendEmail ? `Emailed to ${t.tenantEmail} from your mailbox.` : "Print it and deliver it, or send it by registered mail."}</div>}
          {searchParams.letterError && <div className="banner bad">{searchParams.letterError}</div>}
          <p>The software generates the letter from your rent ledger, on your letterhead. It gives the tenant {RENT_DEMAND_DAYS[t.kind]} days to pay{residential ? " and explains that you may serve a 10 Day Notice and apply to the RTB. It is not itself a notice to end the tenancy." : `, reserves your rights under the lease, and is copied to ${t.guarantors?.length ? "the indemnifiers" : "any indemnifier you add"}.`}</p>
          {t.demandSentAt && <p><span className="pill good">Sent {fmt(t.demandSentAt)}</span> Payment due by <b>{fmt(t.demandDeadline)}</b>.</p>}
          <div className="row">
            <a className="btn ghost" href={`/api/landlord/${t.id}/letter`} target="_blank">Preview letter</a>
            {!t.satisfied && l.total > 0 && (
              <form action={`/api/landlord/${t.id}/letter`} method="post"><button className="btn">{t.demandSentAt ? "Send again" : "Send rent demand"}</button></form>
            )}
          </div>
          <p className="note">Counts as one letter toward your plan's monthly limit. {t.tenantEmail ? (db.mailbox?.sendEmail ? `It's emailed to ${t.tenantEmail} from your connected mailbox.` : "Connect your mailbox in Settings to email it automatically.") : "Add the tenant's email to send it by email."}{residential ? " Email is only proper service if the tenant agreed to it in writing, so also deliver a printed copy." : ""}</p>
        </div>
      </div>

      <Ledger t={t} error={searchParams.ledgerError} />

      {residential ? <ResidentialDetails t={t} rules={rules} /> : <CommercialDetails t={t} rules={rules} forumName={forum!.name} forumSteps={forum!.steps.map((s) => s.title)} selfServe={forum!.selfServe} />}

      {residential && (
        <div className="card" id="forms">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>RTB forms: what goes on each one</h2>
            <a className="btn small" href={`/api/landlord/${t.id}/sheets`} target="_blank">Download all data sheets (PDF)</a>
          </div>
          <p className="note">The RTB only accepts its own forms. Copy these details onto each form from the <a href={rules.residential.links[0].url} target="_blank" rel="noreferrer">RTB forms page</a>, or into the online application. {missing > 0 ? <b>{missing} details are still missing: they're marked in red. Fill them in above.</b> : "Every detail is filled in."}</p>
          {sheets.map((s) => (
            <details key={s.code} className="sheet" open={s.code === "RTB-30" && !t.noticeService?.date}>
              <summary>
                <b>{s.code}</b> {s.title} {missingCount(s) > 0 ? <span className="pill bad">{missingCount(s)} missing</span> : <span className="pill good">complete</span>}
              </summary>
              <p className="note">{s.use} <a href={`/api/landlord/${t.id}/sheets?form=${s.code}`} target="_blank">Data sheet PDF</a></p>
              <dl className="kv">
                {s.fields.map((f) => (
                  <Row key={f.label} label={f.label}>{f.value === undefined ? <span className="missing">Missing{f.fix ? `: fill in "${f.fix}" above` : ""}</span> : f.value || <span className="note">(leave blank)</span>}</Row>
                ))}
              </dl>
              {s.table && s.table.rows.length > 0 && (
                <table className="fees" style={{ marginTop: 8 }}>
                  <thead><tr>{s.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{s.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
                </table>
              )}
            </details>
          ))}
        </div>
      )}

      <Checklist
        title={residential ? "Checklist: unpaid rent at the RTB" : "Checklist: commercial rent arrears"}
        steps={rules[t.kind].steps}
        api={`/api/landlord/${t.id}`}
        progress={progress}
        autoDone={[t.charges.length ? "ledger" : "", t.noticeSignedDate ? "notice" : "", t.utilitiesDemandDate || !t.charges.some((c) => c.kind === "utilities") ? "utilities" : ""].filter(Boolean)}
        disclaimer={rules.disclaimer}
      />

      <div className="grid2">
        <div className="card">
          <h2>Request lawyer review</h2>
          <p>{residential ? "Recommended if the tenant disputes the notice, the tenancy is unusual (shared accommodation, strata rules, a manufactured home site), or you need the Supreme Court for a writ of possession." : "Recommended before distress or a lock-out, if the tenant disputes the arrears, if indemnifiers are involved, or if the arrears are over the Small Claims limit."}</p>
          {t.reviewRequestedAt ? <span className="pill good">Lawyer review requested {fmt(t.reviewRequestedAt)}</span> : (
            <form action={`/api/landlord/${t.id}`} method="post"><input type="hidden" name="action" value="review" /><button className="btn ghost">Request lawyer review (add-on)</button></form>
          )}
        </div>
        <div className="card">
          <h2>Settled?</h2>
          <p className="note">Mark the file settled once the arrears are paid or the matter is closed. Its deadlines leave your calendar.</p>
          <form action={`/api/landlord/${t.id}`} method="post"><input type="hidden" name="action" value={t.satisfied ? "reopen" : "paid"} /><button className="btn ghost small">{t.satisfied ? "Reopen" : "Mark settled"}</button></form>
          <h3 style={{ marginTop: 14 }}>Official sources</h3>
          <ul className="selfserve">
            {rules[t.kind].links.map((x) => <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer">{x.label}</a></li>)}
          </ul>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (<><dt>{label}</dt><dd>{children}</dd></>);
}

function Ledger({ t, error }: { t: Tenancy; error?: string }) {
  const l = ledger(t);
  const action = `/api/landlord/${t.id}`;
  return (
    <div className="card" id="ledger">
      <h2>Rent ledger</h2>
      {error && <div className="banner bad">{error}</div>}
      <table className="fees">
        <thead><tr><th>Charge</th><th>Due</th><th className="amt">Amount</th><th className="amt">Paid</th><th className="amt">Owing</th><th /></tr></thead>
        <tbody>
          {l.lines.map((x) => (
            <tr key={x.id}>
              <td>{x.description}{x.kind !== "rent" && <span className="pill grey" style={{ marginLeft: 6 }}>{x.kind}</span>}</td>
              <td>{fmt(x.dueDate)}</td>
              <td className="amt">{money(x.amount)}</td>
              <td className="amt">{money(x.paid)}</td>
              <td className="amt"><b>{money(x.owing)}</b></td>
              <td><form action={action} method="post"><input type="hidden" name="action" value="remove" /><input type="hidden" name="id" value={x.id} /><button className="btn ghost small" title="Remove this charge">✕</button></form></td>
            </tr>
          ))}
          <tr><td colSpan={4}><b>Total owing today</b>{l.credit > 0 && <span className="note"> ({money(l.credit)} paid in advance)</span>}</td><td className="amt"><b>{money(l.total)}</b></td><td /></tr>
        </tbody>
      </table>
      {t.payments.length > 0 && (
        <p className="note">Payments: {t.payments.map((p) => `${fmt(p.date)} ${money(p.amount)}${p.note ? ` (${p.note})` : ""}`).join(" · ")}. Payments are applied to the oldest charge first.</p>
      )}
      <div className="grid2" style={{ marginTop: 10 }}>
        <form action={action} method="post">
          <input type="hidden" name="action" value="charge" />
          <h3>Add a charge</h3>
          <div className="grid3">
            <div><label>Type</label><select name="kind" defaultValue="rent"><option value="rent">Rent</option><option value="utilities">Utilities</option><option value="other">Other</option></select></div>
            <div><label>Due date</label><input type="date" name="date" required /></div>
            <div><label>Amount</label><input type="text" name="amount" inputMode="decimal" required /></div>
          </div>
          <label>Description</label><input type="text" name="description" placeholder="e.g. Rent for December 2026" />
          <button className="btn small" style={{ marginTop: 8 }}>Add charge</button>
        </form>
        <form action={action} method="post">
          <input type="hidden" name="action" value="payment" />
          <h3>Record a payment</h3>
          <div className="grid2" style={{ gap: 10 }}>
            <div><label>Date received</label><input type="date" name="date" required /></div>
            <div><label>Amount</label><input type="text" name="amount" inputMode="decimal" required /></div>
          </div>
          <label>Note (e.g. e-transfer, receipt given "for use and occupancy only")</label><input type="text" name="note" />
          <button className="btn small" style={{ marginTop: 8 }}>Record payment</button>
        </form>
      </div>
      {t.kind === "residential" && <p className="note">Only charge a late fee if your tenancy agreement includes one, and no more than the Residential Tenancy Regulation allows. Unpaid utilities can only go on the 10 Day Notice once a written demand has gone unpaid for 30 days.</p>}
    </div>
  );
}

/** One collapsible card per section of details, each saving on its own. */
function Section({ t, id, title, done, later, children, open }: { t: Tenancy; id: string; title: string; done?: boolean; later?: boolean; children: ReactNode; open?: boolean }) {
  return (
    <details className="card section" id={id} open={open}>
      <summary><h2 style={{ display: "inline" }}>{title}</h2> {done ? <span className="pill good">complete</span> : later ? <span className="pill grey">fill in when it happens</span> : <span className="pill warn">needs details</span>}</summary>
      <form action={`/api/landlord/${t.id}`} method="post" style={{ marginTop: 10 }}>
        <input type="hidden" name="section" value={id} />
        {children}
        <div className="row" style={{ marginTop: 12 }}><button className="btn small">Save</button></div>
      </form>
    </details>
  );
}

const YesNo = ({ name, value }: { name: string; value?: boolean }) => (
  <select name={name} defaultValue={value === undefined ? "" : value ? "yes" : "no"}><option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option></select>
);

function ServiceFields({ prefix, s, rules, what }: { prefix: string; s?: ServiceRecord; rules: TenancyRules; what: string }) {
  const r = rules.residential;
  return (
    <>
      <div className="grid3">
        <div><label>Date served</label><input type="date" name={`${prefix}.date`} defaultValue={s?.date} /></div>
        <div><label>Time served</label><input type="time" name={`${prefix}.time`} defaultValue={s?.time} /></div>
        <div>
          <label>How it was served</label>
          <select name={`${prefix}.method`} defaultValue={s?.method ?? ""}>
            <option value="">Choose</option>
            {Object.entries(r.methodLabel).map(([k, v]) => <option key={k} value={k}>{v} (received {r.deemedDays[k as keyof typeof r.deemedDays] === 0 ? "same day" : `in ${r.deemedDays[k as keyof typeof r.deemedDays]} days`})</option>)}
          </select>
        </div>
      </div>
      <div className="grid2" style={{ gap: 10 }}>
        <div><label>Served by (full name)</label><input type="text" name={`${prefix}.servedBy`} defaultValue={s?.servedBy} /></div>
        <div><label>Handed to (name of the tenant or adult, if handed over)</label><input type="text" name={`${prefix}.servedTo`} defaultValue={s?.servedTo} /></div>
      </div>
      <label>Address where {what} was served or mailed (or the email address used)</label><input type="text" name={`${prefix}.address`} defaultValue={s?.address} />
      <div className="grid2" style={{ gap: 10 }}>
        <div><label>Registered mail tracking number</label><input type="text" name={`${prefix}.trackingNumber`} defaultValue={s?.trackingNumber} /></div>
        <div><label>Witness name (recommended)</label><input type="text" name={`${prefix}.witness`} defaultValue={s?.witness} /></div>
      </div>
    </>
  );
}

function ResidentialDetails({ t, rules }: { t: Tenancy; rules: TenancyRules }) {
  const r = rules.residential;
  const plannedEffective = earliestEffectiveDate(rules, "door");
  const plannedInPerson = earliestEffectiveDate(rules, "in-person");
  return (
    <>
      <h2 style={{ margin: "22px 0 4px" }}>Details for the RTB forms</h2>
      <p className="note" style={{ marginTop: 0 }}>Everything the RTB forms ask for, in the order you'll need it. Each section saves on its own.</p>

      <Section t={t} id="landlord" title="Landlord" done={!!(t.landlord && t.landlordAddress && t.landlordPhone)}>
        <div className="grid2">
          <div>
            <label>Landlord's legal name(s), as on the tenancy agreement</label><input type="text" name="landlord" defaultValue={t.landlord} />
            <label>Agent or property manager (if one acts for the landlord)</label><input type="text" name="landlordAgent" defaultValue={t.landlordAgent} />
          </div>
          <div>
            <label>Address for service (one line per row)</label><textarea name="landlordAddress" defaultValue={t.landlordAddress} />
            <div className="grid2" style={{ gap: 10 }}>
              <div><label>Phone</label><input type="text" name="landlordPhone" defaultValue={t.landlordPhone} /></div>
              <div><label>Email</label><input type="email" name="landlordEmail" defaultValue={t.landlordEmail} /></div>
            </div>
          </div>
        </div>
      </Section>

      <Section t={t} id="tenants" title="Tenants" done={t.tenants.length > 0}>
        <label>Every tenant's full name, one per line, exactly as on the tenancy agreement</label><textarea name="tenants" defaultValue={t.tenants.join(NL)} />
        <div className="grid3">
          <div><label>Tenant phone</label><input type="text" name="tenantPhone" defaultValue={t.tenantPhone} /></div>
          <div><label>Tenant email</label><input type="email" name="tenantEmail" defaultValue={t.tenantEmail} /></div>
          <div><label>Tenant agreed in writing to be served by email?</label><YesNo name="emailServiceAgreed" value={t.emailServiceAgreed} /></div>
        </div>
      </Section>

      <Section t={t} id="unit" title="Rental unit" done={!!(t.street && t.city && t.postalCode)}>
        <div className="grid2">
          <div><label>Unit or suite (e.g. Basement, 204)</label><input type="text" name="unit" defaultValue={t.unit} /><label>Street address</label><input type="text" name="street" defaultValue={t.street} /></div>
          <div><label>City</label><input type="text" name="city" defaultValue={t.city} /><label>Postal code</label><input type="text" name="postalCode" defaultValue={t.postalCode} /></div>
        </div>
      </Section>

      <Section t={t} id="terms" title="Tenancy terms" done={!!(t.startDate && t.writtenAgreement !== undefined && t.monthlyRent && t.stillOccupied !== undefined)}>
        <div className="grid3">
          <div><label>Tenancy start date</label><input type="date" name="startDate" defaultValue={t.startDate} /></div>
          <div><label>Written tenancy agreement?</label><YesNo name="writtenAgreement" value={t.writtenAgreement} /></div>
          <div><label>Tenant still living in the unit?</label><YesNo name="stillOccupied" value={t.stillOccupied} /></div>
          <div><label>Monthly rent (CAD)</label><input type="text" name="monthlyRent" inputMode="decimal" defaultValue={t.monthlyRent || ""} /></div>
          <div><label>Rent is due on day</label><input type="number" name="rentDueDay" min={1} max={31} defaultValue={t.rentDueDay} /></div>
          <div><label>Date of the last Notice of Rent Increase (if any)</label><input type="date" name="lastRentIncrease" defaultValue={t.lastRentIncrease} /></div>
          <div><label>Security deposit held</label><input type="text" name="securityDeposit" inputMode="decimal" defaultValue={t.securityDeposit ?? ""} /></div>
          <div><label>Date security deposit paid</label><input type="date" name="securityDepositPaid" defaultValue={t.securityDepositPaid} /></div>
          <div />
          <div><label>Pet damage deposit held</label><input type="text" name="petDeposit" inputMode="decimal" defaultValue={t.petDeposit ?? ""} /></div>
          <div><label>Date pet damage deposit paid</label><input type="date" name="petDepositPaid" defaultValue={t.petDepositPaid} /></div>
        </div>
      </Section>

      <Section t={t} id="utilities" title="Utilities (only if the tenant owes you utilities)" done={!!t.utilitiesDemandDate} later={!t.charges.some((c) => c.kind === "utilities")}>
        <p className="note">Give the tenant a written demand with copies of the bills. If they're still unpaid {r.utilitiesDemandDays} days later, you can treat them as unpaid rent on the 10 Day Notice. Add the utility amounts to the rent ledger as "Utilities".</p>
        <label>Date you gave the written demand for utilities</label><input type="date" name="utilitiesDemandDate" defaultValue={t.utilitiesDemandDate} />
      </Section>

      <Section t={t} id="notice" title="10 Day Notice (RTB-30) and how it was served (RTB-34)" done={!!(t.noticeSignedDate && t.noticeService?.date && t.noticeService.method && t.noticeService.servedBy)} open={!t.noticeService?.date}>
        <p className="note">
          The effective date must be at least {r.noticeDays} days after the tenant receives the notice. Served today in person, that's {fmt(plannedInPerson)}; attached to the door today, {fmt(plannedEffective)}. Leave it blank and we'll work it out from how you serve it.
        </p>
        <div className="grid3">
          <div><label>Date you signed the notice</label><input type="date" name="noticeSignedDate" defaultValue={t.noticeSignedDate} /></div>
          <div><label>Effective date written on the notice</label><input type="date" name="noticeEffectiveDate" defaultValue={t.noticeEffectiveDate} /></div>
          <div><label>Did the tenant dispute it within 5 days?</label><YesNo name="tenantDisputed" value={t.tenantDisputed} /></div>
        </div>
        <h3 style={{ marginTop: 12 }}>Service</h3>
        <ServiceFields prefix="notice" s={t.noticeService} rules={rules} what="the notice" />
      </Section>

      <Section t={t} id="direct" title="Direct Request (RTB-12L-DR) and serving the package (RTB-44)" done={!!(t.applicationDate && t.rtbFileNumber && t.packageService?.date)} later={!t.applicationDate}>
        <div className="grid3">
          <div><label>Date you applied</label><input type="date" name="applicationDate" defaultValue={t.applicationDate} /></div>
          <div><label>RTB file number</label><input type="text" name="rtbFileNumber" defaultValue={t.rtbFileNumber} /></div>
          <div><label>Date the RTB made the package available</label><input type="date" name="packageAvailableDate" defaultValue={t.packageAvailableDate} /></div>
        </div>
        <h3 style={{ marginTop: 12 }}>Serving the package on the tenant (within {r.packageServeDays} days)</h3>
        <ServiceFields prefix="package" s={t.packageService} rules={rules} what="the package" />
      </Section>

      <Section t={t} id="orders" title="Decision and orders" done={!!(t.orderDate && t.ordersServedDate)} later={!t.orderDate}>
        <div className="grid2">
          <div><label>Date of the RTB decision</label><input type="date" name="orderDate" defaultValue={t.orderDate} /><label>Order of possession effective date</label><input type="date" name="possessionDate" defaultValue={t.possessionDate} /></div>
          <div><label>Monetary order amount</label><input type="text" name="monetaryOrderAmount" inputMode="decimal" defaultValue={t.monetaryOrderAmount ?? ""} /><label>Date you served the orders on the tenant</label><input type="date" name="ordersServedDate" defaultValue={t.ordersServedDate} /></div>
        </div>
      </Section>

      <Section t={t} id="end" title="End of tenancy and deposits" done={!!(t.tenancyEndDate && t.forwardingAddressDate)} later={!t.tenancyEndDate}>
        <div className="grid3">
          <div><label>Date the tenancy ended (tenant moved out)</label><input type="date" name="tenancyEndDate" defaultValue={t.tenancyEndDate} /></div>
          <div><label>Date you got the forwarding address in writing</label><input type="date" name="forwardingAddressDate" defaultValue={t.forwardingAddressDate} /></div>
          <div><label>Forwarding address</label><input type="text" name="forwardingAddress" defaultValue={t.forwardingAddress} /></div>
        </div>
      </Section>
    </>
  );
}

function CommercialDetails({ t, rules, forumName, forumSteps, selfServe }: { t: Tenancy; rules: TenancyRules; forumName: string; forumSteps: string[]; selfServe: boolean }) {
  const l = ledger(t);
  return (
    <>
      <div className="grid2">
        <div className="card">
          <h2>Where the arrears claim goes</h2>
          <p><b>{forumName}</b> for {money(l.total)}. {selfServe ? "The software guides you through it." : "Over the Small Claims limit, so the file is referred to a lawyer."}</p>
          <ol className="steps">{forumSteps.map((s) => <li key={s}><div className="t">{s}</div></li>)}</ol>
          <p className="note">Name the tenant and each indemnifier by their exact legal names. A company search confirms a company's legal name and registered office.</p>
        </div>
        <div className="card" id="remedy">
          <h2>Lease remedies</h2>
          <p className="note">Pick one. They can't all be combined.</p>
          <form action={`/api/landlord/${t.id}`} method="post">
            <input type="hidden" name="section" value="remedy" />
            {rules.commercial.remedies.map((r) => (
              <label key={r.id} className="check" style={{ alignItems: "flex-start" }}>
                <input type="radio" name="remedy" value={r.id} defaultChecked={t.remedy === r.id} />
                <span><b>{r.title}</b> {r.verify && <span className="pill grey">confirm</span>}<br /><span className="note">{r.detail}</span></span>
              </label>
            ))}
            <label>Date you acted on it (bailiff attended, re-entered, or filed the claim)</label><input type="date" name="remedyDate" defaultValue={t.remedyDate} />
            <div className="row" style={{ marginTop: 10 }}><button className="btn small">Save</button></div>
          </form>
        </div>
      </div>

      <Section t={t} id="lease" title="Lease details" done={!!(t.landlord && t.landlordAddress && t.tenants.length && t.street)}>
        <div className="grid2">
          <div>
            <label>Landlord's legal name, as on the lease</label><input type="text" name="landlord" defaultValue={t.landlord} />
            <label>Landlord's address for notices (one line per row)</label><textarea name="landlordAddress" defaultValue={t.landlordAddress} />
            <label>Tenant's legal name, as on the lease</label><textarea name="tenants" defaultValue={t.tenants.join(NL)} />
            <label>Indemnifiers or guarantors (one per line)</label><textarea name="guarantors" defaultValue={(t.guarantors ?? []).join(NL)} />
          </div>
          <div>
            <div className="grid2" style={{ gap: 10 }}>
              <div><label>Unit or suite</label><input type="text" name="unit" defaultValue={t.unit} /></div>
              <div><label>Postal code</label><input type="text" name="postalCode" defaultValue={t.postalCode} /></div>
            </div>
            <label>Street address</label><input type="text" name="street" defaultValue={t.street} />
            <label>City</label><input type="text" name="city" defaultValue={t.city} />
            <div className="grid2" style={{ gap: 10 }}>
              <div><label>Monthly rent including additional rent</label><input type="text" name="monthlyRent" inputMode="decimal" defaultValue={t.monthlyRent || ""} /></div>
              <div><label>Rent is due on day</label><input type="number" name="rentDueDay" min={1} max={31} defaultValue={t.rentDueDay} /></div>
              <div><label>Days unpaid before re-entry is allowed</label><input type="number" name="graceDays" min={0} max={90} defaultValue={t.graceDays ?? rules.commercial.defaultGraceDays} /></div>
              <div><label>Security deposit held</label><input type="text" name="securityDeposit" inputMode="decimal" defaultValue={t.securityDeposit ?? ""} /></div>
              <div><label>Tenant phone</label><input type="text" name="tenantPhone" defaultValue={t.tenantPhone} /></div>
              <div><label>Tenant email</label><input type="email" name="tenantEmail" defaultValue={t.tenantEmail} /></div>
              <div><label>Lease ended or terminated on</label><input type="date" name="tenancyEndDate" defaultValue={t.tenancyEndDate} /></div>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
