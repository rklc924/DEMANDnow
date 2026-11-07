import { acct, canSeeMatter } from "@/lib/auth";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/http";
import { toIcs } from "@/lib/reminders";
import { readDB } from "@/lib/store";

// GET /api/reminders/<invoiceId> (or "all"): the follow-up dates for one matter as an .ics file, for any calendar app.
export const GET = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const db = await readDB(acct(user));
    const list = (db.reminders ?? []).filter((r) => (params.id === "all" || r.invoiceId === params.id) && canSeeMatter(user, db, r.invoiceId));
    return new NextResponse(toIcs(list), {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="demand-now-${params.id}.ics"` },
    });
  });
