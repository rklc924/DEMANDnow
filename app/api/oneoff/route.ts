import { go } from "@/lib/http";
import { newDraftId, saveDraft, type Draft } from "@/lib/oneoff";
import { saveUpload } from "@/lib/store";

const ALLOWED = ["application/pdf", "image/png", "image/jpeg"];

// Step 1 of the one-off flow: save what the user entered. Nothing is generated until payment.
export async function POST(req: Request) {
  const f = await req.formData();
  const s = (k: string) => String(f.get(k) ?? "").trim();
  const lines = (k: string) => s(k).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const amount = Number(s("amount").replace(/[$,]/g, ""));
  const rate = Number(s("interestRate"));
  if (!s("companyName") || !s("debtorName") || !(amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(s("dueDate"))) {
    return go(req, "/start?error=Please+fill+in+your+business+name%2C+the+debtor%2C+the+amount+and+the+due+date.");
  }

  const id = newDraftId();
  const draft: Draft = {
    id,
    createdAt: new Date().toISOString(),
    paid: false,
    company: {
      name: s("companyName"),
      signatory: s("signatory"),
      signatoryTitle: s("signatoryTitle"),
      phone: s("phone"),
      email: s("email"),
      paymentInstructions: s("paymentInstructions") || `Pay by e-transfer to ${s("email")}, or by cheque payable to ${s("companyName")}.`,
      jurisdiction: "BC",
    },
    debtor: { id: `d-${id}`, name: s("debtorName"), kind: s("debtorKind") === "consumer" ? "consumer" : "business", email: s("debtorEmail"), address: lines("debtorAddress") },
    invoice: {
      id: `m-${id}`,
      number: s("invoiceNumber") || "the account",
      customerId: `d-${id}`,
      issueDate: s("issueDate") || s("dueDate"),
      dueDate: s("dueDate"),
      amountDue: Math.round(amount * 100) / 100,
      interestRate: rate > 0 ? rate : undefined,
      description: s("description") || "goods and services",
    },
  };

  const file = f.get("letterhead");
  if (file instanceof File && file.size > 0 && ALLOWED.includes(file.type) && file.size <= 5_000_000) {
    const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
    const saved = await saveUpload(`oneoff-${id}`, `letterhead.${ext}`, new Uint8Array(await file.arrayBuffer()));
    draft.company.letterhead = { file: saved, mime: file.type };
  }

  await saveDraft(draft);
  return go(req, `/start/${id}`);
}
