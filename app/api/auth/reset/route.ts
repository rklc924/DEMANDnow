import { NextResponse } from "next/server";
import { cookieOptions, resetPassword, SESSION_COOKIE, sessionValue } from "@/lib/auth";
import { go } from "@/lib/http";

export async function POST(req: Request) {
  const f = await req.formData();
  const token = String(f.get("token") ?? "");
  const password = String(f.get("password") ?? "");
  if (password !== String(f.get("confirm") ?? "")) return go(req, `/reset?token=${encodeURIComponent(token)}&error=${encodeURIComponent("The passwords don't match.")}`);
  try {
    const user = await resetPassword(token, password);
    if (!user) return go(req, "/login?error=link");
    const res = go(req, "/?reset=1");
    (res as NextResponse).cookies.set(SESSION_COOKIE, sessionValue(user), cookieOptions);
    return res;
  } catch (e) {
    return go(req, `/reset?token=${encodeURIComponent(token)}&error=${encodeURIComponent((e as Error).message)}`);
  }
}
