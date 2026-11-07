import { acct, canSeeMatter } from "@/lib/auth";
import { LIEN_STEPS } from "@/lib/liens";
import { lienLabel, notifyOwner } from "@/lib/matters";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const step = String(f.get("step") ?? "");
    const db = await readDB(acct(user));
    const lien = db.liens?.find((l) => l.id === params.id);
    if (!lien) return go(req, "/liens");
    if (!canSeeMatter(user, db, lien.id)) return go(req, "/?noAccess=1");
    const p = ((db.progress ??= {})[params.id] ??= { done: [], docs: [] });
    p.done = f.get("done") === "1" ? [...new Set([...p.done, step])] : p.done.filter((s) => s !== step);
    await writeDB(acct(user), db);
    const title = LIEN_STEPS.find((s) => s.id === step)?.title;
    if (title) await notifyOwner(db, lien.id, user, `${f.get("done") === "1" ? "Ticked" : "Unticked"} "${title}"`, lienLabel(lien), req);
    return go(req, `/liens/${params.id}#steps`);
  });
