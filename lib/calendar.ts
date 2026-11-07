import { money } from "./aging";
import { collectDeadlines } from "./deadlines";
import type { Row } from "./ledger";
import { lienDates } from "./liens";
import type { DB } from "./store";

// Everything date-driven across all matters, for the Calendar page: deadlines, follow-ups, limitation dates,
// and matters already collected.

export type EventKind = "deadline" | "followup" | "limitation" | "collected" | "lien";

export interface CalEvent {
  date: string; // YYYY-MM-DD
  kind: EventKind;
  title: string;
  invoiceId: string;
  href: string;
  who: string;
  amount: string;
  overdue: boolean;
}

export function buildEvents(db: DB, rows: Row[], today = new Date().toISOString().slice(0, 10)): CalEvent[] {
  const out: CalEvent[] = [];
  const byInvoice = new Map(rows.map((r) => [r.invoice.id, r]));
  for (const r of rows) {
    const base = { invoiceId: r.invoice.id, href: `/cases/${r.invoice.id}`, who: r.customer.name, amount: money(r.invoice.amountDue) };
    if (r.paid) {
      out.push({ ...base, date: r.letter?.deadline ?? r.invoice.dueDate, kind: "collected", title: `Collected: ${r.invoice.number}`, overdue: false });
      continue;
    }
    if (r.letter) out.push({ ...base, date: r.letter.deadline, kind: "deadline", title: `Payment deadline: ${r.invoice.number}`, overdue: r.letter.deadline < today });
    out.push({ ...base, date: r.limitation, kind: "limitation", title: `Limitation date: ${r.invoice.number}`, overdue: r.limitation < today });
  }
  for (const m of db.reminders ?? []) {
    const r = byInvoice.get(m.invoiceId);
    if (!r || r.paid || m.title.startsWith("Payment deadline")) continue; // deadline already shown above
    out.push({ date: m.date, kind: "followup", title: m.title, invoiceId: m.invoiceId, href: `/cases/${m.invoiceId}`, who: r.customer.name, amount: money(r.invoice.amountDue), overdue: m.date < today });
  }
  for (const l of db.liens ?? []) {
    const base = { invoiceId: l.id, href: `/liens/${l.id}`, who: l.civicAddress || l.owner, amount: money(l.amount) };
    if (l.satisfied) {
      out.push({ ...base, date: l.filedDate ?? l.lastWorkDate, kind: "collected", title: `Lien paid: ${base.who}`, overdue: false });
      continue;
    }
    for (const d of lienDates(l)) {
      if (d.done) continue;
      out.push({ ...base, date: d.date, kind: "lien", title: `Lien: ${d.label}`, overdue: d.date < today });
    }
  }
  // Dates from the deadline sources that the sections above don't already show (e.g. the Reply deadline after
  // service, and any matter types added later).
  for (const d of collectDeadlines(db, rows, today)) {
    if (!d.calendar) continue;
    const r = byInvoice.get(d.href.split("/").pop() ?? "");
    out.push({ date: d.date, kind: "followup", title: d.title, invoiceId: d.key, href: d.href, who: d.who, amount: r ? money(r.invoice.amountDue) : "", overdue: d.date < today });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
