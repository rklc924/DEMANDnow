import type { Row } from "../ledger";
import type { DB } from "../store";
import { SOURCES } from "./sources";

// Every dated step a customer has to take, across every kind of matter, in one shape. The email reminders
// (lib/notify.ts) read from here, and so can the Calendar.
//
// Each kind of matter (demand letters, builders liens, and later landlord arrears or another province) is a
// DeadlineSource in lib/deadlines/sources/. To add one, write a source file and list it in sources/index.ts.
// Nothing else needs to change: its stages appear on the Email reminders page and its dates are emailed.

export interface Stage {
  /** Stable id, stored in each user's preferences. Never rename one that has shipped. */
  id: string;
  /** Shown on the Email reminders page, e.g. "Demand letters". */
  label: string;
  /** One sentence on what this covers. */
  description: string;
}

export interface Deadline {
  /** Unique within the account and stable from day to day, e.g. "inv-123:reply". Include the date's basis, not the date. */
  key: string;
  /** The matter it belongs to (invoice id, lien id...), used for who the matter is assigned to (db.owners). */
  matterId: string;
  /** A stage id from this source's stages. */
  stage: string;
  /**
   * deadline: something must be done by this date. Reminders go out ahead of it (3 days and 1 day by default).
   * update: a new step opens on this date ("the deadline has passed, here's what to do next"). Sent once, on the day.
   */
  kind: "deadline" | "update";
  date: string; // YYYY-MM-DD
  /** Short line for the email subject and list, e.g. "Reply due from Acme Ltd". */
  title: string;
  /** What to do, in a sentence or two. */
  action: string;
  /** Who the matter is against, and a path in the app, e.g. /cases/123. */
  who: string;
  href: string;
  /** Show on the Calendar page too. Leave unset when the Calendar already shows this date another way. */
  calendar?: boolean;
}

export interface DeadlineSource {
  id: string;
  stages: Stage[];
  /** Every open deadline and update for the account. Leave out anything already done, paid or withdrawn. */
  collect(ctx: { db: DB; rows: Row[]; today: string }): Deadline[];
}

export const allStages = (): Stage[] => SOURCES.flatMap((s) => s.stages);

export function collectDeadlines(db: DB, rows: Row[], today: string): Deadline[] {
  const out: Deadline[] = [];
  for (const s of SOURCES) {
    try {
      out.push(...s.collect({ db, rows, today }));
    } catch (e) {
      console.error(`[deadlines] source ${s.id} failed: ${(e as Error).message}`);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export const addDays = (iso: string, n: number) => {
  const d = new Date(iso.slice(0, 10) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Today's date in BC, YYYY-MM-DD. Reminders are counted in Pacific time. */
export const todayPacific = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver" }).format(now);
