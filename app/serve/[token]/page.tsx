import { jobFromToken } from "@/lib/service";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

// The process server's job page, reached from the link in their email or text. No login: the token is the key.
export default async function ServeJob({ params, searchParams }: { params: { token: string }; searchParams: { done?: string; error?: string } }) {
  const token = decodeURIComponent(params.token);
  const job = await jobFromToken(token);
  if (!job) return <div className="card auth"><h1>Link not valid</h1><p>This service link has expired or is incorrect.</p></div>;
  const enc = encodeURIComponent(token);
  return (
    <div className="card" style={{ maxWidth: 680, margin: "0 auto" }}>
      <p className="note">Demand Now · service job {job.id}</p>
      <h1>Serve {job.serveOn}{job.rush && <span className="pill bad" style={{ marginLeft: 10, verticalAlign: "middle" }}>RUSH</span>}</h1>
      {searchParams.done && <div className="banner good">Thank you. The certificate is filed on the client's matter and they've been told.</div>}
      {searchParams.error && <div className="banner bad">{searchParams.error}</div>}
      <dl className="kv">
        <dt>Last known address</dt><dd>{job.address.join(", ")} · <a href={`https://maps.google.com/?q=${encodeURIComponent(job.address.join(", "))}`} target="_blank" rel="noreferrer">Map</a></dd>
        <dt>Serving</dt><dd>{job.isCompany ? "A company: registered office, or a director/officer" : "An individual: hand to them personally"}</dd>
        {job.contactNotes && <><dt>Client notes</dt><dd>{job.contactNotes}</dd></>}
        <dt>Court file</dt><dd>{job.courtFileNo || "On the Notice of Claim"}{job.registry ? `, ${job.registry}` : ""}</dd>
        <dt>Claimant</dt><dd>{job.claimant} · {job.clientEmail}{job.clientPhone ? ` · ${job.clientPhone}` : ""}</dd>
        <dt>Your fee</dt><dd>${job.serverFee}</dd>
      </dl>
      <h2 style={{ marginTop: 20 }}>Documents</h2>
      <ul>{job.files.map((f, i) => <li key={f.key}><a href={`/api/serve/${enc}/files/${i}`} target="_blank">{f.name}</a></li>)}</ul>
      {job.status !== "served" ? (
        <>
          <h2>Report service</h2>
          <form action={`/api/serve/${enc}/served`} method="post" encType="multipart/form-data">
            <label>Date served</label><input type="date" name="servedAt" required />
            <label>Signed Certificate of Service (PDF or a clear photo)</label>
            <input type="file" name="file" accept="application/pdf,image/png,image/jpeg" capture="environment" required />
            <div style={{ marginTop: 14 }}><button className="btn">Submit</button></div>
          </form>
        </>
      ) : (
        <p><span className="pill good">Served {job.servedAt}</span></p>
      )}
    </div>
  );
}
