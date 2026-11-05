import { acct, isAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";
import { go, withUser } from "@/lib/http";
import { readDB, saveUpload, writeDB } from "@/lib/store";

const ALLOWED = ["application/pdf", "image/png", "image/jpeg"];

export const POST = (req: Request) =>
  withUser(req, async (user) => {
    if (!isAdmin(user)) return go(req, "/?adminOnly=1");
    const form = await req.formData();
    const file = form.get("letterhead");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Upload a PDF, PNG or JPG" }, { status: 400 });
    if (file.size > 5_000_000) return NextResponse.json({ error: "Max 5 MB" }, { status: 400 });
    const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
    const saved = await saveUpload(acct(user), `letterhead.${ext}`, new Uint8Array(await file.arrayBuffer()));
    const db = await readDB(acct(user));
    db.company.letterhead = { file: saved, mime: file.type };
    await writeDB(acct(user), db);
    return go(req, "/settings?saved=letterhead");
  });
