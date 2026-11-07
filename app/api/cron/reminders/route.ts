import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { runReminders } from "@/lib/notify";

// POST /api/cron/reminders: the daily reminder run. Called by the Render cron job (scripts/send-reminders.mjs)
// with "Authorization: Bearer <CRON_SECRET>". ?dryRun=1 reports what would be sent without sending.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const want = Buffer.from(secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const summary = await runReminders({
    dryRun: url.searchParams.get("dryRun") === "1",
    today: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
  });
  console.log(`[reminders] ${JSON.stringify(summary)}`);
  return NextResponse.json(summary);
}
