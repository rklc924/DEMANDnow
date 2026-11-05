import { CORS, revokeToken } from "@/lib/oauth";

// RFC 7009. Always 200, whether or not the token existed.
export async function POST(req: Request) {
  const p = new URLSearchParams(await req.text());
  const t = p.get("token");
  if (t) await revokeToken(t);
  return new Response(null, { status: 200, headers: CORS });
}

export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
