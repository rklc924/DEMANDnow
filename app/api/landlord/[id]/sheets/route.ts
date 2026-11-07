import { acct } from "@/lib/auth";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/http";
import { readDB } from "@/lib/store";
import { rtbSheets, tenancyRules, unitLine } from "@/lib/tenancy";
import { renderSheetsPdf } from "@/lib/tenancy/sheetpdf";

// GET: the RTB form data sheets as a printable PDF (?form=RTB-30 for one form).
export const GET = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const db = await readDB(acct(user));
    const t = db.tenancies?.find((x) => x.id === params.id);
    if (!t || t.kind !== "residential") return NextResponse.json({ error: "Not found" }, { status: 404 });
    const only = new URL(req.url).searchParams.get("form");
    const sheets = rtbSheets(t).filter((s) => !only || s.code === only);
    const rules = tenancyRules(t.jurisdiction);
    const pdf = await renderSheetsPdf(
      only ? `${only} data sheet` : "RTB form data sheets",
      `${unitLine(t)} · ${t.tenants.join(", ")} · prepared ${new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}`,
      sheets,
      `Copy these details onto the ${rules.residential.tribunal}'s own forms (gov.bc.ca/landlordtenant) or into the online application. The RTB only accepts its own forms. ${rules.disclaimer}`,
    );
    return new NextResponse(Buffer.from(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${only ?? "rtb-data-sheets"}-${t.id}.pdf"` },
    });
  });
