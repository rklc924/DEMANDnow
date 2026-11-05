import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Certificate of Service for the Provincial Court of BC (Small Claims Court), following the wording and
// structure of the prescribed Form 4 (SCL 004F 03/2017) under the Small Claims Rules. There are two versions:
// one for serving an individual and one for serving a company (Business Corporations Act), each showing only the
// service methods the form allows for that kind of party, plus the form's "other service method" line.
// Everything known from the matter is filled in; what only the server can know is left blank.

export type PartyKind = "individual" | "company";

export interface CertificateData {
  courtFileNo?: string;
  registry?: string;
  claimant: string;
  /** Name of the party served, exactly as on the Notice of Claim. */
  serveOn: string;
  /** Where to serve: the individual's address, or the company's registered office. */
  address: string[];
  documents: string[];
  kind: PartyKind;
  /** Name of the person who will serve, if known. */
  server?: string;
}

/** The documents served with a Small Claims Notice of Claim (see the Notice of Claim instructions, Step 3). */
export const NOTICE_OF_CLAIM_PACKAGE = [
  "Notice of Claim (Form 1), filed",
  "Claimant's Address for Service (Form 38), filed",
  "Blank Reply (Form 2)",
  "Blank Address for Service (Form 38)",
];

const METHODS: Record<PartyKind, { heading: string; options: string[] }> = {
  individual: {
    heading: "an individual",
    options: ["Leaving a copy of it with him or her.", "Mailing a copy of it by registered mail to him or her."],
  },
  company: {
    heading: "a company as defined in the Business Corporations Act",
    options: [
      "Mailing a copy of it by registered mail to the registered office of the company.",
      "Leaving a copy of it at the registered office of the company.",
      "Leaving a copy of it at the place of business of the company, with a receptionist or a person who appears to manage or control the company's business there.",
      "Leaving a copy of it with a director, officer, liquidator, trustee in bankruptcy or receiver manager of the company.",
    ],
  },
};

const W = 612;
const H = 792;
const M = 50;
const INK = rgb(0.1, 0.1, 0.1);
const GREY = rgb(0.4, 0.4, 0.4);

export async function certificateOfServicePdf(d: CertificateData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificate of Service (Form 4): ${d.kind === "company" ? "company" : "individual"}`);
  const page = pdf.addPage([W, H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique);
  let y = H - M;

  const text = (s: string, x: number, size = 10, f: PDFFont = font, color = INK) => page.drawText(s, { x, y, size, font: f, color });
  const rule = (x1: number, x2: number, yy = y - 3) => page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: 0.6, color: GREY });
  const wrap = (s: string, x: number, width: number, size = 10, f: PDFFont = font) => {
    const words = s.split(" ");
    let cur = "";
    const lines: string[] = [];
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > width) { lines.push(cur); cur = w; } else cur = next;
    }
    if (cur) lines.push(cur);
    lines.forEach((l, i) => { text(l, x, size, f); if (i < lines.length - 1) y -= size + 3; });
  };
  const box = (x: number, checked = false) => {
    page.drawRectangle({ x, y: y - 1.5, width: 9, height: 9, borderWidth: 0.8, borderColor: INK });
    if (checked) text("X", x + 1.8, 9, bold);
  };
  // Margin note on the left, wrapped, without moving the current line.
  const margin = (label: string) => {
    const y0 = y;
    const words = label.split(" ");
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (bold.widthOfTextAtSize(next, 7.5) > 105) { text(cur, M, 7.5, bold, GREY); y -= 9; cur = w; } else cur = next;
    }
    if (cur) text(cur, M, 7.5, bold, GREY);
    y = y0;
  };
  // A labelled blank: margin note on the left, value on the line.
  const blank = (label: string, prefix: string, value: string, hint?: string) => {
    margin(label);
    text(prefix, M + 120, 10, bold);
    const x = M + 120 + bold.widthOfTextAtSize(prefix, 10) + 6;
    text(value, x + 2, 10);
    rule(x, W - M);
    if (hint) { y -= 11; text(hint, x + 2, 7, ital, GREY); }
    y -= 22;
  };

  // Header, as on the prescribed form.
  text("FORM 4", M, 9, bold);
  y -= 10;
  text("SCL 004F 03/2017", M, 7, font, GREY);
  y += 10;
  const rx = W - M - 190;
  text("REGISTRY FILE NUMBER", rx, 7, bold, GREY);
  y -= 11;
  text(d.courtFileNo ?? "", rx + 2, 10);
  rule(rx, W - M);
  y -= 16;
  text("REGISTRY LOCATION", rx, 7, bold, GREY);
  y -= 11;
  text(d.registry ?? "", rx + 2, 10);
  rule(rx, W - M);
  y -= 24;
  text("IN THE PROVINCIAL COURT OF BRITISH COLUMBIA (SMALL CLAIMS COURT)", M, 10, bold);
  y -= 22;
  text("CERTIFICATE OF SERVICE", M, 17, bold);
  y -= 14;
  text(`Claimant: ${d.claimant}`, M, 9, font, GREY);
  y -= 26;

  blank("Who served the document(s)?", "I certify that I,", d.server ?? "", "full name of the person who served");
  margin("LIST and ATTACH ALL document(s) that you served.");
  text("served", M + 120, 10, bold);
  y -= 2;
  for (const doc of d.documents) {
    text(`- ${doc}`, M + 168, 10);
    rule(M + 164, W - M);
    y -= 15;
  }
  y -= 8;
  blank("Fill in the name of the party served.", "on", d.serveOn, d.kind === "company" ? "the company's exact legal name, as on the company search and the Notice of Claim" : "the person's full legal name, as on the Notice of Claim");
  blank("When were the document(s) served?", "on", "", "Day / Month / Year");
  margin("Where were the document(s) served?");
  text("at", M + 120, 10, bold);
  const ax = M + 120 + bold.widthOfTextAtSize("at", 10) + 6;
  const addr = d.address.length ? d.address.join(", ") : "";
  text(addr, ax + 2, 10);
  rule(ax, W - M);
  y -= 11;
  text(d.kind === "company" ? "street address or location, city, province (registered office shown; correct it if served elsewhere)" : "street address or location, city, province (last known address shown; correct it if served elsewhere)", ax + 2, 7, ital, GREY);
  y -= 24;

  // Method.
  text("Tell how service took place by checking the appropriate box(es).", M, 7.5, bold, GREY);
  y -= 16;
  text("by", M, 10, bold);
  text(`If the party served is ${METHODS[d.kind].heading}:`, M + 20, 10, bold);
  y -= 17;
  for (const m of METHODS[d.kind].options) {
    box(M + 20);
    wrap(m, M + 36, W - M - (M + 36));
    y -= 16;
  }
  y -= 2;
  box(M + 20);
  text("OTHER SERVICE method or alternate method ordered by the Court:", M + 36, 10, bold);
  y -= 14;
  text("(Indicate other service method or instructions given by a judge or registrar for service.)", M + 36, 7.5, ital, GREY);
  y -= 16;
  rule(M + 36, W - M);
  y -= 22;

  // Proof of registered mail, as the form requires.
  page.drawRectangle({ x: M, y: y - 34, width: W - 2 * M, height: 46, borderWidth: 0.6, borderColor: GREY });
  y -= 2;
  text("NOTE: You must give proof of service by REGISTERED MAIL by attaching one of the following:", M + 8, 8.5, bold);
  y -= 12;
  text("1. a copy, produced by fax or otherwise, of the signature obtained by Canada Post at the time the document was delivered.", M + 8, 8);
  y -= 11;
  text("2. a print-out of the delivery confirmation made available on the Internet by Canada Post (www.canadapost.ca).", M + 8, 8);
  y -= 46;

  rule(M, M + 300);
  rule(M + 330, W - M);
  y -= 13;
  text("Signature of person who served the document", M, 8, font, GREY);
  text("Date (Day / Month / Year)", M + 330, 8, font, GREY);

  footer(page, font, d.kind);
  return pdf.save();
}

function footer(page: PDFPage, font: PDFFont, kind: PartyKind) {
  page.drawText(
    `Prepared by Demand Now following Small Claims Form 4 (SCL 004F), ${kind === "company" ? "company" : "individual"} version. File it at the registry with any registered-mail proof attached. ` +
      "If the registry asks for the government-printed form, copy these details onto it.",
    { x: M, y: 34, size: 7, font, color: GREY, maxWidth: W - 2 * M, lineHeight: 9 },
  );
}
