If the pay-by deadline passes without payment, the matter page shows the next step under **2. If it stays unpaid**. Demand Now picks the right place for your claim and gives you a tick-box checklist to work through.

> **Tip:** This is legal information about BC procedure, not legal advice about your dispute. For advice, use **Request lawyer review** on the matter. Steps marked with a grey **confirm** tag should be checked against the current rules before you rely on them.

# Where your claim goes

Demand Now routes each debt by the amount owing:

| Amount owing | Where it goes | What happens |
| --- | --- | --- |
| Under {{CRT_MAX}} | Civil Resolution Tribunal (CRT) | An online tribunal. You apply online, serve the Dispute Notice, then a case manager helps you settle or a tribunal member decides |
| {{CRT_MAX}} to {{SMALL_CLAIMS_MAX}} | Small Claims Court (Provincial Court) | You file a Notice of Claim at a registry, serve it, and the debtor has 14 days to reply |
| Over {{SMALL_CLAIMS_MAX}} | A lawyer | Supreme Court work. Send the file for lawyer review |

Over {{SMALL_CLAIMS_MAX}}, you can choose to give up the amount above the limit to stay in Small Claims. Talk to a lawyer before deciding.

The card also shows the **claim amount** (with contractual interest if your invoice terms include it, or court-ordered interest if not) and the approximate **limitation date**. In BC you generally have {{LIMITATION_YEARS}} years from the due date to start a claim. A part payment or a written acknowledgment of the debt can extend it.

# The checklist

Below the letter is a **Checklist** for the matter's route, with a progress bar. The checklist runs the matter: tick each step as you finish it, and Demand Now moves the matter on to the next step.

- The step you're on is highlighted in yellow and marked **Current step**. The line above the list shows it too, with when its reminder is due.
- When you tick a step, the reminders for that step are removed from Demand Now and from your connected calendar, and a reminder for the next step is added. For example, ticking **File a Notice of Claim** sets a reminder to serve it.
- The first step ("Send the demand letter and let the deadline pass") ticks itself once the deadline passes.
- If you tick a later step, any earlier step you left unticked is marked **Skipped**. That's normal when a step didn't happen, such as a settlement conference when the debtor never replied. Tick it if you did do it.
- Ticked a step by mistake? Click the box again to untick it. The matter goes back to that step.
- The **Receivables** dashboard shows the step each matter is on in the **Status** column.

Anyone on your team can tick steps. Every tick is recorded in the activity log on the **Team** page.

# Funds collected

The last box on every checklist is **Funds collected**. Use it whenever the debtor pays you anything, at any step.

1. Click **Record funds collected**.
2. Enter the **Amount received** and the **Date received**. You can also add how it was paid and a note.
3. Tick **Paid in full** if this payment settles the debt. Tick it too if you agreed to settle for less than the full amount.
4. Click **Save payment**.

What happens next depends on the payment:

- **Paid in full** (or the payments add up to the full amount): the matter closes. The checklist locks, the process server booking and Notice of Claim cards are removed, and every upcoming reminder is deleted, including the ones in your connected calendar. The matter shows as **Paid** on the dashboard and **Collected** on the Calendar.
- **A part payment**: the matter stays open. The checklist shows the amount collected and the balance still owing, the dashboard shows **Part paid**, and the Notice of Claim card claims the balance. If you haven't started a claim yet, Demand Now routes the matter by the balance, so a balance under {{CRT_MAX}} moves to the CRT. Once you've ticked a step after the demand letter, the matter stays on its route.

> **Tip:** In BC, a part payment can restart the two-year limitation period. Check with a lawyer before relying on that.

The **Mark paid** button next to the demand letter does the same as recording the full balance as paid today.

You need permission to "Add, delete and mark invoices paid" to record payments. Admins always have it.

**Reopening a closed matter.** If a payment bounces or a matter was closed by mistake, an Admin can click **Reopen matter** under Funds collected, or click **Remove** next to a payment. Reopening unlocks the checklist. Payments you didn't remove stay on record.

**Small Claims checklist:**

1. Send the demand letter and let the deadline pass.
2. Choose the registry: nearest to where the debtor lives or does business, or where the transaction took place.
3. File a Notice of Claim (Form 1). Demand Now prepares the form details for you.
4. Serve the Notice of Claim. See [Serving the Notice of Claim](/help/serving-documents).
5. Wait for the Reply. If none arrives in time, apply for a default order.
6. Settlement conference or mediation, if the debtor disputes.
7. Trial.
8. Payment hearing, if the judgment isn't paid.
9. Garnishing order after judgment.

**CRT checklist:**

1. Send the demand letter and let the deadline pass.
2. Use the CRT Solution Explorer.
3. Apply online and pay the fee.
4. Serve the Dispute Notice on the debtor.
5. Facilitation with a CRT case manager.
6. Tribunal decision.
7. Enforce the order through Provincial Court.

# Uploading documents and automatic checks

Steps that need outside proof (proof of delivery, the filed claim, the Certificate of Service, the Reply, the CRT order) have an upload box. Open **What we check** to see exactly what the document must show.

When you upload, Demand Now reads the document and tests it against that step's requirements and the matter's facts: names, amounts and dates.

- A **green box** means it passed every check.
- A **red box** lists each problem as an **Error** or **Can't confirm**, and a red banner appears at the top of the matter. Fix the problems and click **Upload a corrected copy**.
- A grey box means the file was saved but couldn't be checked automatically. Check it yourself against the list.

> **Important:** Automatic checks help catch common mistakes, but they don't guarantee the court or tribunal will accept a document.

# Notice of Claim: what goes on the form

Small Claims matters show a **Notice of Claim** card with every field the form asks for, filled in from your matter: claimant, defendant and address, registry, what happened, the amount claimed and the attachments to include (invoice, contract or terms, demand letter and proof of delivery). Copy these into the form when you file at the registry or online.

# Lawyer review

Every matter has a **Request lawyer review (add-on)** button. It sends the matter's file to a lawyer, who contacts you within one business day. For claims over {{SMALL_CLAIMS_MAX}} the button reads **Send file to the firm**, because those claims need a lawyer.

Once a review is requested you can also open a **firm demand letter**, a version of the letter the reviewing lawyer can send under their own name if they take the file.
