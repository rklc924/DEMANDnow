export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getDoc, storageKind } from "@/lib/db";

// Render health check: confirms the app can reach its storage.
export async function GET() {
  try {
    await getDoc("users", "health-check");
    return NextResponse.json({ ok: true, storage: storageKind() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
