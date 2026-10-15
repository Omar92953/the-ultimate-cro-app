/**
 * Builds the live demos for demo.crotoolbox.com into demos/dist (a static site of its own, NOT part
 * of the public website: every page is noindex, robots.txt disallows everything, / redirects to the
 * website, and there is no list of demos anywhere). The app's "See live demo" buttons open them.
 *
 *   /<feature>/                 the feature's designs, stacked (#design-1, #design-2…)
 *   /<feature>/design-N.html    one design on a demo store page (shown in an iframe)
 *   /bundles/<recipe>/          a bundle recipe's designs
 *   /assets/  /img/  /store/    the extension's real JS and CSS, product pictures, demo cart pages
 *
 * Addresses come from app/lib/site.ts (demoPath); the build fails when its DEMOS or DEMO_RECIPES
 * don't match the features and recipes built here.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Liquid } from "liquidjs";
import { EXT, collectionOf, copyAssets, createEngine, defaults, mo, resolveTsImports } from "../test/storefront/engine.mjs";

resolveTsImports();
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "dist");
const { artSvg } = await import("../site/src/lib/art.ts");
const { FEATURES, FEATURE_KEYS } = await import("../app/lib/catalog.ts");
const { BUNDLE_RECIPES } = await import("../app/lib/bundle-recipes.ts");
const { DEMOS, DEMO_RECIPES, SITE_URL, APP_STORE_URL, demoPath, demoSlug, recipeSlug } = await import("../app/lib/site.ts");
const { frame, productPage, collectionGrid, cartPage, STORE_ROOT } = await import("./src/shell.mjs");
const data = await import("./src/data.mjs");
const { buildFeatures } = await import("./src/features.mjs");
const { checkoutDesigns } = await import("./src/checkout.mjs");
const { viewerPage } = await import("./src/viewer.mjs");

/** House rule: no dashes in visible text ("Add-ons" → "Add ons"). */
const plain = (s) => s.replace(/(\w)-(\w)/g, "$1 $2").replace(/[“”]/g, '"');
const write = (rel, content) => {
  const file = path.join(dist, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

fs.rmSync(dist, { recursive: true, force: true });
copyAssets(path.join(dist, "assets"));
fs.copyFileSync(path.join(here, "../site/public/favicon.svg"), path.join(dist, "favicon.svg"));

// ------------------------------------------------------------------------ hidden from the public --
write("robots.txt", "User-agent: *\nDisallow: /\n");
write("_headers", "/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: strict-origin-when-cross-origin\n");
write("_redirects", `/ ${SITE_URL} 302\n`);
write("index.html", `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><meta http-equiv="refresh" content="0; url=${SITE_URL}"><title>CRO Toolbox</title></head><body><script>location.replace(${JSON.stringify(SITE_URL)})</script><a href="${SITE_URL}">CRO Toolbox</a></body></html>`);
write("404.html", `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><meta http-equiv="refresh" content="0; url=${SITE_URL}"><title>CRO Toolbox</title></head><body><a href="${SITE_URL}">CRO Toolbox</a></body></html>`);

// ------------------------------------------------------------------------ pictures --
for (const a of data.ART) write(`img/${a.handle}.svg`, artSvg(a.kind, { id: "a", tint: a.tint ?? undefined, size: 800 }));
/** The hero banner: products on a shelf, as one picture. */
function shelf(w, h, items) {
  const inner = items
    .map(([kind, tint, x, y, s], i) => artSvg(kind, { id: `h${i}`, tint, size: s }).replace("<svg ", `<svg x="${x}" y="${y}" `).replace(/<rect width="200" height="200" fill="url\(#h\d+bg\)"\/>/, ""))
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9ddcc"/><stop offset="1" stop-color="#c9b398"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#bg)"/><rect y="${h * 0.78}" width="${w}" height="${h * 0.22}" fill="#b89f82"/><rect y="${h * 0.78}" width="${w}" height="8" fill="#a68b6d"/>${inner}</svg>`;
}
write("img/hero-desktop.svg", shelf(2400, 1000, [["candle", null, 1250, 330, 520], ["serum", null, 1660, 330, 520], ["plant", null, 1960, 250, 600], ["mug", null, 1000, 430, 420], ["candle", "#7a4b5c", 820, 520, 330]]));
write("img/hero-mobile.svg", shelf(1000, 1250, [["candle", null, 80, 620, 420], ["serum", null, 420, 600, 440], ["plant", null, 600, 520, 480]]));

// ------------------------------------------------------------------------ rendering --
const engine = createEngine(Liquid, { filters: { asset_url: (name) => `/assets/${name}` } });
const reviewMo = (r, i) => mo(`r${i}`, r);
const baseShop = {
  name: "Lumen Goods",
  url: "https://lumen-goods.example",
  money_format: "${{amount}}",
  enabled_payment_types: ["visa", "master", "american_express", "paypal", "apple_pay", "shopify_pay"],
  policies: [{ title: "Refund policy", url: `${STORE_ROOT}policies/refund-policy` }],
  metaobjects: {
    "$app:cro_settings": collectionOf([mo("settings", { cross_sell_enabled: true, upsell_enabled: true, videos_enabled: true, bundles_enabled: true })]),
    "$app:cro_lists": collectionOf([
      mo("main", {
        reviews: data.reviews.map(reviewMo),
        faq: data.faq.map((q, i) => mo(`f${i}`, q)),
        logos: data.logos.map((l, i) => mo(`l${i}`, l)),
        announcements: data.announcements.map((a, i) => mo(`a${i}`, a)),
      }),
    ]),
    "$app:cro_review": collectionOf(data.reviews.map(reviewMo)),
    "$app:cro_design": collectionOf([]),
    "$app:cro_recent": collectionOf([mo("main", { purchases: [] })]),
  },
};
/** The demo shop with some designs ($app:cro_design handle → config) and other metaobjects. */
function shopWith({ designs = {}, meta = {} } = {}) {
  const m = { ...baseShop.metaobjects };
  m["$app:cro_design"] = collectionOf(Object.entries(designs).map(([h, config]) => mo(h, { config })));
  for (const [type, list] of Object.entries(meta)) m[type] = collectionOf(list);
  return { ...baseShop, metaobjects: m };
}
let blockN = 0;
async function block(name, { settings = {}, shop = shopWith(), page_type = "index", product, collection, page, cart, cartTotal = 0, linklists = {} } = {}) {
  const globals = {
    shop,
    request: { design_mode: false, page_type },
    template: { name: page_type },
    routes: { root_url: STORE_ROOT, all_products_collection_url: `${STORE_ROOT}collections/all`, collections_url: `${STORE_ROOT}collections`, cart_url: `${STORE_ROOT}cart` },
    cart: cart ?? { total_price: cartTotal, items: [], item_count: 0 },
    product,
    collection,
    page,
    linklists,
  };
  const locals = { block: { id: `${name}-${++blockN}`, settings: { ...defaults(name, EXT), ...settings }, shopify_attributes: "" }, product, collection, page };
  const html = await engine.renderFile(name, locals, { globals });
  if (/Liquid error/.test(html)) throw new Error(`${name}: ${html.match(/Liquid error[^<]*/)[0]}`);
  return html;
}

const { features, recipes } = await buildFeatures({ block, shopWith, mo });
Object.assign(features, checkoutDesigns());

// ------------------------------------------------------------------------ pages --
const longCopy = `<p>Our Glow Serum is made in small batches with vitamin C and squalane. Two drops in the morning, before your cream.</p><p>Scroll down: the bar with Add to cart stays with you.</p><div style="height:900px"></div>`;
function bodyOf(d) {
  let main = d.html ?? "";
  if (d.layout === "product")
    main = d.place === "above"
      ? productPage(data.products[d.product], "", { above: main, description: d.description ?? (d.tall ? longCopy : "") })
      : productPage(data.products[d.product], main, { description: d.description ?? (d.tall ? longCopy : "") });
  else if (d.layout === "collection") main = collectionGrid(data.collections[d.collection].title, data.collections[d.collection].products.filter((p) => !p.tags.includes("cro-bundle"))) + main;
  else if (d.layout === "cart") main = cartPage(main);
  return main;
}
const autoClick = (sel) =>
  sel ? `<script>window.addEventListener("load",function(){setTimeout(function(){var el=document.querySelector(${JSON.stringify(sel)});if(el)el.click()},700)})</script>` : "";
const installUrl = (campaign) => `${APP_STORE_URL}?utm_source=crotoolbox_demo&utm_medium=demo&utm_campaign=${encodeURIComponent(campaign)}`;

/** Writes each design's store page under `dir` and returns what the viewer page lists. */
function designPages(dir, title, designs) {
  return designs.map((d, i) => {
    const n = i + 1;
    const id = `${dir.replace(/\//g, "-")}-${n}`;
    const html = frame({
      title: `${title}: ${d.title}`,
      frameId: id,
      body: bodyOf(d) + (d.bottom ?? ""),
      top: d.top ?? "",
      embeds: (d.embeds ?? "") + autoClick(d.autoClick),
      css: d.css ?? [],
      catalog: data.catalog,
      collections: data.collectionHandles,
      orderJson: data.order,
      cartSeed: d.cartSeed ?? null,
      head: d.head ?? "",
      header: d.layout !== "raw" && d.layout !== undefined,
    });
    write(`${dir}/design-${n}.html`, html);
    return { n, id, title: d.title, src: `/${dir}/design-${n}.html`, minHeight: d.minHeight ?? null, scroll: d.scroll ?? null };
  });
}
const CHECKOUT_TIP = "Checkout runs inside Shopify, so this is a picture of it with what the app changes marked.";

const built = [];
for (const key of FEATURE_KEYS) {
  const f = FEATURES[key];
  const title = plain(f.title);
  const dir = demoSlug(key);
  let designs;
  if (key === "bundles") designs = BUNDLE_RECIPES.map((r) => ({ ...recipes[r.key][0], title: plain(r.title) }));
  else designs = features[key];
  if (!designs?.length) continue;
  const checkout = !designs[0].layout;
  const listed = designPages(dir, title, designs);
  write(`${dir}/index.html`, viewerPage({ title, about: plain(f.about), installUrl: installUrl(dir), designs: listed, tip: checkout ? CHECKOUT_TIP : "" }));
  if (demoPath(key) !== `/${dir}/`) throw new Error(`demoPath(${key}) is not /${dir}/`);
  built.push(key);
}
const builtRecipes = [];
for (const r of BUNDLE_RECIPES) {
  const dir = `bundles/${recipeSlug(r.key)}`;
  const title = plain(r.title);
  const listed = designPages(dir, title, recipes[r.key]);
  write(`${dir}/index.html`, viewerPage({ title, about: `${plain(r.about)} ${plain(r.best)}.`, installUrl: installUrl(dir.replace("/", "_")), designs: listed }));
  if (demoPath("bundles", undefined, r.key) !== `/${dir}/`) throw new Error(`demoPath(bundles, ${r.key}) is not /${dir}/`);
  builtRecipes.push(r.key);
}

// The demo store's cart and checkout (the storefront scripts send shoppers there).
const storePage = (rel, title, body) => write(`store/${rel}/index.html`, frame({ title, frameId: `store-${rel}`, body, catalog: data.catalog, collections: data.collectionHandles, orderJson: data.order }));
storePage("cart", "Cart", cartPage());
storePage("checkout", "Checkout", `<div class="page-width demo-pad demo-narrow"><h1>Checkout</h1><p>This is where Shopify's own checkout takes over. Offer and bundle discounts, payment and delivery rules and order limits all run inside it.</p><p><a class="button" href="javascript:history.back()" style="width:auto">Back to the demo</a></p></div>`);

// ------------------------------------------------------------------------ in sync with the app --
const diff = (a, b) => a.filter((x) => !b.includes(x));
const problems = [
  ...diff(FEATURE_KEYS, built).map((k) => `catalog feature "${k}" has no demo`),
  ...diff(built, DEMOS).map((k) => `demo "${k}" is missing from DEMOS in app/lib/site.ts`),
  ...diff(DEMOS, built).map((k) => `DEMOS in app/lib/site.ts lists "${k}", which has no demo`),
  ...diff(DEMOS, FEATURE_KEYS).map((k) => `DEMOS lists "${k}", which is not a catalog feature`),
  ...diff(builtRecipes, DEMO_RECIPES).map((k) => `recipe "${k}" is missing from DEMO_RECIPES`),
  ...diff(DEMO_RECIPES, builtRecipes).map((k) => `DEMO_RECIPES lists "${k}", which has no demo`),
];
if (problems.length) {
  console.error("✗ demos:\n  " + problems.join("\n  "));
  process.exit(1);
}
const pages = fs.readdirSync(dist, { recursive: true }).filter((f) => String(f).endsWith(".html"));
// The blocks pass their settings to the storefront scripts as JSON, which fail silently on bad JSON.
for (const f of pages) {
  const html = fs.readFileSync(path.join(dist, f), "utf8");
  for (const m of html.matchAll(/<script type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch (e) {
      problems.push(`${f}: invalid JSON passed to a script (${e.message.slice(0, 80)})`);
    }
  }
}
if (problems.length) {
  console.error("✗ demos:\n  " + problems.join("\n  "));
  process.exit(1);
}
const unhidden = pages.filter((f) => !fs.readFileSync(path.join(dist, f), "utf8").includes('content="noindex, nofollow"'));
if (unhidden.length) {
  console.error(`✗ demos: pages without noindex: ${unhidden.join(", ")}`);
  process.exit(1);
}
console.log(`✓ demos: ${built.length} features, ${builtRecipes.length} bundle recipes, ${pages.length} pages → demos/dist`);
