import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/store";

// Prototype stand-in for payment detection from the accounting sync.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const db = await readDB();
  if (!db.paidInvoiceIds.includes(params.id)) db.paidInvoiceIds.push(params.id);
  await writeDB(db);
  return NextResponse.redirect(new URL(`/cases/${params.id}`, req.url), 303);
}
