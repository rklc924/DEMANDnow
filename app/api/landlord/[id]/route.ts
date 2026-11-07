import { acct, can } from "@/lib/auth";
import { go, withUser } from "@/lib/http";
import { logActivity, readDB, writeDB } from "@/lib/store";
import { applyForm, date, num, str } from "@/lib/tenancy/form";

// Updates a rent arrears file. `action` picks what the form does:
//   save (default): the details in that card; charge / payment / remove: the rent ledger;
//   paid / reopen: mark the arrears settled; review: send the file for lawyer review.
export const POST = (req: Request, { params }: { params: { id: string } }) =>
  withUser(req, async (user) => {
    const f = await req.formData();
    const db = await readDB(acct(user));
    const t = db.tenancies?.find((x) => x.id === params.id);
    if (!t) return go(req, "/landlord");
    const back = (q: string, hash = "") => go(req, `/landlord/${t.id}${q}${hash}`);
    const action = str(f.get("action")) || "save";

    if (action === "charge" || action === "payment" || action === "remove") {
      if (!can(user, "manageInvoices")) return back("?noPermission=1");
      if (action === "remove") {
        const id = str(f.get("id"));
        t.charges = t.charges.filter((c) => c.id !== id);
        t.payments = t.payments.filter((p) => p.id !== id);
      } else {
        const d = date(f.get("date"));
        const amount = num(f.get("amount"));
        if (!d || !amount) return back(`?ledgerError=${encodeURIComponent("Enter a date and an amount.")}`, "#ledger");
        if (action === "charge") {
          const kind = (["rent", "utilities", "other"] as const).find((k) => k === str(f.get("kind"))) ?? "rent";
          t.charges.push({ id: `C${Date.now()}`, dueDate: d, kind, description: str(f.get("description")) || (kind === "rent" ? "Rent" : kind === "utilities" ? "Utilities" : "Other charge"), amount });
        } else {
          t.payments.push({ id: `P${Date.now()}`, date: d, amount, note: str(f.get("note")) || undefined });
        }
      }
      await writeDB(acct(user), db);
      return back("?saved=1", "#ledger");
    }

    if (action === "paid" || action === "reopen") {
      t.satisfied = action === "paid";
      logActivity(db, user, t.satisfied ? `Marked rent arrears settled at ${t.street}` : `Reopened rent arrears file at ${t.street}`, `/landlord/${t.id}`);
      await writeDB(acct(user), db);
      return back("?saved=1");
    }

    if (action === "review") {
      t.reviewRequestedAt ??= new Date().toISOString();
      db.reviewRequests ??= [];
      if (!db.reviewRequests.some((r) => r.invoiceId === t.id)) db.reviewRequests.push({ invoiceId: t.id, requestedAt: t.reviewRequestedAt });
      logActivity(db, user, `Requested lawyer review of the rent arrears file at ${t.street}`, `/landlord/${t.id}`);
      await writeDB(acct(user), db);
      return back("?review=1");
    }

    applyForm(t, f);
    // Ticks the checklist steps the dates prove.
    const p = ((db.progress ??= {})[t.id] ??= { done: [], docs: [] });
    const auto = [t.noticeService?.date && "serve-notice", t.applicationDate && "apply", t.packageService?.date && "serve-package", t.orderDate && "decision", t.ordersServedDate && "serve-orders"].filter(Boolean) as string[];
    p.done = [...new Set([...p.done, ...auto])];
    await writeDB(acct(user), db);
    return back("?saved=1", str(f.get("section")) ? `#${str(f.get("section"))}` : "");
  });
