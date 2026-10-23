/**
 * Omar's words rule (HANDOFF.md): no dashes in UI text, and the app never speaks in the first person (audit 2026-10-23).
 * (a) Every default text in app/lib (exports named DEFAULT..., TEXTS, ...) has no dash.
 * (b) Admin pages and components never have the app say "we", "us", "our", "I" or "my". Words quoted in “curly quotes”
 *     are the shopper's or the store's own words and are skipped, and so are the previews and sample shop copy.
 * Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const DASH = /\s[-–—]\s|[–—]/;

test("(a) default texts have no dashes", async () => {
  const root = "app/lib";
  const files = (fs.readdirSync(root, { recursive: true }) as string[]).filter((f) => /\.ts$/.test(f) && !f.includes(".server."));
  const bad: string[] = [];
  const seen = new Set<unknown>();
  const walk = (v: unknown, where: string) => {
    if (typeof v === "string") {
      if (DASH.test(v)) bad.push(`${where}: ${v.slice(0, 80)}`);
      return;
    }
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
  };
  for (const f of files) {
    const m = await import(path.resolve(root, f));
    for (const [k, v] of Object.entries(m)) if (/^(DEFAULT|TEXTS$|[A-Z_]*TEXTS$|[A-Z_]*LABELS?$)/.test(k)) walk(v, `${f}:${k}`);
  }
  assert.deepEqual(bad, []);
});

/** The text a person reads in a .tsx file: string literals and JSX text, without comments and class names. */
function uiText(src: string) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const out: string[] = [];
  for (const m of code.matchAll(/"([^"\n]{3,})"|`([^`]{3,})`|>([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g)) out.push((m[1] ?? m[2] ?? m[3]).replace(/“[^”]*”/g, ""));
  return out;
}

test("(b) the admin never speaks in the first person", () => {
  const files = [
    ...fs.readdirSync("app/routes").filter((f) => /^app\..*\.tsx$/.test(f)).map((f) => `app/routes/${f}`),
    ...fs.readdirSync("app/components").filter((f) => /\.tsx$/.test(f) && !/Preview|Showcase|Sample|SecForms/.test(f)).map((f) => `app/components/${f}`),
  ];
  // Not a word on its own when joined by a hyphen (a page handle such as about-us).
  const FIRST = /(?<![-\w])(we|We|we're|We're|we'll|We'll|we've|We've|us|our|Our|I|I'm|I'll|my|My)(?![-\w])/;
  // Default storefront labels the merchant can change: the store's or the shopper's own words, not the app's.
  const STORE_WORDS = new Set(["Contact us", "Add my gift"]);
  const bad: string[] = [];
  for (const f of files) for (const t of uiText(fs.readFileSync(f, "utf8"))) if (FIRST.test(t) && !STORE_WORDS.has(t.trim()) && !/^[a-z0-9_.:/-]+$/.test(t)) bad.push(`${f}: ${t.trim().slice(0, 90)}`);
  assert.deepEqual(bad, []);
});

/** Source without comments (JS and CSS block and line comments, Liquid comment tags). */
const uncommented = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, "")
    .replace(/\{%-?\s*#[\s\S]*?-?%\}/g, "")
    .replace(/(^|[^:'"\\])\/\/[^\n]*/gm, "$1");

test("(c) storefront, checkout and account extensions show no dashes", () => {
  const dirs = ["extensions/cro-storefront/assets", "theme/blocks", "theme/snippets", ...fs.readdirSync("extensions").filter((d) => d !== "cro-storefront").flatMap((d) => [`extensions/${d}/src`, `extensions/${d}/locales`])];
  const bad: string[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(js|jsx|ts|tsx|css|liquid|json)$/.test(f)) continue;
      uncommented(fs.readFileSync(`${dir}/${f}`, "utf8"))
        .split("\n")
        .forEach((line, i) => {
          if (/[–—]/.test(line)) bad.push(`${dir}/${f}:${i + 1}: ${line.trim().slice(0, 90)}`);
        });
    }
  }
  assert.deepEqual(bad, []);
});
