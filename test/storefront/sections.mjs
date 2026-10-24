/**
 * Harness for the cro-sections extension: renders its real Liquid blocks with LiquidJS and mock
 * metaobjects into out/sections/*.html, so the sections can be checked in a browser without a store.
 *
 *   node test/storefront/sections.mjs && python3 -m http.server -d test/storefront/out 8123
 *
 * LiquidJS is close to, not identical to, Shopify Liquid — this catches logic and markup errors;
 * it does not replace testing on a development store.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Liquid } from "liquidjs";
import { EXT, collectionOf, copyAssets, createEngine, defaults, mo, resolveTsImports } from "./engine.mjs";

resolveTsImports();

const here = path.dirname(fileURLToPath(import.meta.url));
const ext = EXT;
const out = path.join(here, "out/sections");
copyAssets(path.join(out, "assets"));
const engine = createEngine(Liquid);

// ---------------------------------------------------------------- mock data --
const photo = (seed, w = 800, h = 1000) => ({ media_type: "image", src: `https://picsum.photos/seed/${seed}/${w}/${h}`, width: w, height: h, aspect_ratio: w / h, alt: "" });
const video = (n) => ({ media_type: "video", preview_image: { src: `https://picsum.photos/seed/v${n}/720/900` }, sources: [{ url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" }] });
const logo = (text, color) => ({ media_type: "image", src: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><text x="0" y="44" font-family="Arial" font-weight="700" font-size="40" fill="${color}">${text}</text></svg>`)}`, width: 200, height: 60, aspect_ratio: 200 / 60 });
// Real chat screenshots (uploaded to the dev store's files) for screenshot-style reviews.
const shot = (f, w, h) => ({ media_type: "image", src: `https://cdn.shopify.com/s/files/1/0836/6669/8457/files/${f}`, width: w, height: h, aspect_ratio: w / h, alt: "" });
// Product photos: Unsplash (free to use). Reviews without their own photo show these.
const tee = { id: 30, title: "Wireless headphones", url: "/products/basic-tee", featured_image: { media_type: "image", src: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=1000&fit=crop&q=60&auto=format", width: 800, height: 1000, aspect_ratio: 0.8, alt: "" } };
const mug = { id: 31, title: "Ceramic mug", url: "/products/logo-mug", featured_image: { media_type: "image", src: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&h=1000&fit=crop&q=60&auto=format", width: 800, height: 1000, aspect_ratio: 0.8, alt: "" } };
const camera = { id: 32, title: "Instant camera", url: "/products/instant-camera", featured_image: { media_type: "image", src: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&h=1000&fit=crop&q=60&auto=format", width: 800, height: 1000, aspect_ratio: 0.8, alt: "" } };

const hour = 3600;
const now = Math.floor(Date.now() / 1000);
const iso = (t) => new Date(t * 1000).toISOString();
const announce = [
  mo("a3", { message: "Third by order, first in the list", link: "/collections/all", icon: "gift", position: 3, active: true }),
  mo("a1", { message: "Free delivery in Cairo over LE 1,000", link: "", icon: "truck", position: 1, active: true }),
  mo("a2", { message: "New drop: summer tees", link: "/collections/tees", icon: "fire", position: 2, active: true }),
  mo("a-off", { message: "PAUSED — must not show", icon: "none", position: 0, active: false }),
  mo("a-future", { message: "FUTURE — must not show", icon: "clock", position: 4, active: true, starts_at: iso(now + 48 * hour) }),
  mo("a-past", { message: "EXPIRED — must not show", icon: "clock", position: 5, active: true, ends_at: iso(now - hour) }),
];
const faq = [
  mo("f1", { question: "How long does delivery take?", answer: "2–4 working days in Cairo and Giza.\nUp to 7 days elsewhere.", group: "Shipping", position: 1, active: true }),
  mo("f2", { question: "Can I pay cash on delivery?", answer: "Yes, cash on delivery is available everywhere we ship.", group: "Payment", position: 2, active: true }),
  mo("f3", { question: "What is your return policy?", answer: "Return unused items within 14 days for a full refund.", group: "Returns", position: 3, active: true }),
  mo("f4", { question: "Do you ship outside Egypt?", answer: "Not yet — we're working on it.", group: "Shipping", position: 4, active: true }),
  mo("f-off", { question: "HIDDEN — must not show", answer: "x", group: "Shipping", position: 0, active: false }),
];
const logos = ["ACME", "Globex", "Initech", "Umbrella", "Hooli"].map((n, i) => mo(`l${i}`, { name: n, image: logo(n, ["#e11d48", "#2563eb", "#16a34a", "#9333ea", "#ea580c"][i]), link: i === 0 ? "https://example.com" : "", position: 5 - i }));
const long = "I ordered on Sunday and it arrived on Tuesday, perfectly packed. The fabric is thick and soft, the print hasn't faded after five washes, and the fit is exactly as described in the size guide. Customer service answered on WhatsApp within minutes when I asked to change the size. Will definitely order again for my brother.";
const reviews = [
  mo("r1", { name: "Mariam A.", text: "", rating: 5, media: shot("review-chat-1.jpg?v=1791333868", 1023, 336), source: "whatsapp", product: tee, location: "Cairo", date: "2026-09-12", verified: true, featured: true, active: true, position: 1 }),
  mo("r2", { name: "Youssef K.", text: "Great sound and the battery lasts all week.", rating: 5, source: "tiktok", source_url: "https://www.tiktok.com/", product: tee, location: "Alexandria", date: "2026-09-20", verified: true, featured: true, active: true, position: 4 }),
  mo("r3", { name: "Nour H.", text: "", rating: 5, media: shot("review-chat-3.jpg?v=1791333868", 1284, 506), source: "instagram", source_url: "https://www.instagram.com/", product: mug, location: "Giza", date: "2026-08-30", verified: false, featured: true, active: true, position: 3, photo_fit: "whole" }),
  mo("r4", { name: "Omar S.", text: "Quick delivery, good quality.", rating: 4, source: "google", product: camera, location: "Mansoura", date: "2026-09-25", active: true, position: 2 }),
  mo("r5", { name: "Salma R.", text: "Got it as a gift and my friend loved it.", rating: 5, source: "facebook", product: mug, date: "2026-10-01", active: true, position: 5 }),
  mo("r6", { name: "Hidden H.", text: "HIDDEN — must not show", rating: 1, active: false, position: 0 }),
];
// What the app writes to $app:cro_lists "main": shown items, in "Order" order.
const shownInOrder = (items) => items.filter((m) => m.active?.value !== false).sort((a, b) => (a.position?.value ?? 0) - (b.position?.value ?? 0));
const lists = (r, f, l, a) => collectionOf([mo("main", { reviews: shownInOrder(r), faq: shownInOrder(f), logos: shownInOrder(l), announcements: shownInOrder(a) })]);

const shop = {
  name: "Harness shop",
  url: "https://harness.example",
  money_format: "${{amount}}",
  enabled_payment_types: ["visa", "master", "american_express", "paypal", "apple_pay"],
  metaobjects: {
    "$app:cro_announce": collectionOf(announce),
    "$app:cro_faq": collectionOf(faq),
    "$app:cro_logo": collectionOf(logos),
    "$app:cro_review": collectionOf(reviews),
    "$app:cro_lists": lists(reviews, faq, logos, announce),
  },
};
// Boosters: defaults (no saved config) + two real-looking recent purchases.
const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
shop.metaobjects["$app:cro_boosters"] = collectionOf([mo("main", { config: null })]);
// Countdown bar: designed in the app — the app's defaults, saved the way the app saves them.
const { toStorefrontCountdownBar, withCountdownBarDefaults } = await import("../../app/lib/designs.ts");
const { toStorefrontReviews, withReviewsDefaults, applyReviewPreset } = await import("../../app/lib/reviews-design.ts");
const in3days = new Date(Date.now() + 3 * 86400e3).toISOString().slice(0, 16);
const { toStorefrontAnnouncement, withAnnouncementDefaults } = await import("../../app/lib/announcement-design.ts");
const { toStorefrontShippingBar, withShippingBarDefaults } = await import("../../app/lib/shipping-bar.ts");
const { toStorefrontLogos, withLogosDefaults } = await import("../../app/lib/logos-design.ts");
const { toStorefrontFaq, withFaqDefaults } = await import("../../app/lib/faq-design.ts");
const faqDesign = (raw) => mo("faq", { config: toStorefrontFaq(withFaqDefaults(raw)) });
const logosDesign = (raw) => mo("logos", { config: toStorefrontLogos(withLogosDefaults(raw)) });
const announceDesign = (raw) => mo("announcement", { config: toStorefrontAnnouncement(withAnnouncementDefaults(raw)) });
const shipBarDesign = mo("shipping_bar", { config: toStorefrontShippingBar(withShippingBarDefaults({ goal: 1000, text: { empty: "Free shipping on orders over {goal}", progress: "Spend {left} more for free shipping", done: "You've unlocked free shipping!" } })) });
shop.metaobjects["$app:cro_design"] = collectionOf([
  mo("reviews", { config: toStorefrontReviews(withReviewsDefaults({ which: { filter: "product", fallback: false } })) }),
  mo("countdown_bar", { config: toStorefrontCountdownBar(withCountdownBarDefaults({ timer: { mode: "daily", cutoff: "23:59" } })) }),
  mo("countdown_home", { config: toStorefrontCountdownBar(withCountdownBarDefaults({ on: true, timer: { mode: "fixed", end: in3days } }, "home"), ) }),
  mo("countdown_product", { config: toStorefrontCountdownBar(withCountdownBarDefaults({ on: true, timer: { mode: "evergreen", hours: 2 } }, "product")) }),
  mo("countdown_cart", { config: toStorefrontCountdownBar(withCountdownBarDefaults({ on: true }, "cart")) }),
  announceDesign({ freeShipping: { on: true, bar: true } }),
  logosDesign({ layout: { lines: 2 } }),
  shipBarDesign,
]);
const withDesign = (d) => ({ ...shop, metaobjects: { ...shop.metaobjects, "$app:cro_design": collectionOf([...shop.metaobjects["$app:cro_design"].values.filter((m) => m.system.handle !== d.system.handle), d]) } });
// Logos with another design: a colour grid with its own heading.
// FAQ with another design: cards, arrow on the left, 2 columns, yellow buttons, no search.
const shopFaqCards = withDesign(faqDesign({ questions: { columns: 2, search: false }, look: { style: "cards", icon: "chevron", iconLeft: true, accent: "#ffbd13" } }));
// "Customers are saying" template: cropped photos, centred, text first; Nour's review keeps its whole photo.
const shopSaying = withDesign(mo("reviews", { config: toStorefrontReviews(applyReviewPreset(withReviewsDefaults({}), "saying")) }));
// Product pages with their own design: the full reviews widget with "Write a review".
const shopWidget = withDesign(mo("reviews_product", { config: toStorefrontReviews(applyReviewPreset(withReviewsDefaults({}, "product"), "widget")) }));
const shopSnippet = withDesign(mo("reviews_product", { config: toStorefrontReviews(applyReviewPreset(withReviewsDefaults({}, "product"), "snippet")) }));
const shopBadge = withDesign(mo("reviews_product", { config: toStorefrontReviews(applyReviewPreset(withReviewsDefaults({}, "product"), "badge")) }));
const shopLogoGrid = withDesign(logosDesign({ layout: { mode: "grid" }, logos: { grayscale: false }, text: { heading: "As seen in" } }));
// The announcement bar with another design: slide, closable, capitals (and no free-shipping message).
const shopSlide = { ...shop, metaobjects: { ...shop.metaobjects, "$app:cro_design": collectionOf([...shop.metaobjects["$app:cro_design"].values.filter((m) => m.system.handle !== "announcement"), announceDesign({ behaviour: { animation: "slide", dismissible: true }, look: { upper: true } })]) } };
shop.metaobjects["$app:cro_recent"] = collectionOf([
  mo("main", {
    purchases: [
      { product: "Classic watch", handle: "classic-watch", image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30", city: "Cairo", at: minutesAgo(5) },
      { product: "Sunglasses", handle: "sunglasses", image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f", city: null, at: minutesAgo(90) },
    ],
  }),
]);
const watch = {
  id: 77, title: "Classic watch", handle: "classic-watch", url: "/products/classic-watch",
  variants: [
    { id: 7701, title: "Silver", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 3 },
    { id: 7702, title: "Black", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 1 },
    { id: 7703, title: "Gold", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 40 },
  ],
};

const empty = { ...shop, metaobjects: { "$app:cro_lists": lists([], [], [], []) } };

async function block(name, overrides = {}, ctx = {}) {
  const settings = { ...defaults(name), ...overrides };
  const globals = {
    shop: ctx.shop ?? shop,
    request: { design_mode: !!ctx.design, page_type: ctx.page_type ?? "index" },
    routes: { root_url: "/", all_products_collection_url: "/collections/all", account_login_url: "/account/login", account_register_url: "/account/register" },
    cart: { total_price: ctx.cartTotal ?? 45000, items: [] },
    product: ctx.product,
    page: ctx.page,
    customer: ctx.customer,
    linklists: ctx.linklists ?? {},
  };
  return engine.renderFile(name, { block: { id: `${name}-${Math.random().toString(36).slice(2, 7)}`, settings, shopify_attributes: "" } }, { globals });
}

const page = (title, body, embeds = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — UCS harness</title><link rel="stylesheet" href="assets/ucs-sections.css"><link rel="stylesheet" href="assets/ucs-wishlist.css"><link rel="stylesheet" href="assets/ucs-cart-extras.css">
<style>:root{--page-width:1200px}body{margin:0;font:15px/1.55 system-ui,sans-serif;color:#121212;background:#fff}header.site{display:flex;justify-content:space-between;align-items:center;padding:18px 40px;border-bottom:1px solid #eee}header.site b{font-size:20px}h3.t{max-width:1200px;margin:32px auto 0;padding:0 40px;font:600 12px/1 monospace;text-transform:uppercase;color:#999}</style>
<script>window.Shopify={routes:{root:'/'},currency:{rate:'1.0'}};window.__cart={total_price:45000};const rf=window.fetch.bind(window);window.fetch=async(u,o)=>{u=String(u);if(u.includes('/cart/add')){window.__cart.total_price+=40000;return new Response('{}')}if(u.includes('/cart.js'))return new Response(JSON.stringify(window.__cart));return rf(u,o)};</script>
</head><body><a href="#main" style="position:absolute;left:-999px">Skip</a><header class="site"><b>Harness shop</b><nav>Home · Catalog · Contact</nav></header><main id="main">${body}</main>${embeds}</body></html>`;
const label = (t) => `<h3 class="t">${t}</h3>`;

const pages = {
  "index.html": page("All sections",
    label("countdown: home section (designed in the app)") + '<div class="shopify-section">' + (await block("ucs-countdown-bar")) + "</div>" +
    label("logos (marquee, two lines)") + (await block("ucs-logos")) +
    label("reviews (carousel, all)") + (await block("ucs-reviews")) +
    label("faq (tabs + search)") + (await block("ucs-faq")),
    (await block("ucs-announcement")) + (await block("ucs-countdown-bar", { position: "bottom", mode: "daily", daily_cutoff: "23:59", text: "Order in the next" }))),
  "variants.html": page("Variants",
    label("countdown: product page, compact (designed in the app)") + '<div class="shopify-section">' + (await block("ucs-countdown-bar", {}, { page_type: "product" })) + "</div>" +
    label("countdown: cart page (daily cut-off)") + '<div class="shopify-section">' + (await block("ucs-countdown-bar", {}, { page_type: "cart" })) + "</div>" +
    label("logos: grid, colour") + (await block("ucs-logos", {}, { shop: shopLogoGrid })) +
    label("reviews: Customers are saying template (one card keeps its whole photo)") + (await block("ucs-reviews", {}, { shop: shopSaying })) +
    label("reviews: chat style, masonry, featured only") + (await block("ucs-reviews", { layout: "masonry", card_style: "chat", filter: "featured" })) +
    label("reviews: carousel, minimal, 4 per row") + (await block("ucs-reviews", { layout: "carousel", card_style: "minimal", columns_desktop: 4 })) +
    label("faq: cards, chevron, 2 columns, only Shipping") + (await block("ucs-faq", { group: "shipping", heading: "Shipping questions" }, { shop: shopFaqCards })),
    (await block("ucs-countdown-bar", { position: "top", mode: "evergreen", evergreen_hours: 2 })) + (await block("ucs-announcement", {}, { shop: shopSlide }))),
  "product.html": page("Product page reviews",
    label("reviews: this product (tee) — expect 2 + JSON-LD") + (await block("ucs-reviews", { filter: "product", layout: "grid" }, { page_type: "product", product: tee })) +
    label("reviews: product page design — full widget, list, Write a review") + (await block("ucs-product-reviews", {}, { page_type: "product", product: tee, shop: shopWidget })) +
    label("reviews: product page — star rating line") + (await block("ucs-product-reviews", {}, { page_type: "product", product: tee, shop: shopBadge })) +
    label("reviews: product page — snippet card") + (await block("ucs-product-reviews", {}, { page_type: "product", product: tee, shop: shopSnippet })) +
    label("reviews: product with none, fallback off — expect nothing") + (await block("ucs-reviews", { filter: "product", fallback: false }, { page_type: "product", product: { id: 99, title: "Lonely", url: "/products/lonely" } }))),
  "empty.html": page("Empty (theme editor)",
    label("logos empty") + (await block("ucs-logos", {}, { shop: empty, design: true })) +
    label("faq empty") + (await block("ucs-faq", {}, { shop: empty, design: true })) +
    label("reviews empty") + (await block("ucs-reviews", {}, { shop: empty, design: true })),
    await block("ucs-announcement", {}, { shop: empty, design: true })),
};
const productJs = {
  id: 77, title: "Classic watch", handle: "classic-watch", featured_image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
  options: [{ name: "Colour", values: ["Silver", "Black", "Gold"] }],
  variants: [
    { id: 7701, title: "Silver", options: ["Silver"], price: 12900, compare_at_price: 15900, available: true },
    { id: 7702, title: "Black", options: ["Black"], price: 12900, compare_at_price: 0, available: true },
    { id: 7703, title: "Gold", options: ["Gold"], price: 13900, compare_at_price: 0, available: true },
  ],
};
const productForm = `<div class="page-width" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;padding:24px 40px;max-width:1100px;margin:0 auto">
  <div style="aspect-ratio:1;background:url(https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600) center/cover;border-radius:16px"></div>
  <div><h1>Classic watch</h1><p style="font-size:20px">$129.00</p>
    <div class="product-form"><form action="/cart/add" method="post" id="product-form-main">
      <label>Colour <select name="id" id="variant">${watch.variants.map((v) => `<option value="${v.id}">${v.title}</option>`).join("")}</select></label>
      <button type="submit" name="add" class="button" style="display:block;width:100%;margin-top:12px;padding:14px;background:#111;color:#fff;border:0;border-radius:24px">Add to cart</button>
    </form></div>
    <div style="height:1400px"></div></div></div>
  <script>const pjs=${JSON.stringify(productJs)};const of=window.fetch;window.fetch=(u,o)=>String(u).includes('/products/')?Promise.resolve(new Response(JSON.stringify(pjs))):of(u,o);</script>`;
// The Points shop (loyalty): a signed in member with 900 points on the watch page (800 points + LE 10), the panel
// list and the Rewards page grid. The app proxy is faked: "me" gives the member's own list, "buy" gives a code.
const { shopFor, toStorefrontLoyalty, withLoyaltyDefaults } = await import("../../app/lib/loyalty/config.ts");
const shopItem = (id, pid, title, handle, image, points, money, show = "all", from = 1) => ({ id, on: true, product: { id: `gid://shopify/Product/${pid}`, title, handle, image, price: 129 }, points, money, only: false, unlisted: false, show, from, limit: 0 });
const loyShop = withLoyaltyDefaults({ on: true, shop: { on: true, items: [
  shopItem("s1", 77, "Classic watch", "classic-watch", "https://images.unsplash.com/photo-1523275335684-37898b6baf30", 800, 10),
  shopItem("s2", 78, "Sunglasses", "sunglasses", "https://images.unsplash.com/photo-1572635196237-14b3f281503f", 500, 0, "afford"),
  shopItem("s3", 79, "Leather bag", "leather-bag", "", 2000, 0, "from", 400),
] } });
const shopLoy = withDesign(mo("loyalty", { config: toStorefrontLoyalty(loyShop, true) }));
const loyMe = { ok: true, member: { points: 900, pending: 0, rewards: [], history: [], shop: [] } };
const loyFake = () => `<script>window.__buys=[];(function(){const me=${JSON.stringify(loyMe)};const of=window.fetch;window.fetch=(u,o)=>{if(!String(u).includes('apps/ucro/loyalty'))return of(u,o);const b=JSON.parse(o.body);if(b.intent==='buy')window.__buys.push(b);const r=b.intent==='buy'?{...me,got:{code:'PTS-TEST',kind:'shop'}}:me;return Promise.resolve(new Response(JSON.stringify(r)))};const cf=window.fetch;window.fetch=(u,o)=>{if(String(u).includes('/cart/add')){document.body.dataset.added=o.body+' '+JSON.stringify(window.__buys);return new Promise(()=>{})}return cf(u,o)};if(location.hash==='#buy')setTimeout(()=>document.querySelector('[data-buy]').click(),1500);})();</script>`;
pages["boosters.html"] = page("Boosters", productForm, (await block("ucs-boosters", {}, { page_type: "product", product: watch })).replace('<link', '<link') + '<link rel="stylesheet" href="assets/ucs-boosters.css">');

{
  const ctx = { page_type: "product", product: watch, shop: shopLoy, customer: { id: 5 } };
  const html = await block("ucs-boosters", {}, ctx);
  // The member's own list from the proxy: all three (900 points: enough for the watch and the sunglasses, past 400 for the bag).
  loyMe.member.shop = shopFor(loyShop, 900);
  pages["loyalty-shop.html"] = page("Points shop", productForm + '<div class="page-width" style="max-width:1100px;margin:0 auto;padding:0 40px" data-ucs-loy-page></div>', loyFake() + html + '<link rel="stylesheet" href="assets/ucs-loyalty.css">');
  pages["loyalty-shop-guest.html"] = page("Points shop (guest)", productForm, (await block("ucs-boosters", {}, { ...ctx, customer: undefined })) + '<link rel="stylesheet" href="assets/ucs-loyalty.css">');
  pages["loyalty-shop-design.html"] = page("Points shop (theme editor)", productForm, (await block("ucs-boosters", {}, { ...ctx, design: true, shop: withDesign(mo("loyalty", { config: toStorefrontLoyalty(withLoyaltyDefaults({ on: true, shop: { on: true, items: [] } }), true) })) })) + '<link rel="stylesheet" href="assets/ucs-loyalty.css">');
}

// Bundle deals: all four types on the watch page, a sunglasses product for the fixed bundle, and a
// working fake cart (add/change/cart.js) so the gift can be added and removed.
const sunglassesJs = { id: 78, title: "Sunglasses", handle: "sunglasses", featured_image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f", price: 4500,
  variants: [{ id: 7801, title: "Default Title", options: ["Default Title"], price: 4500, available: true }] };
const offersData = {
  t: { add_bundle: "Add bundle to cart", bundle_total: "Bundle price", save: "Save {amount}", tier: "Buy {qty}+", off: "{pct}% off", each: "{price} each", free: "free",
    bogo_same: "Add {n} to your cart: {y} of them {reward}", bogo: "Buy {x}, get {y} {reward}", gift_left: "Spend {amount} more to get {gift} free",
    gift_ok: "You've unlocked a free {gift}!", error: "Couldn't add the bundle. Please try again." },
  fbt: { h: "Frequently bought together", img: true, btn: "Buy all [count]: [price]", sv: "amount", ly: "row", al: "center", bd: false, tl: false },
  deals: [
    { id: "d-bogo", t: "bogo", name: "Buy 2, get 1 free", buy: { type: "all", p: [], c: [] }, x: 2, get: { type: "all", p: [], c: [] }, y: 1, pct: 100 },
    { id: "d-vol", t: "volume", name: "Buy more, save more", target: { type: "collections", p: [], c: [500] }, tiers: [{ qty: 3, pct: 15 }, { qty: 2, pct: 10 }] },
    { id: "d-fix", t: "fixed", name: "Watch + sunglasses set", items: [{ h: "classic-watch", id: 77, q: 1 }, { h: "sunglasses", id: 78, q: 1 }], pct: 15 },
    { id: "d-up", t: "upgrade", name: "Upgrade", from: { v: 7701, p: 77, h: "classic-watch", title: "Classic watch — Silver" }, to: { v: 7703, p: 77, h: "classic-watch", title: "Classic watch — Gold", img: null }, text: "Upgrade to {to} for {delta} more", btn: "Upgrade" },
    { id: "d-gift", t: "gift", name: "Free mug", gift: { v: 9901, h: "mug", title: "Ceramic mug", img: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d" }, min: 150, only: null },
  ],
};
const dealShop = { ...shop, metaobjects: { ...shop.metaobjects, "$app:cro_offers": collectionOf([mo("main", { data: offersData })]) } };
const dealCart = `<script>
  window.__dc = { items: [{ key: "w1", id: 7701, product_id: 77, quantity: 1, final_line_price: 12900, properties: {} }] };
  (function () {
    const products = { "classic-watch": ${JSON.stringify({ ...productJs, price: 12900 })}, sunglasses: ${JSON.stringify(sunglassesJs)} };
    const res = (o) => Promise.resolve(new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } }));
    const prices = { 7701: 12900, 7702: 12900, 7703: 13900, 7801: 4500, 9901: 1800 };
    const pids = { 7701: 77, 7702: 77, 7703: 77, 7801: 78, 9901: 99 };
    window.fetch = (u, o) => {
      u = String(u);
      const body = o && o.body ? JSON.parse(o.body) : {};
      if (u.includes("/products/")) return res(products[u.split("/products/")[1].split(".js")[0]]);
      if (u.includes("/cart/add")) {
        (body.items || []).forEach((i) => __dc.items.push({ key: "k" + Math.random().toString(36).slice(2, 6), id: i.id, product_id: pids[i.id], quantity: i.quantity, final_line_price: prices[i.id] * i.quantity, properties: i.properties || {} }));
        return res({ items: __dc.items });
      }
      if (u.includes("/cart/change")) {
        __dc.items = __dc.items.map((i) => (i.key === body.id ? Object.assign(i, { quantity: body.quantity, final_line_price: prices[i.id] * body.quantity }) : i)).filter((i) => i.quantity > 0);
        return res({ items: __dc.items });
      }
      if (u.includes("/cart.js")) return res({ items: __dc.items });
      return res({});
    };
  })();
</script>`;
const dealForm = productForm.replace(/<script>const pjs=[\s\S]*?<\/script>/, "") + dealCart;
pages["deals.html"] = page("Bundle deals", dealForm, (await block("ucs-boosters", {}, { page_type: "product", product: { ...watch, collections: [{ id: 500 }] }, shop: dealShop })) + '<link rel="stylesheet" href="assets/ucs-boosters.css">');

// Quick add on Dawn-style cards. Dawn's ".media > *" rule (which once stretched the button into a
// card-sized oval) is included on purpose; the fake cart answers /products/*.js and /cart/add.js.
const qaCard = (h, title, img, price) => `<div class="card-wrapper" style="width:260px"><div class="card card--media"><div class="card__inner"><div class="card__media"><div class="media" style="position:relative;padding-bottom:125%"><img src="${img}?w=500" alt="" style="object-fit:cover"></div></div></div><div class="card__content"><h3 class="card__heading"><a href="/products/${h}">${title}</a></h3><span>${price}</span></div></div></div>`;
const qaProducts = {
  "classic-watch": { ...productJs, price: 12900 },
  sunglasses: sunglassesJs,
};
const qaPage = `<style>.media{display:block;overflow:hidden}.media > *:not(.zoom):not(.deferred-media__poster-button){display:block;max-width:100%;position:absolute;top:0;left:0;height:100%;width:100%}.card__media{position:relative}</style>
<div style="display:flex;gap:24px;padding:32px 40px">${qaCard("classic-watch", "Classic watch", "https://images.unsplash.com/photo-1523275335684-37898b6baf30", "$129.00")}${qaCard("sunglasses", "Sunglasses", "https://images.unsplash.com/photo-1572635196237-14b3f281503f", "$45.00")}</div>
<script>(function(){const P=${JSON.stringify(qaProducts)};const res=(o)=>Promise.resolve(new Response(JSON.stringify(o),{headers:{"Content-Type":"application/json"}}));window.fetch=(u,o)=>{u=String(u);if(u.includes("/products/"))return res(P[u.split("/products/")[1].split(".js")[0]]);if(u.includes("/cart/add"))return res({items:[{key:"k1",id:7801,quantity:1}]});return res({});};})();</script>`;
pages["quick-add.html"] = page("Quick add", qaPage, (await block("ucs-quick-add", { after: "toast", autohide: 0 })) + '<link rel="stylesheet" href="assets/ucs-quick-add.css">');

// Several designs per section: a block set to Design 2 reads "faq_2"; Design 3 isn't made, so it shows design 1.
const shopTwoFaqs = withDesign(mo("faq_2", { config: toStorefrontFaq(withFaqDefaults({ text: { heading: "Design two heading" }, look: { style: "cards" } })) }));
pages["designs.html"] = page("Several designs",
  label("faq: design 2") + (await block("ucs-faq", { design: "2" }, { shop: shopTwoFaqs })) +
  label("faq: design 3 (not made) — falls back to design 1") + (await block("ucs-faq", { design: "3" }, { shop: shopTwoFaqs })));
if (!pages["designs.html"].includes("Design two heading")) throw new Error("design 2 not used");
if ((pages["designs.html"].match(/Design two heading/g) || []).length !== 1) throw new Error("design 3 should fall back to design 1");
// Back in stock & pre-order: one sold-out variant (Notify me) and one sellable at 0 stock (Pre-order).
const stockProduct = { id: 77, title: "Linen shirt", handle: "linen-shirt", url: "/products/linen-shirt", selected_or_first_available_variant: { id: 701 }, variants: [
  { id: 701, title: "Small", available: false, inventory_management: "shopify", inventory_quantity: 0, inventory_policy: "deny" },
  { id: 702, title: "Medium", available: true, inventory_management: "shopify", inventory_quantity: 0, inventory_policy: "continue" },
  { id: 703, title: "Large", available: true, inventory_management: "shopify", inventory_quantity: 5, inventory_policy: "deny" } ] };
const { toStorefrontStock, withStockDefaults } = await import("../../app/lib/stock-design.ts");
const stockShop = withDesign(mo("stock", { config: toStorefrontStock(withStockDefaults({})) }));
const buyForm = (id) => `<form action="/cart/add" method="post" style="display:grid;gap:8px;max-width:420px;margin:24px 40px 0"><select name="id">${stockProduct.variants.map((v) => `<option value="${v.id}"${v.id === id ? " selected" : ""}>${v.title}</option>`).join("")}</select><button type="submit" name="add" style="min-height:44px">Add to cart</button></form>`;
pages["stock.html"] = page("Back in stock & pre-order",
  label("sold out (Small): Notify me — switch to Medium for pre-order, Large for normal") + '<div class="shopify-section">' + buyForm(701) + '<div style="max-width:420px;margin:0 40px">' + (await block("ucs-stock", {}, { page_type: "product", product: stockProduct, shop: stockShop })) + "</div></div>");
// Track order & Returns pages, with the app's answers mocked (any order number works with any email).
const mockOrders = `<script>(function(){const f=window.fetch;const order={name:"#1001",createdAt:"2026-10-03T10:00:00Z",cancelled:false,payment:"PAID",fulfillment:"FULFILLED",items:[{key:"11",title:"Linen shirt",variant:"Medium",quantity:1,image:null},{key:"12",title:"Classic tee",variant:"Large",quantity:2,image:null}],shipments:[{status:"IN_TRANSIT",company:"Aramex",number:"EG123456789",url:"https://example.com/track",delivered:null,estimated:"2026-10-08T00:00:00Z",tracking:{status:"out",place:"Cairo, C, EG",estimated:"2026-10-08T00:00:00Z",delivered:null,events:[{status:"out",city:"Cairo",province:"C",country:"EG",message:"Out for delivery",at:"2026-10-07T06:00:00Z"},{status:"transit",city:"Alexandria",province:"",country:"EG",message:"Left the hub",at:"2026-10-06T20:00:00Z"}]}}]};window.fetch=async(u,o)=>{u=String(u);if(u.includes("/apps/ucro/track"))return new Response(JSON.stringify({ok:true,order}));if(u.includes("/apps/ucro/returns")){const b=JSON.parse(o.body);return new Response(JSON.stringify(b.intent==="send"?{ok:true}:{ok:true,order}))}return f(u,o)}})();</script>`;
pages["orders.html"] = page("Track order & Returns", mockOrders +
  label("track order page") + (await block("ucs-order-page", { page: "track" }, { page_type: "page" })) +
  label("returns page") + (await block("ucs-order-page", { page: "returns" }, { page_type: "page" })));
// Store lines on both pages, the store credit bonus by the after delivery returns link, and the bonus badge on the Returns page.
const { toStorefrontOrderPage, withOrderPageDefaults } = await import("../../app/lib/order-pages.ts");
const opDesign = (kind) => mo(`${kind}_page`, { config: toStorefrontOrderPage(withOrderPageDefaults({ text: { brand: "Free returns within 30 days\nQuestions? help@example.com" } }, kind)) });
const incentiveShop = withDesign(opDesign("returns"));
const incentiveShopTrack = withDesign(opDesign("track"));
const mockIncentives = `<script>(function(){const f=window.fetch;const items=[{key:"11",title:"Linen shirt",variant:"Medium",quantity:1,image:null,price:"70.00"}];const order={name:"#1002",createdAt:"2026-10-03T10:00:00Z",cancelled:false,payment:"PAID",fulfillment:"FULFILLED",currency:"USD",items,shipments:[{status:"DELIVERED",company:"Aramex",number:"EG1",url:"https://example.com/track",delivered:"2026-10-07T00:00:00Z",estimated:null,tracking:null}],afterDelivery:{reviewUrl:"",reviews:[],returnsHandle:"returns",creditBonus:10}};window.fetch=async(u,o)=>{u=String(u);if(u.includes("/apps/ucro/track"))return new Response(JSON.stringify({ok:true,order}));if(u.includes("/apps/ucro/returns"))return new Response(JSON.stringify({ok:true,order:{name:"#1002",currency:"USD",items},options:{credit:{bonus:10},signIn:null,exchange:null},credits:[],returns:[]}));return f(u,o)}})();</script>`;
pages["order-pages-incentives.html"] = page("Track and Returns: store lines and store credit bonus", mockIncentives +
  label("track order page: store lines; look up any order to see the bonus by the returns link") + (await block("ucs-order-page", { page: "track" }, { page_type: "page", shop: incentiveShopTrack })) +
  label("returns page: store lines; look up, tick the item: store credit first with a 10% extra badge, refund still chosen") + (await block("ucs-order-page", { page: "returns" }, { page_type: "page", shop: incentiveShop })));
const { toStorefrontDelivery, withDeliveryDefaults } = await import("../../app/lib/delivery-design.ts");
const deliveryShop = withDesign(mo("delivery", { config: toStorefrontDelivery(withDeliveryDefaults({ rules: { zones: [{ countries: "SA", min: 5, max: 7 }] } })) }));
const { toStorefrontSizeGuide, withSizeGuideDefaults, SAMPLE_CHART } = await import("../../app/lib/size-guide.ts");
const sgShop = withDesign(mo("size_guide", { config: toStorefrontSizeGuide(withSizeGuideDefaults({ charts: [
  { ...SAMPLE_CHART, id: "p", name: "Pants", match: { all: false, products: [], collections: [], tags: "Pants" }, columns: ["Waist"], rows: [{ size: "30", values: ["76"], height: [null, null], weight: [null, null] }] },
  { ...SAMPLE_CHART, id: "t", name: "Tees", match: { all: false, products: [], collections: [{ handle: "mens", title: "Men" }], tags: "" } },
] })) }));
pages["size-guide.html"] = page("Size guide",
  label("product page: tagged Tees, in the collection mens, so the second chart") + '<div style="max-width:440px;margin:0 40px"><p>Size: S M L</p>' + (await block("ucs-size-guide", {}, { page_type: "product", product: { handle: "classic-tee", tags: ["Summer"], collections: [{ handle: "mens" }] }, shop: sgShop })) + "</div>");
// A chart for all products shows only where the product has a size like option (not on a Gift Card or a candle).
const sgAllShop = withDesign(mo("size_guide", { config: toStorefrontSizeGuide(withSizeGuideDefaults({ charts: [{ ...SAMPLE_CHART, id: "a", match: { all: true, products: [], collections: [], tags: "" } }] })) }));
const sgAll = async (options) => block("ucs-size-guide", {}, { page_type: "product", product: { handle: "p", tags: [], collections: [], options }, shop: sgAllShop });
const sgSized = await sgAll(["Color", "Size"]), sgPlain = await sgAll(["Title"]), sgFr = await sgAll(["Taille"]);
if (!sgSized.includes("data-ucs-sg")) throw new Error("size guide missing on a product with a Size option");
if (!sgFr.includes("data-ucs-sg")) throw new Error("size guide missing on a product with a Taille option");
if (sgPlain.includes("data-ucs-sg")) throw new Error("size guide shown on a product with no size option");
// The Order pages block on "Automatic": the pages the app made show Track and Returns, every other page shows nothing.
const opShop = withDesign(mo("order_pages", { config: { trackHandle: "track-your-order", returnsHandle: "returns" } }));
const opAuto = async (handle, shop) => block("ucs-order-page", {}, { page_type: "page", page: { handle }, shop });
pages["order-pages-auto.html"] = page("Order pages, automatic",
  label("page track-your-order") + (await opAuto("track-your-order", opShop)) + label("page returns") + (await opAuto("returns", opShop)) + label("page about-us (nothing)") + (await opAuto("about-us", opShop)) + label("store without saved pages: shows Track as before") + (await opAuto("anything", shop)));
pages["delivery.html"] = page("Delivery estimate",
  label("product page (Egypt)") + '<div style="max-width:440px;margin:0 40px">' + (await block("ucs-delivery", {}, { page_type: "product", shop: deliveryShop })) + "</div>");
// Tiered rewards bar: free shipping 300, free gift 600, 10% off 900; cart at 450.
const rewardsShop = withDesign(mo("shipping_bar", { config: toStorefrontShippingBar(withShippingBarDefaults({ goal: 300, tiers: [{ goal: 600, reward: "gift", label: "Free gift", progress: "Spend {left} more for a free gift", done: "Free gift unlocked!" }, { goal: 900, reward: "percent", percent: 10, label: "10% off", progress: "Spend {left} more for 10% off", done: "You've unlocked 10% off!" }] })) }));
pages["rewards.html"] = page("Tiered rewards bar", label("free shipping 300 → free gift 600 → 10% off 900 (cart 450)") + (await block("ucs-shipping-bar", {}, { shop: rewardsShop, cartTotal: 45000 })), '<link rel="stylesheet" href="assets/ucs-shipping-bar.css">');
const { toStorefrontPersonalize, withPersonalizeDefaults } = await import("../../app/lib/personalize-design.ts");
const pzShop = withDesign(mo("personalize", { config: toStorefrontPersonalize(withPersonalizeDefaults({ fields: [{ label: "Name to engrave", type: "text", max: 12, required: true, preview: true }, { label: "Colour", type: "color", options: "#d4af37\n#c0c0c0" }], fee: { on: true, variantId: "999", note: "Engraving adds EGP 50." } })) }));
const pzProduct = { id: 88, title: "Bottle", handle: "bottle", featured_image: "https://cdn.shopify.com/s/files/1/0000/0001/files/bottle.jpg", collections: [] };
pages["personalize.html"] = page("Personalization",
  '<script>window.__adds=[];const pf=window.fetch;window.fetch=async(u,o)=>{if(String(u).includes("/cart/add")){window.__adds.push(o.body instanceof FormData?"form":o.body);return new Response(JSON.stringify({items:[{key:"k",variant_id:1}]}))}return pf(u,o)};</script>' +
  '<div class="shopify-section" style="max-width:440px;margin:24px 40px"><form action="/cart/add" method="post"><input type="hidden" name="id" value="501"><button type="submit">Add to cart</button></form>' +
  (await block("ucs-personalize", {}, { page_type: "product", product: pzProduct, shop: pzShop })) + "</div>");
const { toStorefrontCartExtras, withCartExtrasDefaults } = await import("../../app/lib/cart-extras-design.ts");
const ceShop = withDesign(mo("cart_extras", { config: toStorefrontCartExtras(withCartExtrasDefaults({ code: { on: true }, date: { required: true, slots: "10–2 pm\n2–6 pm" } })) }));
pages["cart-extras.html"] = page("Gift note & delivery date",
  // Fake cart codes: SAVE10 takes $10 off the order, FREESHIP is a shipping code (nothing off in the cart), SOLO works only on its own, BEST works but pushes SAVE10 out, anything else is invalid.
  '<script>window.__upd=[];window.__codes=[];const cart=()=>({attributes:{},note:"",currency:"USD",items:[],discount_codes:window.__codes,cart_level_discount_applications:window.__codes.filter(x=>x.applicable&&x.code==="SAVE10").map(()=>({type:"discount_code",key:"SAVE10",title:"SAVE10",total_allocated_amount:1000}))});const cf=window.fetch;window.fetch=async(u,o)=>{u=String(u);if(u.endsWith("cart.js"))return new Response(JSON.stringify(cart()));if(u.includes("cart/update")){window.__upd.push(o.body);const b=JSON.parse(o.body);if("discount" in b){const l=b.discount.split(",").filter(Boolean);window.__codes=l.map(c=>({code:c,applicable:(c==="SAVE10"&&!l.includes("BEST"))||c==="BEST"||c==="FREESHIP"||(c==="SOLO"&&l.length===1)}))}return new Response(JSON.stringify(cart()))}return cf(u,o)};</script>' +
  '<div style="max-width:420px;margin:24px 40px">' + (await block("ucs-cart-extras", {}, { page_type: "cart", shop: ceShop })) + '<button name="checkout" type="button">Check out</button></div>');
// Cart page: an upgrade for a line in the cart, and "add 1 more" for a volume deal on that product.
const cartOffers = { ...offersData, t: { ...offersData.t, more: "Add {n} more to get {pct}% off", more_btn: "Add {n} more" },
  deals: [offersData.deals.find((d) => d.t === "upgrade"), { id: "d-vol2", t: "volume", name: "Buy more, save more", target: { type: "products", p: [77], c: [] }, tiers: [{ qty: 2, pct: 10 }, { qty: 3, pct: 15 }] }] };
const cartShop = { ...shop, metaobjects: { ...shop.metaobjects, "$app:cro_offers": collectionOf([mo("main", { data: cartOffers })]) } };
const cartFake = `<script>
  window.__cc = { items: [{ key: "w1", variant_id: 7701, product_id: 77, quantity: 1, price: 12900, properties: {} }] };
  window.__calls = [];
  (function () {
    const watchJs = ${JSON.stringify({ ...productJs, price: 12900 })};
    const res = (o) => Promise.resolve(new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } }));
    window.fetch = (u, o) => {
      u = String(u); const body = o && o.body ? JSON.parse(o.body) : {};
      if (u.includes("/products/")) return res(watchJs);
      if (u.includes("/cart/")) __calls.push(u.split("/cart/").pop()+ " " + JSON.stringify(body));
      if (u.includes("/cart.js")) return res({ items: __cc.items });
      return res({ items: __cc.items });
    };
  })();
</script>`;
pages["deals-cart.html"] = page("Deals in the cart", cartFake + '<form action="/cart" method="post" style="margin:24px 40px"><p>Cart: 1 × Classic watch — Silver</p></form>', (await block("ucs-boosters", {}, { page_type: "cart", shop: cartShop })) + '<link rel="stylesheet" href="assets/ucs-boosters.css">');
const { toStorefrontWishlist, withWishlistDefaults } = await import("../../app/lib/wishlist-design.ts");
const wlShop = withDesign(mo("wishlist", { config: toStorefrontWishlist(withWishlistDefaults({})) }));
const wlFake = `<script>
  try { localStorage.setItem("ucs-wishlist", JSON.stringify([{ h: "classic-tee", v: 2, p: 50000, t: 1 }, { h: "old-save", p: 0, t: 0 }])); } catch (e) {}
  const wf = window.fetch;
  window.fetch = (u, o) => { u = String(u); if (u.includes("/products/")) return Promise.resolve(new Response(JSON.stringify({ title: u.includes("classic-tee") ? "Classic tee" : "Classic watch", url: "/products/x", price: 995, price_varies: true, featured_image: null, variants: [{ id: 1, title: "Small", price: 995, available: true }, { id: 2, title: "Large", price: 2495, available: true }] }))); return wf(u, o); };
</script>`;
pages["wishlist.html"] = page("Wishlist", wlFake +
  '<div class="shopify-section" style="margin:24px 40px"><form action="/cart/add"><input type="hidden" name="id" value="2"><button type="submit" name="add">Add to cart</button></form>' +
  '<div class="card-wrapper" style="width:200px"><div class="card__media" style="height:120px;background:#eee"></div><a href="/products/classic-tee">Classic tee</a></div></div>' +
  '<div id="fixed-bar" style="position:fixed;left:0;right:0;bottom:0;height:60px;background:#222;z-index:10"></div>' +
  (await block("ucs-order-page", { page: "wishlist" }, { page_type: "page" })),
  await block("ucs-boosters", {}, { page_type: "product", product: { ...watch, handle: "classic-watch", price: 12900 }, shop: wlShop }));
const { toStorefrontQuiz, withQuizDefaults } = await import("../../app/lib/quiz-design.ts");
const quizShop = withDesign(mo("quiz", { config: toStorefrontQuiz(withQuizDefaults({})) }));
const quizFake = `<script>
  window.__qcalls = [];
  const qf = window.fetch;
  const P = (id, title, tags) => ({ id, title, handle: title.toLowerCase().replace(/ /g, "-"), tags, images: [], variants: [{ id: id * 10, price: "450.00", available: true }] });
  window.fetch = (u, o) => { u = String(u); window.__qcalls.push(u + (o && o.body ? " " + o.body : ""));
    if (u.includes("/products.json")) return Promise.resolve(new Response(JSON.stringify({ products: [P(1, "Gift box", ["gift", "classic", "mid"]), P(2, "Bold mug", ["home", "bold", "budget"]), P(3, "Classic watch", ["for-me", "classic", "premium"]), P(4, "Plain tee", ["minimal"])] })));
    return Promise.resolve(new Response("{}")); };
</script>`;
pages["quiz.html"] = page("Product quiz", quizFake + (await block("ucs-quiz", {}, { shop: quizShop })));
// Holdout test: the boosters embed splits shoppers; a holdout shopper gets no app widgets.
const xpShop = withDesign(mo("experiment", { config: { on: true, holdout: 10, since: "2026-10-11T00:00:00Z" } }));
pages["holdout.html"] = page("Holdout test", '<script>try{localStorage.setItem("ucs-xp-2026-10-11T00:00:00Z","holdout")}catch(e){}window.__calls=[];const hf=window.fetch;window.fetch=(u,o)=>{window.__calls.push(String(u)+(o&&o.body?" "+o.body:""));return Promise.resolve(new Response(JSON.stringify({attributes:{}})))};</script><div class="ucs" style="margin:24px 40px">An app widget</div>', await block("ucs-boosters", {}, { shop: xpShop }));

// CRO sections: one shared block, each kind with its default design; the pop up through the boosters embed.
{
  const { BLOCK_KINDS, defaultSec, toStorefrontSec, withSecDefaults } = await import("../../app/lib/cro-sections.ts");
  const img = (seed) => ({ id: `gid://shopify/MediaImage/${seed}`, url: `https://picsum.photos/seed/${seed}/1200/800`, kind: "image", title: seed });
  const extra = {
    product_tabs: { content: { ...defaultSec("product_tabs").content, tabs: [{ title: "Care", text: "Wash cold.", mf: "custom.care" }, { title: "Shipping", text: "Ships in 2 days.", mf: "" }] } },
    before_after: { content: { ...defaultSec("before_after").content, before: img("b1"), after: img("a1") } },
    shoppable: { content: { ...defaultSec("shoppable").content, image: img("look"), spots: [{ x: 30, y: 40, id: "1", handle: "classic-watch", title: "Classic watch", image: null, price: 12900, variant: "gid://shopify/ProductVariant/7701", variants: 3 }] } },
  };
  const designs = BLOCK_KINDS.map((k) => mo(k, { config: toStorefrontSec(withSecDefaults(k, { ...defaultSec(k), ...extra[k] })) }));
  const popup = mo("email_popup", { config: toStorefrontSec(withSecDefaults("email_popup", { ...defaultSec("email_popup"), content: { ...defaultSec("email_popup").content, on: true, show: { delay: 0, scroll: 0, exit: false, pages: "all", every: 7 } } })) });
  const secShop = { ...shop, metaobjects: { ...shop.metaobjects, "$app:cro_design": collectionOf([...shop.metaobjects["$app:cro_design"].values, ...designs, popup]) } };
  const tee = { id: 90, title: "Classic tee", handle: "classic-tee", description: "<p>Soft cotton tee.</p>", metafields: { custom: { care: { value: "<p>Wash at 30.</p>" } } }, variants: [] };
  const fake = `<script>try{localStorage.setItem("ucs-rv",JSON.stringify(["classic-watch","classic-tee"]))}catch(e){}window.__subs=[];const sf=window.fetch;window.fetch=(u,o)=>{u=String(u);if(u.includes("apps/ucro/subscribe")){window.__subs.push(o.body);return Promise.resolve(new Response(JSON.stringify({ok:true,code:"WELCOME-TEST1"})))}if(u.includes("/products/"))return Promise.resolve(new Response(JSON.stringify({handle:"classic-watch",title:"Classic watch",available:true,featured_image:null,variants:[{id:7701,price:12900,available:true}]})));return sf(u,o)};</script>`;
  let body = fake + '<link rel="stylesheet" href="assets/ucs-sec.css">';
  for (const k of BLOCK_KINDS) body += label(`CRO section: ${k}`) + (await block("ucs-section", { kind: k }, { page_type: "product", product: tee, shop: secShop }));
  body += label("CRO section not designed yet (theme editor note)") + (await block("ucs-section", { kind: "guarantee" }, { design: true, shop }));
  pages["cro-sections.html"] = page("CRO sections", body, await block("ucs-boosters", {}, { page_type: "index", shop: secShop }));
}

for (const [file, html] of Object.entries(pages)) fs.writeFileSync(path.join(out, file), html);

// ---------------------------------------------------------------- checks --
const problems = [];
const check = (ok, msg) => ok || problems.push(msg);
for (const [file, html] of Object.entries(pages)) {
  for (const word of ["PAUSED", "HIDDEN"]) check(!html.includes(word), `${file}: hidden item "${word}" was rendered`);
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { problems.push(`${file}: invalid JSON-LD (${e.message})`); }
  }
  check(!/Liquid error|undefined/.test(html.replace(/data-[a-z-]+="[^"]*"/g, "")), `${file}: Liquid error or "undefined" in output`);
}
const idx = pages["index.html"];
const msgs = [...idx.matchAll(/ucs-ab__msg"[^>]*>[\s\S]*?<span>([^<]*)<\/span>/g)].map((m) => m[1]);
check(msgs[0]?.startsWith("Free delivery") && msgs[2]?.startsWith("Third"), `announcements not in "Order" order: ${msgs.join(" | ")}`);
const rows = idx.split('class="ucs-logos__track').slice(1).map((r) => [...r.matchAll(/alt="([^"]+)"/g)].slice(0, 5).map((m) => m[1]).join());
check(rows.length === 2 && rows[0] !== rows[1] && new Set(rows[1].split(",")).size === 5, `logo lines wrong: ${rows.join(" / ")}`);
const variants = pages["variants.html"];
check(/ucs-logos ucs-logos--grid(?![^"]*ucs-logos--gray)/.test(variants) && variants.includes("As seen in"), "logos grid design (colour, own heading) not applied");
check(/ucs-faq ucs-faq--cards ucs-faq--chevron ucs-faq--icon-left/.test(variants) && variants.includes("--ucs-accent: #ffbd13") && variants.includes("Shipping questions") && variants.includes("ucs-faq__list--2"), "FAQ cards design / per-placement heading not applied");
check(idx.includes('type="search"') && !/ucs-faq__list--2/.test(idx), "FAQ default design (search, 1 column) not applied");
check(/data-page="cart"[\s\S]*?"cart":\{[^<]*"on":true/.test(variants), "countdown: the cart page design is not passed to the block");
// Reviews are built in the browser from the passed data: the product page passes only the tee's 2.
const productReviews = (() => {
  const m = /data-ucs-rv data-only="1"[^>]*>\s*<script type="application\/json">([\s\S]*?)<\/script>/.exec(pages["product.html"]);
  try { return m ? JSON.parse(m[1]).r.length : -1; } catch { return -2; }
})();
check(productReviews === 2, `product page should pass only the tee's 2 reviews (got ${productReviews})`);
check((idx.match(/class="ucs-faq__item"/g) || []).length === 4, "FAQ should show the 4 shown questions");
{
  const auto = pages["order-pages-auto.html"];
  const kinds = [...auto.matchAll(/data-ucs-orders="(\w+)"/g)].map((m) => m[1]);
  check(JSON.stringify(kinds) === JSON.stringify(["track", "returns", "track"]), `automatic order pages should show track, returns, nothing, then track for an old store (got ${kinds})`);
}
check(pages["holdout.html"].includes("data-cro-group"), "holdout script should render when the test is on");
check(pages["deals.html"].includes("ucs-deals.js") && !pages["boosters.html"].includes("ucs-deals.js"), "deals script should load only when the shop has deals");
check(/"cols": \[500,0\]/.test(pages["deals.html"].replace(/\s+/g, " ")), "product collection ids should reach the deals script");
{
  const cro = pages["cro-sections.html"];
  for (const k of ["compare_table", "benefits", "product_tabs", "guarantee", "before_after", "shoppable", "recently_viewed", "how_it_works"]) {
    check(cro.includes(`data-ucs-sec="${k}"`) && cro.includes(`assets/ucs-sec-${k}.js`), `CRO section ${k} not rendered or its script not loaded`);
  }
  check(cro.includes('<template data-t="desc"><p>Soft cotton tee.</p></template>') && cro.includes('data-t="custom.care"><p>Wash at 30.</p>'), "product tabs: description or metafield template missing");
  check(cro.includes('data-ucs-sec="email_popup"') && cro.includes("ucs-sec-email_popup.js"), "email pop up not loaded by the boosters embed");
  check(!pages["index.html"].includes("ucs-sec-email_popup.js"), "email pop up must not load when it is off");
  check(cro.includes("Design this section in the app first"), "CRO section: empty note missing in the theme editor");
}
{
  const data = (p) => JSON.parse(/id="ucs-loy-data">(.*?)<\/script>/s.exec(pages[p])?.[1] ?? "null");
  const d = data("loyalty-shop.html");
  check(d?.pid === 77 && d.in === true, "Points shop: the product id and the signed in flag should reach the loyalty script");
  check(JSON.stringify((d?.c.ps ?? []).map((x) => x.id)) === '["s1"]', "Points shop: the public copy should hold only the products everyone sees");
  check(data("loyalty-shop-guest.html")?.in === false && !data("loyalty-shop.html")?.dm, "Points shop: guest flag or design flag wrong");
  check(data("loyalty-shop-design.html")?.dm === 1, "Points shop: the theme editor flag (sample product) is missing");
}
if (problems.length) {
  console.error("✗ sections harness:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("✓ sections checks passed · rendered:", Object.keys(pages).join(", "), "→", path.relative(process.cwd(), out));
