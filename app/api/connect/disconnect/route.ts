import { acct, isAdmin } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

export const POST = (req: Request) =>
  withUser(req, async (user) => {
    if (!isAdmin(user)) return go(req, "/?adminOnly=1");
    const db = await readDB(acct(user));
    delete db.mailbox;
    await writeDB(acct(user), db);
    return go(req, "/settings#mailbox");
  });
