import { NextResponse } from "next/server";
import { renderLetterPdf } from "@/lib/letters/pdf";
import { buildDemandLetter } from "@/lib/letters/template";
import { draftRow, readDraft } from "@/lib/oneoff";
import { readUpload } from "@/lib/store";

// The one-off letter PDF. Only generated once the draft is paid for.
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const d = await readDraft(params.id);
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!d.paid) return NextResponse.json({ error: "Payment required" }, { status: 402 });
  const row = draftRow(d);
  const content = buildDemandLetter(row, d.company, 14, new Date(d.paidAt ?? Date.now()));
  const lh = d.company.letterhead;
  const pdf = await renderLetterPdf(content, lh ? { bytes: await readUpload(lh.file), mime: lh.mime } : undefined);
  return new NextResponse(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="demand-letter-${d.debtor.name.replace(/[^\w]+/g, "-")}.pdf"` },
  });
}
