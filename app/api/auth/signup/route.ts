import { NextResponse } from "next/server";
import { cookieOptions, createUser, SESSION_COOKIE, sessionValue } from "@/lib/auth";
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
      const db = await readDB(user.id);
      db.company = { ...draft.company, email: draft.company.email || user.email };
      db.manual = { customers: [draft.debtor], invoices: [draft.invoice] };
      await writeDB(user.id, db);
      draft.importedTo = user.id;
      await saveDraft(draft);
    }
    const res = go(req, plan ? `/billing?plan=${encodeURIComponent(plan)}` : "/billing");
    (res as NextResponse).cookies.set(SESSION_COOKIE, sessionValue(user.id), cookieOptions);
    return res;
  } catch (e) {
    return go(req, `/signup?error=${encodeURIComponent((e as Error).message)}${plan ? `&plan=${plan}` : ""}`);
  }
}
