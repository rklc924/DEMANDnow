import { PLANS } from "./plans";
import type { DB } from "./store";

// Plan enforcement. Each demand letter sent counts as one matter in the calendar month it is sent.

export function lettersThisMonth(db: DB, now = new Date()) {
  const ym = now.toISOString().slice(0, 7);
  return db.letters.filter((l) => l.sentAt.slice(0, 7) === ym).length;
}

export function usage(db: DB) {
  const sub = db.subscription?.status === "active" ? db.subscription : undefined;
  const plan = sub ? PLANS[sub.plan] : undefined;
  const used = lettersThisMonth(db);
  const limit = plan ? plan.letterLimit : 0;
  const remaining = !plan ? 0 : limit === null ? Infinity : Math.max(0, limit - used);
  return { sub, plan, used, limit, remaining };
}

export class PlanError extends Error {}

export function assertCanSend(db: DB) {
  const u = usage(db);
  if (!u.plan) throw new PlanError("Choose a plan to start sending demand letters.");
  if (u.remaining < 1)
    throw new PlanError(
      `You've used all ${u.limit} letters on the ${u.plan.name} plan this month. Upgrade to Unlimited to keep sending.`,
    );
}
