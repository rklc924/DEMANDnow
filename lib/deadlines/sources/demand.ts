import { addDays, type Deadline, type DeadlineSource } from "..";
import type { DB } from "../../store";

// Demand letters and the court steps after them (CRT, Small Claims, lawyer hand-off).

const stepDone = (db: DB, invoiceId: string, ...steps: string[]) => {
  const p = db.progress?.[invoiceId];
  return steps.some((s) => p?.done.includes(s) || p?.docs.some((d) => d.stepId === s));
};

export const demandSource: DeadlineSource = {
  id: "demand",
  stages: [
    { id: "demand", label: "Demand letters", description: "When an invoice is ready for a demand letter, and the letter's deadline to pay." },
    { id: "claim", label: "Starting a claim", description: "The next step once the deadline to pay passes: a CRT or Small Claims claim, or a lawyer hand-off." },
    { id: "service", label: "Service and the Reply", description: "The Reply deadline after you serve a Notice of Claim, and when you can apply for a default order." },
    { id: "limitation", label: "Limitation dates", description: "Warnings before the two-year limitation date, while no claim has been started." },
  ],
  collect({ db, rows }) {
    const out: Deadline[] = [];
    for (const r of rows) {
      if (r.paid) continue;
      const id = r.invoice.id;
      const href = `/cases/${id}`;
      const who = r.customer.name;
      const inv = `invoice ${r.invoice.number}`;
      const base = { who, href, matterId: id };
      const letter = r.letter;
      const claimStarted = stepDone(db, id, "apply", "notice", "handoff");

      if (!letter && r.daysToLimitation > 0) {
        const auto = db.settings.autoSend && r.customer.kind === "business";
        if (!auto) {
          out.push({
            ...base,
            key: `${id}:ready`,
            stage: "demand",
            kind: "update",
            date: addDays(r.invoice.dueDate, db.settings.thresholdDays),
            title: `Ready for a demand letter: ${who}, ${inv}`,
            action: `This invoice is now ${db.settings.thresholdDays} days past due. Review the demand letter Demand Now has prepared and send it.`,
          });
        }
      }

      if (letter) {
        out.push({
          ...base,
          key: `${id}:${letter.id}:pay`,
          stage: "demand",
          kind: "deadline",
          date: letter.deadline,
          title: `Payment deadline: ${who}, ${inv}`,
          action: "This is the deadline to pay given in your demand letter. If you've been paid, click Mark paid or record it under Funds collected so the reminders stop.",
        });
        if (!claimStarted) {
          out.push({
            ...base,
            key: `${id}:${letter.id}:next`,
            stage: "claim",
            kind: "update",
            date: addDays(letter.deadline, 1),
            title: r.forum.selfServe ? `Next step: start a ${r.forum.name} claim against ${who}` : `Next step: request lawyer review for ${who}`,
            action: r.forum.selfServe
              ? `The deadline to pay has passed. Open the matter and follow the step-by-step guide to prepare and file your claim.`
              : `The amount is above the Small Claims limit. Use Request lawyer review on the matter page to send the file for review.`,
          });
        }
        if (r.forum.id === "small-claims" && !db.servedDates?.[id] && !stepDone(db, id, "serve")) {
          out.push({
            ...base,
            key: `${id}:${letter.id}:filecheck`,
            stage: "claim",
            kind: "update",
            date: addDays(letter.deadline, 14),
            title: `Check: is the Notice of Claim filed and served? (${who})`,
            action: "Once you've served it, enter the date of service on the matter page to get the Reply and default order dates.",
          });
        }
      }

      const served = db.servedDates?.[id];
      if (served && r.forum.id === "small-claims") {
        if (!stepDone(db, id, "reply")) {
          out.push({
            ...base,
            key: `${id}:reply:${served}`,
            stage: "service",
            kind: "deadline",
            date: addDays(served, 14),
            title: `Reply due from ${who}`,
            action: `${who} has 14 days after service to file a Reply (30 days if served outside BC). If you receive a Reply, upload it on the matter page.`,
            calendar: true,
          });
          out.push({
            ...base,
            key: `${id}:default:${served}`,
            stage: "service",
            kind: "update",
            date: addDays(served, 15),
            title: `No Reply? You can now apply for a default order against ${who}`,
            action: "If no Reply has been filed, you can apply for a default order (31 days after service if served outside BC). Check with the registry first.",
            calendar: true,
          });
        }
      }

      if (!claimStarted && r.forum.selfServe && r.daysToLimitation > -1) {
        out.push({
          ...base,
          key: `${id}:limit60`,
          stage: "limitation",
          kind: "update",
          date: addDays(r.limitation, -60),
          title: `Limitation warning, 60 days left: ${who}, ${inv}`,
          action: `The limitation period ends ${r.limitation}. A claim must be filed before then or the debt may become unenforceable.`,
        });
        out.push({
          ...base,
          key: `${id}:limit`,
          stage: "limitation",
          kind: "deadline",
          date: r.limitation,
          title: `Limitation date: ${who}, ${inv}`,
          action: "This is the last day to start a claim for this debt. After it, the debt may become unenforceable.",
        });
      }
    }
    return out;
  },
};
