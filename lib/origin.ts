// The public address of the app, for redirects and links in emails.
// Behind Render's proxy, req.url points at the internal server (e.g. http://localhost:10000), which a browser
// can't reach. Prefer APP_URL, then the URL Render sets automatically, then the forwarded host headers.
export function publicOrigin(req?: Request): string {
  const set = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
  if (set) return set.replace(/\/$/, "");
  if (!req) return "http://localhost:3000";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? new URL(req.url).protocol.replace(":", "");
    return `${proto}://${host.split(",")[0].trim()}`;
  }
  return new URL(req.url).origin;
}
