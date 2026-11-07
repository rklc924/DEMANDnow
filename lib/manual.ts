import { readFile } from "fs/promises";
import path from "path";
import { BC } from "./jurisdictions/bc";
import { LIEN_FILING_FEE, LIEN_RUSH_FEE, LIEN_STANDARD_DAYS, LIEN_TITLE_SEARCH_FEE } from "./liens";
import { ONE_OFF_PRICE } from "./oneoff";
import { COMPANY_SEARCH_FEE } from "./party";
import { PLANS } from "./plans";
import { WITNESS_PAGE_FEE } from "./witness";

// The user manual shown at /help. Each chapter is a Markdown file in content/manual/, listed in
// content/manual/index.json with the app routes it explains. scripts/check-manual.mjs fails CI when
// a page route has no chapter, so every new screen ships with its manual entry.
//
// Prices and limits are never typed into the Markdown. Write a token such as {{STANDARD_MONTHLY}}
// and it is filled from the same constants the app charges with, so the manual can't drift.

export interface Chapter {
  slug: string;
  title: string;
  summary: string;
  group: string;
  routes: string[];
  placeholder?: boolean;
}

const DIR = path.join(process.cwd(), "content", "manual");

const dollars = (n: number) => `$${n.toLocaleString("en-CA")}`;
const serviceFees = BC.forums.find((f) => f.id === "small-claims")?.service?.serverFees;

export const MANUAL_TOKENS: Record<string, string> = {
  STANDARD_MONTHLY: dollars(PLANS.standard.price.monthly),
  STANDARD_ANNUAL: dollars(PLANS.standard.price.annual),
  STANDARD_LIMIT: String(PLANS.standard.letterLimit),
  UNLIMITED_MONTHLY: dollars(PLANS.unlimited.price.monthly),
  UNLIMITED_ANNUAL: dollars(PLANS.unlimited.price.annual),
  ONE_OFF_PRICE: dollars(ONE_OFF_PRICE),
  COMPANY_SEARCH_FEE: dollars(COMPANY_SEARCH_FEE),
  SERVICE_BOOKING_FEE: dollars(serviceFees?.bookingFee ?? 0),
  LIEN_FILING_FEE: dollars(LIEN_FILING_FEE),
  LIEN_RUSH_FEE: dollars(LIEN_RUSH_FEE),
  LIEN_STANDARD_DAYS: String(LIEN_STANDARD_DAYS),
  LIEN_TITLE_SEARCH_FEE: dollars(LIEN_TITLE_SEARCH_FEE),
  WITNESS_PAGE_FEE: dollars(WITNESS_PAGE_FEE),
  CRT_MAX: "$5,000",
  SMALL_CLAIMS_MAX: dollars(BC.forums.find((f) => f.id === "small-claims")?.maxClaim ?? 35000),
  LIMITATION_YEARS: String(BC.limitation.years),
};

export async function chapters(): Promise<Chapter[]> {
  return JSON.parse(await readFile(path.join(DIR, "index.json"), "utf8")).chapters;
}

export async function chapter(slug: string): Promise<{ meta: Chapter; html: string } | null> {
  const list = await chapters();
  const meta = list.find((c) => c.slug === slug);
  if (!meta) return null;
  const md = await readFile(path.join(DIR, `${slug}.md`), "utf8");
  return { meta, html: renderMarkdown(fillTokens(md)) };
}

export function fillTokens(md: string) {
  return md.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k: string) => MANUAL_TOKENS[k] ?? m);
}

// A small Markdown renderer for our own trusted content: headings, paragraphs, lists, tables,
// > callouts ("> **Tip:**" etc.), bold, italic, inline code and links. HTML in the source is escaped.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const slugify = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function inline(s: string) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text: string, href: string) => {
      const external = /^https?:/.test(href);
      return `<a href="${href}"${external ? ' target="_blank" rel="noreferrer"' : ""}>${text}</a>`;
    });
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(4, h[1].length + 1); // "#" in a chapter is the page's h2
      const text = inline(h[2]);
      out.push(`<h${level} id="${slugify(text)}">${text}</h${level}>`);
      i++;
      continue;
    }

    if (line.startsWith(">")) {
      const body: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) body.push(lines[i++].replace(/^>\s?/, ""));
      const kind = /^\*\*(Warning|Important)/i.test(body[0] ?? "") ? "warn" : "tip";
      out.push(`<div class="callout ${kind}">${renderMarkdown(body.join("\n"))}</div>`);
      continue;
    }

    if (/^\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = lines[i++].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
      }
      const [head, ...body] = rows;
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`,
      );
      continue;
    }

    const ordered = /^\d+\.\s/.test(line);
    if (ordered || /^[-*]\s/.test(line)) {
      const items: string[] = [];
      const re = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      while (i < lines.length && (re.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        if (re.test(lines[i])) items.push(lines[i].replace(re, ""));
        else items[items.length - 1] += " " + lines[i].trim();
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|\||\d+\.\s|[-*]\s)/.test(lines[i])) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return out.join("\n");
}

/** Section headings in a rendered chapter, for the "On this page" list. */
export const headings = (html: string) =>
  [...html.matchAll(/<h3 id="([^"]+)">(.*?)<\/h3>/g)].map((m) => ({ id: m[1], text: m[2].replace(/<[^>]+>/g, "") }));
