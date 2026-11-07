import { acct, canSeeMatter } from "@/lib/auth";
import { LIEN_STEPS } from "@/lib/liens";
import { lienLabel, notifyOwner } from "@/lib/matters";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";
import { applyStep } from "@/lib/workflow";

export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const step = String(f.get("step") ?? "");
    const done = f.get("done") === "1";
    const db = await readDB(acct(user));
    const lien = db.liens?.find((l) => l.id === params.id);
    if (!lien) return go(req, "/liens");
    if (!canSeeMatter(user, db, lien.id)) return go(req, "/?noAccess=1");
    const res = await applyStep(db, user, { id: lien.id, steps: LIEN_STEPS, href: `/liens/${lien.id}`, label: `lien at ${lien.civicAddress || lien.owner}`, autoDone: lien.filedDate ? ["dates", "file"] : [] }, step, done);
    if (!res.ok) return go(req, `/liens/${params.id}#steps`);
    await writeDB(acct(user), db);
    const title = LIEN_STEPS.find((s) => s.id === step)?.title;
    if (title) await notifyOwner(db, lien.id, user, `${done ? "Ticked" : "Unticked"} "${title}"`, lienLabel(lien), req);
    return go(req, `/liens/${params.id}#steps`);
  });
