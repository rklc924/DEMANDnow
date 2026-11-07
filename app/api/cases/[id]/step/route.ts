import { acct, canSeeMatter } from "@/lib/auth";
import { loadRow } from "@/lib/ledger";
import { notifyOwner, rowLabel } from "@/lib/matters";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

// Ticks or unticks one step on a matter's checklist.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const step = String(f.get("step") ?? "");
    const db = await readDB(acct(user));
    if (!canSeeMatter(user, db, params.id)) return go(req, "/?noAccess=1");
    const p = ((db.progress ??= {})[params.id] ??= { done: [], docs: [] });
    p.done = f.get("done") === "1" ? [...new Set([...p.done, step])] : p.done.filter((s) => s !== step);
    await writeDB(acct(user), db);
    const { row } = await loadRow(acct(user), params.id);
    const title = row?.forum.steps.find((s) => s.id === step)?.title;
    if (row && title) await notifyOwner(db, params.id, user, `${f.get("done") === "1" ? "Ticked" : "Unticked"} "${title}"`, rowLabel(row), req);
    return go(req, `/cases/${params.id}#steps`);
  });
