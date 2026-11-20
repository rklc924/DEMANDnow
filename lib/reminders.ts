import type { Row } from "./ledger";
import type { LetterRecord, Reminder } from "./store";

// The follow-up reminders ("BF" dates) created when a demand letter goes out. They go into the
// connected calendar, and are always available as an .ics file for any other calendar app.

const addDays = (iso: string, n: number) => {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function followUps(row: Row, letter: LetterRecord, appUrl: string): Reminder[] {
  const { invoice, customer, forum } = row;
  const link = `${appUrl}/cases/${invoice.id}`;
  const who = `${customer.name}, invoice ${invoice.number}`;
  // Each reminder is tagged with the checklist step it chases, so ticking that step removes it (lib/workflow.ts).
  const claimStep = forum.steps.find((s) => s.startsClaim)?.id ?? forum.steps[1]?.id;
  const list: Omit<Reminder, "id">[] = [
    {
      invoiceId: invoice.id,
      date: letter.deadline,
      stepId: forum.steps[0]?.id,
      title: `Payment deadline: ${who}`,
      detail: `The demand letter's deadline to pay is today. If you've been paid, record the funds collected in Demand Now. ${link}`,
    },
    {
      invoiceId: invoice.id,
      date: addDays(letter.deadline, 1),
      stepId: claimStep,
      title: `If unpaid, next step: ${forum.selfServe ? `start a ${forum.name} claim` : "send to a lawyer"} (${who})`,
      detail: forum.selfServe
        ? `The deadline has passed. Open the step-by-step guide to prepare and file your claim. ${link}`
        : `The amount is above the Small Claims limit. Send the file for lawyer review. ${link}`,
    },
  ];
  if (forum.id === "small-claims") {
    list.push({
      invoiceId: invoice.id,
      date: addDays(letter.deadline, 14),
      stepId: "serve",
      title: `Check: Notice of Claim filed and served? (${who})`,
      detail: `If you've served it, enter the service date in Demand Now to get the Reply and default-order dates. ${link}`,
    });
  }
  const warn = addDays(row.limitation, -60);
  if (warn > letter.sentAt.slice(0, 10)) {
    list.push({
      invoiceId: invoice.id,
      date: warn,
      stepId: claimStep,
      title: `Limitation warning, 60 days left: ${who}`,
      detail: `The two-year limitation period ends ${row.limitation}. A claim must be filed before then or the debt may be unenforceable. ${link}`,
    });
  }
  return list.map((r, i) => ({ ...r, id: `${letter.id}-${i}` }));
}

const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
const compact = (d: string) => d.replace(/-/g, "");

/** An iCalendar file of reminders, for Apple Calendar or any app not connected directly. */
export function toIcs(reminders: Reminder[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const events = reminders.map((r) =>
    [
      "BEGIN:VEVENT",
      `UID:${r.id}@demandnow`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(r.date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(r.date, 1))}`,
      `SUMMARY:${esc(r.title)}`,
      `DESCRIPTION:${esc(r.detail)}`,
      "BEGIN:VALARM",
      "TRIGGER:PT9H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(r.title)}`,
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n"),
  );
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Demand Now//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR", ""].join("\r\n");
}
