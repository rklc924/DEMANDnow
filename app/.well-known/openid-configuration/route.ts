import { authServerMetadata, CORS, json } from "@/lib/oauth";

// Some MCP clients look here first. Same metadata as /.well-known/oauth-authorization-server.
export const dynamic = "force-dynamic";
export const GET = (req: Request) => json(authServerMetadata(req));
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
