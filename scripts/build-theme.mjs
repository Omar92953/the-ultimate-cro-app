/**
 * Builds the theme app extension's Liquid from the readable sources in theme/.
 *
 * Shopify allows one theme app extension per app and 100 KB of Liquid in it (blocks + snippets,
 * schema included). The sources in theme/ keep comments, indentation and pretty schema JSON;
 * this writes compact copies (no comments, no indentation, minified schema) to
 * extensions/cro-storefront/{blocks,snippets}. Edit theme/, never the extension's Liquid.
 *
 * Longer schema texts (labels, help, option names) move to locales/en.default.schema.json as
 * "t:s.N" keys: translation files don't count toward the Liquid limit (they have their own 15 KB).
 *
 *   node scripts/build-theme.mjs           build once
 *   node scripts/build-theme.mjs --watch   rebuild on every change (while `shopify app dev` runs)
 *   node scripts/build-theme.mjs --check   fail if the extension is out of date or over the limit
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "theme");
const OUT = path.join(root, "extensions/cro-storefront");
const DIRS = ["blocks", "snippets"];
const LOCALE = path.join(OUT, "locales/en.default.schema.json");
const LOCALE_LIMIT = 15 * 1024;
const LOCALE_KEYS = 248; // Shopify allows 250 translation keys
const LIMIT = 100 * 1024;
const WARN = 92 * 1024;

const MIN_MOVE = 12; // shorter texts cost more as keys than they save

/** Replaces longer schema texts with translation keys, collecting them in `strings`. */
/** Shopify's schema rules that theme check doesn't catch (they only fail on upload). */
function validate(schema, file) {
  const errors = [];
  for (const st of schema.settings ?? []) {
    if (st.type === "range") {
      const steps = (st.max - st.min) / st.step + 1;
      if (steps < 3 || steps > 101) errors.push(`${st.id}: a range needs 3–101 steps (has ${steps})`);
      if (st.default < st.min || st.default > st.max || (st.default - st.min) % st.step) errors.push(`${st.id}: default ${st.default} is not a step of the range`);
    }
    if (st.type === "select" && st.default !== undefined && !(st.options ?? []).some((o) => o.value === st.default)) errors.push(`${st.id}: default "${st.default}" is not an option`);
  }
  const headings = (schema.settings ?? []).filter((st) => st.type === "header" || st.type === "paragraph").length;
  if (headings > 6) errors.push(`${headings} headers/paragraphs (app blocks allow 6)`);
  if (errors.length) throw new Error(`${file}: ${errors.join("; ")}`);
}

function translate(schema, strings) {
  const key = (text) => {
    if (typeof text !== "string" || text.length < MIN_MOVE || text.startsWith("t:")) return text;
    if (!strings.has(text)) strings.set(text, strings.size.toString(36));
    return `t:s.${strings.get(text)}`;
  };
  for (const st of schema.settings ?? []) {
    for (const f of ["label", "info", "content", "placeholder"]) if (st[f]) st[f] = key(st[f]);
    for (const o of st.options ?? []) o.label = key(o.label);
  }
  return schema;
}

export function minify(source, file = "", strings = new Map()) {
  let s = source.replace(/\r\n/g, "\n");
  // Schema → one line of minified JSON (and fail loudly on invalid JSON).
  s = s.replace(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/, (_, json) => {
    let schema;
    try {
      schema = JSON.parse(json);
    } catch (e) {
      throw new Error(`${file}: invalid schema JSON (${e.message})`);
    }
    validate(schema, file);
    return `{% schema %}${JSON.stringify(translate(schema, strings))}{% endschema %}`;
  });
  // Comment tags.
  s = s.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, "");
  // Inside {% liquid %} tags: drop "# …" comment lines.
  s = s.replace(/\{%-?\s*liquid\b[\s\S]*?-?%\}/g, (tag) => tag.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n"));
  // Shopify ends an output tag at its first "}" (theme check doesn't notice), e.g. {{ x | replace: '{goal}', … }}.
  const brace = /\{\{(?:(?!\}\})[^}])*\}(?!\})/.exec(s);
  if (brace) throw new Error(`${file}: "}" inside {{ … }} ends the tag early on Shopify — do it in {% liquid %}: ${brace[0].slice(0, 60)}`);
  // Blocks: "block.settings" → "bs" (assigned once at the top). Saves ~12 bytes per use; the schema
  // (whose visible_if conditions must say block.settings) is left alone.
  if (file.startsWith("blocks")) {
    const at = s.indexOf("{% schema %}");
    const body = at < 0 ? s : s.slice(0, at);
    const uses = (body.match(/\bblock\.settings\b/g) || []).length;
    if (uses >= 3) {
      if (/\bbs\b/.test(body)) throw new Error(`${file}: uses a variable named "bs", which the build reserves`);
      s = "{%- assign bs = block.settings -%}\n" + body.replace(/\bblock\.settings\b/g, "bs") + (at < 0 ? "" : s.slice(at));
    }
  }
  // Indentation and blank lines (newlines are kept: {% liquid %} needs them).
  s = s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
  // A line break next to a whitespace-trimming tag ("-%}", "-}}", "{%-", "{{-") never reaches the
  // page, so it can go. Lines inside {% liquid %} neither end nor start that way, so they keep theirs.
  // Never right after a "{": "{" + "{%-" would read as an output tag.
  return s.replace(/(-%\}|-\}\})\n(?!\{(?![{%]))/g, "$1").replace(/([^{])\n(?=\{%-|\{\{-)/g, "$1") + "\n";
}

function sources() {
  const out = [];
  for (const d of DIRS) {
    for (const f of fs.readdirSync(path.join(SRC, d)).filter((f) => f.endsWith(".liquid")).sort()) out.push(path.join(d, f));
  }
  return out;
}

function build({ write }) {
  const files = sources();
  const stale = [];
  const strings = new Map();
  let total = 0;
  for (const rel of files) {
    const min = minify(fs.readFileSync(path.join(SRC, rel), "utf8"), rel, strings);
    total += Buffer.byteLength(min);
    const dest = path.join(OUT, rel);
    const current = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : null;
    if (current !== min) {
      stale.push(rel);
      if (write) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, min);
      }
    }
  }
  // Files removed from theme/ are removed from the extension too.
  for (const d of DIRS) {
    const dir = path.join(OUT, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const rel = path.join(d, f);
      if (!files.includes(rel)) {
        stale.push(`${rel} (removed)`);
        if (write) fs.rmSync(path.join(dir, f));
      }
    }
  }
  const locale = JSON.stringify({ s: Object.fromEntries([...strings].map(([text, k]) => [k, text])) }, null, 1) + "\n";
  const localeSize = Buffer.byteLength(locale);
  if (strings.size > LOCALE_KEYS) throw new Error(`en.default.schema.json would have ${strings.size} keys (limit ${LOCALE_KEYS}); raise MIN_MOVE`);
  if (localeSize > LOCALE_LIMIT) throw new Error(`en.default.schema.json would be ${localeSize} bytes (limit ${LOCALE_LIMIT}); raise MIN_MOVE`);
  if ((fs.existsSync(LOCALE) ? fs.readFileSync(LOCALE, "utf8") : null) !== locale) {
    stale.push("locales/en.default.schema.json");
    if (write) fs.writeFileSync(LOCALE, locale);
  }
  const blocks = files.filter((f) => f.startsWith("blocks")).length;
  return { total, blocks, stale, localeSize };
}

function report({ total, blocks, stale, localeSize }, verb) {
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  const msg = `theme: ${blocks} blocks, ${kb(total)} of ${kb(LIMIT)} Liquid, schema texts ${kb(localeSize)} of ${kb(LOCALE_LIMIT)}${stale.length ? ` · ${verb} ${stale.length} file(s)` : ""}`;
  if (total > LIMIT) console.error(`✗ ${msg} — over Shopify's limit`);
  else if (total > WARN) console.warn(`! ${msg} — close to Shopify's limit`);
  else console.log(`✓ ${msg}`);
  return total <= LIMIT && blocks <= 30;
}

const args = new Set(process.argv.slice(2));
if (import.meta.url === `file://${process.argv[1]}`) {
  if (args.has("--check")) {
    const r = build({ write: false });
    const ok = report(r, "out of date:");
    if (r.stale.length) console.error(`  Run \`npm run build:theme\`: ${r.stale.join(", ")}`);
    process.exit(ok && !r.stale.length ? 0 : 1);
  }
  const ok = report(build({ write: true }), "updated");
  if (args.has("--watch")) {
    let t;
    fs.watch(SRC, { recursive: true }, () => {
      clearTimeout(t);
      t = setTimeout(() => {
        try {
          report(build({ write: true }), "updated");
        } catch (e) {
          console.error(`✗ ${e.message}`);
        }
      }, 100);
    });
    console.log("watching theme/ …");
  } else if (!ok) process.exit(1);
}
