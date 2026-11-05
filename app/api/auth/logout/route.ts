import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { go } from "@/lib/http";

export async function POST(req: Request) {
  const res = go(req, "/login");
  (res as NextResponse).cookies.delete(SESSION_COOKIE);
  return res;
}
