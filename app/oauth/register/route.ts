import { CORS, json, oauthError, registerClient } from "@/lib/oauth";

// RFC 7591 dynamic client registration. Claude and ChatGPT register themselves here when a user adds the connector.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { client, secret } = await registerClient(body);
    return json(
      {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(Date.parse(client.createdAt) / 1000),
        ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
        client_name: client.name,
        redirect_uris: client.redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: client.authMethod,
        scope: "matters",
      },
      201,
    );
  } catch (e) {
    return oauthError(e);
  }
}

export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
