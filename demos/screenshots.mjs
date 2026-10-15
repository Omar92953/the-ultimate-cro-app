/**
 * Screenshots of the live demos for the website's feature pages (the website never links to the
 * demos; it shows these pictures). Writes site/src/assets/features/<feature>.jpg and
 * site/src/assets/bundles/<recipe>.jpg from each demo's first design; the website build turns them
 * into small WebP/AVIF files.
 *
 *   npm --prefix demos run build && npm --prefix demos run screenshots
 *
 * Needs Playwright with Chromium (not installed by default: `npm i -g playwright && npx playwright
 * install chromium`, or set PLAYWRIGHT_CHROMIUM to a Chromium binary). Commit the pictures.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "dist");
const out = path.join(here, "../site/src/assets");
const { chromium } = await import("playwright").catch(() => import("playwright-core"));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(dist, p);
  if (!file.startsWith(dist) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" }).end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(4399, r));

/** Where to look on a demo page before the picture (most widgets sit at the top). */
const LOOK = {
  footer: { scroll: "bottom" },
  sticky_atc: { scroll: 420 },
  sales_pop: { wait: 2600 },
  cart_tools: { wait: 1800 },
  cart_offers: { wait: 1800 },
  videos: { wait: 1500 },
};

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
const shots = [];
for (const dir of fs.readdirSync(dist)) {
  if (!fs.existsSync(path.join(dist, dir, "design-1.html")) || dir === "bundles") continue;
  shots.push({ key: dir.replace(/-/g, "_"), url: `/${dir}/design-1.html`, file: path.join(out, "features", `${dir}.jpg`) });
}
for (const dir of fs.readdirSync(path.join(dist, "bundles"))) {
  if (!fs.existsSync(path.join(dist, "bundles", dir, "design-1.html"))) continue;
  shots.push({ key: `bundles/${dir}`, url: `/bundles/${dir}/design-1.html`, file: path.join(out, "bundles", `${dir}.jpg`) });
}
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:4399${s.url}`, { waitUntil: "load" });
  const look = LOOK[s.key] ?? {};
  if (look.scroll === "bottom") await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  else if (look.scroll) await page.evaluate((y) => window.scrollTo(0, y), look.scroll);
  await page.waitForTimeout(look.wait ?? 1200);
  fs.mkdirSync(path.dirname(s.file), { recursive: true });
  await page.screenshot({ path: s.file, type: "jpeg", quality: 78 });
  await page.close();
}
await browser.close();
server.close();
console.log(`✓ ${shots.length} screenshots → site/src/assets`);
