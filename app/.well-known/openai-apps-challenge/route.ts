// OpenAI app directory domain verification: set OPENAI_APPS_CHALLENGE to the token from the OpenAI platform.
export const dynamic = "force-dynamic";

export function GET() {
  const t = process.env.OPENAI_APPS_CHALLENGE;
  return t ? new Response(t, { headers: { "Content-Type": "text/plain" } }) : new Response("Not configured", { status: 404 });
}
