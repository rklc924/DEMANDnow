import { accountIdForUser, can, readUser, type User } from "./auth";
import { bucketFor, daysOverdue, money } from "./aging";
import { getJurisdiction, limitationDate, routeForum } from "./jurisdictions";
import { createMatterForUser, parseMatter } from "./intake";
import { loadRows, type Row } from "./ledger";
import { baseUrl } from "./oauth";
import { assignMatter, visibleTo } from "./matters";
import { readDB, writeDB, type DB } from "./store";
import { usage } from "./usage";

// Demand Now MCP server (Model Context Protocol, Streamable HTTP, stateless JSON responses).
// Claude (custom connectors / Connectors Directory) and ChatGPT (apps and connectors) call it at /mcp
// with an OAuth bearer token for the user's Demand Now account. The tools collect overdue-invoice
// details in the chat and hand them into the portal; letters are reviewed and sent from the portal.

export const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05", "2025-11-25"];
const SERVER_INFO = { name: "demand-now", title: "Demand Now", version: "1.0.0" };

const INSTRUCTIONS = `Demand Now prepares demand letters for overdue invoices and guides British Columbia businesses through collection: Civil Resolution Tribunal (under $5,000), Small Claims Court ($5,000 to $35,000), or a lawyer above that.
Use these tools when the user wants to collect an unpaid invoice, chase aging accounts receivable, or send a demand letter in BC.
Workflow: collect the debtor's legal name, whether they are a business or an individual, their mailing address and email, the invoice number, amount owing (CAD), due date and what it was for. Call check_forum to explain where the claim would go, then create_demand_matter once the user confirms the details. Give the user the matter_url so they can review and send the letter in Demand Now.
Demand Now provides legal information and documents, not legal advice. Don't tell the user a letter has been sent: letters are reviewed and sent from the portal.`;

type Json = Record<string, unknown>;
interface Ctx {
  /** The organization's account id. */
  userId: string;
  /** The person who connected the assistant: what they can see and do applies here too. */
  user: User | null;
  clientName: string;
  base: string;
}

interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Json;
  outputSchema?: Json;
  annotations: Json;
  run(args: Json, ctx: Ctx): Promise<{ text: string; data: Json }>;
}

const matterProps = {
  debtor_name: { type: "string", description: "Legal name of the person or company that owes the money. For a company, its exact registered name if known." },
  debtor_type: { type: "string", enum: ["business", "individual"], description: "business for a company or sole proprietor's business, individual for a consumer. Letters to individuals always wait for the user's review." },
  debtor_email: { type: "string", description: "Debtor's email address, if known." },
  debtor_address: { type: "string", description: "Debtor's mailing address, one line per row (street, then city, province and postal code)." },
  amount_owing: { type: "number", description: "Outstanding balance in Canadian dollars, excluding interest." },
  due_date: { type: "string", description: "Date the invoice was due, YYYY-MM-DD." },
  invoice_number: { type: "string", description: "Invoice or account number." },
  invoice_date: { type: "string", description: "Invoice date, YYYY-MM-DD." },
  interest_rate: { type: "number", description: "Annual interest rate on overdue amounts stated in the invoice terms, as a percentage. Leave out if the terms don't state one." },
  description: { type: "string", description: "What the invoice was for, e.g. landscaping services." },
};

function forumFacts(jurisdiction: string, amount: number, dueDate: string) {
  const j = getJurisdiction(jurisdiction);
  const forum = routeForum(j, amount);
  const days = daysOverdue(dueDate);
  const lim = limitationDate(j, dueDate);
  const daysToLimitation = Math.ceil((lim.getTime() - Date.now()) / 86_400_000);
  return { j, forum, days, lim: lim.toISOString().slice(0, 10), daysToLimitation };
}

function rowSummary(r: Row, db: DB, base: string) {
  const done = db.progress?.[r.invoice.id]?.done ?? [];
  const next = r.forum.steps.find((s) => !done.includes(s.id));
  return {
    matter_id: r.invoice.id,
    debtor: r.customer.name,
    debtor_type: r.customer.kind === "consumer" ? "individual" : "business",
    invoice_number: r.invoice.number,
    amount_owing: r.invoice.amountDue,
    due_date: r.invoice.dueDate,
    days_overdue: r.days,
    aging_bucket: r.bucket,
    forum: r.forum.name,
    status: r.paid ? "paid" : r.letter ? (r.letter.deadline < new Date().toISOString().slice(0, 10) ? "deadline passed" : "letter sent") : "no letter yet",
    letter_sent: r.letter?.sentAt.slice(0, 10) ?? null,
    payment_deadline: r.letter?.deadline ?? null,
    limitation_date: r.limitation,
    next_step: r.paid ? null : next?.title ?? null,
    steps_done: done.length,
    steps_total: r.forum.steps.length,
    matter_url: `${base}/cases/${r.invoice.id}`,
  };
}

const TOOLS: Tool[] = [
  {
    name: "check_forum",
    title: "Check where an unpaid invoice would go",
    description:
      "For an unpaid invoice in British Columbia, work out how overdue it is, the limitation deadline, and where a claim would go if the demand letter is ignored (Civil Resolution Tribunal under $5,000, Small Claims Court up to $35,000, a lawyer above that), with the steps involved. Read-only; nothing is saved.",
    inputSchema: {
      type: "object",
      properties: { amount_owing: matterProps.amount_owing, due_date: matterProps.due_date, debtor_type: matterProps.debtor_type },
      required: ["amount_owing", "due_date"],
      additionalProperties: false,
    },
    annotations: { title: "Check where an unpaid invoice would go", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a, ctx) {
      const amount = Number(a.amount_owing);
      const due = String(a.due_date ?? "");
      if (!(amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error("Give amount_owing (CAD) and due_date (YYYY-MM-DD).");
      const db = await readDB(ctx.userId);
      const f = forumFacts(db.company.jurisdiction || "BC", amount, due);
      const consumer = a.debtor_type === "individual";
      const data = {
        jurisdiction: f.j.name,
        amount_owing: amount,
        days_overdue: f.days,
        aging_bucket: bucketFor(f.days),
        over_90_days: f.days > 90,
        forum: f.forum.name,
        self_serve: f.forum.selfServe,
        forum_summary: f.forum.summary,
        steps: f.forum.steps.map((s) => s.title),
        limitation_date: f.lim,
        days_to_limitation: f.daysToLimitation,
        limitation_note: f.j.limitation.note,
        review_required: consumer,
        disclaimer: f.j.disclaimer,
      };
      const lines = [
        `${money(amount)}, ${f.days > 0 ? `${f.days} days past due` : "not yet due"}.`,
        f.daysToLimitation <= 0
          ? `The two-year limitation date (${f.lim}) may have passed. The user should speak to a lawyer before sending a demand.`
          : `Limitation date: ${f.lim} (${f.daysToLimitation} days left to start a claim).`,
        `If the demand is ignored: ${f.forum.name}. ${f.forum.summary}`,
        f.forum.selfServe ? `Steps: ${data.steps.join("; ")}.` : "Demand Now hands claims of this size to a lawyer.",
        consumer ? "Demands to individuals always wait for the user's review before sending." : "",
        f.j.disclaimer,
      ];
      return { text: lines.filter(Boolean).join("\n"), data };
    },
  },
  {
    name: "create_demand_matter",
    title: "Start a demand in Demand Now",
    description:
      "Save an unpaid invoice to the user's Demand Now account as a new matter, ready for them to review and send a demand letter on their letterhead. Confirm the details with the user first. Returns a link where the user reviews it and sends the letter from Demand Now. Does not send anything or charge the user.",
    inputSchema: {
      type: "object",
      properties: {
        ...matterProps,
        creditor: {
          type: "object",
          description: "The user's own business, only needed if their Demand Now profile is incomplete.",
          properties: {
            name: { type: "string" },
            signatory: { type: "string", description: "Person who signs the letter." },
            signatory_title: { type: "string" },
            phone: { type: "string" },
            email: { type: "string" },
            payment_instructions: { type: "string", description: "How the debtor should pay, e.g. e-transfer address." },
          },
          additionalProperties: false,
        },
      },
      required: ["debtor_name", "debtor_type", "amount_owing", "due_date"],
      additionalProperties: false,
    },
    annotations: { title: "Start a demand in Demand Now", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async run(a, ctx) {
      const m = parseMatter(a);
      if (ctx.user && !can(ctx.user, "addMatters", await readDB(ctx.userId))) throw new Error("This user's admin hasn't given them access to add matters in Demand Now.");
      const res = await createMatterForUser(ctx.userId, m, ctx.clientName);
      if (ctx.user && res.kind !== "draft" && !res.duplicate && res.invoiceId) {
        const owned = await readDB(ctx.userId);
        if (!owned.owners?.[res.invoiceId]) {
          await assignMatter(owned, ctx.userId, res.invoiceId, ctx.user.id, ctx.user, `invoice ${m.invoiceNumber || "the account"} (${m.debtorName})`);
          await writeDB(ctx.userId, owned);
        }
      }
      const url = `${ctx.base}${res.path}`;
      const db = await readDB(ctx.userId);
      const f = forumFacts(db.company.jurisdiction || "BC", m.amount, m.dueDate);
      if (res.kind === "draft") {
        // No prices or upgrade prompts in the chat (ChatGPT directory rules): payment happens in the portal.
        return {
          text: [
            `Saved the demand to ${m.debtorName} for ${money(m.amount)} in Demand Now. This account has no active plan, so the user finishes it in Demand Now, where they review the details and generate the letter and step-by-step guide.`,
            `Open it here: ${url}`,
            `If unpaid, the claim would go to: ${f.forum.name}.`,
          ].join("\n"),
          data: { status: "needs_checkout", matter_url: url, forum: f.forum.name, limitation_date: f.lim },
        };
      }
      return {
        text: [
          res.duplicate ? `This matter was already in Demand Now, so nothing new was added.` : `Added the demand to ${m.debtorName} for ${money(m.amount)} to the user's Demand Now dashboard.`,
          `Review and send the letter here: ${url}`,
          `If unpaid, the claim would go to: ${f.forum.name}. Limitation date: ${f.lim}.`,
          res.lettersLeft !== null ? `Letters left on the plan this month: ${res.lettersLeft}.` : "",
          m.debtorKind === "consumer" ? "Demands to individuals always wait for the user's review." : "",
          res.companyIncomplete.length ? `Before sending, the user should add ${res.companyIncomplete.join(", ")} in Settings (${ctx.base}/settings).` : "",
        ].filter(Boolean).join("\n"),
        data: {
          status: res.duplicate ? "already_exists" : "created",
          matter_id: res.invoiceId,
          matter_url: url,
          forum: f.forum.name,
          limitation_date: f.lim,
          letters_left_this_month: res.lettersLeft,
          profile_missing: res.companyIncomplete,
        },
      };
    },
  },
  {
    name: "list_matters",
    title: "List overdue invoices and matters",
    description:
      "List the user's receivables and demand matters in Demand Now, most overdue first, with status (no letter yet, letter sent, deadline passed, paid), forum, next step and link. Also returns plan usage.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["all", "open", "over_90_days", "letter_sent", "deadline_passed", "paid"], description: "Filter. Defaults to open (unpaid)." },
        limit: { type: "number", description: "Maximum matters to return (1 to 50, default 20)." },
      },
      additionalProperties: false,
    },
    annotations: { title: "List overdue invoices and matters", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a, ctx) {
      const { db, rows } = await visibleRows(ctx);
      const all = rows.map((r) => rowSummary(r, db, ctx.base));
      const status = String(a.status ?? "open");
      const filtered = all.filter((r) =>
        status === "all" ? true
        : status === "paid" ? r.status === "paid"
        : status === "over_90_days" ? r.status !== "paid" && r.days_overdue > 90
        : status === "letter_sent" ? r.status === "letter sent"
        : status === "deadline_passed" ? r.status === "deadline passed"
        : r.status !== "paid",
      );
      const limit = Math.min(50, Math.max(1, Number(a.limit) || 20));
      const u = usage(db);
      const plan = u.plan ? { plan: u.plan.name, letters_used_this_month: u.used, letter_limit: u.limit } : { plan: null };
      const shown = filtered.slice(0, limit);
      const text = shown.length
        ? shown.map((r) => `• ${r.debtor} · ${r.invoice_number} · ${money(r.amount_owing)} · ${r.days_overdue} days · ${r.status} · ${r.forum} · ${r.matter_url}`).join("\n") +
          (filtered.length > shown.length ? `\n…and ${filtered.length - shown.length} more.` : "")
        : "No matching matters.";
      return { text, data: { matters: shown, total: filtered.length, ...plan } };
    },
  },
  {
    name: "get_matter",
    title: "Get a matter's status and next step",
    description: "Get one Demand Now matter by matter_id: the debtor, amount, demand letter status and deadline, where a claim would go, every enforcement step and which are done, and the next step.",
    inputSchema: {
      type: "object",
      properties: { matter_id: { type: "string", description: "The matter_id from list_matters or create_demand_matter." } },
      required: ["matter_id"],
      additionalProperties: false,
    },
    annotations: { title: "Get a matter's status and next step", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async run(a, ctx) {
      const { db, rows } = await visibleRows(ctx);
      const r = rows.find((x) => x.invoice.id === String(a.matter_id ?? ""));
      if (!r) throw new Error("No matter with that matter_id. Use list_matters to find it.");
      const s = rowSummary(r, db, ctx.base);
      const done = db.progress?.[r.invoice.id]?.done ?? [];
      const steps = r.forum.steps.map((st) => ({ title: st.title, detail: st.detail, done: done.includes(st.id), document: st.document ?? null }));
      const text = [
        `${s.debtor} · ${s.invoice_number} · ${money(s.amount_owing)} · ${s.days_overdue} days past due · ${s.status}.`,
        s.payment_deadline ? `Payment deadline: ${s.payment_deadline}.` : "",
        `Forum: ${s.forum}. Limitation date: ${s.limitation_date}.`,
        s.next_step ? `Next step: ${s.next_step}.` : "",
        `Open: ${s.matter_url}`,
      ].filter(Boolean).join("\n");
      return { text, data: { ...s, steps } };
    },
  },
];

/** The matters the connected person may see: all of them for admins, otherwise what's assigned to them. */
async function visibleRows(ctx: Ctx) {
  const all = await loadRows(ctx.userId);
  return ctx.user ? visibleTo(ctx.user, all.db, all.rows) : all;
}

// ---------- JSON-RPC ----------

type RpcMsg = { jsonrpc: "2.0"; id?: string | number | null; method?: string; params?: Json };

const ok = (id: RpcMsg["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const fail = (id: RpcMsg["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handle(msg: RpcMsg, ctx: Ctx) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(msg?.id, -32600, "Invalid request");
  if (msg.id === undefined) return null; // notifications (initialized, cancelled, ...) need no reply
  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return ok(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { ...SERVER_INFO, websiteUrl: ctx.base },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return ok(msg.id, {});
    case "tools/list":
      return ok(msg.id, {
        tools: TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations })),
      });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return fail(msg.id, -32602, `Unknown tool: ${String(msg.params?.name)}`);
      try {
        const { text, data } = await tool.run((msg.params?.arguments as Json) ?? {}, ctx);
        return ok(msg.id, { content: [{ type: "text", text }], structuredContent: data, isError: false });
      } catch (e) {
        // Tool errors go back to the model so it can fix the input and retry.
        return ok(msg.id, { content: [{ type: "text", text: (e as Error).message }], isError: true });
      }
    }
    case "resources/list":
      return ok(msg.id, { resources: [] });
    case "prompts/list":
      return ok(msg.id, { prompts: [] });
    default:
      return fail(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

/** Handles one POST body (a message or a batch). Returns the response body, or null when only notifications were sent. */
export async function handleRpc(body: unknown, ctx: { userId: string; clientName: string; req: Request }) {
  const c: Ctx = { userId: await accountIdForUser(ctx.userId), user: await readUser(ctx.userId), clientName: ctx.clientName, base: baseUrl(ctx.req) };
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handle(m as RpcMsg, c)))).filter((r) => r !== null);
    return out.length ? out : null;
  }
  return handle(body as RpcMsg, c);
}

export const toolNames = () => TOOLS.map((t) => t.name);
