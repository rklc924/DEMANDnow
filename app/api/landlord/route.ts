import { acct } from "@/lib/auth";
import { randomBytes } from "crypto";
import { go, withUser } from "@/lib/http";
import { logActivity, readDB, writeDB } from "@/lib/store";
import { monthlyCharges, tenancyRules, type Tenancy } from "@/lib/tenancy";
import { applyForm, date, num, str } from "@/lib/tenancy/form";

// Opens a rent arrears file in the Landlord section: residential (RTB) or commercial lease.
export const POST = (req: Request) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const kind = str(f.get("kind")) === "commercial" ? "commercial" : "residential";
    const db = await readDB(acct(user));
    const t: Tenancy = {
      id: `TN${randomBytes(4).toString("hex")}`,
      createdAt: new Date().toISOString(),
      kind,
      jurisdiction: tenancyRules(db.company.jurisdiction || "BC").code,
      landlord: db.company.name,
      landlordAddress: "",
      tenants: [],
      street: "",
      city: "",
      monthlyRent: 0,
      rentDueDay: 1,
      charges: [],
      payments: [],
      stillOccupied: true,
    };
    applyForm(t, f);
    const firstUnpaid = date(f.get("firstUnpaid"));
    const months = Math.min(36, Math.max(0, Math.round(num(f.get("months")) ?? 0)));
    const paid = num(f.get("paidSoFar"));
    if (!t.tenants.length || !t.street || !(t.monthlyRent > 0) || !firstUnpaid || months < 1) {
      return go(req, `/landlord?kind=${kind}&error=${encodeURIComponent("Tenant name, the unit or premises address, monthly rent, the first unpaid rent date and the number of months unpaid are required.")}#new`);
    }
    t.charges = monthlyCharges(firstUnpaid, months, t.monthlyRent, t.rentDueDay);
    if (paid) t.payments.push({ id: `P${Date.now()}`, date: new Date().toISOString().slice(0, 10), amount: paid, note: "Paid toward these months before this file was opened" });
    const utilities = num(f.get("utilities"));
    if (utilities) t.charges.push({ id: `U${Date.now()}`, dueDate: t.utilitiesDemandDate ?? firstUnpaid, kind: "utilities", description: "Unpaid utilities", amount: utilities });
    (db.tenancies ??= []).push(t);
    logActivity(db, user, `Opened a ${kind} rent arrears file for ${t.street}`, `/landlord/${t.id}`);
    await writeDB(acct(user), db);
    return go(req, `/landlord/${t.id}`);
  });
