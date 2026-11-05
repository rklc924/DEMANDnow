import { verifyEmail } from "@/lib/auth";
import { go } from "@/lib/http";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const user = await verifyEmail(token);
  return go(req, user ? "/?verified=1" : "/login?error=link");
}
