import { PREFILL_KEYS } from "@/lib/intake";
import { ONE_OFF_PRICE } from "@/lib/oneoff";

// One-off demand, step 1: free to fill in. Payment is asked for only before the letter is generated.
// Any field can be prefilled from the query string (e.g. /start?debtorName=Acme+Ltd&amount=7800&dueDate=2026-06-03),
// so an AI assistant or website without the connector can hand the details over in a link.
export default function Start({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const v = (k: (typeof PREFILL_KEYS)[number]) => searchParams[k]?.slice(0, 500);
  const prefilled = PREFILL_KEYS.some((k) => searchParams[k]);
  const consumer = ["consumer", "individual"].includes(v("debtorKind") ?? "");
  return (
    <>
      <h1>Send a demand letter for one unpaid invoice</h1>
      <p className="sub">Fill in the details for free. Before we generate anything, you can pay ${ONE_OFF_PRICE} for this one demand, or subscribe if you have more. British Columbia only.</p>
      {searchParams.error && <div className="banner warn">{searchParams.error}</div>}
      {prefilled && !searchParams.error && <div className="banner good">We've filled in the details you gave your assistant. Check them, add anything missing, then continue.</div>}
      <form action="/api/oneoff" method="post" encType="multipart/form-data">
        <div className="grid2">
          <div className="card">
            <h2>Your business</h2>
            <label>Legal business name</label><input type="text" name="companyName" defaultValue={v("companyName")} required />
            <div className="grid2" style={{ gap: 12 }}>
              <div><label>Signed by</label><input type="text" name="signatory" defaultValue={v("signatory")} /></div>
              <div><label>Title</label><input type="text" name="signatoryTitle" defaultValue={v("signatoryTitle")} /></div>
              <div><label>Phone</label><input type="text" name="phone" defaultValue={v("phone")} /></div>
              <div><label>Email</label><input type="text" name="email" defaultValue={v("email")} /></div>
            </div>
            <label>How should they pay you?</label>
            <textarea name="paymentInstructions" defaultValue={v("paymentInstructions")} placeholder="e.g. E-transfer to ar@yourbusiness.ca, or cheque payable to Your Business Ltd." />
            <label>Letterhead (optional: PDF, PNG or JPG)</label>
            <input type="file" name="letterhead" accept="application/pdf,image/png,image/jpeg" />
          </div>
          <div className="card">
            <h2>Who owes you</h2>
            <label>Name (person or company)</label><input type="text" name="debtorName" defaultValue={v("debtorName")} required />
            <label className="check" style={{ marginTop: 12 }}>
              <input type="radio" name="debtorKind" value="business" defaultChecked={!consumer} /> <span>A business</span>
            </label>
            <label className="check">
              <input type="radio" name="debtorKind" value="consumer" defaultChecked={consumer} /> <span>An individual (consumer)</span>
            </label>
            <label>Mailing address (one line per row)</label>
            <textarea name="debtorAddress" defaultValue={v("debtorAddress")} placeholder={"123 Main Street\nKelowna, BC  V1Y 1A1"} />
            <label>Their email (optional)</label><input type="text" name="debtorEmail" defaultValue={v("debtorEmail")} />
          </div>
        </div>
        <div className="card">
          <h2>The debt</h2>
          <div className="grid3">
            <div><label>Invoice number</label><input type="text" name="invoiceNumber" defaultValue={v("invoiceNumber")} /></div>
            <div><label>Amount owing (CAD)</label><input type="text" name="amount" defaultValue={v("amount")} inputMode="decimal" required /></div>
            <div><label>Due date</label><input type="date" name="dueDate" defaultValue={v("dueDate")} required /></div>
            <div><label>Invoice date</label><input type="date" name="issueDate" defaultValue={v("issueDate")} /></div>
            <div><label>Interest rate in your terms (%/yr, if any)</label><input type="text" name="interestRate" defaultValue={v("interestRate")} inputMode="decimal" /></div>
            <div><label>What it was for</label><input type="text" name="description" defaultValue={v("description")} placeholder="e.g. landscaping services" /></div>
          </div>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn">Continue</button>
        </div>
      </form>
    </>
  );
}
