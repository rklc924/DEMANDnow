import { saveUser } from "@/lib/auth";
import { allStages } from "@/lib/deadlines";
import { go, withUser } from "@/lib/http";
import { LEAD_CHOICES } from "@/lib/notify";

// Saves the signed-in user's own email reminder preferences.
export const POST = (req: Request) =>
  withUser(
    req,
    async (user) => {
      const f = await req.formData();
      user.notifications = {
        email: f.get("email") === "on",
        leadDays: LEAD_CHOICES.map((c) => c.days).filter((n) => f.get(`lead${n}`) === "on"),
        mutedStages: allStages().map((s) => s.id).filter((id) => f.get(`stage_${id}`) !== "on"),
        scope: f.get("scope") === "mine" ? "mine" : f.get("scope") === "all" ? "all" : user.notifications?.scope,
      };
      await saveUser(user);
      return go(req, "/notifications?saved=1");
    },
    { card: false },
  );
