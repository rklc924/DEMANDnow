import { acct, isAdmin } from "@/lib/auth";
import { cookies } from "next/headers";
import { go, withUser } from "@/lib/http";
import { exchangeCode, isProvider } from "@/lib/mailbox";
import { readDB, writeDB } from "@/lib/store";

type Ctx = { params: { provider: string } };

export const GET = (req: Request, { params }: Ctx) =>
  withUser(req, async (user) => {
    if (!isAdmin(user)) return go(req, "/?adminOnly=1");
    const url = new URL(req.url);
    const p = params.provider;
    const state = cookies().get("dn_oauth")?.value;
    const code = url.searchParams.get("code");
    if (!isProvider(p) || !code || !state || state !== url.searchParams.get("state")) {
      return go(req, `/settings?mailError=${encodeURIComponent("Connection was cancelled or expired. Try again.")}#mailbox`);
    }
    try {
      const db = await readDB(acct(user));
      const m = await exchangeCode(req, p, code);
      m.address ||= db.company.email || user.email;
      db.mailbox = m;
      await writeDB(acct(user), db);
    } catch (e) {
      return go(req, `/settings?mailError=${encodeURIComponent((e as Error).message)}#mailbox`);
    }
    return go(req, "/settings?saved=mailbox#mailbox");
  });
