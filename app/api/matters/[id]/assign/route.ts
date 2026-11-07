import { acct, can } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { loadRow } from "@/lib/ledger";
import { assignMatter, lienLabel, matterLink, rowLabel } from "@/lib/matters";
import { writeDB } from "@/lib/store";

// Assign a matter (invoice or lien) to someone in the organization, or unassign it.
// Admins, and regular users the admin allows, can do this.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const { db, row } = await loadRow(acct(user), params.id);
    const lien = db.liens?.find((l) => l.id === params.id);
    if (!row && !lien) return go(req, "/");
    const link = matterLink(db, params.id);
    if (!can(user, "assignMatters", db)) return go(req, `${link}?noPermission=1`);
    const label = lien ? lienLabel(lien) : rowLabel(row!);
    try {
      await assignMatter(db, acct(user), params.id, String(f.get("assignee") ?? ""), user, label, req);
    } catch (e) {
      return go(req, `${link}?assignError=${encodeURIComponent((e as Error).message)}#assign`);
    }
    await writeDB(acct(user), db);
    return go(req, `${link}?assigned=1#assign`);
  });
