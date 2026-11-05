import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const step = String(f.get("step") ?? "");
    const db = await readDB(user.id);
    if (!db.liens?.some((l) => l.id === params.id)) return go(req, "/liens");
    const p = ((db.progress ??= {})[params.id] ??= { done: [], docs: [] });
    p.done = f.get("done") === "1" ? [...new Set([...p.done, step])] : p.done.filter((s) => s !== step);
    await writeDB(user.id, db);
    return go(req, `/liens/${params.id}#steps`);
  });
