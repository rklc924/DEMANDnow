The Receivables page is your home screen. It shows what your customers owe, how late each invoice is, and which invoices are ready for a demand letter.

# The aging tiles

The tiles across the top add up your unpaid invoices by how late they are: not yet due, 1 to 30 days, 31 to 60, 61 to 90, and over 90 days. The over-90 tile is highlighted because those invoices are ready for a demand.

# The demand queue

The **demand queue** lists every invoice past your threshold (90 days unless you change it in [Settings](/help/settings)). For each one you see:

- **Days late** and the **balance** owing.
- **Route if unpaid:** where a claim would go in BC if the letter doesn't work. Under {{CRT_MAX}} it's the Civil Resolution Tribunal, up to {{SMALL_CLAIMS_MAX}} it's Small Claims Court, and above that it goes to a lawyer. See [If the debt stays unpaid](/help/enforcement).
- **Limitation:** how many days are left before the {{LIMITATION_YEARS}}-year limitation period ends. After that, the debt may be impossible to collect through the courts.
- **Status:**

| Status | What it means |
| --- | --- |
| Ready for demand | Past the threshold, no letter sent yet |
| Letter sent | A demand letter went out and the pay-by deadline hasn't passed |
| Deadline passed | The pay-by deadline passed without payment. Time for the next step |
| Paid | You marked it paid. The workflow has stopped |
| Limitation passed | The limitation period appears to have ended. Speak to a lawyer before doing anything else |

Under each status, a short line says where the matter is up to, such as "Ready for a demand letter" or "Next: File the Notice of Claim". The **Assigned to** column shows who is working on it.

Click **Review letter** or **Next steps** to open the matter. Consumer customers are marked with a grey **consumer** tag.

# Whose matters you see

Admins see every matter. Use **Show matters assigned to** above the tiles and click **Show** to narrow the page to one person, to yourself (**Me**), or to matters nobody has been assigned (**Nobody yet**).

Regular users see only the matters assigned to them, unless their admin allows them to see every matter. The tiles and tables add up only the matters you can see. See [Your team and user roles](/help/team).

# Coming up

The **Coming up** table shows invoices that are late but haven't reached your threshold yet, with the number of days until they do. Nothing is sent for these.

# Add an invoice by hand

If an invoice isn't coming from your accounting system, add it yourself:

1. Click **+ Add invoice**.
2. Choose an existing customer, or enter a new one: the name as it appears on your invoice, whether it's a business or an individual, their email and mailing address.
3. Enter the invoice number, amount owing, what it was for, the invoice date and the due date. Leave the due date blank to use 30 days after the invoice date.
4. If your terms charge interest on overdue amounts, enter the yearly rate. It's used in the letter and the claim.
5. Under **Assigned to**, choose who will work on it. It starts on your own name. If your admin hasn't let you assign matters, it's assigned to you.
6. Click **Add invoice**.

The invoice is tracked with the rest, and the demand workflow starts automatically once it's overdue past your threshold. You can delete an invoice you added by hand from its matter page, as long as no letter has been sent. On a team account, regular users need their admin's permission to add or delete invoices.

# The nightly sync

Each night Demand Now checks your invoices. If **auto-send** is on, it sends demand letters to **business** customers that have passed the threshold, up to your plan's monthly limit. Letters held back because you reached the limit are listed in the message after the sync. **Run nightly sync** runs the same check straight away. Only admins see this button.

> **Important:** Consumer (individual) customers are never auto-sent. You always review those letters yourself before they go out.
