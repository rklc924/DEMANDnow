import { money } from "@/lib/aging";
import { WITNESS_KIND_LABEL, WITNESS_PAGE_FEE, WITNESS_PARTNERS, WITNESS_WHO, type WitnessJob, type WitnessNeed } from "@/lib/witness";

// "Get it sworn or notarized": a local partner, or a mobile notary or commissioner who comes to you.
// Shown under any checklist step marked `witness`, and as a general card on matter pages for any other document.

export interface WitnessContext {
  /** The matter bookings belong to, e.g. "case:<invoiceId>" or "lien:<lienId>". */
  matter: string;
  /** Page to come back to after booking. */
  back: string;
  card?: string;
  jobs: WitnessJob[];
  message?: { kind: "good" | "bad"; text: string };
}

/** Page-level result message from /api/witness, from the page's search params. */
export function witnessMessage(q: { witnessBooked?: string; witnessReferral?: string; witnessError?: string }): WitnessContext["message"] {
  if (q.witnessBooked) return { kind: "good", text: "Booked. Your card was charged the page fee. We'll confirm the appointment time, and any travel cost, with you before the visit." };
  if (q.witnessReferral) return { kind: "good", text: "Request sent. We'll email you a partner near you, usually within one business day. There's no charge from us." };
  if (q.witnessError) return { kind: "bad", text: q.witnessError };
  return undefined;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

function Jobs({ jobs }: { jobs: WitnessJob[] }) {
  if (!jobs.length) return null;
  return (
    <ul className="jobs">
      {jobs.map((j) => (
        <li key={j.id}>
          <span className={`pill ${j.mode === "mobile" ? "blue" : "grey"}`}>{j.mode === "mobile" ? `Mobile ${WITNESS_WHO[j.kind]} booked` : "Partner referral requested"}</span>{" "}
          {j.document} · {fmtDate(j.createdAt)}{j.fee ? ` · ${money(j.fee)} for ${j.pages} page${j.pages === 1 ? "" : "s"}` : ""}
        </li>
      ))}
    </ul>
  );
}

/** The two options for one document. With no `need`, the user names the document and picks commissioner or notary. */
export function WitnessOptions({ need, step, ctx, compact }: { need?: WitnessNeed; step?: string; ctx: WitnessContext; compact?: boolean }) {
  const kind = need?.kind ?? "commissioner";
  const who = WITNESS_WHO[kind];
  const jobs = ctx.jobs.filter((j) => (step ? j.stepId === step : !j.stepId));
  const partners = WITNESS_PARTNERS.filter((p) => !need || p.kinds.includes(kind));
  const hidden = (
    <>
      <input type="hidden" name="matter" value={ctx.matter} />
      <input type="hidden" name="back" value={ctx.back} />
      {step && <input type="hidden" name="step" value={step} />}
      {need && <><input type="hidden" name="document" value={need.document} /><input type="hidden" name="kind" value={need.kind} /></>}
    </>
  );
  const pick = !need && (
    <>
      <label>Which document?</label>
      <input type="text" name="document" placeholder="e.g. Affidavit of service" required />
      <label>What does it need?</label>
      <select name="kind" defaultValue="commissioner">
        <option value="commissioner">Sworn or affirmed before a commissioner (affidavits, statutory declarations)</option>
        <option value="notary">Notarized by a notary public (e.g. certified copies, documents used outside BC)</option>
      </select>
    </>
  );
  return (
    <div className={`witness ${compact ? "compact" : ""}`}>
      {need && (
        <p className="note" style={{ marginTop: 8 }}>
          <b>Needs a {who}:</b> the {need.document} must be {WITNESS_KIND_LABEL[need.kind]}. {need.note} Don't sign it beforehand.
        </p>
      )}
      <Jobs jobs={jobs} />
      <div className="grid2" style={{ gap: 12 }}>
        <details>
          <summary className="btn small ghost">Use a local partner</summary>
          <div style={{ marginTop: 8 }}>
            {partners.length > 0 ? (
              <ul>
                {partners.map((p) => (
                  <li key={p.name}><b>{p.name}</b>, {p.address}, {p.city}{p.phone ? ` · ${p.phone}` : ""}{p.url ? <> · <a href={p.url} target="_blank" rel="noreferrer">Website</a></> : null}</li>
                ))}
              </ul>
            ) : null}
            <form action="/api/witness" method="post">
              {hidden}
              <input type="hidden" name="mode" value="partner" />
              {pick}
              <label>Your city or postal code</label>
              <input type="text" name="city" required />
              <button className="btn small" style={{ marginTop: 8 }}>Refer me to a partner near me</button>
              <p className="note">Free from us. The partner charges their own fee when you visit.</p>
            </form>
          </div>
        </details>
        <details>
          <summary className="btn small">Book a mobile {need ? who : "notary or commissioner"}</summary>
          <form action="/api/witness" method="post" style={{ marginTop: 8 }}>
            {hidden}
            <input type="hidden" name="mode" value="mobile" />
            {pick}
            <label>Number of pages to sign and stamp</label>
            <input type="number" name="pages" min={1} max={200} defaultValue={1} required />
            <label>Where should they meet you? (one line per row)</label>
            <textarea name="address" required />
            <label>Who is signing?</label>
            <input type="text" name="signer" placeholder="Full name, as on their photo ID" />
            <label>Best days and times</label>
            <input type="text" name="times" placeholder="e.g. weekdays after 3 PM" />
            <label>Notes (buzzer, parking)</label>
            <input type="text" name="notes" />
            <button className="btn small" style={{ marginTop: 8 }}>Book and charge my card{ctx.card ? ` (${ctx.card})` : ""}</button>
            <p className="note">{money(WITNESS_PAGE_FEE)} per page, charged now. Travel costs may be extra: we confirm any travel cost and the appointment time with you before the visit.</p>
          </form>
        </details>
      </div>
    </div>
  );
}

/** A general card for any document on the matter that needs swearing or notarizing. */
export function WitnessCard({ ctx }: { ctx: WitnessContext }) {
  return (
    <div className="card" id="witness">
      <h2>Need something sworn or notarized?</h2>
      {ctx.message && <div className={`banner ${ctx.message.kind}`}>{ctx.message.text}</div>}
      <p>
        Some documents, like affidavits, have to be signed in front of a commissioner for taking affidavits or a notary public. Go to a local
        partner, or book a mobile notary or commissioner to come to you.
      </p>
      <WitnessOptions ctx={ctx} />
    </div>
  );
}
