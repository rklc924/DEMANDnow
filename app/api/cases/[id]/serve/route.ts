import { randomBytes } from "crypto";
import { money } from "@/lib/aging";
import { putFile } from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";
import { go, withUser } from "@/lib/http";
import { loadRow } from "@/lib/ledger";
import { buildCertificate, dispatch, newJob, requestQuote, saveJob } from "@/lib/service";
import { readUpload, writeDB } from "@/lib/store";
import { chargeCard } from "@/lib/stripe";

// Book a process server for a matter's starting document.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const back = (q: string) => go(req, `/cases/${params.id}?${q}#service`);
    const f = await req.formData();
    const { db, row } = await loadRow(user.id, params.id);
    const svc = row?.forum.service;
    if (!row || !svc) return back("serveError=" + encodeURIComponent("Service booking isn't available for this matter."));

    const area = svc.serverFees.fees.find((x) => x.id === String(f.get("area")) && !x.addOn);
    const rushFee = svc.serverFees.fees.find((x) => x.addOn)?.price ?? 0;
    const rush = f.get("rush") === "on";
    const address = String(f.get("address") ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    const serveOn = String(f.get("serveOn") ?? "").trim() || row.customer.name;
    if (!area) return back("serveError=" + encodeURIComponent("Choose where the defendant is."));
    if (!address.length) return back("serveError=" + encodeURIComponent("Enter the last known address."));

    const serverFee = (area.price ?? 0) + (rush ? rushFee : 0);
    const bookingFee = svc.serverFees.bookingFee;
    const { job, token } = newJob({
      accountId: user.id,
      invoiceId: row.invoice.id,
      areaId: area.id,
      rush,
      serverFee,
      bookingFee,
      total: serverFee + bookingFee,
      serveOn,
      isCompany: row.customer.kind === "business",
      address,
      contactNotes: String(f.get("notes") ?? "").trim(),
      courtFileNo: String(f.get("courtFileNo") ?? "").trim(),
      registry: String(f.get("registry") ?? "").trim(),
      claimant: db.company.name,
      clientEmail: db.company.email || user.email,
      clientPhone: db.company.phone,
    });
    const record = () => {
      (db.serviceJobs ??= []).push({ id: job.id, invoiceId: row.invoice.id, createdAt: job.createdAt, status: job.status, total: job.total, areaId: area.id });
    };

    if (!area.dispatch || area.price === null) {
      await requestQuote(req, job, row, db.company);
      await saveJob(job);
      record();
      await writeDB(user.id, db);
      return back("quote=1");
    }

    // The documents to serve: the filed Notice of Claim from the checklist, or one attached to this booking.
    const uploaded = f.get("file");
    let notice: { name: string; key: string; mime: string } | undefined;
    if (uploaded instanceof File && uploaded.size > 0) {
      const ext = uploaded.type === "application/pdf" ? "pdf" : uploaded.type === "image/png" ? "png" : "jpg";
      const key = await putFile(`${user.id}/serve-${job.id}-notice.${ext}`, new Uint8Array(await uploaded.arrayBuffer()), uploaded.type);
      notice = { name: `Filed Notice of Claim.${ext}`, key, mime: uploaded.type };
    } else {
      const doc = (db.progress?.[row.invoice.id]?.docs ?? []).filter((d) => d.stepId === "notice").at(-1);
      if (doc) notice = { name: `Filed Notice of Claim.${doc.mime === "application/pdf" ? "pdf" : "jpg"}`, key: doc.file, mime: doc.mime };
    }
    if (!notice) return back("serveError=" + encodeURIComponent("Attach your filed Notice of Claim so the server has something to serve."));

    // Charge the card on file before anything is sent.
    try {
      const charge = await chargeCard(user.id, job.total, `Process service: ${serveOn} (${row.invoice.number})`, { jobId: job.id, invoiceId: row.invoice.id });
      job.chargeId = charge.id;
      (db.charges ??= []).push({ id: randomBytes(4).toString("hex"), at: new Date().toISOString(), amount: job.total, description: `Process service on ${serveOn}`, stripeId: charge.id, demo: charge.demo });
    } catch (e) {
      return back("serveError=" + encodeURIComponent((e as Error).message));
    }

    const cert = await buildCertificate(job, [`${svc.document} (filed)`, "Blank Reply form"]);
    const certKey = await putFile(`${user.id}/serve-${job.id}-certificate.pdf`, cert, "application/pdf");
    job.files = [notice, { name: "Certificate of Service (pre-filled).pdf", key: certKey, mime: "application/pdf" }];
    await dispatch(req, job, token, [
      { filename: notice.name, content: await readUpload(notice.key) },
      { filename: "Certificate of Service (pre-filled).pdf", content: cert },
    ]);
    await saveJob(job);
    record();
    await writeDB(user.id, db);

    await sendEmail({
      to: job.clientEmail,
      subject: `Process server booked: ${serveOn}`,
      text: `We've sent your ${svc.document} to our process server to serve ${serveOn} at ${address.join(", ")}${rush ? " (rush)" : ""}.\n\nCharged to your card on file: ${money(job.total)} (server ${money(serverFee)} + booking fee ${money(bookingFee)}), plus applicable tax.\n\nYou'll get an email when it's served, with the signed Certificate of Service. Track it here: ${appUrl(req)}/cases/${row.invoice.id}#service\n\nDemand Now`,
    }).catch(() => undefined);
    return back("booked=1");
  });
