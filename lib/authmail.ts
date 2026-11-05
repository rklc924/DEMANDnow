import { issueToken, type User } from "./auth";
import { appUrl, sendEmail } from "./email";

export async function sendVerification(req: Request, user: User) {
  const token = await issueToken(user, "verify");
  await sendEmail({
    to: user.email,
    subject: "Confirm your email for Demand Now",
    text: `Hi ${user.name || "there"},\n\nConfirm your email to start sending demand letters:\n${appUrl(req)}/api/auth/verify?token=${encodeURIComponent(token)}\n\nThe link works for 3 days. If you didn't create a Demand Now account, ignore this email.\n\nDemand Now`,
  });
}

export async function sendReset(req: Request, user: User) {
  const token = await issueToken(user, "reset");
  await sendEmail({
    to: user.email,
    subject: "Reset your Demand Now password",
    text: `Hi ${user.name || "there"},\n\nReset your password here:\n${appUrl(req)}/reset?token=${encodeURIComponent(token)}\n\nThe link works for one hour. If you didn't ask for this, ignore this email; your password hasn't changed.\n\nDemand Now`,
  });
}
