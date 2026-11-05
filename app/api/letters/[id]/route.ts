import { NextResponse } from "next/server";
import { loadRow } from "@/lib/ledger";
import { renderLetterPdf } from "@/lib/letters/pdf";
import { buildDemandLetter } from "@/lib/letters/template";
import { sendLetter } from "@/lib/send";
import { readUpload } from "@/lib/store";

// GET: preview the letter PDF on the letterhead. POST: send it.
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { db, row } = await loadRow(params.id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sentOn = row.letter ? new Date(row.letter.sentAt) : new Date();
  const content = buildDemandLetter(row, db.company, db.settings.responseDays, sentOn);
  const lh = db.company.letterhead;
  const pdf = await renderLetterPdf(content, lh ? { bytes: await readUpload(lh.file), mime: lh.mime } : undefined);
  return new NextResponse(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="demand-${row.invoice.number}.pdf"` },
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await sendLetter(params.id);
  return NextResponse.redirect(new URL(`/cases/${params.id}?sent=1`, req.url), 303);
}
