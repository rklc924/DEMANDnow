import { acct } from "@/lib/auth";
import { NextResponse } from "next/server";
import { NOTICE_OF_CLAIM_PACKAGE, certificateOfServicePdf } from "@/lib/certificate";
import { withUser } from "@/lib/http";
import { loadRow } from "@/lib/ledger";

// Pre-filled Certificate of Service (Form 4) for clients who serve the Notice of Claim themselves.
export const GET = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const { db, row } = await loadRow(acct(user), params.id);
    if (!row) return new NextResponse("Not found", { status: 404 });
    const kind = new URL(req.url).searchParams.get("kind") === "individual" ? "individual" : "company";
    const bytes = await certificateOfServicePdf({
      claimant: db.company.name,
      serveOn: row.customer.name,
      address: row.customer.address,
      documents: NOTICE_OF_CLAIM_PACKAGE,
      kind,
    });
    return new NextResponse(Buffer.from(bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Certificate of Service - ${kind}.pdf"` },
    });
  });
