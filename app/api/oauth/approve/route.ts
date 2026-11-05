import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { go } from "@/lib/http";
import { baseUrl, checkAuthorizeRequest, issueCode } from "@/lib/oauth";

// Consent form target. The session cookie is SameSite=Lax, so this only works from our own consent page.
export async function POST(req: Request) {
  const f = await req.formData();
  const p: Record<string, string> = {};
  f.forEach((v, k) => typeof v === "string" && (p[k] = v));
  const user = await getUser();
  if (!user) return go(req, "/login");
  let r: Awaited<ReturnType<typeof checkAuthorizeRequest>>;
  try {
    r = await checkAuthorizeRequest(p);
  } catch {
    return go(req, `/oauth/authorize?${new URLSearchParams(p)}`);
  }
  const back = new URL(r.redirectUri);
  if (p.decision !== "allow") {
    back.searchParams.set("error", "access_denied");
    back.searchParams.set("error_description", "The user cancelled the connection.");
  } else {
    const code = await issueCode({ client: r.client, userId: user.id, redirectUri: r.redirectUri, challenge: r.challenge, resource: r.resource });
    back.searchParams.set("code", code);
  }
  if (r.state) back.searchParams.set("state", r.state);
  back.searchParams.set("iss", baseUrl(req));
  return NextResponse.redirect(back.toString(), 303);
}
