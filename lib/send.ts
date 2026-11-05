import { buildDemandLetter } from "./letters/template";
import { loadRows, type Row } from "./ledger";
import { writeDB, type DB } from "./store";
import { assertCanSend, usage } from "./usage";

// Prototype delivery: records the send. Phase 3 wires email (with PDF attached) and a
// Canadian print-and-mail API, and stores the delivery proof for the service guide.

function record(db: DB, row: Row, mode: "manual" | "auto") {
  buildDemandLetter(row, db.company, db.settings.responseDays);
  const sentAt = new Date();
  const deadline = new Date(sentAt);
  deadline.setDate(deadline.getDate() + db.settings.responseDays);
  db.letters.push({
    id: `L${Date.now()}${Math.floor(Math.random() * 1000)}`,
    invoiceId: row.invoice.id,
    sentAt: sentAt.toISOString(),
    channel: "email",
    mode,
    deadline: deadline.toISOString().slice(0, 10),
  });
}

export async function sendLetter(accountId: string, invoiceId: string) {
  const { db, rows } = await loadRows(accountId);
  const row = rows.find((r) => r.invoice.id === invoiceId);
  if (!row) throw new Error("Invoice not found");
  if (row.paid) throw new Error("Invoice is marked paid");
  assertCanSend(db); // throws PlanError with a user-facing message
  record(db, row, "manual");
  await writeDB(accountId, db);
}

/** Nightly job: auto-send to business debtors past the threshold with no letter yet, within the plan's monthly allowance. */
export async function runAutoSend(accountId: string): Promise<{ sent: string[]; held: number }> {
  const { db, rows } = await loadRows(accountId);
  if (!db.settings.autoSend) return { sent: [], held: 0 };
  const due = rows.filter(
    (r) => !r.paid && !r.letter && r.days >= db.settings.thresholdDays && r.customer.kind === "business" && r.daysToLimitation > 0,
  );
  const room = usage(db).remaining;
  const sending = due.slice(0, Number.isFinite(room) ? room : due.length);
  sending.forEach((r) => record(db, r, "auto"));
  await writeDB(accountId, db);
  return { sent: sending.map((r) => r.invoice.number), held: due.length - sending.length };
}
