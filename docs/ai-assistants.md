# Demand Now in Claude and ChatGPT

Demand Now runs a remote MCP server at `<APP_URL>/mcp`. A user connects it once from Claude or ChatGPT, signs in to Demand Now, and approves. After that, when they ask the assistant about an unpaid invoice, the assistant can work out the forum and add the matter straight into their Demand Now account.

## What the assistant can do

| Tool | What it does | Annotations |
| --- | --- | --- |
| `check_forum` | Days overdue, limitation date, and where a claim goes (CRT under $5,000, Small Claims to $35,000, lawyer above), with the steps | read-only |
| `create_demand_matter` | Saves the debtor and invoice as a new matter and returns the link to review and send | writes, not destructive |
| `list_matters` | Receivables and matters with status, forum, next step and link | read-only |
| `get_matter` | One matter's steps, what's done, deadlines and next step | read-only |

It can't send letters, file documents, take payment or see passwords. The portal's payment rules still apply:

- **Subscribers.** The matter goes onto their dashboard. Sending the letter counts against the plan, and is done in the portal.
- **No active plan.** The matter is saved as a one-off draft. The link opens the $75 one-off checkout, or the user can subscribe.

The tool replies never mention prices or push upgrades, because ChatGPT's directory doesn't allow that inside the chat.

## How it works

- **MCP:** Streamable HTTP and stateless. Every POST gets a JSON reply (`app/mcp/route.ts`, `lib/mcp.ts`).
- **OAuth 2.1:** Demand Now is its own authorization server (`lib/oauth.ts`).
  - Discovery: `/.well-known/oauth-protected-resource` (RFC 9728) and `/.well-known/oauth-authorization-server` (RFC 8414).
  - Dynamic client registration at `/oauth/register` (RFC 7591).
  - Authorization code with PKCE S256 at `/oauth/authorize`, using the consent screen.
  - Tokens at `/oauth/token`. Access tokens last 1 hour. Refresh tokens last 60 days and rotate on every use.
  - Revocation at `/oauth/revoke`.
  - Tokens and codes are stored hashed in the `oauth` table.
- **Disconnecting:** users see connected assistants under Settings > AI assistants and can disconnect them there, which ends access immediately.
- **Matters added by an assistant:** the case page shows a banner asking the user to check the legal name, address and amount before sending.
- **Prefill fallback:** for assistants without the connector, `/start` accepts the form fields in the query string, for example `/start?debtorName=Acme+Ltd&debtorKind=business&amount=7800&dueDate=2026-06-03&invoiceNumber=1042`. The keys are listed in `PREFILL_KEYS` in `lib/intake.ts`.

## Before going live

1. Set `APP_URL` to the public https address (for example `https://app.demandnow.ca`). The connector URL and OAuth metadata are built from it.
2. Publish a privacy policy, terms of service and a support page or email. Both directories require all three.
3. Create a reviewer test account with an active plan and a few sample matters. Sign-in must work with only an email and password, with no codes or magic links.

## Listing in the Claude Connectors Directory (Anthropic)

1. Test it as a custom connector first. In Claude, go to Settings > Connectors > Add custom connector, paste `<APP_URL>/mcp`, then connect and run every tool.
2. Submit at **claude.ai/directory/manage**: Submit new > MCP connector. You need a paid Claude plan.
3. Fill in the listing:
   - Name, a one-line description (up to 200 characters) and a full description
   - Categories, a docs URL (this file or a public help page), privacy policy URL, support contact, icon (`public/brand/demand-now-icon.png`) and the URL slug, which can't be changed later
4. Auth: choose OAuth with dynamic client registration. Nothing extra needs registering, because Claude registers itself.
5. Data handling: it's your own first-party API. No health data, no sponsored content.
6. Reviewer access: give the test account credentials and the steps, for example "Ask: Acme Ltd owes us $7,800 on invoice 1042, due 2026-06-03. Start a demand in Demand Now."
7. Accept the compliance acknowledgments. One is about financial transactions: the connector takes no payments.
8. Review: an automatic policy scan runs first, and some submissions also get a human review. No fixed timeline is published. The contact is mcp-review@anthropic.com.

## Listing in the ChatGPT app directory (OpenAI)

1. Test it in ChatGPT first. Turn on Developer mode (Settings > Apps & Connectors > Advanced), choose Create, paste `<APP_URL>/mcp` with OAuth, then connect and run every tool.
2. Verify the OpenAI organization (business verification) in the OpenAI Platform settings. Only an org owner, or a member with Apps Management write access, can submit.
3. Submit from the OpenAI Platform's app/plugin submission page, choosing a remote MCP server ("With MCP").
4. Domain verification: put the token OpenAI gives you in the `OPENAI_APPS_CHALLENGE` environment variable on Render. It is served at `/.well-known/openai-apps-challenge`.
5. Provide:
   - Website, support, privacy policy and terms URLs
   - Display name and short description (30 characters each), a long description, developer name, category and a square logo
   - 5 positive and 3 negative test prompts
   - A demo recording, and the test account with login steps
6. Policy points to watch:
   - **No selling digital subscriptions inside ChatGPT, and no upgrade prompts.** The connector sends users to the portal, which handles payment on our own domain.
   - Debt relief and credit repair apps are prohibited. Demand Now is a creditor-side tool, so describe it as "demand letters and BC court-process information for businesses owed money" so it isn't confused with those.
   - Legal: present it as legal information and documents, not legal advice. This matches the disclaimer every tool returns.
   - It must be suitable for ages 13 to 17, carry no ads, and work on desktop and mobile.
7. Review feedback comes by email. You can appeal a rejection by replying.

Both sets of requirements were checked on 2026-11-05 and change often. Recheck them on the submission pages before you submit.
