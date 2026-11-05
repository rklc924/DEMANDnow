import { ONE_OFF_PRICE } from "@/lib/oneoff";

// One-off demand, step 1: free to fill in. Payment is asked for only before the letter is generated.
export default function Start({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <>
      <h1>Send a demand letter for one unpaid invoice</h1>
      <p className="sub">Fill in the details for free. Before we generate anything, you can pay ${ONE_OFF_PRICE} for this one demand, or subscribe if you have more. British Columbia only.</p>
      {searchParams.error && <div className="banner warn">{searchParams.error}</div>}
      <form action="/api/oneoff" method="post" encType="multipart/form-data">
        <div className="grid2">
          <div className="card">
            <h2>Your business</h2>
            <label>Legal business name</label><input type="text" name="companyName" required />
            <div className="grid2" style={{ gap: 12 }}>
              <div><label>Signed by</label><input type="text" name="signatory" /></div>
              <div><label>Title</label><input type="text" name="signatoryTitle" /></div>
              <div><label>Phone</label><input type="text" name="phone" /></div>
              <div><label>Email</label><input type="text" name="email" /></div>
            </div>
            <label>How should they pay you?</label>
            <textarea name="paymentInstructions" placeholder="e.g. E-transfer to ar@yourbusiness.ca, or cheque payable to Your Business Ltd." />
            <label>Letterhead (optional: PDF, PNG or JPG)</label>
            <input type="file" name="letterhead" accept="application/pdf,image/png,image/jpeg" />
          </div>
          <div className="card">
            <h2>Who owes you</h2>
            <label>Name (person or company)</label><input type="text" name="debtorName" required />
            <label className="check" style={{ marginTop: 12 }}>
              <input type="radio" name="debtorKind" value="business" defaultChecked /> <span>A business</span>
            </label>
            <label className="check">
              <input type="radio" name="debtorKind" value="consumer" /> <span>An individual (consumer)</span>
            </label>
            <label>Mailing address (one line per row)</label>
            <textarea name="debtorAddress" placeholder={"123 Main Street\nKelowna, BC  V1Y 1A1"} />
            <label>Their email (optional)</label><input type="text" name="debtorEmail" />
          </div>
        </div>
        <div className="card">
          <h2>The debt</h2>
          <div className="grid3">
            <div><label>Invoice number</label><input type="text" name="invoiceNumber" /></div>
            <div><label>Amount owing (CAD)</label><input type="text" name="amount" inputMode="decimal" required /></div>
            <div><label>Due date</label><input type="date" name="dueDate" required /></div>
            <div><label>Invoice date</label><input type="date" name="issueDate" /></div>
            <div><label>Interest rate in your terms (%/yr, if any)</label><input type="text" name="interestRate" inputMode="decimal" /></div>
            <div><label>What it was for</label><input type="text" name="description" placeholder="e.g. landscaping services" /></div>
          </div>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn">Continue</button>
        </div>
      </form>
    </>
  );
}
