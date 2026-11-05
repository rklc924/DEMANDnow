import { getUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { go } from "@/lib/http";
import { supportInbox } from "@/lib/legal";

const TOPICS: Record<string, string> = { question: "Question", billing: "Billing", service: "Booked service", privacy: "Privacy request", problem: "Problem" };

// Basic abuse limit: 5 messages per IP per hour (per instance).
const recent = new Map<string, number[]>();
const back = (req: Request, error: string) => go(req, `/support?error=${encodeURIComponent(error)}#contact`);

export async function POST(req: Request) {
  const f = await req.formData();
  const s = (k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
  if (s("website")) return go(req, "/support?sent=1"); // honeypot: bots fill hidden fields
  const name = s("name", 120);
  const email = s("email", 160);
  const message = s("message", 5000);
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || message.length < 5) return back(req, "Please add your name, a valid email and a message.");

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const times = (recent.get(ip) ?? []).filter((t) => t > Date.now() - 3_600_000);
  if (times.length >= 5) return back(req, "Too many messages. Please try again later.");
  recent.set(ip, [...times, Date.now()]);

  const user = await getUser();
  const topic = TOPICS[s("topic")] ?? "Question";
  const to = supportInbox();
  if (!to) console.warn("SUPPORT_EMAIL is not set: support message written to the log only.");
  try {
    await sendEmail({
      to: to || "support@localhost",
      replyTo: email,
      subject: `[Support] ${topic} from ${name}`,
      text: `${message}\n\n---\nFrom: ${name} <${email}>\nAccount: ${user ? `${user.email} (${user.id})` : "not signed in"}\nTopic: ${topic}`,
    });
  } catch (e) {
    console.error("support email failed", e);
    return back(req, "We couldn't send that just now. Please try again in a few minutes.");
  }
  return go(req, "/support?sent=1");
}
