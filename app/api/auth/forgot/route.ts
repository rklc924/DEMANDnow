import { findUserByEmail } from "@/lib/auth";
import { sendReset } from "@/lib/authmail";
import { go } from "@/lib/http";

// Always answers the same way, so the form can't be used to find out who has an account.
export async function POST(req: Request) {
  const f = await req.formData();
  const user = await findUserByEmail(String(f.get("email") ?? ""));
  if (user) await sendReset(req, user).catch((e) => console.error("reset email failed", e));
  return go(req, "/forgot?sent=1");
}
