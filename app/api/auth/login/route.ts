import { NextResponse } from "next/server";
import { cookieOptions, SESSION_COOKIE, sessionValue, verifyLogin } from "@/lib/auth";
import { go } from "@/lib/http";

export async function POST(req: Request) {
  const f = await req.formData();
  const user = await verifyLogin(String(f.get("email") ?? ""), String(f.get("password") ?? ""));
  if (!user) return go(req, "/login?error=1");
  const res = go(req, "/");
  (res as NextResponse).cookies.set(SESSION_COOKIE, sessionValue(user.id), cookieOptions);
  return res;
}
