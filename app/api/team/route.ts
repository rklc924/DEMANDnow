import { randomBytes } from "crypto";
import { acct, createUser, isAdmin, orgUsers, readUser, saveUser, type Permission, type Role, type User } from "@/lib/auth";
import { deleteDoc } from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";
import { go, withUser } from "@/lib/http";
import { logActivity, readDB, writeDB } from "@/lib/store";
import { scryptSync } from "crypto";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const PERMS: Permission[] = ["sendLetters", "orderServices", "manageInvoices"];

// Team management for an organization's admin: add, change role, restrict, reset password, disable, delete.
export const POST = (req: Request) =>
  withUser(req, async (admin) => {
    if (!isAdmin(admin)) return go(req, "/?adminOnly=1");
    const f = await req.formData();
    const action = str(f.get("action"));
    const org = acct(admin);
    const back = (q: string) => go(req, `/team?${q}`);
    const err = (m: string) => back("error=" + encodeURIComponent(m));
    const db = await readDB(org);
    const users = await orgUsers(org);
    const admins = users.filter((u) => isAdmin(u) && !u.disabled);

    if (action === "org") {
      const name = str(f.get("orgName"));
      if (!name) return err("Enter your organization's name.");
      db.company.name = name;
      logActivity(db, admin, `Renamed the organization to ${name}`);
      await writeDB(org, db);
      return back("ok=" + encodeURIComponent("Organization name saved."));
    }

    if (action === "add") {
      const email = str(f.get("email")).toLowerCase();
      const name = str(f.get("name"));
      const role: Role = str(f.get("role")) === "admin" ? "admin" : "member";
      const password = str(f.get("password")) || randomBytes(9).toString("base64url");
      let user: User;
      try {
        user = await createUser({ email, password, name, company: db.company.name, orgId: org, role });
      } catch (e) {
        return err((e as Error).message);
      }
      logActivity(db, admin, `Added ${name || email} as ${role === "admin" ? "an admin" : "a regular user"}`);
      await writeDB(org, db);
      await sendEmail({
        to: email,
        subject: `You've been added to ${db.company.name} on Demand Now`,
        text: `Hi ${name || "there"},\n\n${admin.name || admin.email} added you to ${db.company.name} on Demand Now.\n\nLog in at ${appUrl(req)}/login with this email and the temporary password your admin gives you. You can change it with "Forgot password" at any time.\n\nDemand Now`,
      }).catch(() => undefined);
      const shown = str(f.get("password")) ? "" : `&temp=${encodeURIComponent(password)}&for=${encodeURIComponent(email)}`;
      return back("ok=" + encodeURIComponent(`${user.name || user.email} added.`) + shown);
    }

    const target = await readUser(str(f.get("userId")));
    if (!target || acct(target) !== org) return err("That user isn't in your organization.");
    const label = target.name || target.email;
    const isLastAdmin = isAdmin(target) && !target.disabled && admins.length <= 1;

    if (action === "role") {
      const role: Role = str(f.get("role")) === "admin" ? "admin" : "member";
      if (role === "member" && isLastAdmin) return err("Your organization needs at least one admin. Make someone else an admin first.");
      target.role = role;
      if (target.id === org && role === "member") target.orgId = org; // the founding login keeps the same organization
      await saveUser(target);
      logActivity(db, admin, `Made ${label} ${role === "admin" ? "an admin" : "a regular user"}`);
    } else if (action === "perms") {
      target.permissions = Object.fromEntries(PERMS.map((p) => [p, f.get(p) === "on"]));
      await saveUser(target);
      logActivity(db, admin, `Changed what ${label} can do`);
    } else if (action === "password") {
      const password = str(f.get("password"));
      if (password.length < 10) return err("Temporary passwords must be at least 10 characters.");
      const salt = randomBytes(16).toString("hex");
      target.salt = salt;
      target.hash = scryptSync(password, salt, 64).toString("hex");
      target.sessionVersion = (target.sessionVersion ?? 1) + 1; // signs them out everywhere
      target.resetToken = undefined;
      await saveUser(target);
      logActivity(db, admin, `Reset the password for ${label}`);
      await writeDB(org, db);
      return back("ok=" + encodeURIComponent(`Password reset for ${label}. They've been signed out; give them the new password.`));
    } else if (action === "disable" || action === "enable") {
      if (target.id === admin.id) return err("You can't disable your own login.");
      if (action === "disable" && isLastAdmin) return err("You can't disable the only admin.");
      target.disabled = action === "disable";
      target.sessionVersion = (target.sessionVersion ?? 1) + 1;
      await saveUser(target);
      logActivity(db, admin, `${action === "disable" ? "Blocked" : "Restored"} access for ${label}`);
    } else if (action === "delete") {
      if (target.id === admin.id) return err("You can't delete your own login.");
      if (target.id === org) return err("This is the login the organization was created with. Block it instead of deleting it.");
      if (isLastAdmin) return err("You can't delete the only admin.");
      await deleteDoc("users", target.id);
      logActivity(db, admin, `Deleted the login for ${label}`);
    } else {
      return err("Unknown action.");
    }
    await writeDB(org, db);
    return back("ok=" + encodeURIComponent("Saved."));
  });
