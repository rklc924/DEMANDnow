import { go, withUser } from "@/lib/http";
import { runAutoSend } from "@/lib/send";

// Called by the nightly scheduler for every account (and by the "Run nightly sync" button in the prototype).
export const POST = (req: Request) =>
  withUser(req, async (user) => {
    const { sent, held } = await runAutoSend(user.id);
    return go(req, `/?autosent=${sent.length}&held=${held}`);
  });
