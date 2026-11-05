import { NextResponse } from "next/server";
import { runAutoSend } from "@/lib/send";

// Called by the nightly scheduler (and the "Run nightly sync" button in the prototype).
export async function POST(req: Request) {
  const sent = await runAutoSend();
  return NextResponse.redirect(new URL(`/?autosent=${sent.length}`, req.url), 303);
}
