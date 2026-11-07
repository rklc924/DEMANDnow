import { NextResponse } from "next/server";
import { unsubscribe } from "@/lib/notify";

// The "Stop all reminder emails" link in every reminder. GET shows a confirm button (so link scanners in mail
// filters don't unsubscribe anyone); POST switches reminders off, and is also the one-click List-Unsubscribe target.
export const dynamic = "force-dynamic";

const page = (body: string) =>
  new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reminder emails</title></head>
<body style="margin:0;background:#FBF8F1;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#14211F">
<div style="max-width:480px;margin:60px auto;padding:24px;background:#fff;border:1px solid #E7E1D3;border-radius:10px">${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  return page(`<h1 style="font-size:20px;margin-top:0">Stop reminder emails?</h1>
<p>You'll stop getting Demand Now's deadline reminder emails. Your matters, the Calendar and any reminders in your own calendar are not affected.</p>
<form method="post"><input type="hidden" name="token" value="${esc(token)}"><button style="background:#0F766E;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:600;cursor:pointer">Stop reminder emails</button></form>`);
}

export async function POST(req: Request) {
  let token = new URL(req.url).searchParams.get("token") ?? "";
  try {
    const f = await req.formData();
    token = String(f.get("token") ?? "") || token;
  } catch {
    /* one-click unsubscribe posts no token field */
  }
  const user = await unsubscribe(token);
  if (!user) return page(`<h1 style="font-size:20px;margin-top:0">That link didn't work</h1><p>Log in to Demand Now and open <b>Email reminders</b> to change your settings.</p>`);
  return page(`<h1 style="font-size:20px;margin-top:0">Reminder emails are off</h1><p>You won't get any more deadline reminders at ${esc(user.email)}. To turn them back on, log in and open <b>Email reminders</b>.</p>`);
}
