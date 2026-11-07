import { createHmac, timingSafeEqual } from "crypto";
import { acct, isAdmin, orgUsers, readUser, saveUser, type NotificationPrefs, type User } from "./auth";
import { getDoc, listDocs, putDoc } from "./db";
import { addDays, collectDeadlines, todayPacific, type Deadline } from "./deadlines";
import { publicOrigin } from "./origin";
import { sendEmail } from "./email";
import { loadRows } from "./ledger";
import { DEFAULT_REMINDER_SETTINGS, matterOwner, readDB, type DB } from "./store";
import { usage } from "./usage";

// Email reminders. Once a day (a Render cron job calls /api/cron/reminders), every subscriber gets one email
// listing what needs doing: deadlines coming up in 3 days and 1 day (their choice), and new steps that opened
// today. Dates come from lib/deadlines, so any kind of matter that registers a source is covered.
// What has been sent is logged per user in the notifications table, so nothing is sent twice.

export const LEAD_CHOICES = [
  { days: 7, label: "7 days before" },
  { days: 3, label: "3 days before" },
  { days: 1, label: "1 day before" },
  { days: 0, label: "On the day" },
];
export const DEFAULT_PREFS: NotificationPrefs = { email: true, leadDays: [3, 1], mutedStages: [] };
/** New steps are sent on the day they open. If the daily run was missed, they're still sent this many days later. */
const UPDATE_GRACE_DAYS = 7;

export const prefsFor = (u: Pick<User, "notifications">): NotificationPrefs => ({ ...DEFAULT_PREFS, ...u.notifications });

export const orgReminderSettings = (db: DB) => ({ ...DEFAULT_REMINDER_SETTINGS, ...db.reminderSettings });

/**
 * Which matters a user is reminded about. A matter assigned to someone always reaches them. Admins get every
 * matter unless they chose "only mine"; they always get matters nobody is assigned to, so nothing is missed.
 * Regular users get only their assigned matters, unless the admin allows all matters and they chose that.
 */
export function scopeFor(u: User, db: DB): "all" | "mine" {
  const chosen = prefsFor(u).scope;
  if (isAdmin(u)) return chosen ?? "all";
  return orgReminderSettings(db).memberScope === "all" ? chosen ?? "mine" : "mine";
}

/** activeIds: everyone in the organization who can still log in. A matter whose owner is gone or blocked goes to the admins. */
export function forUser(deadlines: Deadline[], u: User, db: DB, activeIds: Set<string>): Deadline[] {
  if (scopeFor(u, db) === "all") return deadlines;
  return deadlines.filter((d) => {
    const owner = matterOwner(db, d.matterId);
    if (owner && activeIds.has(owner)) return owner === u.id;
    return isAdmin(u);
  });
}

export const activeIdsOf = (users: User[]) => new Set(users.filter((u) => !u.disabled).map((u) => u.id));

interface SentLog {
  /** "<deadline key>@<date>:<slot>" -> the deadline's date, so old entries can be pruned. */
  sent: Record<string, string>;
  lastSentAt?: string;
}

export interface DueItem {
  d: Deadline;
  /** Days until the deadline (0 = today). Undefined for a new step. */
  daysLeft?: number;
  logKey: string;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / 86_400_000);

/** What should go in today's email for one user. */
export function dueToday(deadlines: Deadline[], prefs: NotificationPrefs, sent: Record<string, string>, today: string): DueItem[] {
  const muted = new Set(prefs.mutedStages);
  const leads = [...new Set(prefs.leadDays)].filter((n) => n >= 0).sort((a, b) => a - b);
  const out: DueItem[] = [];
  for (const d of deadlines) {
    if (muted.has(d.stage)) continue;
    if (d.kind === "update") {
      const logKey = `${d.key}@${d.date}:u`;
      if (d.date <= today && d.date >= addDays(today, -UPDATE_GRACE_DAYS) && !sent[logKey]) out.push({ d, logKey });
      continue;
    }
    const left = daysBetween(today, d.date);
    if (left < 0) continue;
    // The nearest reminder slot we're inside. If the run was missed, or the deadline was only just entered,
    // this sends one catch-up reminder rather than several at once.
    const slot = leads.find((n) => left <= n);
    if (slot === undefined) continue;
    const logKey = `${d.key}@${d.date}:${slot}`;
    if (!sent[logKey]) out.push({ d, daysLeft: left, logKey });
  }
  return out;
}

const fmt = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const when = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);
const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SECRET = () => process.env.SESSION_SECRET ?? "dev-only-secret-change-me";
const mac = (userId: string) => createHmac("sha256", SECRET()).update(`unsubscribe:${userId}`).digest("base64url");
export const unsubscribeToken = (userId: string) => `${userId}.${mac(userId)}`;

/** Checks the token in an unsubscribe link and switches that user's reminder emails off. */
export async function unsubscribe(token: string): Promise<User | null> {
  const [id, given] = token.split(".");
  if (!id || !given) return null;
  const a = Buffer.from(mac(id));
  const b = Buffer.from(given);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const user = await readUser(id);
  if (!user) return null;
  user.notifications = { ...prefsFor(user), email: false };
  await saveUser(user);
  return user;
}

export function composeEmail(user: User, company: string, items: DueItem[], opts: { origin: string; test?: boolean }) {
  const { origin } = opts;
  const deadlines = items.filter((i) => i.daysLeft !== undefined).sort((a, b) => a.daysLeft! - b.daysLeft!);
  const updates = items.filter((i) => i.daysLeft === undefined);
  const first = deadlines[0] ?? updates[0];
  const subject =
    (opts.test ? "Test: " : "") +
    (items.length === 1
      ? first.daysLeft !== undefined
        ? `Due ${when(first.daysLeft)}: ${first.d.title}`
        : first.d.title
      : deadlines.length
        ? `${items.length} reminders: ${deadlines.length === 1 ? "1 deadline" : `${deadlines.length} deadlines`} coming up`
        : `${items.length} next steps in Demand Now`);
  const manage = `${origin}/notifications`;
  const unsub = `${origin}/api/notifications/unsubscribe?token=${encodeURIComponent(unsubscribeToken(user.id))}`;
  const hello = `Hi ${user.name?.split(" ")[0] || "there"},`;
  const intro = opts.test
    ? `This is a test of your Demand Now reminder emails for ${company}. Here's what's coming up.`
    : `Here's what needs your attention in Demand Now for ${company}.`;
  const footer = [
    "Demand Now is software. These reminders are worked out from the dates you've entered and are legal information about BC procedure, not legal advice. Check each date against the court or tribunal's own rules. For advice on a matter, use Request lawyer review on the matter page.",
  ];

  const textItem = (i: DueItem) => [
    i.daysLeft !== undefined ? `${i.d.title} (due ${when(i.daysLeft)}, ${fmt(i.d.date)})` : `${i.d.title} (${fmt(i.d.date)})`,
    i.d.action,
    `Open: ${origin}${i.d.href}`,
  ].join("\n");
  const text = [
    hello,
    intro,
    deadlines.length ? `DEADLINES COMING UP\n\n${deadlines.map(textItem).join("\n\n")}` : "",
    updates.length ? `NEXT STEPS\n\n${updates.map(textItem).join("\n\n")}` : "",
    ...footer,
    `Choose which reminders you get: ${manage}\nStop all reminder emails: ${unsub}`,
  ].filter(Boolean).join("\n\n");

  const htmlItem = (i: DueItem) => `
    <tr><td style="padding:12px 0;border-top:1px solid #E7E1D3">
      ${i.daysLeft !== undefined ? `<div style="font-size:12px;font-weight:700;color:${i.daysLeft <= 1 ? "#B42318" : "#0F766E"};text-transform:uppercase;letter-spacing:.04em">Due ${escHtml(when(i.daysLeft))} · ${escHtml(fmt(i.d.date))}</div>` : `<div style="font-size:12px;font-weight:700;color:#0F766E;text-transform:uppercase;letter-spacing:.04em">Next step · ${escHtml(fmt(i.d.date))}</div>`}
      <div style="font-size:16px;font-weight:600;margin:4px 0">${escHtml(i.d.title)}</div>
      <div style="color:#3D4A48">${escHtml(i.d.action)}</div>
      <div style="margin-top:8px"><a href="${escHtml(origin + i.d.href)}" style="color:#0F766E;font-weight:600">Open the matter</a></div>
    </td></tr>`;
  const section = (title: string, list: DueItem[]) =>
    list.length ? `<h2 style="font-size:15px;margin:24px 0 4px;color:#0B4F4A">${title}</h2><table width="100%" cellpadding="0" cellspacing="0">${list.map(htmlItem).join("")}</table>` : "";
  const html = `<!doctype html><html><body style="margin:0;background:#FBF8F1;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#14211F">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#0B4F4A;color:#fff;padding:14px 20px;border-radius:10px 10px 0 0;font-weight:700">Demand Now <span style="color:#FFC83D">·</span> Reminders</div>
    <div style="background:#fff;padding:20px;border-radius:0 0 10px 10px;border:1px solid #E7E1D3;border-top:0">
      <p style="margin-top:0">${escHtml(hello)}</p>
      <p>${escHtml(intro)}</p>
      ${section("Deadlines coming up", deadlines)}
      ${section("Next steps", updates)}
    </div>
    <p style="font-size:12px;color:#5B6664">${escHtml(footer[0])}</p>
    <p style="font-size:12px;color:#5B6664"><a href="${escHtml(manage)}" style="color:#0F766E">Choose which reminders you get</a> · <a href="${escHtml(unsub)}" style="color:#0F766E">Stop all reminder emails</a></p>
  </div></body></html>`;

  return {
    subject,
    text,
    html,
    headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}


/** The daily run: one email per subscriber with anything due. */
export async function runReminders(opts: { today?: string; dryRun?: boolean; origin?: string } = {}) {
  const today = opts.today ?? todayPacific();
  const origin = opts.origin ?? publicOrigin();
  const everyone = await listDocs<User>("users");
  const byAccount = new Map<string, User[]>();
  for (const u of everyone) byAccount.set(acct(u), [...(byAccount.get(acct(u)) ?? []), u]);

  const summary = { today, accounts: 0, emails: 0, items: 0, errors: [] as string[] };
  for (const [accountId, all] of byAccount) {
    const members = all.filter((u) => !u.disabled && u.emailVerifiedAt && prefsFor(u).email);
    if (!members.length) continue;
    const active = activeIdsOf(all);
    try {
      const db = await readDB(accountId);
      if (!usage(db).plan) continue; // subscribers only
      if (!orgReminderSettings(db).enabled) continue; // switched off by an admin
      summary.accounts++;
      const { rows } = await loadRows(accountId, db);
      const deadlines = collectDeadlines(db, rows, today);
      for (const u of members) {
        const log = (await getDoc<SentLog>("notifications", u.id)) ?? { sent: {} };
        const items = dueToday(forUser(deadlines, u, db, active), prefsFor(u), log.sent, today);
        if (!items.length) continue;
        if (!opts.dryRun) {
          try {
            await sendEmail({ to: u.email, ...composeEmail(u, db.company.name, items, { origin }) });
          } catch (e) {
            summary.errors.push(`${u.id}: ${(e as Error).message}`);
            continue;
          }
          for (const i of items) log.sent[i.logKey] = i.d.date;
          // Forget entries for dates long gone.
          const cutoff = addDays(today, -60);
          for (const [k, date] of Object.entries(log.sent)) if (date < cutoff) delete log.sent[k];
          log.lastSentAt = new Date().toISOString();
          await putDoc("notifications", u.id, log);
        }
        summary.emails++;
        summary.items += items.length;
      }
    } catch (e) {
      summary.errors.push(`${accountId}: ${(e as Error).message}`);
    }
  }
  return summary;
}

/** For the Email reminders page: open dates in the next 60 days and when each reminder will go out. */
export function upcoming(deadlines: Deadline[], prefs: NotificationPrefs, today: string) {
  const until = addDays(today, 60);
  const muted = new Set(prefs.mutedStages);
  return deadlines
    .filter((d) => d.date >= today && d.date <= until)
    .map((d) => ({
      d,
      muted: muted.has(d.stage),
      sendOn:
        d.kind === "update"
          ? [d.date]
          : [...new Set(prefs.leadDays)].sort((a, b) => b - a).map((n) => addDays(d.date, -n)).filter((x) => x >= today),
    }));
}

/** A one-off email to the user with what's coming up, so they can see what reminders look like. Not logged. */
export async function sendTest(user: User, origin: string) {
  const db = await readDB(acct(user));
  const today = todayPacific();
  const { rows } = await loadRows(acct(user), db);
  const active = activeIdsOf(await orgUsers(acct(user)));
  const list = upcoming(forUser(collectDeadlines(db, rows, today), user, db, active), prefsFor(user), today).filter((x) => !x.muted).slice(0, 5);
  const items: DueItem[] = list.length
    ? list.map(({ d }) => ({ d, daysLeft: d.kind === "deadline" ? daysBetween(today, d.date) : undefined, logKey: "" }))
    : [{
        d: { key: "sample", matterId: "sample", stage: "demand", kind: "deadline", date: addDays(today, 3), title: "Payment deadline: Sample Customer Ltd, invoice 1001", action: "This is a sample. You have no open dates in the next 60 days, so here is what a reminder looks like.", who: "Sample Customer Ltd", href: "/calendar" },
        daysLeft: 3,
        logKey: "",
      }];
  await sendEmail({ to: user.email, ...composeEmail(user, db.company.name, items, { origin, test: true }) });
}
