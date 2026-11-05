import { buildDemandLetter } from "./letters/template";
import { loadRows, type Row } from "./ledger";
import { writeDB, type DB } from "./store";

// Prototype delivery: records the send. Phase 3 wires email (with PDF attached) and a
// Canadian print-and-mail API, and stores the delivery proof for the service guide.

function record(db: DB, row: Row, mode: "manual" | "auto") {
  const letter = buildDemandLetter(row, db.company, db.settings.responseDays);
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
  return letter;
}

export async function sendLetter(invoiceId: string) {
  const { db, rows } = await loadRows();
  const row = rows.find((r) => r.invoice.id === invoiceId);
  if (!row) throw new Error("Invoice not found");
  if (row.paid) throw new Error("Invoice is marked paid");
  record(db, row, "manual");
  await writeDB(db);
}

/** Nightly job: auto-send to business debtors past the threshold with no letter yet. Consumers always wait for review. */
export async function runAutoSend(): Promise<string[]> {
  const { db, rows } = await loadRows();
  if (!db.settings.autoSend) return [];
  const due = rows.filter(
    (r) => !r.paid && !r.letter && r.days >= db.settings.thresholdDays && r.customer.kind === "business" && r.daysToLimitation > 0,
  );
  due.forEach((r) => record(db, r, "auto"));
  await writeDB(db);
  return due.map((r) => r.invoice.number);
}
