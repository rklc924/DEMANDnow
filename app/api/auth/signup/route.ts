import { NextResponse } from "next/server";
import { cookieOptions, createUser, SESSION_COOKIE, sessionValue, acct } from "@/lib/auth";
import { sendVerification } from "@/lib/authmail";
import { go } from "@/lib/http";
import { readDraft, saveDraft } from "@/lib/oneoff";
import { readDB, writeDB } from "@/lib/store";

export async function POST(req: Request) {
  const f = await req.formData();
  const plan = String(f.get("plan") ?? "");
  try {
    const user = await createUser({
      email: String(f.get("email") ?? ""),
      password: String(f.get("password") ?? ""),
      name: String(f.get("name") ?? ""),
      company: String(f.get("company") ?? ""),
    });
    // Coming from a one-off draft: carry its details and matter into the new account.
    const draft = await readDraft(String(f.get("draft") ?? ""));
    if (draft && !draft.importedTo) {
      const db = await readDB(acct(user));
      db.company = { ...draft.company, email: draft.company.email || user.email };
      db.manual = { customers: [draft.debtor], invoices: [draft.invoice] };
      await writeDB(acct(user), db);
      draft.importedTo = acct(user);
      await saveDraft(draft);
    }
    await sendVerification(req, user).catch((e) => console.error("verification email failed", e));
    // Every account adds a card first, then picks a plan.
    const res = go(req, `/billing/card${plan ? `?plan=${encodeURIComponent(plan)}` : ""}`);
    (res as NextResponse).cookies.set(SESSION_COOKIE, sessionValue(user), cookieOptions);
    return res;
  } catch (e) {
    return go(req, `/signup?error=${encodeURIComponent((e as Error).message)}${plan ? `&plan=${plan}` : ""}`);
  }
}
