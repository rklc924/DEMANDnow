// One-time import of a prototype's file data (DATA_DIR) into Postgres (DATABASE_URL).
// Usage: DATA_DIR=/var/data DATABASE_URL=postgres://... node scripts/import-files.mjs
import { promises as fs } from "fs";
import path from "path";
import pg from "pg";

const dir = process.env.DATA_DIR ?? "./data";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes("localhost") ? undefined : { rejectUnauthorized: false } });
const readJson = async (f) => JSON.parse(await fs.readFile(f, "utf8"));
const list = async (d) => fs.readdir(d).catch(() => []);

await pool.query(`create table if not exists users (id text primary key, email text not null unique, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists accounts (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists drafts (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists jobs (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists files (key text primary key, mime text not null, bytes bytea not null, created_at timestamptz not null default now());`);

const mime = (f) => (f.endsWith(".pdf") ? "application/pdf" : f.endsWith(".png") ? "image/png" : "image/jpeg");
let n = { users: 0, accounts: 0, drafts: 0, files: 0 };

// Prototype users.json (single file) and the newer users/ folder.
const legacy = await readJson(path.join(dir, "users.json")).catch(() => []);
const users = [...legacy];
for (const f of await list(path.join(dir, "users"))) users.push(await readJson(path.join(dir, "users", f)));
for (const u of users) {
  u.sessionVersion ??= 1;
  await pool.query(`insert into users (id, email, data) values ($1,$2,$3) on conflict (id) do nothing`, [u.id, u.email, u]);
  n.users++;
}

for (const id of await list(path.join(dir, "accounts"))) {
  const base = path.join(dir, "accounts", id);
  const db = await readJson(path.join(base, "db.json")).catch(() => null);
  if (!db) continue;
  // Re-home uploads from absolute paths into the files table.
  const rehome = async (p) => {
    if (!p || !p.startsWith("/")) return p;
    const key = `${id}/${path.basename(p)}`;
    const bytes = await fs.readFile(p).catch(() => null);
    if (!bytes) return p;
    await pool.query(`insert into files (key, mime, bytes) values ($1,$2,$3) on conflict (key) do nothing`, [key, mime(p), bytes]);
    n.files++;
    return key;
  };
  if (db.company?.letterhead) db.company.letterhead.file = await rehome(db.company.letterhead.file);
  for (const prog of Object.values(db.progress ?? {})) for (const d of prog.docs ?? []) d.file = await rehome(d.file);
  await pool.query(`insert into accounts (id, data) values ($1,$2) on conflict (id) do nothing`, [id, db]);
  n.accounts++;
}

for (const f of [...(await list(path.join(dir, "oneoff"))), ...(await list(path.join(dir, "drafts")))]) {
  const d = await readJson(path.join(dir, (await list(path.join(dir, "oneoff"))).includes(f) ? "oneoff" : "drafts", f));
  await pool.query(`insert into drafts (id, data) values ($1,$2) on conflict (id) do nothing`, [d.id, d]);
  n.drafts++;
}
console.log("imported", n);
await pool.end();
