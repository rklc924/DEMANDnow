import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// A pre-filled Certificate of Service for a BC Small Claims Notice of Claim, for the person who serves to
// complete and sign. Everything known from the matter is filled in; what only the server can know is left blank.
// verify: confirm the content against the current prescribed Small Claims form before launch, or switch to
// filling the official PDF once we have it.

export interface CertificateData {
  courtFileNo?: string;
  registry?: string;
  claimant: string;
  defendant: string;
  serveOn: string; // person or company to be served
  address: string[]; // last known address
  documents: string[];
  isCompany: boolean;
}

const W = 612;
const H = 792;
const M = 56;

export async function certificateOfServicePdf(d: CertificateData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Certificate of Service");
  const page = pdf.addPage([W, H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = H - M;

  const text = (s: string, x: number, size = 10, f: PDFFont = font) => page.drawText(s, { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
  const line = (x1: number, x2: number, yy = y - 2) => page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: 0.6, color: rgb(0.3, 0.3, 0.3) });
  const box = (x: number, checked = false) => {
    page.drawRectangle({ x, y: y - 1, width: 9, height: 9, borderWidth: 0.8, borderColor: rgb(0.2, 0.2, 0.2) });
    if (checked) text("X", x + 1.8, 9, bold);
  };
  const field = (label: string, value = "", width = W - 2 * M) => {
    text(label, M, 9, bold);
    y -= 15;
    text(value, M + 4, 10);
    line(M, M + width);
    y -= 22;
  };

  text("Court File No.", W - M - 170, 9, bold);
  text(d.courtFileNo ?? "", W - M - 95, 10);
  line(W - M - 98, W - M);
  y -= 16;
  text("Registry", W - M - 170, 9, bold);
  text(d.registry ?? "", W - M - 95, 10);
  line(W - M - 98, W - M);
  y -= 28;

  text("In the Provincial Court of British Columbia (Small Claims)", M, 11, bold);
  y -= 26;
  text("CERTIFICATE OF SERVICE", M, 18, bold);
  y -= 30;

  field("Claimant", d.claimant);
  field("Defendant", d.defendant);

  text("I served the following documents:", M, 10, bold);
  y -= 16;
  for (const doc of d.documents) {
    box(M + 4, true);
    text(doc, M + 20, 10);
    y -= 15;
  }
  y -= 10;

  field(d.isCompany ? "On the company" : "On the person", d.serveOn);
  if (d.isCompany) field("By handing them to (name and position, e.g. director), if served in person");

  text("At this address (last known address shown; correct it if served elsewhere)", M, 9, bold);
  y -= 15;
  for (const a of d.address.length ? d.address : [""]) {
    text(a, M + 4, 10);
    line(M, W - M);
    y -= 15;
  }
  y -= 10;

  text("On (date)", M, 9, bold);
  text("At (time)", M + 260, 9, bold);
  y -= 15;
  line(M, M + 220);
  line(M + 260, W - M);
  y -= 24;

  text("How the documents were served:", M, 10, bold);
  y -= 16;
  const methods = d.isCompany
    ? ["Left at, or mailed by registered mail to, the company's registered office", "Handed to a director, officer or manager of the company"]
    : ["Handed to the person named above", "Sent by registered mail, and the signed receipt is attached"];
  for (const m of [...methods, "Other (describe):"]) {
    box(M + 4);
    text(m, M + 20, 10);
    y -= 16;
  }
  line(M + 110, W - M, y + 14);
  y -= 8;

  field("How I knew it was the right person or office (e.g. they confirmed their name; photo ID; registry search)");

  y -= 6;
  text("I certify that the information above is true.", M, 10, bold);
  y -= 30;
  line(M, M + 230);
  line(M + 260, W - M);
  y -= 13;
  text("Signature of person who served", M, 8);
  text("Printed name", M + 260, 8);
  y -= 26;
  line(M, M + 230);
  line(M + 260, W - M);
  y -= 13;
  text("Date signed", M, 8);
  text("Phone number", M + 260, 8);

  footer(page, font);
  return pdf.save();
}

function footer(page: PDFPage, font: PDFFont) {
  page.drawText(
    "Prepared by Demand Now from the matter details. Complete the blanks, sign, and file at the registry. Use the court's current prescribed form if the registry requires it.",
    { x: M, y: 36, size: 7, font, color: rgb(0.45, 0.45, 0.45), maxWidth: W - 2 * M, lineHeight: 9 },
  );
}
