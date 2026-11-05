import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { deleteDoc, getDoc, putDoc } from "./db";
import { readDB, writeDB } from "./store";

// OAuth 2.1 authorization server for AI assistants (Claude connectors, ChatGPT apps) that call the
// Demand Now MCP server at /mcp. Supports dynamic client registration (RFC 7591), authorization code
// with PKCE S256, refresh token rotation and revocation. The user signs in to Demand Now and approves
// on a consent screen; the assistant only ever holds a token, never the password.
// Everything lives in the "oauth" table, and raw codes and tokens are only ever stored hashed.

export const SCOPE = "matters";
const ACCESS_TTL = 60 * 60; // seconds
const REFRESH_TTL = 60 * 86_400;
const CODE_TTL = 5 * 60;

export const baseUrl = (req?: Request) => (process.env.APP_URL ?? (req ? new URL(req.url).origin : "http://localhost:3000")).replace(/\/$/, "");
export const mcpUrl = (req?: Request) => `${baseUrl(req)}/mcp`;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const token = (prefix: string) => `${prefix}_${randomBytes(32).toString("base64url")}`;
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const nowS = () => Math.floor(Date.now() / 1000);

export interface Client {
  clientId: string;
  name: string;
  redirectUris: string[];
  clientUri?: string;
  /** Present for confidential clients (client_secret_post / client_secret_basic). */
  secretHash?: string;
  authMethod: "none" | "client_secret_post" | "client_secret_basic";
  createdAt: string;
}

interface Code {
  clientId: string;
  userId: string;
  redirectUri: string;
  challenge: string;
  scope: string;
  resource?: string;
  expires: number;
}

export interface Grant {
  grantId: string;
  userId: string;
  clientId: string;
  clientName: string;
  scope: string;
  createdAt: string;
  lastUsedAt?: string;
}

interface StoredToken {
  grantId: string;
  userId: string;
  expires: number;
}

export class OAuthError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

// ---------- Clients ----------

/** Redirect URIs must be https, or loopback http for desktop clients and local testing. */
function validRedirect(uri: string) {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

export async function registerClient(body: Record<string, unknown>): Promise<{ client: Client; secret?: string }> {
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];
  if (!uris.length || uris.length > 10 || !uris.every(validRedirect)) {
    throw new OAuthError("invalid_redirect_uri", "Provide one to ten https redirect URIs (http is allowed for localhost only).");
  }
  const requested = String(body.token_endpoint_auth_method ?? "none");
  const authMethod = (["none", "client_secret_post", "client_secret_basic"].includes(requested) ? requested : "none") as Client["authMethod"];
  const grants = Array.isArray(body.grant_types) ? body.grant_types.map(String) : ["authorization_code"];
  if (grants.some((g) => !["authorization_code", "refresh_token"].includes(g))) {
    throw new OAuthError("invalid_client_metadata", "Only authorization_code and refresh_token grants are supported.");
  }
  const client: Client = {
    clientId: `dnc_${randomBytes(12).toString("hex")}`,
    name: String(body.client_name ?? "").slice(0, 80).trim() || "AI assistant",
    redirectUris: uris,
    clientUri: typeof body.client_uri === "string" ? body.client_uri.slice(0, 200) : undefined,
    authMethod,
    createdAt: new Date().toISOString(),
  };
  let secret: string | undefined;
  if (authMethod !== "none") {
    secret = token("dncs");
    client.secretHash = sha(secret);
  }
  await putDoc("oauth", `client_${client.clientId}`, client);
  return { client, secret };
}

export const getClient = (clientId: string) => (/^dnc_[a-f0-9]{24}$/.test(clientId) ? getDoc<Client>("oauth", `client_${clientId}`) : Promise.resolve(null));

/** Checks the request parameters of an authorization request. Returns the client, or throws a message safe to show the user. */
export async function checkAuthorizeRequest(p: URLSearchParams | Record<string, string | undefined>) {
  const get = (k: string) => (p instanceof URLSearchParams ? p.get(k) ?? undefined : p[k]);
  const client = await getClient(get("client_id") ?? "");
  if (!client) throw new OAuthError("invalid_client", "This connection link isn't recognised. Start the connection again from your AI assistant.");
  const redirectUri = get("redirect_uri") ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : "");
  if (!client.redirectUris.includes(redirectUri)) throw new OAuthError("invalid_request", "The return address doesn't match this connection. Start again from your AI assistant.");
  // From here on, errors can be returned to the client's redirect URI.
  if (get("response_type") !== "code") throw new OAuthError("unsupported_response_type", "Only response_type=code is supported.");
  const challenge = get("code_challenge") ?? "";
  if (!challenge || (get("code_challenge_method") ?? "plain") !== "S256") throw new OAuthError("invalid_request", "PKCE with S256 is required.");
  const scope = get("scope")?.split(" ").filter(Boolean) ?? [];
  if (scope.some((s) => s !== SCOPE && s !== "offline_access")) throw new OAuthError("invalid_scope", `Unknown scope. Use "${SCOPE}".`);
  return { client, redirectUri, challenge, state: get("state"), resource: get("resource") };
}

// ---------- Codes, grants and tokens ----------

export async function issueCode(input: { client: Client; userId: string; redirectUri: string; challenge: string; resource?: string }) {
  const raw = token("dn_code");
  const code: Code = {
    clientId: input.client.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    challenge: input.challenge,
    scope: SCOPE,
    resource: input.resource,
    expires: nowS() + CODE_TTL,
  };
  await putDoc("oauth", `code_${sha(raw)}`, code);
  return raw;
}

function checkClientSecret(client: Client, secret: string | undefined) {
  if (client.authMethod === "none") return;
  if (!secret || !client.secretHash || !sameHash(sha(secret), client.secretHash)) throw new OAuthError("invalid_client", "Client authentication failed.", 401);
}

async function issueTokens(grant: Grant) {
  const access = token("dn_at");
  const refresh = token("dn_rt");
  await putDoc("oauth", `at_${sha(access)}`, { grantId: grant.grantId, userId: grant.userId, expires: nowS() + ACCESS_TTL } satisfies StoredToken);
  await putDoc("oauth", `rt_${sha(refresh)}`, { grantId: grant.grantId, userId: grant.userId, expires: nowS() + REFRESH_TTL } satisfies StoredToken);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL, refresh_token: refresh, scope: grant.scope };
}

/** Records the connection on the account so the user can see and disconnect it in Settings. */
async function createGrant(userId: string, client: Client, scope: string): Promise<Grant> {
  const grant: Grant = {
    grantId: randomBytes(12).toString("hex"),
    userId,
    clientId: client.clientId,
    clientName: client.name,
    scope,
    createdAt: new Date().toISOString(),
  };
  await putDoc("oauth", `grant_${grant.grantId}`, grant);
  const db = await readDB(userId);
  db.aiConnections = [...(db.aiConnections ?? []), { grantId: grant.grantId, clientName: client.name, connectedAt: grant.createdAt }];
  await writeDB(userId, db);
  return grant;
}

export async function exchangeCode(p: { code: string; clientId: string; clientSecret?: string; redirectUri?: string; verifier: string }) {
  const id = `code_${sha(p.code)}`;
  const code = await getDoc<Code>("oauth", id);
  await deleteDoc("oauth", id); // single use, whatever happens next
  if (!code || code.expires < nowS()) throw new OAuthError("invalid_grant", "The authorization code is invalid or expired.");
  const client = await getClient(p.clientId || code.clientId);
  if (!client || client.clientId !== code.clientId) throw new OAuthError("invalid_grant", "The code was issued to a different client.");
  checkClientSecret(client, p.clientSecret);
  if (p.redirectUri && p.redirectUri !== code.redirectUri) throw new OAuthError("invalid_grant", "redirect_uri does not match.");
  const expected = createHash("sha256").update(p.verifier ?? "").digest("base64url");
  if (!p.verifier || !sameHash(expected, code.challenge)) throw new OAuthError("invalid_grant", "PKCE verification failed.");
  const grant = await createGrant(code.userId, client, code.scope);
  return issueTokens(grant);
}

export async function refresh(p: { refreshToken: string; clientId: string; clientSecret?: string }) {
  const id = `rt_${sha(p.refreshToken)}`;
  const rt = await getDoc<StoredToken>("oauth", id);
  if (!rt || rt.expires < nowS()) throw new OAuthError("invalid_grant", "The refresh token is invalid or expired.");
  const grant = await getDoc<Grant>("oauth", `grant_${rt.grantId}`);
  if (!grant) throw new OAuthError("invalid_grant", "This connection was disconnected.");
  const client = await getClient(p.clientId || grant.clientId);
  if (!client || client.clientId !== grant.clientId) throw new OAuthError("invalid_grant", "The token was issued to a different client.");
  checkClientSecret(client, p.clientSecret);
  await deleteDoc("oauth", id); // rotate
  return issueTokens(grant);
}

/** RFC 7009: revoking a token ends the whole connection. Unknown tokens are not an error. */
export async function revokeToken(raw: string) {
  for (const kind of ["at", "rt"]) {
    const t = await getDoc<StoredToken>("oauth", `${kind}_${sha(raw)}`);
    if (t) return disconnect(t.userId, t.grantId);
  }
}

export async function disconnect(userId: string, grantId: string) {
  const grant = await getDoc<Grant>("oauth", `grant_${grantId}`);
  if (grant && grant.userId === userId) await deleteDoc("oauth", `grant_${grantId}`);
  const db = await readDB(userId);
  if (db.aiConnections?.some((c) => c.grantId === grantId)) {
    db.aiConnections = db.aiConnections.filter((c) => c.grantId !== grantId);
    await writeDB(userId, db);
  }
}

/** Resolves a bearer token to the signed-in user's id and connection, or null. */
export async function authenticate(req: Request): Promise<{ userId: string; grant: Grant } | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!m) return null;
  const t = await getDoc<StoredToken>("oauth", `at_${sha(m[1])}`);
  if (!t || t.expires < nowS()) return null;
  const grant = await getDoc<Grant>("oauth", `grant_${t.grantId}`);
  if (!grant) return null;
  const last = grant.lastUsedAt ? Date.parse(grant.lastUsedAt) : 0;
  if (Date.now() - last > 10 * 60_000) {
    grant.lastUsedAt = new Date().toISOString();
    await putDoc("oauth", `grant_${grant.grantId}`, grant);
  }
  return { userId: t.userId, grant };
}

// ---------- Discovery metadata ----------

export const authServerMetadata = (req: Request) => {
  const b = baseUrl(req);
  return {
    issuer: b,
    authorization_endpoint: `${b}/oauth/authorize`,
    token_endpoint: `${b}/oauth/token`,
    registration_endpoint: `${b}/oauth/register`,
    revocation_endpoint: `${b}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: [SCOPE],
    service_documentation: `${b}/settings#ai`,
  };
};

export const protectedResourceMetadata = (req: Request) => ({
  resource: mcpUrl(req),
  authorization_servers: [baseUrl(req)],
  scopes_supported: [SCOPE],
  bearer_methods_supported: ["header"],
  resource_name: "Demand Now",
  resource_documentation: `${baseUrl(req)}/settings#ai`,
});

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS, ...headers } });

export const oauthError = (e: unknown) =>
  e instanceof OAuthError ? json({ error: e.code, error_description: e.message }, e.status) : json({ error: "server_error", error_description: "Something went wrong." }, 500);
