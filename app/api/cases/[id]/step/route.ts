import { acct, canSeeMatter } from "@/lib/auth";
import { loadRow } from "@/lib/ledger";
import { notifyOwner, rowLabel } from "@/lib/matters";
import { go, withUser } from "@/lib/http";
import { writeDB } from "@/lib/store";
import { applyStep } from "@/lib/workflow";

// Ticks or unticks one step on a matter's checklist, which moves the workflow to the next step (lib/workflow.ts).
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const step = String(f.get("step") ?? "");
    const done = f.get("done") === "1";
    const { db, row } = await loadRow(acct(user), params.id);
    if (!row) return go(req, "/");
    if (!canSeeMatter(user, db, params.id)) return go(req, "/?noAccess=1");
    const deadlinePassed = !!row.letter && new Date(row.letter.deadline + "T23:59:59") < new Date();
    const res = await applyStep(db, user, {
      id: row.invoice.id,
      steps: row.forum.steps,
      href: `/cases/${row.invoice.id}`,
      label: `${row.customer.name}, invoice ${row.invoice.number}`,
      forumId: row.forum.id,
      autoDone: deadlinePassed ? [row.forum.steps[0].id] : [],
    }, step, done);
    if (!res.ok) return go(req, `/cases/${params.id}${res.error === "closed" ? "?closed=1" : ""}#steps`);
    await writeDB(acct(user), db);
    const title = row.forum.steps.find((s) => s.id === step)?.title;
    if (title) await notifyOwner(db, params.id, user, `${done ? "Ticked" : "Unticked"} "${title}"`, rowLabel(row), req);
    return go(req, `/cases/${params.id}${done ? `?ticked=${encodeURIComponent(step)}` : ""}#steps`);
  });
