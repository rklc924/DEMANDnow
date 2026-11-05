import { NextResponse } from "next/server";
import { go, withUser } from "@/lib/http";
import { loadRow } from "@/lib/ledger";
import { renderLetterPdf } from "@/lib/letters/pdf";
import { buildDemandLetter, type LetterVariant } from "@/lib/letters/template";
import { sendLetter } from "@/lib/send";
import { readUpload } from "@/lib/store";
import { PlanError } from "@/lib/usage";

type Ctx = { params: { id: string } };

// GET: preview the letter PDF on the letterhead (?variant=firm for the lawyer letter). POST: send it.
export const GET = (req: Request, { params }: Ctx) =>
  withUser(req, async (user) => {
    const { db, row } = await loadRow(user.id, params.id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const sentOn = row.letter ? new Date(row.letter.sentAt) : new Date();
    const variant: LetterVariant = new URL(req.url).searchParams.get("variant") === "firm" ? "firm" : "company";
    const content = buildDemandLetter(row, db.company, db.settings.responseDays, sentOn, variant);
    const lh = variant === "company" ? db.company.letterhead : undefined; // firm letters use the firm letterhead (phase 5)
    const pdf = await renderLetterPdf(content, lh ? { bytes: await readUpload(lh.file), mime: lh.mime } : undefined);
    return new NextResponse(Buffer.from(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="demand-${row.invoice.number}.pdf"` },
    });
  });

export const POST = (req: Request, { params }: Ctx) =>
  withUser(req, async (user) => {
    if (!user.emailVerifiedAt) {
      return go(req, `/cases/${params.id}?limit=${encodeURIComponent("Confirm your email address before sending letters. Check your inbox, or resend the link from Receivables.")}`);
    }
    try {
      await sendLetter(user.id, params.id);
    } catch (e) {
      if (e instanceof PlanError) return go(req, `/cases/${params.id}?limit=${encodeURIComponent(e.message)}`);
      throw e;
    }
    return go(req, `/cases/${params.id}?sent=1`);
  });
