import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import path from "path";
import { createAccountDB, DATA_DIR } from "./store";

// Prototype email + password login with a signed session cookie.
// Production: swap for Auth.js with Microsoft and Google sign-in; keep getUser()/requireUser() as the seam.

export interface User {
  id: string;
  email: string;
  name: string;
  company: string;
  salt: string;
  hash: string;
  createdAt: string;
}

export const SESSION_COOKIE = "dc_session";
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SECRET = process.env.SESSION_SECRET ?? "dev-only-secret-change-me";

async function readUsers(): Promise<User[]> {
  try {
    return JSON.parse(await fs.readFile(USERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

async function writeUsers(users: User[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

const hashPassword = (password: string, salt: string) => scryptSync(password, salt, 64).toString("hex");
const sign = (value: string) => createHmac("sha256", SECRET).update(value).digest("hex");

export async function createUser(input: { email: string; password: string; name: string; company: string }) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email.");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");
  const users = await readUsers();
  if (users.some((u) => u.email === email)) throw new Error("An account with that email already exists.");
  const salt = randomBytes(16).toString("hex");
  const user: User = {
    id: randomBytes(8).toString("hex"),
    email,
    name: input.name.trim(),
    company: input.company.trim() || "Your company",
    salt,
    hash: hashPassword(input.password, salt),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeUsers(users);
  await createAccountDB(user.id, user.company, user.email);
  return user;
}

export async function verifyLogin(email: string, password: string): Promise<User | null> {
  const user = (await readUsers()).find((u) => u.email === email.trim().toLowerCase());
  if (!user) return null;
  const a = Buffer.from(hashPassword(password, user.salt), "hex");
  const b = Buffer.from(user.hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b) ? user : null;
}

export const sessionValue = (userId: string) => `${userId}.${sign(userId)}`;

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
  secure: process.env.NODE_ENV === "production" && !process.env.ALLOW_HTTP,
};

export async function getUser(): Promise<User | null> {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [id, mac] = raw.split(".");
  if (!id || !mac) return null;
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return (await readUsers()).find((u) => u.id === id) ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
