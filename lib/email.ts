import { publicOrigin } from "./origin";
// Transactional email and SMS.
// Email: Resend (RESEND_API_KEY, EMAIL_FROM). SMS: Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM).
// Without keys, messages are written to the server log so flows can be tested locally.

export interface Attachment {
  filename: string;
  content: Uint8Array;
}

export async function sendEmail(msg: { to: string; subject: string; text: string; attachments?: Attachment[]; replyTo?: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:dev] to=${msg.to} subject="${msg.subject}" attachments=${msg.attachments?.length ?? 0}\n${msg.text}`);
    return { dev: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Demand Now <no-reply@demandnow.ca>",
      to: [msg.to],
      subject: msg.subject,
      text: msg.text,
      reply_to: msg.replyTo,
      attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })),
    }),
  });
  if (!res.ok) throw new Error(`Email failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return { dev: false };
}

export async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    console.log(`[sms:dev] to=${to}\n${body}`);
    return { dev: true };
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) throw new Error(`SMS failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return { dev: false };
}

export const appUrl = (req?: Request) => publicOrigin(req);
