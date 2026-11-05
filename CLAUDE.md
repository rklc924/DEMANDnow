# Demand Now

BC demand letter and enforcement app (Next.js 14, Postgres, hosted on Render). See README.md for layout and setup.

## Keep the user manual up to date (required for every feature PR)

The customer user manual lives in the app at `/help`. Its chapters are Markdown files in `content/manual/`, listed in `content/manual/index.json`. It ships with the code, so it has to change in the same PR as the feature.

In every PR that adds or changes something a customer can see or do:

1. Update the chapter that covers it, or add a new chapter (a `.md` file plus an entry in `index.json`). Describe what the user clicks and what happens, in plain language and full sentences, using the button and page names exactly as they appear in the app.
2. Add any new page route to that chapter's `routes` in `index.json`. Pages customers never see go under `notCovered` with a reason.
3. Never type prices, fees or limits into the Markdown. Use a `{{TOKEN}}` and add it to `MANUAL_TOKENS` in `lib/manual.ts`, reading the same constant the app charges with.
4. Add a line to `content/manual/whats-new.md` under the current month.
5. Run `npm run check:manual`. CI runs it on every PR and fails if a page has no chapter, a token is unknown, a help link is broken or a price is hard-coded.

Bug fixes and internal changes with no visible effect don't need a manual change.

## Wording rules

- Demand Now is software, not a legal services business. Say the software generates letters and fills in forms. Never say a lawyer drafted or wrote the letters.
- Enforcement content is legal information about BC procedure, not legal advice. Point users to "Request lawyer review" for advice.
- Use the firm's own demand letter wording, never CLEBC text (internal firm use only).
