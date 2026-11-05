import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { LetterContent } from "./template";

// Renders the letter onto the subscriber's letterhead. A PDF letterhead's first page becomes the
// page background; a PNG/JPG is drawn full page. Text starts below the header band.

const PAGE: [number, number] = [612, 792]; // US Letter, the Canadian business default
const MARGIN_X = 72;
const TOP = 150; // leave room for the letterhead header
const BOTTOM = 96; // and footer

export async function renderLetterPdf(letter: LetterContent, letterhead?: { bytes: Uint8Array; mime: string }) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const size = 11.5;
  const leading = 15;
  const maxWidth = PAGE[0] - MARGIN_X * 2;

  let background: ((page: ReturnType<typeof doc.addPage>) => void) | undefined;
  if (letterhead) {
    if (letterhead.mime === "application/pdf") {
      const [embedded] = await doc.embedPdf(letterhead.bytes, [0]);
      background = (p) => p.drawPage(embedded, { x: 0, y: 0, width: PAGE[0], height: PAGE[1] });
    } else {
      const img = letterhead.mime === "image/png" ? await doc.embedPng(letterhead.bytes) : await doc.embedJpg(letterhead.bytes);
      background = (p) => p.drawImage(img, { x: 0, y: 0, width: PAGE[0], height: PAGE[1] });
    }
  }

  let page = doc.addPage(PAGE);
  background?.(page);
  let y = PAGE[1] - TOP;

  const newPageIfNeeded = () => {
    if (y < BOTTOM) {
      page = doc.addPage(PAGE);
      background?.(page);
      y = PAGE[1] - TOP;
    }
  };
  const line = (text: string, f = font) => {
    newPageIfNeeded();
    page.drawText(text, { x: MARGIN_X, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
    y -= leading;
  };
  const wrap = (text: string, f = font) => {
    const words = text.split(/\s+/);
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > maxWidth) {
        line(cur, f);
        cur = w;
      } else cur = next;
    }
    if (cur) line(cur, f);
  };

  line(letter.date);
  y -= leading;
  line(letter.via, bold);
  y -= leading / 2;
  letter.recipient.forEach((r) => line(r));
  y -= leading;
  line(letter.salutation);
  y -= leading / 2;
  wrap(letter.subject, bold);
  y -= leading / 2;
  letter.paragraphs.forEach((p, i) => {
    wrap(p);
    y -= leading / 2;
    if (i === letter.statementAfter) {
      for (const s of letter.statement) {
        newPageIfNeeded();
        const f = s.total ? bold : font;
        if (s.total) {
          page.drawLine({ start: { x: PAGE[0] - MARGIN_X - 110, y: y + leading - 3 }, end: { x: PAGE[0] - MARGIN_X - 30, y: y + leading - 3 }, thickness: 0.6 });
        }
        page.drawText(s.label, { x: MARGIN_X + 24, y, size, font: f });
        const w = f.widthOfTextAtSize(s.amount, size);
        page.drawText(s.amount, { x: PAGE[0] - MARGIN_X - 30 - w, y, size, font: f });
        y -= leading;
      }
      y -= leading / 2;
    }
  });
  y -= leading / 2;
  letter.signoff.forEach((s) => (s ? line(s) : (y -= leading)));

  return doc.save();
}
