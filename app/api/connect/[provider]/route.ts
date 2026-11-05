import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { go, withUser } from "@/lib/http";
import { authorizeUrl, isProvider, providerLive } from "@/lib/mailbox";
import { readDB, writeDB } from "@/lib/store";

type Ctx = { params: { provider: string } };

// One-touch connect: send the user to Microsoft or Google to approve sending mail and adding calendar events.
// Demo mode (no client id/secret configured): connects a simulated mailbox so the flow can be tried.
export const POST = (req: Request, { params }: Ctx) =>
  withUser(req, async (user) => {
    const p = params.provider;
    if (!isProvider(p)) return go(req, "/settings");
    if (!providerLive(p)) {
      const db = await readDB(user.id);
      db.mailbox = { provider: p, address: db.company.email || user.email, connectedAt: new Date().toISOString(), demo: true, sendEmail: true, addReminders: true };
      await writeDB(user.id, db);
      return go(req, "/settings?saved=mailbox#mailbox");
    }
    const state = randomBytes(16).toString("hex");
    const res = NextResponse.redirect(authorizeUrl(req, p, state), 303);
    res.cookies.set("dn_oauth", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && !process.env.ALLOW_HTTP, maxAge: 600, path: "/" });
    return res;
  });
