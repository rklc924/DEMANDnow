import { authenticate, CORS, json, mcpUrl, baseUrl } from "@/lib/oauth";
import { handleRpc } from "@/lib/mcp";

// Remote MCP endpoint for Claude and ChatGPT (Streamable HTTP, stateless: every POST gets a JSON reply).
// Unauthenticated requests get a 401 pointing at the OAuth metadata, which starts the sign-in flow.

export const dynamic = "force-dynamic";

const unauthorized = (req: Request) =>
  json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Sign in to Demand Now to use this connector." } }, 401, {
    "WWW-Authenticate": `Bearer realm="Demand Now", resource_metadata="${baseUrl(req)}/.well-known/oauth-protected-resource", scope="matters"`,
  });

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  const out = await handleRpc(body, { userId: auth.userId, clientName: auth.grant.clientName, req });
  if (out === null) return new Response(null, { status: 202, headers: CORS });
  return json(out);
}

// No server-initiated streams in this stateless server.
export async function GET(req: Request) {
  if (!(await authenticate(req))) return unauthorized(req);
  return new Response("This MCP server does not offer a server-to-client stream. Send JSON-RPC requests with POST to " + mcpUrl(req), {
    status: 405,
    headers: { ...CORS, Allow: "POST" },
  });
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: { ...CORS, Allow: "POST" } });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
