import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

export const POST = (req: Request) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const db = await readDB(user.id);
    if (db.mailbox) {
      db.mailbox.sendEmail = f.get("sendEmail") === "on";
      db.mailbox.addReminders = f.get("addReminders") === "on";
      await writeDB(user.id, db);
    }
    return go(req, "/settings?saved=mailbox#mailbox");
  });
