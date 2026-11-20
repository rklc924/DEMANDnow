import { acct } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { logActivity, readDB, writeDB } from "@/lib/store";

// Admin only: organization-wide reminder rules.
export const POST = (req: Request) =>
  withUser(
    req,
    async (user) => {
      const f = await req.formData();
      const db = await readDB(acct(user));
      db.reminderSettings = {
        enabled: f.get("enabled") === "on",
        memberScope: f.get("memberScope") === "all" ? "all" : "assigned",
      };
      logActivity(db, user, `Changed the team's email reminder settings`, "/notifications");
      await writeDB(acct(user), db);
      return go(req, "/notifications?saved=team");
    },
    { admin: true },
  );
