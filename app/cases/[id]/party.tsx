import { COMPANY_SEARCH_FEE, PARTY_TYPE_LABEL, partyName, partyWarnings, type Party } from "@/lib/party";

const fmt = (iso: string) => new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });

const MESSAGES: Record<string, { kind: "good" | "warn"; text: string }> = {
  saved: { kind: "good", text: "Saved. Your letters, court forms and service booking now use this name and address." },
  read: { kind: "good", text: "We read the company search and filled in the details below. Check them against the search, then confirm." },
  manual: { kind: "warn", text: "Company search saved. Automatic reading isn't switched on yet, so copy the details from the search into the form below." },
  ordered: { kind: "good", text: "Company search ordered. We'll email it to you, usually within one business day. Upload it here when it arrives." },
};

export function PartyCard({ action, party, invoiceName, isBusiness, status, error }: {
  action: string;
  party?: Party;
  invoiceName: string;
  isBusiness: boolean;
  status?: string;
  error?: string;
}) {
  const p = party;
  const confirmed = !!p?.confirmedAt;
  const type = p?.type ?? (isBusiness ? "company" : "individual");
  const warnings = partyWarnings(p, invoiceName);
  const msg = status ? MESSAGES[status] : undefined;

  return (
    <div className="card" id="party">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Who you're pursuing: legal name and address</h2>
        {confirmed ? <span className="pill good">Confirmed {fmt(p!.confirmedAt!)}</span> : <span className="pill warn">Not confirmed yet</span>}
      </div>
      {msg && <div className={`banner ${msg.kind}`}>{msg.text}</div>}
      {error && <div className="banner bad">{error}</div>}
      {!confirmed && (
        <p>
          Before you send a demand or file a claim, confirm the debtor's <b>exact legal name</b> and the <b>address the court accepts</b>. Your accounting system says "{invoiceName}", which may be a nickname or trade name.
        </p>
      )}
      {confirmed && (
        <dl className="kv">
          <dt>Legal name</dt><dd><b>{partyName(p!)}</b>{p!.incNumber ? ` · ${p!.incNumber}` : ""}{p!.status ? ` · ${p!.status}` : ""}</dd>
          {p!.type === "company" ? (
            <>
              <dt>Registered office</dt><dd>{p!.registeredOffice?.join(", ")}</dd>
              {!!p!.recordsOffice?.length && <><dt>Records office</dt><dd>{p!.recordsOffice.join(", ")}</dd></>}
              {!!p!.directors?.length && <><dt>Directors</dt><dd>{p!.directors.map((d) => `${d.name}${d.address ? ` (${d.address})` : ""}`).join("; ")}</dd></>}
              {p!.searchDate && <><dt>Company search</dt><dd>dated {fmt(p!.searchDate)}</dd></>}
            </>
          ) : (
            <><dt>Lives at</dt><dd>{p!.homeAddress?.join(", ")}</dd></>
          )}
          {p!.howConfirmed && <><dt>How confirmed</dt><dd>{p!.howConfirmed}</dd></>}
        </dl>
      )}
      {warnings.length > 0 && (
        <div className="banner bad">
          <b>Check before you rely on this:</b>
          <ul style={{ margin: "6px 0 0" }}>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      <details open={!confirmed}>
        <summary><b>Why the legal name and address must be right</b></summary>
        <ul className="selfserve">
          <li><b>A judgment is only as good as the name on it.</b> If the name is wrong, you may win but be unable to garnish wages, seize a bank account or register against property, because the judgment names someone who doesn't legally exist.</li>
          <li><b>Service at the wrong address doesn't count.</b> The court can refuse a default order, or set one aside later, if the Notice of Claim wasn't served the way the rules require. You lose the filing and service fees and weeks of time.</li>
          <li><b>The limitation clock keeps running.</b> Most debts must be sued on within 2 years. Time spent fixing a wrong name or redoing service can push you past the deadline.</li>
          <li><b>Companies have their own rules.</b> The registry requires a copy of a recent company search with any claim against a company, and a company is served at its registered office or through a director or officer, not at a branch or a manager's home.</li>
        </ul>
      </details>

      <div className="grid2" style={{ marginTop: 10 }}>
        <div>
          <h3>If it's a company</h3>
          <ol className="steps-plain">
            <li>Look at the contract, credit application or the debtor's own invoices for a name ending in Ltd., Inc., Corp. or Limited, or a number like "1234567 B.C. Ltd.".</li>
            <li>Get a <b>BC Registry company search</b>. It shows the exact legal name, the incorporation number, whether the company is active, the <b>registered and records office</b> addresses and the <b>directors</b>.</li>
            <li>Check the company is <b>active</b>. If it's dissolved, in liquidation or in receivership, stop and send it for lawyer review.</li>
            <li>Use the legal name exactly as printed on the demand letter and the Notice of Claim, and serve at the <b>registered office</b> (or hand it to a director).</li>
            <li>File a copy of the search with the Notice of Claim. Get a fresh one if it's more than about 30 days old when you serve.</li>
          </ol>
        </div>
        <div>
          <h3>If it's a person or sole proprietor</h3>
          <ol className="steps-plain">
            <li>Use their <b>full legal name</b> (first and last, as on their ID or the contract), not a nickname or initials.</li>
            <li>If they trade under a business name that isn't incorporated (no Ltd., Inc. or Corp.), the person is the debtor. Name them as "Jane Smith, doing business as Smith Renovations".</li>
            <li>Confirm the name isn't actually a company. A free check on <a href="https://www.orgbook.gov.bc.ca" target="_blank" rel="noreferrer">OrgBook BC</a> shows whether a BC company or registered firm by that name exists.</li>
            <li>Confirm where they <b>live now</b>: a recent contract or credit application, a returned letter, a property title search, or asking them directly. Service by registered mail only counts if they sign for it there.</li>
            <li>Note how you confirmed it. It helps if the defendant later says they were never served.</li>
          </ol>
        </div>
      </div>

      {(
        <div className="grid2" style={{ marginTop: 6 }}>
          <div className="subcard">
            <h3 style={{ marginTop: 0 }}>{type === "company" ? "Order a company search" : "Could it be a company? Order a search"}</h3>
            {p?.searchOrder ? (
              <p className="note">Ordered {fmt(p.searchOrder.orderedAt)}. We'll email it to you; upload it alongside when it arrives.</p>
            ) : (
              <form action={action} method="post">
                <input type="hidden" name="action" value="order" />
                <label>Company name to search</label>
                <input type="text" name="searchName" defaultValue={p?.legalName || invoiceName} />
                <p className="note">${COMPANY_SEARCH_FEE} plus BC Registries fees at cost, charged to your card on file. Usually within one business day.</p>
                <button className="btn">Order search · ${COMPANY_SEARCH_FEE} + registry fees</button>
              </form>
            )}
          </div>
          <div className="subcard">
            <h3 style={{ marginTop: 0 }}>Upload a company search</h3>
            <form action={action} method="post" encType="multipart/form-data">
              <input type="hidden" name="action" value="upload" />
              <p className="note">Already have one, or bought it yourself from <a href="https://www.bcregistry.gov.bc.ca" target="_blank" rel="noreferrer">BC Registries</a>? Upload the PDF and we'll fill in the legal name, registered office and directors.</p>
              <input type="file" name="file" accept="application/pdf,image/png,image/jpeg" />
              <div style={{ marginTop: 8 }}><button className="btn ghost">Upload and read it</button></div>
            </form>
          </div>
        </div>
      )}

      <details open={!confirmed} style={{ marginTop: 12 }}>
        <summary><b>{confirmed ? "Edit the details" : "Enter and confirm the details"}</b></summary>
        <form action={action} method="post">
          <input type="hidden" name="action" value="save" />
          <label>The debtor is</label>
          <select name="type" defaultValue={type}>
            {Object.entries(PARTY_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="grid2">
            <div>
              <label>Exact legal name</label>
              <input type="text" name="legalName" defaultValue={p?.legalName} placeholder={type === "company" ? "e.g. Harbourview Renovations Ltd." : "e.g. Jane Marie Smith"} required />
              <label>Trade name (sole proprietor only)</label>
              <input type="text" name="tradeName" defaultValue={p?.tradeName} placeholder="e.g. Smith Renovations" />
              <label>Home address (person or sole proprietor), one line each</label>
              <textarea name="homeAddress" rows={3} defaultValue={p?.homeAddress?.join("\n")} />
              <label>How you confirmed the name and address</label>
              <input type="text" name="howConfirmed" defaultValue={p?.howConfirmed} placeholder="e.g. signed credit application, March 2026" />
            </div>
            <div>
              <label>Incorporation number (company)</label>
              <input type="text" name="incNumber" defaultValue={p?.incNumber} placeholder="e.g. BC1234567" />
              <label>Status on the search</label>
              <input type="text" name="status" defaultValue={p?.status} placeholder="Active" />
              <label>Date of the company search</label>
              <input type="date" name="searchDate" defaultValue={p?.searchDate} />
              <label>Registered office (company), one line each</label>
              <textarea name="registeredOffice" rows={3} defaultValue={p?.registeredOffice?.join("\n")} />
              <label>Records office (company), one line each</label>
              <textarea name="recordsOffice" rows={2} defaultValue={p?.recordsOffice?.join("\n")} />
              <label>Directors, one per line: Name - address</label>
              <textarea name="directors" rows={2} defaultValue={p?.directors?.map((d) => `${d.name}${d.address ? ` - ${d.address}` : ""}`).join("\n")} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}><button className="btn">Confirm these details</button></div>
        </form>
      </details>
    </div>
  );
}
