/**
 * Checks every outside address the app links to: website pages, help articles, privacy, terms,
 * tutorials, and every live demo page (features, bundle recipes, template designs).
 * Fetches each with a browser user agent; anything but 200 fails the run.
 *
 * Run: node --experimental-strip-types --no-warnings scripts/check-links.mjs
 * (or: npm run check:links). Demo pages missing on demo.crotoolbox.com are listed at the end
 * under "Demo pages missing": they are built by the demos project, not fixed here.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const site = await import(new URL("../app/lib/site.ts", import.meta.url));
const { SITE_URL, DEMO_URL, DEMOS, DEMO_RECIPES, DEMO_TEMPLATES, HELP_SLUGS_USED, helpUrl, demoUrl, TUTORIALS_URL } = site;

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** [label, url] pairs, kind = "site" | "help" | "demo". */
const links = [];
const add = (kind, label, url) => links.push({ kind, label, url });

for (const p of ["/", "/pricing/", "/privacy/", "/terms/", "/support/"]) add("site", `site ${p}`, SITE_URL + p);
add("site", "tutorials", TUTORIALS_URL);
add("help", "help center", helpUrl());
for (const slug of HELP_SLUGS_USED) {
  add("help", `help ${slug}`, helpUrl(slug));
  // The slug must be an article in the website's content, or the link is ours to fix.
  if (!existsSync(`${root}site/src/content/help/${slug}.md`)) add("help", `help ${slug} (no file in site/src/content/help)`, `${SITE_URL}/help/__missing-${slug}/`);
}
for (const key of DEMOS) add("demo", `demo ${key}`, demoUrl(key));
for (const key of DEMO_RECIPES) add("demo", `demo bundles recipe ${key}`, demoUrl("bundles", undefined, key));
for (const [key, n] of Object.entries(DEMO_TEMPLATES)) for (let d = 1; d <= n; d++) add("demo", `demo ${key} design ${d}`, demoUrl(key, d));

// A #design-N address is the same page as its feature: fetch each page once.
const pages = new Map();
for (const l of links) {
  const page = l.url.split("#")[0];
  if (!pages.has(page)) pages.set(page, []);
  pages.get(page).push(l);
}

async function status(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
      await res.arrayBuffer();
      if (res.status === 200 || attempt === 1) return res.status;
    } catch (e) {
      if (attempt === 1) return `error: ${e.cause?.code ?? e.message}`;
    }
  }
}

const entries = [...pages.keys()];
const result = new Map();
let next = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (next < entries.length) {
      const url = entries[next++];
      result.set(url, await status(url));
    }
  }),
);

let bad = 0;
const missingDemos = [];
for (const url of entries) {
  const s = result.get(url);
  const ok = s === 200;
  console.log(`${ok ? "OK  " : "FAIL"} ${String(s).padEnd(6)} ${url}`);
  if (!ok) {
    bad++;
    if (url.startsWith(DEMO_URL)) missingDemos.push(`${url} (${s})`);
  }
}
console.log(`\n${entries.length} pages checked from ${links.length} links, ${bad} not 200.`);
if (missingDemos.length) console.log(`\nDemo pages missing (for the demos project, not built here):\n${missingDemos.map((m) => `  ${m}`).join("\n")}`);
process.exit(bad ? 1 : 0);
