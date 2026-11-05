import { go, withUser } from "@/lib/http";
import { readDB, writeDB } from "@/lib/store";

export const POST = (req: Request) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const db = await readDB(user.id);
    // Only fields present in the submitted form change; anything absent keeps its saved value.
    const s = (k: string, prev: string) => (f.has(k) ? String(f.get(k)).trim() || prev : prev);
    const c = db.company;
    db.company = {
      ...c,
      name: s("name", c.name),
      signatory: s("signatory", c.signatory),
      signatoryTitle: s("signatoryTitle", c.signatoryTitle),
      phone: s("phone", c.phone),
      email: s("email", c.email),
      paymentInstructions: s("paymentInstructions", c.paymentInstructions),
    };
    if (f.has("thresholdDays")) {
      db.settings = {
        autoSend: f.get("autoSend") === "on",
        thresholdDays: Math.max(30, Number(f.get("thresholdDays")) || 90),
        responseDays: Math.max(7, Number(f.get("responseDays")) || 14),
      };
    }
    await writeDB(user.id, db);
    return go(req, "/settings?saved=settings");
  });
