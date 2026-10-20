/**
 * Accessibility checks on the built site (run after `npm --prefix site run build`):
 *   - every page: <html lang>, a skip link, one <h1> and headings that never skip a level going down
 *   - every <img> has an alt attribute (alt="" for decorative pictures)
 *   - every link and button has a name (text, aria-label or an image's alt)
 *   - no duplicate ids; form fields have a label
 *   - WCAG contrast of the colour pairs the site uses (tokens in src/styles/global.css): 4.5:1 for text
 * The live demos (/demo/) are skipped: they copy the app's storefront blocks.
 *
 * Usage (repo root): node site/scripts/check-a11y.mjs        Exits with 1 when anything fails.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const css = readFileSync(join(here, "..", "src/styles/global.css"), "utf8");

let failed = 0;
const fail = (where, msg) => {
  failed++;
  console.log(`  ✗ ${where}: ${msg}`);
};
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/gi, " ").trim();

const files = readdirSync(dist, { recursive: true }).filter((f) => String(f).endsWith(".html") && !String(f).startsWith("demo/"));
for (const f of files) {
  const where = `/${f}`;
  const html = readFileSync(join(dist, f), "utf8");
  const body = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  if (!/<html[^>]*\slang="[a-z-]+"/i.test(html)) fail(where, "no <html lang>");
  if (!/class="skip"/.test(html)) fail(where, "no skip link");
  const levels = [...body.matchAll(/<h([1-6])[\s>]/gi)].map((m) => Number(m[1]));
  if (levels.filter((l) => l === 1).length !== 1) fail(where, `${levels.filter((l) => l === 1).length} h1`);
  if (levels[0] !== undefined && levels[0] !== 1 && !where.includes("404")) fail(where, `first heading is h${levels[0]}`);
  levels.forEach((l, i) => {
    if (i && l > levels[i - 1] + 1) fail(where, `heading jumps from h${levels[i - 1]} to h${l}`);
  });
  // A bare `alt` is an empty alt: right for decorative pictures.
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) if (!/\salt(=|[\s>])/.test(m[0])) fail(where, `img without alt: ${m[0].slice(0, 90)}`);
  for (const m of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const name = /aria-label="[^"]+"/.test(m[1]) || strip(m[2]) || /<img[^>]*alt="[^"]+"/.test(m[2]);
    if (!name) fail(where, `link without a name: <a${m[1].slice(0, 80)}>`);
  }
  for (const m of body.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    if (!/aria-label="[^"]+"/.test(m[1]) && !strip(m[2])) fail(where, `button without a name: <button${m[1].slice(0, 80)}>`);
  }
  const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) fail(where, `duplicate id "${id}"`);
  for (const m of body.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    if (/type="(hidden|submit|button)"/.test(m[2])) continue;
    const id = m[2].match(/\sid="([^"]+)"/)?.[1];
    // Inside an open <label>…</label> counts as labelled too.
    const before = body.slice(0, m.index);
    const insideLabel = before.lastIndexOf("<label") > before.lastIndexOf("</label>");
    const labelled = insideLabel || /aria-label(ledby)?="/.test(m[2]) || (id && new RegExp(`<label[^>]*for="${id}"`).test(body));
    if (!labelled) fail(where, `form field without a label: <${m[1]}${m[2].slice(0, 80)}>`);
  }
}
console.log(`Structure: ${files.length} pages checked.`);

// Contrast (WCAG 2.1): relative luminance of sRGB colours.
const token = (name) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const PAIRS = [
  ["body text", "ink", "paper"],
  ["muted text", "muted", "paper"],
  ["muted text on grey sections", "muted", "mist"],
  ["links and green labels", "accent-deep", "paper"],
  ["links on grey sections", "accent-deep", "mist"],
  ["green pill text", "accent-deep", "accent-soft"],
  ["muted text on dark sections", "muted-dark", "ink"],
  ["bright accent on dark sections", "accent", "ink"],
  ["ink text on accent buttons", "ink", "accent"],
  ["white text on dark sections", "paper", "ink"],
];
for (const [label, fg, bg] of PAIRS) {
  const a = token(fg), b = token(bg);
  if (!a || !b) {
    fail("contrast", `token missing for ${label} (--${fg} / --${bg})`);
    continue;
  }
  const r = ratio(a, b);
  console.log(`  ${r >= 4.5 ? "ok" : "✗ "} ${r.toFixed(2)}:1  ${label} (--${fg} ${a} on --${bg} ${b})`);
  if (r < 4.5) failed++;
}
console.log(failed ? `✗ ${failed} problem(s)` : "✓ all checks passed");
process.exit(failed ? 1 : 0);
