import { CORS, json, protectedResourceMetadata } from "@/lib/oauth";

// RFC 9728. Served at /.well-known/oauth-protected-resource and /.well-known/oauth-protected-resource/mcp.
export const dynamic = "force-dynamic";
export const GET = (req: Request) => json(protectedResourceMetadata(req));
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
