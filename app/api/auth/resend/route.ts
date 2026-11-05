import { sendVerification } from "@/lib/authmail";
import { go, withUser } from "@/lib/http";

export const POST = (req: Request) =>
  withUser(req, async (user) => {
    if (!user.emailVerifiedAt) await sendVerification(req, user);
    return go(req, "/?resent=1");
  }, { card: false });
