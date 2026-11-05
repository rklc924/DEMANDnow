import { go, withUser } from "@/lib/http";
import { disconnect } from "@/lib/oauth";

// Settings > AI assistants > Disconnect: ends that assistant's access straight away.
export async function POST(req: Request) {
  return withUser(req, async (user) => {
    const f = await req.formData();
    await disconnect(user.id, String(f.get("grantId") ?? ""));
    return go(req, "/settings?ai=disconnected#ai");
  }, { card: false });
}
