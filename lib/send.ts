import { loadRows, type Row } from "./ledger";
import { renderLetterPdf } from "./letters/pdf";
import { buildDemandLetter } from "./letters/template";
import { addCalendarEvent, sendFromMailbox } from "./mailbox";
import { followUps } from "./reminders";
import { readUpload, writeDB, type DB, type LetterRecord } from "./store";
import { assertCanSend, usage } from "./usage";

// Sending a demand: record it, email it from the customer's connected mailbox (Outlook or Gmail) with the
// PDF attached, and add the follow-up reminders to their calendar. Print-and-mail is a later phase.

const APP_URL = () => process.env.APP_URL ?? "http://localhost:3000";

async function deliver(db: DB, row: Row, mode: "manual" | "auto"): Promise<LetterRecord> {
  const sentAt = new Date();
  const content = buildDemandLetter(row, db.company, db.settings.responseDays, sentAt);
  const deadline = new Date(sentAt);
  deadline.setDate(deadline.getDate() + db.settings.responseDays);
  const letter: LetterRecord = {
    id: `L${Date.now()}${Math.floor(Math.random() * 1000)}`,
    invoiceId: row.invoice.id,
    sentAt: sentAt.toISOString(),
    channel: "email",
    mode,
    deadline: deadline.toISOString().slice(0, 10),
  };
  db.letters.push(letter);

  const m = db.mailbox;
  const to = row.customer.email;
  if (m?.sendEmail && to) {
    const subject = `${content.subject} (${db.company.name})`;
    try {
      if (m.demo) {
        (db.outbox ??= []).push({ to, subject, at: letter.sentAt });
      } else {
        const lh = db.company.letterhead;
        const pdf = await renderLetterPdf(content, lh ? { bytes: await readUpload(lh.file), mime: lh.mime } : undefined);
        await sendFromMailbox(m, {
          to,
          subject,
          text: `${content.salutation}\n\nPlease see the attached demand letter regarding invoice ${row.invoice.number}. Payment is due by ${letter.deadline}.\n\n${db.company.signatory || db.company.name}\n${db.company.name}${db.company.phone ? `\n${db.company.phone}` : ""}`,
          attachment: { filename: `Demand - ${row.invoice.number}.pdf`, bytes: pdf },
        });
      }
      letter.emailedVia = m.demo ? "demo" : m.provider;
      letter.emailedTo = to;
    } catch (e) {
      letter.deliveryError = (e as Error).message;
    }
  }

  const reminders = followUps(row, letter, APP_URL());
  if (m?.addReminders) {
    for (const r of reminders) {
      try {
        r.eventId = m.demo ? `demo-${r.id}` : await addCalendarEvent(m, r);
      } catch (e) {
        letter.deliveryError ??= `Calendar: ${(e as Error).message}`;
        break;
      }
    }
  }
  (db.reminders ??= []).push(...reminders);
  return letter;
}

export async function sendLetter(accountId: string, invoiceId: string): Promise<LetterRecord> {
  const { db, rows } = await loadRows(accountId);
  const row = rows.find((r) => r.invoice.id === invoiceId);
  if (!row) throw new Error("Invoice not found");
  if (row.paid) throw new Error("Invoice is marked paid");
  assertCanSend(db); // throws PlanError with a user-facing message
  const letter = await deliver(db, row, "manual");
  await writeDB(accountId, db);
  return letter;
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
  for (const r of sending) await deliver(db, r, "auto");
  await writeDB(accountId, db);
  return { sent: sending.map((r) => r.invoice.number), held: due.length - sending.length };
}
