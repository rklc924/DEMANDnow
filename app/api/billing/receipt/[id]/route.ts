import { NextResponse } from "next/server";
import { acct, isAdmin } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { receiptNumber, receiptPdf } from "@/lib/receipt";
import { readDB } from "@/lib/store";

// A paid invoice / receipt PDF for one charge on the account.
export const GET = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    if (!isAdmin(user)) return go(req, "/?adminOnly=1");
    const db = await readDB(acct(user));
    const c = (db.charges ?? []).find((x) => x.id === params.id);
    if (!c) return new NextResponse("Not found", { status: 404 });
    const pdf = await receiptPdf(c, db, user.email);
    return new NextResponse(Buffer.from(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${receiptNumber(c)}.pdf"` },
    });
  });
