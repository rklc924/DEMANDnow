import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

// Ticks or unticks one step on a matter's checklist.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const step = String(f.get("step") ?? "");
    const db = await readDB(user.id);
    const p = ((db.progress ??= {})[params.id] ??= { done: [], docs: [] });
    p.done = f.get("done") === "1" ? [...new Set([...p.done, step])] : p.done.filter((s) => s !== step);
    await writeDB(user.id, db);
    return go(req, `/cases/${params.id}#steps`);
  });
