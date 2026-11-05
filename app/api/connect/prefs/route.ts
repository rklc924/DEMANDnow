import { acct, isAdmin } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

export const POST = (req: Request) =>
  withUser(req, async (user) => {
    if (!isAdmin(user)) return go(req, "/?adminOnly=1");
    const f = await req.formData();
    const db = await readDB(acct(user));
    if (db.mailbox) {
      db.mailbox.sendEmail = f.get("sendEmail") === "on";
      db.mailbox.addReminders = f.get("addReminders") === "on";
      await writeDB(acct(user), db);
    }
    return go(req, "/settings?saved=mailbox#mailbox");
  });
