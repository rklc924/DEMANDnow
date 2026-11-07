import { promises as fs } from "fs";
import path from "path";
import { Pool } from "pg";

// Storage. With DATABASE_URL set (production), everything lives in Postgres: users, account documents,
// one-off drafts and uploaded files. Without it (local development), JSON files under DATA_DIR.
// Each record is a JSON document keyed by id, which keeps the rest of the app unchanged while
// giving us transactions, backups and multiple app instances in production.

export type Table = "users" | "accounts" | "drafts" | "jobs" | "oauth" | "notifications";

export const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const usePg = () => !!process.env.DATABASE_URL;

let pool: Pool | undefined;
let ready: Promise<void> | undefined;

function pg(): Pool {
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    ssl: process.env.DATABASE_SSL === "0" ? undefined : process.env.DATABASE_URL?.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });
  return pool;
}

const SCHEMA = `
create table if not exists users (
  id text primary key,
  email text not null unique,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists accounts (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists drafts (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists jobs (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists oauth (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists notifications (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists files (
  key text primary key,
  mime text not null,
  bytes bytea not null,
  created_at timestamptz not null default now()
);
`;

/** Creates tables on first use. Safe to run on every boot. */
async function q(text: string, params: unknown[] = []) {
  ready ??= pg().query(SCHEMA).then(() => undefined);
  await ready;
  return pg().query(text, params);
}

const safe = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "");
const docFile = (table: Table, id: string) => path.join(DATA_DIR, table, `${safe(id)}.json`);

export async function getDoc<T>(table: Table, id: string): Promise<T | null> {
  if (!id) return null;
  if (usePg()) {
    const r = await q(`select data from ${table} where id = $1`, [id]);
    return (r.rows[0]?.data as T) ?? null;
  }
  try {
    return JSON.parse(await fs.readFile(docFile(table, id), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function putDoc(table: Table, id: string, data: unknown): Promise<void> {
  if (usePg()) {
    if (table === "users") {
      await q(
        `insert into users (id, email, data) values ($1, $2, $3)
         on conflict (id) do update set email = excluded.email, data = excluded.data, updated_at = now()`,
        [id, (data as { email: string }).email, data],
      );
    } else {
      await q(
        `insert into ${table} (id, data) values ($1, $2)
         on conflict (id) do update set data = excluded.data, updated_at = now()`,
        [id, data],
      );
    }
    return;
  }
  const f = docFile(table, id);
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, JSON.stringify(data, null, 2));
}

/** Every document in a table. Fine at our scale; add paging when it isn't. */
export async function listDocs<T>(table: Table): Promise<T[]> {
  if (usePg()) {
    const r = await q(`select data from ${table}`);
    return r.rows.map((x) => x.data as T);
  }
  try {
    const dir = path.join(DATA_DIR, table);
    const names = (await fs.readdir(dir)).filter((n) => n.endsWith(".json"));
    return (await Promise.all(names.map(async (n) => JSON.parse(await fs.readFile(path.join(dir, n), "utf8")) as T)));
  } catch {
    return [];
  }
}

export async function deleteDoc(table: Table, id: string): Promise<void> {
  if (!id) return;
  if (usePg()) {
    await q(`delete from ${table} where id = $1`, [id]);
    return;
  }
  await fs.rm(docFile(table, id), { force: true });
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  if (usePg()) {
    const r = await q(`select id from users where email = $1`, [email]);
    return r.rows[0]?.id ?? null;
  }
  try {
    for (const f of await fs.readdir(path.join(DATA_DIR, "users"))) {
      const u = JSON.parse(await fs.readFile(path.join(DATA_DIR, "users", f), "utf8"));
      if (u.email === email) return u.id;
    }
  } catch {
    /* no users yet */
  }
  return null;
}

/** Stores an uploaded file and returns its key. */
export async function putFile(key: string, bytes: Uint8Array, mime: string): Promise<string> {
  if (usePg()) {
    await q(
      `insert into files (key, mime, bytes) values ($1, $2, $3)
       on conflict (key) do update set mime = excluded.mime, bytes = excluded.bytes`,
      [key, mime, Buffer.from(bytes)],
    );
    return key;
  }
  const f = path.join(DATA_DIR, "files", ...key.split("/").map(safeName));
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, bytes);
  return key;
}

const safeName = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, "");

export async function getFile(key: string): Promise<Buffer> {
  // Records from before this change stored an absolute path on the server's disk.
  if (key.startsWith("/")) return fs.readFile(key);
  if (usePg()) {
    const r = await q(`select bytes from files where key = $1`, [key]);
    if (!r.rows[0]) throw new Error("File not found");
    return r.rows[0].bytes as Buffer;
  }
  return fs.readFile(path.join(DATA_DIR, "files", ...key.split("/").map(safeName)));
}

export const storageKind = () => (usePg() ? "postgres" : "files");
