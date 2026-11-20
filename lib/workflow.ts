import type { EnforcementStep } from "./jurisdictions/types";
import { addCalendarEvent, removeCalendarEvent } from "./mailbox";
import { logActivity, type CaseProgress, type DB, type Payment, type Reminder } from "./store";

// The matter's checklist drives its workflow. Ticking a step moves the matter to the next step: the reminders
// for the ticked step (and anything before it) are removed, and the next step's reminder is scheduled.
// Recording funds collected in full closes the matter and stops every further enforcement step and reminder.
// Shared by debt matters, builders liens and the landlord routes: anything with a list of EnforcementSteps.

type Actor = { id: string; name: string; email: string };

const APP_URL = () => process.env.APP_URL ?? "http://localhost:3000";
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const progressFor = (db: DB, matterId: string): CaseProgress => ((db.progress ??= {})[matterId] ??= { done: [], docs: [] });

export interface Stage {
  /** The step to work on now: the first unticked step after the furthest ticked one. Undefined when every step is done. */
  current?: EnforcementStep;
  /** Earlier steps left unticked once a later step was ticked (e.g. no settlement conference because there was no Reply). */
  skipped: Set<string>;
  doneCount: number;
}

export function stageOf(steps: EnforcementStep[], done: Iterable<string>): Stage {
  const d = new Set(done);
  let furthest = -1;
  steps.forEach((s, i) => { if (d.has(s.id)) furthest = i; });
  const skipped = new Set(steps.slice(0, Math.max(furthest, 0)).filter((s) => !d.has(s.id)).map((s) => s.id));
  return { current: steps.slice(furthest + 1).find((s) => !d.has(s.id)), skipped, doneCount: steps.filter((s) => d.has(s.id)).length };
}

/** Money collected on a matter so far, and what is still owing. */
export function collectedOn(db: DB, matterId: string, amountDue: number) {
  const collected = Math.round((db.progress?.[matterId]?.payments ?? []).reduce((s, p) => s + p.amount, 0) * 100) / 100;
  return { collected, balance: Math.max(0, Math.round((amountDue - collected) * 100) / 100) };
}

async function dropReminders(db: DB, keep: (r: Reminder) => boolean) {
  const gone = (db.reminders ?? []).filter((r) => !keep(r));
  if (!gone.length) return;
  db.reminders = (db.reminders ?? []).filter(keep);
  const m = db.mailbox;
  if (!m) return;
  for (const r of gone) {
    if (!r.eventId) continue;
    try {
      await removeCalendarEvent(m, r.eventId);
    } catch {
      // The reminder is gone from Demand Now either way; a stale calendar entry is harmless.
    }
  }
}

/** Removes every reminder for a matter that hasn't come up yet, here and in the connected calendar. */
export const clearReminders = (db: DB, matterId: string) => dropReminders(db, (r) => r.invoiceId !== matterId || r.date < today());

interface Matter {
  /** Invoice id for a debt matter, lien id for a lien. Also the key in db.progress. */
  id: string;
  steps: EnforcementStep[];
  /** Where the matter lives in the app, for reminder links and the activity log. */
  href: string;
  /** "Acme Ltd, invoice 1042", used in reminder titles. */
  label: string;
  /** Forum the steps belong to, pinned once the claim is started. */
  forumId?: string;
  /** Steps the app has already completed on its own (e.g. the demand deadline passed). */
  autoDone?: string[];
}

/**
 * Ticks or unticks one step and moves the workflow on. Every signed-in member of the organization may tick steps;
 * the activity log on the Team page records who did.
 */
export async function applyStep(db: DB, user: Actor, matter: Matter, stepId: string, done: boolean) {
  const step = matter.steps.find((s) => s.id === stepId);
  if (!step) return { ok: false as const, error: "Unknown step" };
  const p = progressFor(db, matter.id);
  if (p.closedAt) return { ok: false as const, error: "closed" };

  p.done = done ? [...new Set([...p.done, stepId])] : p.done.filter((s) => s !== stepId);
  // Once anything past the demand is done, keep the matter on its current route even if a part payment lowers the balance.
  if (done && matter.forumId && stepId !== matter.steps[0]?.id) p.forumId ??= matter.forumId;
  if (!p.done.some((id) => id !== matter.steps[0]?.id)) delete p.forumId;

  const index = new Map(matter.steps.map((s, i) => [s.id, i]));
  const { current } = stageOf(matter.steps, [...p.done, ...(matter.autoDone ?? [])]);
  const at = current ? index.get(current.id)! : matter.steps.length;
  // Reminders for steps before the current one are finished business; the current step and later ones stay.
  await dropReminders(db, (r) => r.invoiceId !== matter.id || !r.stepId || !index.has(r.stepId) || index.get(r.stepId)! >= at);

  if (current?.followUp && !(db.reminders ?? []).some((r) => r.invoiceId === matter.id && r.stepId === current.id)) {
    const served = db.servedDates?.[matter.id];
    const from = current.id === "reply" && served ? served : today();
    const reminder: Reminder = {
      id: `${matter.id}-step-${current.id}-${Date.now()}`,
      invoiceId: matter.id,
      stepId: current.id,
      date: addDays(from, current.followUp.days),
      title: `${current.followUp.title} (${matter.label})`,
      detail: `${current.followUp.detail} ${APP_URL()}${matter.href}`,
    };
    const m = db.mailbox;
    if (m?.addReminders && reminder.date >= today()) {
      try {
        reminder.eventId = m.demo ? `demo-${reminder.id}` : await addCalendarEvent(m, reminder);
      } catch {
        // Still shown on the Calendar page and in the .ics download.
      }
    }
    (db.reminders ??= []).push(reminder);
  }

  logActivity(db, user, `${done ? "Ticked" : "Unticked"} "${step.title}"`, matter.href);
  return { ok: true as const, next: current };
}

/**
 * Records money received from the debtor. When the total reaches the amount owing (or the user says it was paid in
 * full, e.g. a negotiated settlement), the matter closes: it's marked paid, reminders are removed, and the checklist
 * and service booking lock. A part payment lowers the balance and the workflow carries on.
 */
export async function recordCollection(
  db: DB,
  user: Actor,
  matter: { id: string; href: string; amountDue: number },
  pay: { amount: number; date: string; full: boolean; method?: string; note?: string },
) {
  const p = progressFor(db, matter.id);
  const before = collectedOn(db, matter.id, matter.amountDue);
  const amount = Math.round(pay.amount * 100) / 100;
  if (amount > 0) {
    const entry: Payment = {
      id: `P${Date.now()}${Math.floor(Math.random() * 1000)}`,
      date: pay.date,
      amount,
      method: pay.method || undefined,
      note: pay.note || undefined,
      recordedAt: new Date().toISOString(),
      recordedBy: user.name || user.email,
    };
    (p.payments ??= []).push(entry);
  }
  const after = collectedOn(db, matter.id, matter.amountDue);
  const closes = pay.full || after.balance <= 0;
  const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (closes) {
    p.closedAt = new Date().toISOString();
    if (!db.paidInvoiceIds.includes(matter.id)) db.paidInvoiceIds.push(matter.id);
    await clearReminders(db, matter.id);
    logActivity(db, user, `Recorded funds collected in full${amount > 0 ? ` (${money(amount)})` : ""}; matter closed`, matter.href);
  } else {
    logActivity(db, user, `Recorded a part payment of ${money(amount)}; ${money(after.balance)} still owing`, matter.href);
  }
  return { closed: closes, collected: after.collected, balance: after.balance, wasCollected: before.collected };
}

/** Admin only: reopens a closed matter (a cheque bounced, or it was closed by mistake). Payments stay on record. */
export function reopenMatter(db: DB, user: Actor, matter: { id: string; href: string }) {
  const p = progressFor(db, matter.id);
  delete p.closedAt;
  db.paidInvoiceIds = db.paidInvoiceIds.filter((id) => id !== matter.id);
  logActivity(db, user, "Reopened the matter", matter.href);
}

/** Removes a payment recorded by mistake. Admin only. */
export function removePayment(db: DB, user: Actor, matter: { id: string; href: string }, paymentId: string) {
  const p = progressFor(db, matter.id);
  const gone = p.payments?.find((x) => x.id === paymentId);
  if (!gone) return;
  p.payments = p.payments!.filter((x) => x.id !== paymentId);
  logActivity(db, user, `Removed a recorded payment of $${gone.amount}`, matter.href);
}
