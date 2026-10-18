/**
 * Checks built pages in site/dist (run after `npm --prefix site run build`):
 *   - the page exists, has exactly one <h1>, a <title>, a meta description and a canonical link
 *   - the title and the meta description contain the page's keyword
 *   - every JSON-LD block parses, and the types you ask for are there
 *   - every internal link and image points to a file that exists in site/dist
 *   - no dashes in the visible text (house rule): word-word hyphens, en and em dashes
 *
 * Usage (from the repo root):
 *   node site/scripts/check-pages.mjs "/shopify-upsell-app/=shopify upsell app" "/shopify-cross-sell/=shopify cross sell"
 *   node site/scripts/check-pages.mjs --require FAQPage,BreadcrumbList "/shopify-upsell-app/=shopify upsell app"
 *   node site/scripts/check-pages.mjs --all-links        # internal links of every page in site/dist
 * Exits with 1 when anything fails.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const SITE = "https://crotoolbox.com";
const args = process.argv.slice(2);
let needTypes = [];
let allLinks = false;
const pages = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--require") needTypes = args[++i].split(",").filter(Boolean);
  else if (args[i] === "--all-links") allLinks = true;
  else {
    const [path, ...kw] = args[i].split("=");
    pages.push({ path, keyword: kw.join("=") });
  }
}
if (!existsSync(dist)) {
  console.error("✗ site/dist is missing: run npm --prefix site run build first");
  process.exit(1);
}

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const fileFor = (path) => (path.endsWith("/") ? join(dist, path, "index.html") : join(dist, path));

/** Internal addresses (href, src, srcset) that don't resolve to a file in dist. */
function brokenLinks(html) {
  const urls = [];
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) urls.push(m[1]);
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) for (const part of m[1].split(",")) urls.push(part.trim().split(/\s+/)[0]);
  const bad = [];
  for (let u of urls) {
    u = decode(u);
    if (u.startsWith(SITE)) u = u.slice(SITE.length) || "/";
    if (!u.startsWith("/") || u.startsWith("//")) continue;
    const path = decodeURIComponent(u.split("#")[0].split("?")[0]);
    if (!path) continue;
    const ok = existsSync(fileFor(path)) || (!path.endsWith("/") && existsSync(join(dist, path, "index.html")));
    if (!ok) bad.push(u);
  }
  return [...new Set(bad)];
}

/** Visible text: no head, scripts, styles, svg or tags. */
const visibleText = (html) =>
  decode(
    html
      .replace(/<head[\s\S]*?<\/head>/i, " ")
      .replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ");

let failed = 0;
const fail = (where, msg) => {
  failed++;
  console.log(`  ✗ ${where}: ${msg}`);
};

for (const { path, keyword } of pages) {
  const file = fileFor(path);
  console.log(`${path}  (keyword: "${keyword}")`);
  if (!existsSync(file)) {
    fail(path, `no file ${file.slice(dist.length)}`);
    continue;
  }
  const html = readFileSync(file, "utf8");
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1 !== 1) fail(path, `${h1} <h1> elements`);
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
  const desc = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "");
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? "";
  if (!title) fail(path, "no <title>");
  if (!desc) fail(path, "no meta description");
  if (!canonical) fail(path, "no canonical link");
  const k = keyword.toLowerCase();
  if (k && !title.toLowerCase().includes(k)) fail(path, `title lacks the keyword: "${title}"`);
  if (k && !desc.toLowerCase().includes(k)) fail(path, `description lacks the keyword: "${desc}"`);
  const types = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      types.push(data["@type"]);
    } catch (e) {
      fail(path, `JSON-LD does not parse: ${e.message}`);
    }
  }
  for (const t of needTypes) if (!types.includes(t)) fail(path, `no ${t} JSON-LD`);
  const faq = html.match(/<script type="application\/ld\+json">(\{"@context":"https:\/\/schema.org","@type":"FAQPage"[\s\S]*?)<\/script>/);
  const faqCount = faq ? JSON.parse(faq[1]).mainEntity.length : 0;
  const bad = brokenLinks(html);
  for (const b of bad) fail(path, `broken internal link ${b}`);
  const dashes = [...visibleText(html).matchAll(/.{0,30}(?:[A-Za-z]-[A-Za-z]|[–—]|\s-\s).{0,30}/g)].map((m) => m[0].trim());
  for (const d of dashes) fail(path, `dash in visible text: "${d}"`);
  const links = (html.match(/\shref="(?:\/|https:\/\/crotoolbox\.com\/)/g) ?? []).length;
  console.log(`  title: ${title}\n  description (${desc.length}): ${desc}\n  canonical: ${canonical}\n  h1: ${h1}, JSON-LD: ${types.join(", ") || "none"}${faqCount ? ` (${faqCount} questions)` : ""}, internal links: ${links}, broken: ${bad.length}, dashes: ${dashes.length}`);
}

if (allLinks) {
  const files = readdirSync(dist, { recursive: true }).filter((f) => String(f).endsWith(".html") && !String(f).startsWith("demo/"));
  let count = 0;
  for (const f of files) {
    const bad = brokenLinks(readFileSync(join(dist, f), "utf8"));
    count++;
    for (const b of bad) fail(`/${f}`, `broken internal link ${b}`);
  }
  console.log(`All pages: checked internal links on ${count} pages (the demos under /demo/ are skipped).`);
}

console.log(failed ? `✗ ${failed} problem(s)` : "✓ all checks passed");
process.exit(failed ? 1 : 0);
