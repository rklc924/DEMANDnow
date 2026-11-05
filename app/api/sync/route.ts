import { acct, can } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { runAutoSend } from "@/lib/send";

// Called by the nightly scheduler for every account (and by the "Run nightly sync" button in the prototype).
export const POST = (req: Request) =>
  withUser(req, async (user) => {
    if (!can(user, "sendLetters")) return go(req, "/?noPermission=1");
    if (!user.emailVerifiedAt) return go(req, "/?unverified=1");
    const { sent, held } = await runAutoSend(acct(user));
    return go(req, `/?autosent=${sent.length}&held=${held}`);
  });
