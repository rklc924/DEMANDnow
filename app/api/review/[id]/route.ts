import { NextResponse } from "next/server";
import { readDB, writeDB } from "@/lib/store";

// Paid add-on: sends the assembled file to the firm for review. Prototype records the request;
// phase 5 creates the matter in the firm's practice management system and notifies a lawyer.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const db = await readDB();
  db.reviewRequests ??= [];
  if (!db.reviewRequests.some((r) => r.invoiceId === params.id))
    db.reviewRequests.push({ invoiceId: params.id, requestedAt: new Date().toISOString() });
  await writeDB(db);
  return NextResponse.redirect(new URL(`/cases/${params.id}?review=1`, req.url), 303);
}
