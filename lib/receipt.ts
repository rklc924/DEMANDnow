import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { DB } from "./store";

type Charge = NonNullable<DB["charges"]>[number];

/** Invoice number shown on receipts: DN-YYYY-<id>. */
export const receiptNumber = (c: Charge) => c.number ?? `DN-${c.at.slice(0, 4)}-${c.id.toUpperCase()}`;

/** A paid invoice / receipt for one charge. */
export async function receiptPdf(c: Charge, db: DB, billedEmail: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Receipt ${receiptNumber(c)}`);
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const teal = rgb(0.06, 0.46, 0.43);
  const ink = rgb(0.12, 0.16, 0.18);
  const grey = rgb(0.4, 0.44, 0.44);
  const M = 56;
  let y = 736;
  const t = (s: string, x: number, size = 10, f = font, color = ink) => page.drawText(s, { x, y, size, font: f, color });
  const right = (s: string, xr: number, size = 10, f = font, color = ink) => page.drawText(s, { x: xr - f.widthOfTextAtSize(s, size), y, size, font: f, color });
  const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = new Date(c.at).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  t("Demand", M, 22, bold);
  page.drawText("Now", { x: M + bold.widthOfTextAtSize("Demand", 22) + 1, y, size: 22, font: bold, color: teal });
  right("PAID INVOICE / RECEIPT", 612 - M, 12, bold, teal);
  y -= 30;
  page.drawLine({ start: { x: M, y }, end: { x: 612 - M, y }, thickness: 1, color: teal });
  y -= 28;

  t("Billed to", M, 9, bold, grey);
  right("Receipt number", 612 - M - 140, 9, bold, grey);
  right(receiptNumber(c), 612 - M, 10, bold);
  y -= 15;
  t(db.company.name, M, 11, bold);
  right("Date paid", 612 - M - 140, 9, bold, grey);
  right(date, 612 - M);
  y -= 14;
  for (const line of [db.company.phone, db.company.email || billedEmail].filter(Boolean)) {
    t(line, M, 10, font, grey);
    y -= 13;
  }
  y = Math.min(y, 640) - 20;

  page.drawRectangle({ x: M, y: y - 6, width: 612 - 2 * M, height: 22, color: rgb(0.87, 0.95, 0.94) });
  y += 1;
  t("Description", M + 8, 9, bold);
  right("Amount (CAD)", 612 - M - 8, 9, bold);
  y -= 28;
  t(c.description, M + 8, 10);
  right(money(c.amount), 612 - M - 8);
  y -= 20;
  page.drawLine({ start: { x: M, y }, end: { x: 612 - M, y }, thickness: 0.5, color: grey });
  y -= 22;
  right("Total paid", 612 - M - 110, 11, bold);
  right(money(c.amount), 612 - M - 8, 12, bold);
  y -= 30;

  const card = db.card ? `${db.card.brand.toUpperCase()} ending ${db.card.last4}` : "card on file";
  t(`Paid in full by ${card}${c.demo ? " (demo mode: no real charge was made)" : ""}.`, M, 10);
  y -= 14;
  if (c.stripeId) {
    t(`Payment reference: ${c.stripeId}`, M, 9, font, grey);
    y -= 14;
  }
  if (c.extraFeesNote) {
    t(c.extraFeesNote, M, 9, font, grey);
    y -= 14;
  }

  page.drawText("Thank you for using Demand Now.", { x: M, y: 70, size: 10, font: bold, color: teal });
  page.drawText("Questions about this receipt? Reply to any Demand Now email or use Help in the app.", { x: M, y: 56, size: 8, font, color: grey });
  return pdf.save();
}
