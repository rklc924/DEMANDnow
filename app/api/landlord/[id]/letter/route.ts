import { acct, can } from "@/lib/auth";
import { NextResponse } from "next/server";
import { go, withUser } from "@/lib/http";
import { renderLetterPdf } from "@/lib/letters/pdf";
import { buildRentDemand, rentDemandDeadline } from "@/lib/letters/rent";
import { sendFromMailbox } from "@/lib/mailbox";
import { logActivity, readDB, readUpload, writeDB, type LetterRecord } from "@/lib/store";
import { ledger } from "@/lib/tenancy";
import { PlanError, assertCanSend } from "@/lib/usage";

type Ctx = { params: { id: string } };

// GET: preview the rent demand letter on the letterhead. POST: send it. A rent demand counts as one
// letter toward the plan's monthly limit, like any other demand letter.
export const GET = (req: Request, { params }: Ctx) =>
  withUser(req, async (user) => {
    const db = await readDB(acct(user));
    const t = db.tenancies?.find((x) => x.id === params.id);
    if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const content = buildRentDemand(t, db.company, t.demandSentAt ? new Date(t.demandSentAt) : new Date());
    const lh = db.company.letterhead;
    const pdf = await renderLetterPdf(content, lh ? { bytes: await readUpload(lh.file), mime: lh.mime } : undefined);
    return new NextResponse(Buffer.from(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="rent-demand-${t.id}.pdf"` },
    });
  });

export const POST = (req: Request, { params }: Ctx) =>
  withUser(req, async (user) => {
    const back = (q: string) => go(req, `/landlord/${params.id}${q}#letter`);
    if (!can(user, "sendLetters")) return back("?noPermission=1");
    if (!user.emailVerifiedAt) return back(`?letterError=${encodeURIComponent("Confirm your email address before sending letters. Check your inbox, or resend the link from Receivables.")}`);
    const db = await readDB(acct(user));
    const t = db.tenancies?.find((x) => x.id === params.id);
    if (!t) return go(req, "/landlord");
    if (ledger(t).total <= 0) return back(`?letterError=${encodeURIComponent("Nothing is owing on the rent ledger.")}`);
    try {
      assertCanSend(db);
    } catch (e) {
      if (e instanceof PlanError) return back(`?letterError=${encodeURIComponent(e.message)}`);
      throw e;
    }
    const sentAt = new Date();
    const content = buildRentDemand(t, db.company, sentAt);
    t.demandSentAt = sentAt.toISOString();
    t.demandDeadline = rentDemandDeadline(t, sentAt);
    const letter: LetterRecord = { id: `L${Date.now()}`, invoiceId: t.id, sentAt: t.demandSentAt, channel: "email", mode: "manual", deadline: t.demandDeadline };
    db.letters.push(letter);

    const m = db.mailbox;
    if (m?.sendEmail && t.tenantEmail) {
      try {
        if (m.demo) (db.outbox ??= []).push({ to: t.tenantEmail, subject: content.subject, at: letter.sentAt });
        else {
          const lh = db.company.letterhead;
          const pdf = await renderLetterPdf(content, lh ? { bytes: await readUpload(lh.file), mime: lh.mime } : undefined);
          await sendFromMailbox(m, {
            to: t.tenantEmail,
            subject: `${content.subject} (${t.landlord})`,
            text: `${content.salutation}\n\nPlease see the attached letter about unpaid rent. Payment is due by ${letter.deadline}.\n\n${db.company.signatory || t.landlord}\n${t.landlord}${db.company.phone ? `\n${db.company.phone}` : ""}`,
            attachment: { filename: "Rent demand.pdf", bytes: pdf },
          });
        }
        letter.emailedVia = m.demo ? "demo" : m.provider;
        letter.emailedTo = t.tenantEmail;
      } catch (e) {
        letter.deliveryError = (e as Error).message;
      }
    }
    const p = ((db.progress ??= {})[t.id] ??= { done: [], docs: [] });
    p.done = [...new Set([...p.done, t.kind === "residential" ? "reminder" : "demand"])];
    logActivity(db, user, `Sent a rent demand letter for ${t.street}`, `/landlord/${t.id}`);
    await writeDB(acct(user), db);
    return back("?sent=1");
  });
