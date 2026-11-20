import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserIdByEmail, getDoc, putDoc, listDocs } from "./db";
import { createAccountDB, readDB } from "./store";

// Email + password accounts with a signed session cookie, email verification and password reset.
// Session cookies carry the user's session version, so a password reset signs out every other session.

export interface User {
  id: string;
  email: string;
  name: string;
  company: string;
  salt: string;
  hash: string;
  createdAt: string;
  emailVerifiedAt?: string;
  sessionVersion?: number;
  /** One-time tokens, stored hashed. */
  verifyToken?: { hash: string; expires: string };
  resetToken?: { hash: string; expires: string };
  /** The organization this login belongs to. Missing means the user's own organization (id = user id). */
  orgId?: string;
  /** Admin controls billing, settings, add-ons and the team. Regular users work on matters. Missing means admin. */
  role?: Role;
  /** Set by an admin to block this login. */
  disabled?: boolean;
  /** This user's own settings where they differ from the organization's defaults for regular users. */
  permissions?: PermissionMap;
}

// What regular users can do. Admins can always do everything.
// MEMBER_DEFAULTS is the built-in starting point. Each organization's admin can change it for all
// regular users on the Team page (DB.memberDefaults), and override it for one user (User.permissions).
// To add a permission: add it here with a label and a default, then check it with can() in the route.
export type Permission =
  | "seeAllMatters"
  | "addMatters"
  | "sendLetters"
  | "markPaid"
  | "deleteInvoices"
  | "assignMatters"
  | "orderServices"
  | "requestReview";
export const PERMISSIONS: { key: Permission; label: string; default: boolean }[] = [
  { key: "seeAllMatters", label: "See every matter, not just the ones assigned to them", default: false },
  { key: "addMatters", label: "Add invoices and liens", default: true },
  { key: "sendLetters", label: "Send demand letters", default: true },
  { key: "markPaid", label: "Mark invoices paid and record funds collected", default: true },
  { key: "deleteInvoices", label: "Delete invoices", default: false },
  { key: "assignMatters", label: "Assign and reassign matters", default: false },
  { key: "orderServices", label: "Order paid services (process servers, lien filings, searches)", default: false },
  { key: "requestReview", label: "Request lawyer review", default: false },
];
export const PERMISSION_LABEL = Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.label])) as Record<Permission, string>;
export const MEMBER_DEFAULTS = Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.default])) as Record<Permission, boolean>;
export type PermissionMap = Partial<Record<Permission, boolean>>;

/** What a regular user gets unless their own settings say otherwise: the organization's defaults, then the built-in ones. */
export const orgDefault = (org: { memberDefaults?: PermissionMap }, p: Permission) => org.memberDefaults?.[p] ?? MEMBER_DEFAULTS[p];

/** Admins can do everything; regular users get their own setting, else the organization's default. */
export const can = (u: Pick<User, "role" | "permissions">, p: Permission, org: { memberDefaults?: PermissionMap }) =>
  isAdmin(u) || (u.permissions?.[p] ?? orgDefault(org, p));

/** Whether this login can open a matter: admins and "see every matter" users see all, others see what's assigned to them. */
export const canSeeMatter = (u: Pick<User, "id" | "role" | "permissions">, org: { memberDefaults?: PermissionMap; owners?: Record<string, string> }, matterId: string) =>
  can(u, "seeAllMatters", org) || org.owners?.[matterId] === u.id;

/** Everyone who can log in to an organization. */
export async function orgUsers(accountId: string): Promise<User[]> {
  const all = await listDocs<User>("users");
  return all.filter((u) => acct(u) === accountId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export type Role = "admin" | "member";
export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", member: "Regular user" };

/** The organization (account) a login works in. */
export const acct = (u: Pick<User, "id" | "orgId">) => u.orgId ?? u.id;
export const isAdmin = (u: Pick<User, "role">) => (u.role ?? "admin") === "admin";

/** For callers that only hold a user id (AI assistant tokens). */
export async function accountIdForUser(userId: string) {
  const u = await readUser(userId);
  return u ? acct(u) : userId;
}

export const SESSION_COOKIE = "dc_session";
const SECRET = process.env.SESSION_SECRET ?? "dev-only-secret-change-me";
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET && process.env.NEXT_PHASE !== "phase-production-build") {
  console.warn("SESSION_SECRET is not set: sessions are signed with a development secret.");
}

const hashPassword = (password: string, salt: string) => scryptSync(password, salt, 64).toString("hex");
const sign = (value: string) => createHmac("sha256", SECRET).update(value).digest("hex");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const normalize = (email: string) => email.trim().toLowerCase();

export const readUser = (id: string) => getDoc<User>("users", id);
export const saveUser = (u: User) => putDoc("users", u.id, u);

export async function findUserByEmail(email: string): Promise<User | null> {
  const id = await findUserIdByEmail(normalize(email));
  return id ? readUser(id) : null;
}

function checkPassword(password: string) {
  if (password.length < 10) throw new Error("Password must be at least 10 characters.");
}

export async function createUser(input: { email: string; password: string; name: string; company: string; orgId?: string; role?: Role }) {
  const email = normalize(input.email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email.");
  checkPassword(input.password);
  if (await findUserIdByEmail(email)) throw new Error("An account with that email already exists.");
  const salt = randomBytes(16).toString("hex");
  const user: User = {
    id: randomBytes(8).toString("hex"),
    email,
    name: input.name.trim(),
    company: input.company.trim() || "Your company",
    salt,
    hash: hashPassword(input.password, salt),
    createdAt: new Date().toISOString(),
    sessionVersion: 1,
    ...(input.orgId ? { orgId: input.orgId, role: input.role ?? "member" } : { role: "admin" as Role }),
  };
  await saveUser(user);
  if (!input.orgId) await createAccountDB(user.id, user.company, user.email);
  return user;
}

export async function verifyLogin(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (user?.disabled) return null;
  if (!user) {
    hashPassword(password, "timing-equaliser"); // same work whether or not the account exists
    return null;
  }
  const a = Buffer.from(hashPassword(password, user.salt), "hex");
  const b = Buffer.from(user.hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b) ? user : null;
}

/** Issues a one-time token (verify: 3 days, reset: 1 hour), stores its hash and returns the raw token for the link. */
export async function issueToken(user: User, kind: "verify" | "reset"): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  const ttl = kind === "verify" ? 3 * 86_400_000 : 3_600_000;
  const t = { hash: sha(raw), expires: new Date(Date.now() + ttl).toISOString() };
  if (kind === "verify") user.verifyToken = t;
  else user.resetToken = t;
  await saveUser(user);
  return `${user.id}.${raw}`;
}

async function consume(token: string, kind: "verify" | "reset"): Promise<User | null> {
  const [id, raw] = token.split(".");
  if (!id || !raw) return null;
  const user = await readUser(id);
  const t = kind === "verify" ? user?.verifyToken : user?.resetToken;
  if (!user || !t || t.expires < new Date().toISOString()) return null;
  const a = Buffer.from(sha(raw));
  const b = Buffer.from(t.hash);
  return a.length === b.length && timingSafeEqual(a, b) ? user : null;
}

export async function verifyEmail(token: string): Promise<User | null> {
  const user = await consume(token, "verify");
  if (!user) return null;
  user.emailVerifiedAt = new Date().toISOString();
  delete user.verifyToken;
  await saveUser(user);
  return user;
}

export async function resetPassword(token: string, password: string): Promise<User | null> {
  checkPassword(password);
  const user = await consume(token, "reset");
  if (!user) return null;
  user.salt = randomBytes(16).toString("hex");
  user.hash = hashPassword(password, user.salt);
  user.sessionVersion = (user.sessionVersion ?? 1) + 1; // signs out other sessions
  user.emailVerifiedAt ??= new Date().toISOString(); // they proved they own the inbox
  delete user.resetToken;
  await saveUser(user);
  return user;
}

export const sessionValue = (user: User) => {
  const body = `${user.id}.${user.sessionVersion ?? 1}`;
  return `${body}.${sign(body)}`;
};

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
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [id, version, mac] = parts;
  const expected = Buffer.from(sign(`${id}.${version}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const user = await readUser(id);
  return user && !user.disabled && String(user.sessionVersion ?? 1) === version ? user : null;
}

/** For pages. Signed-out visitors go to /login. Unless card is false, accounts without a card on file go to add one. */
export async function requireUser(opts: { card?: boolean; admin?: boolean } = {}): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (opts.admin && !isAdmin(user)) redirect("/?adminOnly=1");
  if (opts.card !== false && isAdmin(user) && !(await readDB(acct(user))).card) redirect("/billing/card");
  return user;
}

// Basic brute-force protection: at most 10 failed logins per email or IP in 15 minutes (per instance).
const fails = new Map<string, number[]>();
export function loginBlocked(keys: string[]): boolean {
  const since = Date.now() - 15 * 60_000;
  return keys.some((k) => (fails.get(k) ?? []).filter((t) => t > since).length >= 10);
}
export function recordFailedLogin(keys: string[]) {
  const since = Date.now() - 15 * 60_000;
  for (const k of keys) fails.set(k, [...(fails.get(k) ?? []).filter((t) => t > since), Date.now()]);
}
