# Demand Now: prototype

A subscription web app for BC businesses. They upload their letterhead and connect their accounting system. The app finds invoices more than 90 days past due and sends a demand letter on the business's own letterhead, either after the user reviews it or automatically. If the debt stays unpaid, it guides the user through the next BC step.

Plan, compliance notes and decisions: https://claude.ai/artifact/67Eafc5Faje2CcGY77L5Mo

## Run it

```
npm install
npm run build && npm start      # http://localhost:3000
```

The prototype uses a sample ledger (`lib/accounting/sample.ts`) and a JSON file store (`data/db.json`, created on first write). Sending is recorded but not delivered.

## What works

- **Accounts:** sign up, log in and log out with email and password. Each account's data is kept separately. Sessions use a signed cookie.
- **Plans** (`/pricing` and `/billing`): Standard, up to 10 demand letters a month, at $99/month or $990/year. Unlimited at $249/month or $2,490/year. The header shows how many letters have been used this month. Sending is blocked without a plan or once the limit is reached, and auto-send stops at the limit.
- **One-off demand** (`/start`): no account needed. The user fills in the details for free, then sees a paywall. They can pay $75 for this one demand, or subscribe and carry the matter into their new account. Paying unlocks the letter PDF and the full step-by-step guide.
- **Payments:** Stripe Checkout handles both subscriptions and the $75 one-off, prices in CAD. The Stripe customer portal handles plan changes, card updates, invoices and cancellation. A webhook keeps plans in sync, and Stripe Tax is optional. With no Stripe keys, the app runs in demo mode.
- **Receivables dashboard** (`/`): aging buckets, the queue of invoices over 90 days, the forum each would go to, and a limitation countdown. "Run nightly sync" runs the auto-send rule.
- **Company & letterhead** (`/settings`): upload a letterhead, enter the company details and set the sending rules. Auto-send goes to business customers only.
- **Case page** (`/cases/:id`): preview the letter on your letterhead or as a firm letter, send it, mark the debt paid, request a lawyer review, and follow the BC step-by-step guide. Small Claims cases also get the Notice of Claim data.

## Put it online (Render)

1. Sign in at render.com with GitHub.
2. Choose **New > Blueprint**, pick this repository, and click **Apply**. `render.yaml` creates the web service, a 1 GB disk for data, and a session secret.
3. The site goes live at `https://demand-now.onrender.com` or similar. The Starter plan costs about US$7/month and is needed for the disk.

Without Stripe keys the site runs in demo mode. Add them later under Environment in the Render dashboard.

## Payments setup (Stripe)

1. Create a Stripe account in CAD and copy the secret key into `STRIPE_SECRET_KEY` (see `.env.example`).
2. Add a webhook endpoint at `https://<your domain>/api/billing/webhook` for these events: `checkout.session.completed` and `customer.subscription.created`, `.updated` and `.deleted`. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Turn on the customer portal in the Stripe dashboard, allowing plan switching and cancellation.
4. Once registered for GST/PST, configure Stripe Tax and set `STRIPE_AUTOMATIC_TAX=1`.

Prices are defined in `lib/plans.ts` and `lib/oneoff.ts` and sent to Stripe inline, so you don't need to create products by hand.

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
| `lib/store.ts` | JSON store, one file per account; swap for Postgres in phase 2 |
| `lib/auth.ts` | Email/password login and signed session; swap for Auth.js + Microsoft/Google sign-in |
| `lib/plans.ts`, `lib/usage.ts` | Tiers, prices and the monthly letter limit |
| `lib/stripe.ts` | Stripe Checkout, customer portal and webhook sync |
| `lib/oneoff.ts` | $75 one-off demands |

## Before launch

- Replace the letter wording with firm-authored text. CLEBC precedents are for internal firm use only.
- Have a lawyer confirm every step marked `verify` in `bc.ts` against the current Small Claims Rules and CRT rules.
- Get a Law Society practice advisor's view on court-document generation (Legal Profession Act s. 15).
- Phase 2: unified accounting API and Postgres. Phase 3: real email and registered-mail delivery. Phase 4: fill the official Notice of Claim and CRT forms.
