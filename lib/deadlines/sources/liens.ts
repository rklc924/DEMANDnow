import type { Deadline, DeadlineSource } from "..";
import { lienDates } from "../../liens";

// Builders lien add-on: the s. 20 filing deadline, the s. 33 action deadline, the 21-day notice and trust claims.

export const lienSource: DeadlineSource = {
  id: "liens",
  stages: [{ id: "liens", label: "Builders liens", description: "The last day to file a claim of lien, start an action, or respond to a notice to commence." }],
  collect({ db }) {
    const out: Deadline[] = [];
    for (const l of db.liens ?? []) {
      if (l.satisfied) continue;
      const who = l.civicAddress || l.owner || "your lien";
      for (const d of lienDates(l)) {
        if (d.done) continue;
        out.push({
          key: `lien-${l.id}:${d.key}`,
          stage: "liens",
          kind: "deadline",
          date: d.date,
          title: `${d.label}: ${who}`,
          action: `${d.basis.replace(/\.?$/, ".")}${d.estimate && !/estimate/i.test(d.basis) ? " This date is an estimate." : ""}`,
          who,
          href: `/liens/${l.id}`,
          matterId: l.id,
        });
      }
    }
    return out;
  },
};
