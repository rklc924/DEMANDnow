// Keeps the user manual in step with the app. Run with `npm run check:manual` (CI runs it on every PR).
// Fails when:
//  - a page route under app/ isn't covered by a chapter in content/manual/index.json (or listed in notCovered)
//  - a chapter in index.json has no Markdown file, or a Markdown file isn't listed
//  - a chapter uses a {{TOKEN}} that lib/manual.ts doesn't define
//  - a chapter links to /help/<slug> for a chapter that doesn't exist
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import path from "path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const manualDir = path.join(root, "content", "manual");
const index = JSON.parse(readFileSync(path.join(manualDir, "index.json"), "utf8"));
const errors = [];

function pages(dir, base = "") {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "api" || name.startsWith("_") || name.startsWith(".")) continue;
      out.push(...pages(full, name.startsWith("(") ? base : `${base}/${name}`));
    } else if (/^page\.(tsx|ts|jsx|js|mdx)$/.test(name)) out.push(base || "/");
  }
  return out;
}

const covered = new Set(index.chapters.flatMap((c) => c.routes));
for (const r of Object.keys(index.notCovered ?? {})) covered.add(r);
for (const r of pages(path.join(root, "app"))) {
  if (!covered.has(r)) errors.push(`Page ${r} has no manual chapter. Add it to a chapter's "routes" in content/manual/index.json and document it, or list it under "notCovered" with a reason.`);
}

const tokenSrc = readFileSync(path.join(root, "lib", "manual.ts"), "utf8");
const tokens = new Set([...tokenSrc.matchAll(/^\s+([A-Z0-9_]+):/gm)].map((m) => m[1]));
const slugs = new Set(index.chapters.map((c) => c.slug));

for (const c of index.chapters) {
  const file = path.join(manualDir, `${c.slug}.md`);
  if (!existsSync(file)) { errors.push(`Chapter "${c.slug}" is listed but content/manual/${c.slug}.md is missing.`); continue; }
  const md = readFileSync(file, "utf8");
  for (const [, t] of md.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)) if (!tokens.has(t)) errors.push(`${c.slug}.md uses {{${t}}}, which lib/manual.ts doesn't define.`);
  for (const [, s] of md.matchAll(/\]\(\/help\/([a-z0-9-]+)/g)) if (!slugs.has(s)) errors.push(`${c.slug}.md links to /help/${s}, which isn't a chapter.`);
  if (/\$\d/.test(md.replace(/\{\{[A-Z0-9_]+\}\}/g, ""))) {
    const lines = md.split("\n").filter((l) => /\$\d/.test(l) && !/e\.g\.|for example|"[^"]*\$\d/i.test(l));
    for (const l of lines) errors.push(`${c.slug}.md has a hard-coded price ("${l.trim().slice(0, 60)}..."). Use a {{TOKEN}} from lib/manual.ts so it stays in sync.`);
  }
}
for (const f of readdirSync(manualDir)) {
  if (f.endsWith(".md") && !slugs.has(f.slice(0, -3))) errors.push(`content/manual/${f} isn't listed in index.json.`);
}

if (errors.length) {
  console.error(`User manual check failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`User manual OK: ${index.chapters.length} chapters cover every page.`);
