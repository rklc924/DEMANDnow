import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { FormSheet } from "./index";

// Prints the RTB form data sheets: one section per form, with every value the landlord copies onto the
// RTB's own form (or into the online application). Missing values print as "MISSING" so nothing is skipped.

const PAGE: [number, number] = [612, 792];
const M = 54;

export async function renderSheetsPdf(title: string, subtitle: string, sheets: FormSheet[], note: string) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage(PAGE);
  let y = PAGE[1] - M;
  const width = PAGE[0] - M * 2;
  const need = (h: number) => {
    if (y - h < M) {
      page = doc.addPage(PAGE);
      y = PAGE[1] - M;
    }
  };
  const wrap = (text: string, f: typeof font, size: number, w: number) => {
    const out: string[] = [];
    let cur = "";
    for (const word of text.replace(/[^\x20-\x7E]/g, "-").split(/\s+/)) {
      const next = cur ? `${cur} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > w && cur) {
        out.push(cur);
        cur = word;
      } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  };
  const para = (text: string, f = font, size = 10, color = rgb(0.1, 0.1, 0.1)) => {
    for (const l of wrap(text, f, size, width)) {
      need(size + 4);
      page.drawText(l, { x: M, y, size, font: f, color });
      y -= size + 4;
    }
  };

  para(title, bold, 16);
  para(subtitle, font, 10, rgb(0.35, 0.35, 0.35));
  y -= 6;
  for (const s of sheets) {
    y -= 10;
    need(40);
    para(`${s.code}: ${s.title}`, bold, 12, rgb(0.06, 0.46, 0.43));
    para(s.use, font, 9, rgb(0.35, 0.35, 0.35));
    y -= 4;
    for (const f of s.fields) {
      const value = f.value === undefined ? "MISSING: fill this in on the matter page" : f.value || "(leave blank)";
      const labelLines = wrap(f.label, bold, 9, 200);
      const valueLines = wrap(value, font, 9, width - 210);
      const h = Math.max(labelLines.length, valueLines.length) * 12 + 4;
      need(h);
      labelLines.forEach((l, i) => page.drawText(l, { x: M, y: y - i * 12, size: 9, font: bold, color: rgb(0.2, 0.2, 0.2) }));
      valueLines.forEach((l, i) => page.drawText(l, { x: M + 210, y: y - i * 12, size: 9, font, color: f.value === undefined ? rgb(0.64, 0.16, 0.16) : rgb(0.1, 0.1, 0.1) }));
      y -= h;
    }
    if (s.table && s.table.rows.length) {
      y -= 4;
      const cols = s.table.head.length;
      const cw = width / cols;
      const row = (cells: string[], f: typeof font) => {
        need(14);
        cells.forEach((c, i) => page.drawText(wrap(c, f, 8, cw - 4)[0] ?? "", { x: M + i * cw, y, size: 8, font: f }));
        y -= 13;
      };
      row(s.table.head, bold);
      s.table.rows.forEach((r) => row(r, font));
    }
  }
  y -= 12;
  para(note, font, 8, rgb(0.35, 0.35, 0.35));
  return doc.save();
}
