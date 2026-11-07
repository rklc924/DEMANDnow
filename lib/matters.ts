import { canSeeMatter, orgUsers, readUser, type User } from "./auth";
import { appUrl, sendEmail } from "./email";
import type { Row } from "./ledger";
import { LIEN_STEPS, type Lien } from "./liens";
import { logActivity, matterOwner, type DB } from "./store";
import { stageOf } from "./workflow";

// Matter assignment and keeping the assigned user up to date.
// Every matter (an invoice or a lien) can be assigned to one user in the organization (DB.owners).
// The assigned user is emailed when it's assigned to them, and whenever someone else moves it forward.

type Actor = { id: string; name: string; email: string };

export const matterLink = (db: DB, matterId: string) => (db.liens?.some((l) => l.id === matterId) ? `/liens/${matterId}` : `/cases/${matterId}`);

/** Users a matter can be assigned to: everyone in the organization who isn't blocked. */
export async function assignableUsers(accountId: string) {
  return (await orgUsers(accountId)).filter((u) => !u.disabled);
}

/**
 * Assigns a matter. Logs it and emails the new assignee unless they assigned it to themselves.
 * Pass assigneeId "" to unassign. Call before writeDB.
 */
export async function assignMatter(db: DB, accountId: string, matterId: string, assigneeId: string, actor: Actor, label: string, req?: Request) {
  const link = matterLink(db, matterId);
  const owners = (db.owners ??= {});
  if (!assigneeId) {
    if (!owners[matterId]) return;
    delete owners[matterId];
    logActivity(db, actor, `Unassigned ${label}`, link);
    return;
  }
  const assignee = await readUser(assigneeId);
  if (!assignee || assignee.disabled || (assignee.orgId ?? assignee.id) !== accountId) throw new Error("That user isn't in your organization.");
  if (owners[matterId] === assigneeId) return;
  owners[matterId] = assigneeId;
  const who = assignee.id === actor.id ? "themselves" : assignee.name || assignee.email;
  logActivity(db, actor, `Assigned ${label} to ${who}`, link);
  if (assignee.id !== actor.id) {
    await sendEmail({
      to: assignee.email,
      subject: `Assigned to you: ${label}`,
      text: `Hi ${assignee.name || "there"},\n\n${actor.name || actor.email} assigned ${label} to you in ${db.company.name} on Demand Now.\n\nOpen it here: ${appUrl(req)}${link}\n\nYou'll get an email when someone else moves it forward.\n\nDemand Now`,
    }).catch(() => undefined);
  }
}

/**
 * Tells the assigned user that something happened on their matter, unless they did it themselves.
 * Safe to call after writeDB; never throws.
 */
export async function notifyOwner(db: DB, matterId: string, actor: Actor | null, what: string, label: string, req?: Request) {
  const ownerId = matterOwner(db, matterId);
  if (!ownerId || ownerId === actor?.id) return;
  const owner = await readUser(ownerId).catch(() => null);
  if (!owner || owner.disabled) return;
  const by = actor ? `${actor.name || actor.email} ` : "";
  await sendEmail({
    to: owner.email,
    subject: `Update on ${label}: ${what}`,
    text: `Hi ${owner.name || "there"},\n\nAn update on ${label}, which is assigned to you: ${by}${what.charAt(0).toLowerCase() + what.slice(1)}.\n\nOpen it here: ${appUrl(req)}${matterLink(db, matterId)}\n\nDemand Now`,
  }).catch(() => undefined);
}

/** Narrows rows, liens and reminders to the matters this login can see (everything for admins). */
export function visibleTo(user: User, db: DB, rows: Row[]): { db: DB; rows: Row[] } {
  const see = (id: string) => canSeeMatter(user, db, id);
  return {
    db: { ...db, liens: db.liens?.filter((l) => see(l.id)), reminders: db.reminders?.filter((r) => see(r.invoiceId)) },
    rows: rows.filter((r) => see(r.invoice.id)),
  };
}

/** Default assignee for a new matter: regular users get their own; admins choose, defaulting to themselves. */
export function chosenAssignee(user: User, picked: string | null, canAssign: boolean) {
  if (!canAssign) return user.id;
  return picked ?? user.id;
}

export const rowLabel = (r: Row) => `invoice ${r.invoice.number} (${r.customer.name})`;
export const lienLabel = (l: Lien) => `the lien on ${l.civicAddress || l.pid || "the property"}`;

/** Where a demand matter is up to, in a few words. Follows the checklist workflow (lib/workflow.ts). */
export function rowStage(db: DB, r: Row): string {
  if (r.paid) return "Paid";
  const done = new Set(db.progress?.[r.invoice.id]?.done ?? []);
  const deadlinePassed = r.letter ? new Date(r.letter.deadline + "T23:59:59") < new Date() : false;
  if (r.letter && deadlinePassed) done.add(r.forum.steps[0]?.id ?? "demand");
  const started = [...done].some((id) => id !== r.forum.steps[0]?.id);
  if (!started) {
    if (!r.letter) return r.days >= db.settings.thresholdDays ? "Ready for a demand letter" : "Not yet overdue enough";
    if (!deadlinePassed) return "Letter sent, waiting for payment";
  }
  const { current } = stageOf(r.forum.steps, done);
  return current ? `Next: ${current.title}` : "All steps done";
}

export function lienStage(db: DB, l: Lien): string {
  if (l.satisfied || db.progress?.[l.id]?.closedAt) return "Paid";
  const done = [...(db.progress?.[l.id]?.done ?? []), ...(l.filedDate ? ["dates", "file"] : [])];
  const { current } = stageOf(LIEN_STEPS, done);
  return current ? `Next: ${current.title}` : "All steps done";
}
