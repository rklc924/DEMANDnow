import { authServerMetadata, CORS, json } from "@/lib/oauth";

// RFC 8414 authorization server metadata (also at the path-suffixed form some clients request).
export const dynamic = "force-dynamic";
export const GET = (req: Request) => json(authServerMetadata(req));
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
