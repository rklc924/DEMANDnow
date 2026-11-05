import { NextResponse } from "next/server";
import { cookieOptions, loginBlocked, recordFailedLogin, SESSION_COOKIE, sessionValue, verifyLogin } from "@/lib/auth";
import { go } from "@/lib/http";

export async function POST(req: Request) {
  const f = await req.formData();
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const keys = [`e:${email}`, `ip:${ip}`];
  if (loginBlocked(keys)) return go(req, "/login?error=locked");
  const user = await verifyLogin(email, String(f.get("password") ?? ""));
  if (!user) {
    recordFailedLogin(keys);
    return go(req, "/login?error=1");
  }
  const res = go(req, "/");
  (res as NextResponse).cookies.set(SESSION_COOKIE, sessionValue(user), cookieOptions);
  return res;
}
