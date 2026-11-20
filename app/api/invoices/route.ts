import { acct, can } from "@/lib/auth";
import { assignMatter, chosenAssignee } from "@/lib/matters";
import { randomBytes } from "crypto";
import type { Customer, Invoice } from "@/lib/accounting/types";
import { go, withUser } from "@/lib/http";
import { readDB, writeDB, logActivity } from "@/lib/store";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const date = (v: FormDataEntryValue | null) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : "");
const plus30 = (iso: string) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
};

// Adds an invoice entered by hand (not from the accounting sync).
export const POST = (req: Request) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const err = (m: string) => go(req, `/invoices/new?error=${encodeURIComponent(m)}`);
    const db = await readDB(acct(user));
    if (!can(user, "addMatters", db)) return go(req, "/?noPermission=1");
    const manual = (db.manual ??= { customers: [], invoices: [] });

    let customer = manual.customers.find((c) => c.id === str(f.get("customerId")));
    if (!customer) {
      const name = str(f.get("name"));
      if (!name) return err("Enter the customer's name, or pick an existing customer.");
      customer = {
        id: `MC${randomBytes(4).toString("hex")}`,
        name,
        kind: str(f.get("kind")) === "consumer" ? "consumer" : "business",
        email: str(f.get("email")),
        address: str(f.get("address")).split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
      } satisfies Customer;
      manual.customers.push(customer);
    }

    const number = str(f.get("number"));
    const amount = Number(str(f.get("amount")).replace(/[$,\s]/g, ""));
    const issueDate = date(f.get("issueDate"));
    const dueDate = date(f.get("dueDate")) || (issueDate ? plus30(issueDate) : "");
    const rate = Number(str(f.get("interestRate")).replace(/%/g, ""));
    if (!number) return err("Enter the invoice number.");
    if (!(amount > 0)) return err("Enter the amount owing.");
    if (!issueDate) return err("Enter the invoice date.");
    if (dueDate < issueDate) return err("The due date can't be before the invoice date.");
    if (manual.invoices.some((i) => i.number === number && i.customerId === customer!.id)) return err(`Invoice ${number} is already entered for ${customer.name}.`);

    const invoice: Invoice = {
      id: `MI${randomBytes(5).toString("hex")}`,
      number,
      customerId: customer.id,
      issueDate,
      dueDate,
      amountDue: Math.round(amount * 100) / 100,
      interestRate: rate > 0 ? rate : undefined,
      description: str(f.get("description")) || `Invoice ${number}`,
    };
    logActivity(db, user, `Added invoice ${number} for ${customer.name}`, `/cases/${invoice.id}`);
    manual.invoices.push(invoice);
    const assignee = chosenAssignee(user, f.has("assignee") ? str(f.get("assignee")) : null, can(user, "assignMatters", db));
    try {
      await assignMatter(db, acct(user), invoice.id, assignee, user, `invoice ${number} (${customer.name})`, req);
    } catch (e) {
      return err((e as Error).message);
    }
    await writeDB(acct(user), db);
    return go(req, `/?added=${encodeURIComponent(number)}`);
  });
