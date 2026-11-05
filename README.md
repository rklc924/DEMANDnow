# Demand Company: prototype

A subscription web app for BC businesses. They upload their letterhead and connect their accounting system. The app finds invoices more than 90 days past due and sends a demand letter on the business's own letterhead, either after the user reviews it or automatically. If the debt stays unpaid, it guides the user through the next BC step.

Plan, compliance notes and decisions: https://claude.ai/artifact/67Eafc5Faje2CcGY77L5Mo

## Run it

```
npm install
npm run build && npm start      # http://localhost:3000
```

The prototype uses a sample ledger (`lib/accounting/sample.ts`) and a JSON file store (`data/db.json`, created on first write). Sending is recorded but not delivered.

## What works

- **Receivables dashboard** (`/`): shows aging buckets and a queue of invoices over the threshold, with the forum each would go to and a limitation countdown. "Run nightly sync" runs the auto-send rule.
- **Company & letterhead** (`/settings`): upload a PDF/PNG/JPG letterhead, enter the company details printed on the letter, and set the sending rules. Auto-send applies to business customers only; consumer debts always wait for review.
- **Case page** (`/cases/:id`): preview the letter PDF on the letterhead, send it, mark the invoice paid, request a lawyer review (add-on), and follow the step-by-step guide for the routed forum. For Small Claims cases it also shows the Notice of Claim data sheet.

## Layout

| Path | Purpose |
| --- | --- |
| `lib/jurisdictions/bc.ts` | BC rules pack: forums, thresholds (CRT under $5k, Small Claims to $35k, lawyer above), steps, limitation |
| `lib/jurisdictions/index.ts` | Forum routing and limitation date; add `ab.ts` etc. for new provinces |
| `lib/accounting/types.ts` | Normalized customer/invoice shape a unified accounting API maps into |
| `lib/ledger.ts` | Joins ledger, letters and rules into dashboard rows |
| `lib/letters/template.ts` | Demand letter wording (placeholder: replace with firm-authored text) |
| `lib/letters/pdf.ts` | Renders the letter onto the uploaded letterhead with pdf-lib |
| `lib/send.ts` | Manual send and the nightly auto-send rule |
| `lib/store.ts` | JSON store; swap for Postgres in phase 2 |

## Before launch

- Replace the letter wording with firm-authored text. CLEBC precedents are for internal firm use only.
- Have a lawyer confirm every step marked `verify` in `bc.ts` against the current Small Claims Rules and CRT rules.
- Get a Law Society practice advisor's view on court-document generation (Legal Profession Act s. 15).
- Phase 2: unified accounting API. Phase 3: real email/mail delivery and Stripe. Phase 4: fill the official Notice of Claim and CRT forms.
