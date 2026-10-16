// Usage: node scripts/listing/frame-screenshots.mjs <repo root>  (needs playwright-core and Google Chrome; not a repo dependency)
// Puts each real App Store screenshot (branding/screenshots/hires) into a branded 1600 x 900 frame with a
// short headline. Renders at 2x with Chrome, then the PNG is scaled to 1600 x 900.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
const R = process.argv[2];
const SRC = path.join(R, "branding/screenshots/hires");
const OUT = path.join(R, "branding/screenshots/framed");
const FONT = path.join(R, "site/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2");
const LOGO = fs.readFileSync(path.join(R, "branding/logo-wordmark-black.svg"), "utf8");
const SHOTS = [
  ["1-create-offer", "01-create-offer.png", "Every kind of offer in one place", "Upsells, bundles, cross sells and discounts"],
  ["2-bundle-editor", "09-bundle-editor.png", "Build bundles with a live preview", "Six bundle types, priced by Shopify at checkout"],
  ["3-upsell-editor", "08-upsell-editor.png", "Upsells that match your theme", "See the real block while you set it up"],
  ["4-storefront", "04-storefront.png", "Widgets for any Online Store 2.0 theme", "Added in the theme editor, no code"],
  ["5-upsell-offers", "02-upsell-offers.png", "Choose which offer shows first", "Every offer with its status and show order"],
  ["6-checkout", "06-checkout.png", "Rules and offers in the checkout", "Payment and delivery rules, order limits, thank-you page"],
];
// The hires captures are 2584 x 1454 and include the Shopify admin bar (top) and menu (left): crop to the app.
const CROP = { x: 433, y: 106, w: 2584 - 433 };
const SHOW_W = 1340;
const k = SHOW_W / CROP.w;
const html = (img, title, sub) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;src:url("file://${FONT}") format("woff2");font-weight:100 900}
*{box-sizing:border-box;margin:0}
html,body{width:1600px;height:900px;overflow:hidden}
body{font-family:Inter,sans-serif;color:#0b0b0f;background:
 radial-gradient(900px 520px at 12% -10%, #e3f8ec 0%, rgba(227,248,236,0) 70%),
 radial-gradient(800px 500px at 100% 0%, #eeeee9 0%, rgba(238,238,233,0) 70%), #f6f6f3}
.top{position:absolute;left:0;right:0;top:54px;text-align:center}
h1{font-size:50px;font-weight:780;letter-spacing:-0.025em;line-height:1.08}
p{margin-top:12px;font-size:21px;font-weight:500;color:#5a5c66}
.logo{position:absolute;left:44px;top:38px;height:30px}
.logo svg{height:30px;width:auto}
.shot{position:absolute;left:${(1600 - SHOW_W) / 2}px;top:210px;width:${SHOW_W}px;height:760px;overflow:hidden;
 border-radius:18px 18px 0 0;background:#fff;box-shadow:0 0 0 1px rgba(11,11,15,.08),0 30px 70px -20px rgba(11,11,15,.28),0 12px 28px -12px rgba(11,11,15,.18)}
.shot img{position:absolute;left:${-CROP.x * k}px;top:${-CROP.y * k}px;width:${2584 * k}px}
</style></head><body>
<div class="logo">${LOGO}</div>
<div class="top"><h1>${title}</h1><p>${sub}</p></div>
<div class="shot"><img src="data:image/png;base64,${fs.readFileSync(img).toString("base64")}"></div>
</body></html>`;
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
fs.mkdirSync(OUT, { recursive: true });
for (const [name, src, title, sub] of SHOTS) {
  await page.setContent(html(path.join(SRC, src), title, sub), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const file = path.join(OUT, `${name}@2x.png`);
  await page.screenshot({ path: file, type: "png" });
  console.log(file);
}
await browser.close();
