import { publicOrigin } from "./origin";
import { decrypt, encrypt } from "./crypto";
import type { Mailbox, MailProvider } from "./store";

// One-touch mailbox + calendar connection. The customer signs in with Microsoft (Outlook / Microsoft 365)
// or Google (Gmail / Workspace); we then send demand letters from their own address and add follow-up
// reminders ("BFs") to their own calendar. Without the provider's client id/secret this runs in demo mode.

interface ProviderConfig {
  label: string;
  clientId?: string;
  clientSecret?: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
}

const PROVIDERS: Record<MailProvider, ProviderConfig> = {
  microsoft: {
    label: "Outlook / Microsoft 365",
    clientId: process.env.MS_CLIENT_ID,
    clientSecret: process.env.MS_CLIENT_SECRET,
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["openid", "email", "offline_access", "User.Read", "Mail.Send", "Calendars.ReadWrite"],
  },
  google: {
    label: "Gmail / Google Workspace",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  },
};

export const providerLabel = (p: MailProvider) => PROVIDERS[p].label;
export const isProvider = (p: string): p is MailProvider => p === "microsoft" || p === "google";
export const providerLive = (p: MailProvider) => !!(PROVIDERS[p].clientId && PROVIDERS[p].clientSecret);

const appUrl = (req: Request) => publicOrigin(req);
export const redirectUri = (req: Request, p: MailProvider) => `${appUrl(req)}/api/connect/${p}/callback`;

export function authorizeUrl(req: Request, p: MailProvider, state: string) {
  const c = PROVIDERS[p];
  const q = new URLSearchParams({
    client_id: c.clientId!,
    response_type: "code",
    redirect_uri: redirectUri(req, p),
    scope: c.scopes.join(" "),
    state,
    prompt: "consent",
  });
  if (p === "google") q.set("access_type", "offline");
  return `${c.authUrl}?${q}`;
}

async function tokenRequest(p: MailProvider, body: Record<string, string>) {
  const c = PROVIDERS[p];
  const res = await fetch(c.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId!, client_secret: c.clientSecret!, ...body }),
  });
  if (!res.ok) throw new Error(`${c.label} sign-in failed (${res.status})`);
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; id_token?: string };
}

const emailFromIdToken = (idToken?: string) => {
  try {
    return JSON.parse(Buffer.from(idToken!.split(".")[1], "base64url").toString()).email as string | undefined;
  } catch {
    return undefined;
  }
};

export async function exchangeCode(req: Request, p: MailProvider, code: string): Promise<Mailbox> {
  const t = await tokenRequest(p, { grant_type: "authorization_code", code, redirect_uri: redirectUri(req, p) });
  return {
    provider: p,
    address: emailFromIdToken(t.id_token) ?? "",
    connectedAt: new Date().toISOString(),
    accessToken: encrypt(t.access_token),
    refreshToken: t.refresh_token ? encrypt(t.refresh_token) : undefined,
    expiresAt: Date.now() + t.expires_in * 1000,
    sendEmail: true,
    addReminders: true,
  };
}

/** Returns a valid access token, refreshing it (and mutating the mailbox) when it has expired. */
async function accessToken(m: Mailbox): Promise<string> {
  if (m.accessToken && m.expiresAt && m.expiresAt - 60_000 > Date.now()) return decrypt(m.accessToken)!;
  const refresh = decrypt(m.refreshToken);
  if (!refresh) throw new Error("Mailbox sign-in expired. Reconnect it in Settings.");
  const t = await tokenRequest(m.provider, { grant_type: "refresh_token", refresh_token: refresh });
  m.accessToken = encrypt(t.access_token);
  if (t.refresh_token) m.refreshToken = encrypt(t.refresh_token);
  m.expiresAt = Date.now() + t.expires_in * 1000;
  return t.access_token;
}

async function call(m: Mailbox, url: string, body: unknown, contentType = "application/json") {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(m)}`, "Content-Type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${providerLabel(m.provider)} returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 202 || res.status === 204 ? {} : res.json();
}

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  attachment: { filename: string; bytes: Uint8Array };
}

export async function sendFromMailbox(m: Mailbox, mail: OutgoingMail) {
  if (m.provider === "microsoft") {
    await call(m, "https://graph.microsoft.com/v1.0/me/sendMail", {
      message: {
        subject: mail.subject,
        body: { contentType: "Text", content: mail.text },
        toRecipients: [{ emailAddress: { address: mail.to } }],
        attachments: [
          {
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: mail.attachment.filename,
            contentType: "application/pdf",
            contentBytes: Buffer.from(mail.attachment.bytes).toString("base64"),
          },
        ],
      },
      saveToSentItems: true,
    });
    return;
  }
  const boundary = `dn${Date.now()}`;
  const mime = [
    `To: ${mail.to}`,
    `Subject: ${mail.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    mail.text,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${mail.attachment.filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${mail.attachment.filename}"`,
    "",
    Buffer.from(mail.attachment.bytes).toString("base64").replace(/.{76}/g, "$&\r\n"),
    `--${boundary}--`,
  ].join("\r\n");
  await call(m, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { raw: Buffer.from(mime).toString("base64url") });
}

const nextDay = (date: string) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** Adds an all-day reminder with a morning alert. Returns the calendar's event id. */
export async function addCalendarEvent(m: Mailbox, ev: { date: string; title: string; detail: string }): Promise<string> {
  if (m.provider === "microsoft") {
    const r = (await call(m, "https://graph.microsoft.com/v1.0/me/events", {
      subject: ev.title,
      body: { contentType: "Text", content: ev.detail },
      isAllDay: true,
      start: { dateTime: `${ev.date}T00:00:00`, timeZone: "Pacific Standard Time" },
      end: { dateTime: `${nextDay(ev.date)}T00:00:00`, timeZone: "Pacific Standard Time" },
      isReminderOn: true,
      reminderMinutesBeforeStart: -540, // 9:00 am on the day
      categories: ["Demand Now"],
    })) as { id: string };
    return r.id;
  }
  const r = (await call(m, "https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    summary: ev.title,
    description: ev.detail,
    start: { date: ev.date },
    end: { date: nextDay(ev.date) },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 * 60 }] }, // 9:00 am on the day
  })) as { id: string };
  return r.id;
}

/** Deletes a reminder from the connected calendar, e.g. once its step is ticked off or the debt is collected. */
export async function removeCalendarEvent(m: Mailbox, eventId: string): Promise<void> {
  if (m.demo || eventId.startsWith("demo-")) return;
  const url =
    m.provider === "microsoft"
      ? `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`
      : `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`;
  const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${await accessToken(m)}` } });
  // Already gone (deleted by the user, or 410 Gone from Google) is fine.
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`${providerLabel(m.provider)} returned ${res.status}`);
}
