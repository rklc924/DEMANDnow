import { go, withUser } from "@/lib/http";
import { sendTest } from "@/lib/notify";
import { publicOrigin } from "@/lib/origin";

// Sends the signed-in user a sample reminder email with what's coming up.
export const POST = (req: Request) =>
  withUser(
    req,
    async (user) => {
      if (!user.emailVerifiedAt) return go(req, "/notifications?error=unverified");
      try {
        await sendTest(user, publicOrigin(req));
      } catch {
        return go(req, "/notifications?error=send");
      }
      return go(req, "/notifications?test=1");
    },
    { card: false },
  );
