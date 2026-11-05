import { acct, isAdmin } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

// Turns on the Builders Lien add-on. Prototype: activates directly. Launch: Stripe checkout once the price is approved.
export const POST = (req: Request) =>
  withUser(req, async (user) => {
    if (!isAdmin(user)) return go(req, "/?adminOnly=1");
    const db = await readDB(acct(user));
    (db.addons ??= {}).liens ??= { since: new Date().toISOString() };
    await writeDB(acct(user), db);
    return go(req, "/liens");
  });
