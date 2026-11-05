import { CORS, exchangeCode, json, oauthError, OAuthError, refresh } from "@/lib/oauth";

async function params(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, String(v)]));
  }
  return Object.fromEntries(new URLSearchParams(await req.text()));
}

/** client_secret_basic credentials, if sent. */
function basic(req: Request): { id?: string; secret?: string } {
  const m = /^Basic\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!m) return {};
  const [id, secret] = Buffer.from(m[1], "base64").toString("utf8").split(":");
  return { id: decodeURIComponent(id ?? ""), secret: decodeURIComponent(secret ?? "") };
}

export async function POST(req: Request) {
  try {
    const p = await params(req);
    const b = basic(req);
    const clientId = b.id || p.client_id || "";
    const clientSecret = b.secret || p.client_secret || undefined;
    if (p.grant_type === "authorization_code") {
      return json(await exchangeCode({ code: p.code ?? "", clientId, clientSecret, redirectUri: p.redirect_uri, verifier: p.code_verifier ?? "" }));
    }
    if (p.grant_type === "refresh_token") {
      return json(await refresh({ refreshToken: p.refresh_token ?? "", clientId, clientSecret }));
    }
    throw new OAuthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
  } catch (e) {
    return oauthError(e);
  }
}

export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
