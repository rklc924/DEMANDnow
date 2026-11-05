import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

export const POST = (req: Request) =>
  withUser(req, async (user) => {
    const db = await readDB(user.id);
    delete db.mailbox;
    await writeDB(user.id, db);
    return go(req, "/settings#mailbox");
  });
