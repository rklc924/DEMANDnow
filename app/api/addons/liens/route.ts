import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

// Turns on the Builders Lien add-on. Prototype: activates directly. Launch: Stripe checkout once the price is approved.
export const POST = (req: Request) =>
  withUser(req, async (user) => {
    const db = await readDB(user.id);
    (db.addons ??= {}).liens ??= { since: new Date().toISOString() };
    await writeDB(user.id, db);
    return go(req, "/liens");
  });
