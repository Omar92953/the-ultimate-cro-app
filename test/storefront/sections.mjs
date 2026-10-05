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

const here = path.dirname(fileURLToPath(import.meta.url));
const ext = path.resolve(here, "../../extensions/cro-storefront");
const out = path.join(here, "out/sections");
fs.mkdirSync(path.join(out, "assets"), { recursive: true });
for (const f of fs.readdirSync(path.join(ext, "assets"))) fs.copyFileSync(path.join(ext, "assets", f), path.join(out, "assets", f));
const locale = JSON.parse(fs.readFileSync(path.join(ext, "locales/en.default.json"), "utf8"));

const engine = new Liquid({ root: [path.join(ext, "blocks"), path.join(ext, "snippets")], extname: ".liquid", strictFilters: true });
engine.registerTag("schema", {
  parse(token, remain) {
    const stream = this.liquid.parser.parseStream(remain);
    stream.on("tag:endschema", () => stream.stop()).on("template", () => {}).on("end", () => { throw new Error("schema not closed"); });
    stream.start();
  },
  *render() {},
});
// Named filter arguments arrive as [key, value] pairs.
const named = (args) => Object.fromEntries(args.filter(Array.isArray));
const attrs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => `${k}="${String(v).replace(/"/g, "&quot;")}"`).join(" ");
engine.registerFilter("image_url", (img, ...args) => {
  const src = img?.src ?? img?.preview_image?.src ?? String(img ?? "");
  const o = named(args);
  return src.startsWith("data:") ? src : `${src}${src.includes("?") ? "&" : "?"}width=${o.width ?? o.height ?? 720}`;
});
engine.registerFilter("image_tag", (url, ...args) => {
  const o = named(args);
  return `<img ${attrs({ src: url, alt: o.alt ?? "", class: o.class, loading: o.loading ?? "lazy", fetchpriority: o.fetchpriority, width: o.width, height: o.height, sizes: o.sizes })}>`;
});
engine.registerFilter("video_tag", (video, ...args) => {
  const o = named(args);
  const flags = ["muted", "loop", "playsinline", "autoplay", "controls"].filter((k) => o[k]).join(" ");
  return `<video ${attrs({ class: o.class, preload: o.preload, poster: video.preview_image?.src })} ${flags}><source src="${video.sources[0].url}" type="video/mp4"></video>`;
});
engine.registerFilter("placeholder_svg_tag", (name, cls) => `<svg class="${cls}" viewBox="0 0 525 300" xmlns="http://www.w3.org/2000/svg"><rect width="525" height="300"/></svg>`);
engine.registerFilter("asset_url", (name) => `assets/${name}`);
engine.registerFilter("handleize", (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
engine.registerFilter("color_brightness", (hex) => {
  const m = String(hex).replace("#", "").match(/../g) || ["0", "0", "0"];
  const [r, g, b] = m.map((x) => parseInt(x, 16));
  return (r * 299 + g * 587 + b * 114) / 1000;
});
engine.registerFilter("t", (key, ...args) => {
  const o = named(args);
  let v = key.split(".").reduce((x, k) => (x ? x[k] : undefined), locale) ?? key;
  if (v && typeof v === "object") v = o.count === 1 ? v.one : v.other;
  return String(v).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => o[k] ?? "");
});

// ---------------------------------------------------------------- mock data --
const f = (value) => ({ value });
const mo = (handle, fields) => ({ system: { handle }, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, f(v)])) });
const collectionOf = (items) => Object.assign(Object.fromEntries(items.map((m) => [m.system.handle, m])), { values: items });
const photo = (seed, w = 800, h = 1000) => ({ media_type: "image", src: `https://picsum.photos/seed/${seed}/${w}/${h}`, width: w, height: h, aspect_ratio: w / h, alt: "" });
const video = (n) => ({ media_type: "video", preview_image: { src: `https://picsum.photos/seed/v${n}/720/900` }, sources: [{ url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" }] });
const logo = (text, color) => ({ media_type: "image", src: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><text x="0" y="44" font-family="Arial" font-weight="700" font-size="40" fill="${color}">${text}</text></svg>`)}`, width: 200, height: 60, aspect_ratio: 200 / 60 });
const tee = { id: 30, title: "Basic tee", url: "/products/basic-tee", featured_image: { src: "https://picsum.photos/seed/tee/300/300" } };
const mug = { id: 31, title: "Logo mug", url: "/products/logo-mug", featured_image: { src: "https://picsum.photos/seed/mug/300/300" } };

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
  mo("r1", { name: "Mariam A.", text: long, rating: 5, source: "whatsapp", product: tee, location: "Cairo", date: "2026-09-12", verified: true, featured: true, active: true, position: 1 }),
  mo("r2", { name: "Youssef K.", text: "Love it! Wearing it in the video 😄", rating: 5, media: video(1), source: "tiktok", source_url: "https://www.tiktok.com/", product: tee, location: "Alexandria", verified: true, featured: true, active: true, position: 2 }),
  mo("r3", { name: "Nour H.", text: "Colours are even better in person.", rating: 4, media: photo("rv3"), source: "instagram", source_url: "https://www.instagram.com/", product: mug, location: "Giza", date: "2026-08-30", verified: false, featured: true, active: true, position: 3 }),
  mo("r4", { name: "Omar S.", text: "Quick delivery, good quality.", rating: 4, source: "google", active: true, position: 4 }),
  mo("r5", { name: "Salma R.", text: "Got it as a gift and my friend loved it.", rating: 5, source: "facebook", product: mug, active: true, position: 5 }),
  mo("r6", { name: "Hidden H.", text: "HIDDEN — must not show", rating: 1, active: false, position: 0 }),
];
// What the app writes to $app:cro_lists "main": shown items, in "Order" order.
const shownInOrder = (items) => items.filter((m) => m.active?.value !== false).sort((a, b) => (a.position?.value ?? 0) - (b.position?.value ?? 0));
const lists = (r, f, l, a) => collectionOf([mo("main", { reviews: shownInOrder(r), faq: shownInOrder(f), logos: shownInOrder(l), announcements: shownInOrder(a) })]);

const shop = {
  name: "Harness shop",
  url: "https://harness.example",
  money_format: "LE {{amount}}",
  metaobjects: {
    "$app:cro_announce": collectionOf(announce),
    "$app:cro_faq": collectionOf(faq),
    "$app:cro_logo": collectionOf(logos),
    "$app:cro_review": collectionOf(reviews),
    "$app:cro_lists": lists(reviews, faq, logos, announce),
  },
};
const empty = { ...shop, metaobjects: { "$app:cro_lists": lists([], [], [], []) } };

function defaults(name) {
  const src = fs.readFileSync(path.join(ext, "blocks", `${name}.liquid`), "utf8");
  const schema = JSON.parse(src.split("{% schema %}")[1].split("{% endschema %}")[0]);
  return Object.fromEntries(schema.settings.filter((s) => s.id).map((s) => [s.id, s.default ?? (s.type === "checkbox" ? false : "")]));
}
async function block(name, overrides = {}, ctx = {}) {
  const settings = { ...defaults(name), ...overrides };
  const globals = {
    shop: ctx.shop ?? shop,
    request: { design_mode: !!ctx.design, page_type: ctx.page_type ?? "index" },
    routes: { root_url: "/", all_products_collection_url: "/collections/all" },
    cart: { total_price: ctx.cartTotal ?? 45000, items: [] },
    product: ctx.product,
  };
  return engine.renderFile(name, { block: { id: `${name}-${Math.random().toString(36).slice(2, 7)}`, settings, shopify_attributes: "" } }, { globals });
}

const page = (title, body, embeds = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — UCS harness</title><link rel="stylesheet" href="assets/ucs-sections.css">
<style>:root{--page-width:1200px}body{margin:0;font:15px/1.55 system-ui,sans-serif;color:#121212;background:#fff}header.site{display:flex;justify-content:space-between;align-items:center;padding:18px 40px;border-bottom:1px solid #eee}header.site b{font-size:20px}h3.t{max-width:1200px;margin:32px auto 0;padding:0 40px;font:600 12px/1 monospace;text-transform:uppercase;color:#999}</style>
<script>window.Shopify={routes:{root:'/'},currency:{rate:'1.0'}};window.__cart={total_price:45000};const rf=window.fetch.bind(window);window.fetch=async(u,o)=>{u=String(u);if(u.includes('/cart/add')){window.__cart.total_price+=40000;return new Response('{}')}if(u.includes('/cart.js'))return new Response(JSON.stringify(window.__cart));return rf(u,o)};</script>
</head><body><a href="#main" style="position:absolute;left:-999px">Skip</a><header class="site"><b>Harness shop</b><nav>Home · Catalog · Contact</nav></header><main id="main">${body}</main>${embeds}</body></html>`;
const label = (t) => `<h3 class="t">${t}</h3>`;

const pages = {
  "index.html": page("All sections",
    label("hero (desktop + mobile images)") + (await block("ucs-hero", { image_desktop: photo("herod", 2400, 1000), image_mobile: photo("herom", 1000, 1250), button_2_label: "Our story" })) +
    label("countdown (fixed date)") + (await block("ucs-countdown", { end_date: new Date(Date.now() + 3 * 86400e3).toISOString().slice(0, 16).replace("T", " ") })) +
    label("logos (marquee, two lines)") + (await block("ucs-logos", { lines: "2" })) +
    label("reviews (carousel, all)") + (await block("ucs-reviews")) +
    label("faq (tabs + search)") + (await block("ucs-faq", { search: true })),
    (await block("ucs-announcement", { free_shipping: true, fs_threshold: 1000 })) + (await block("ucs-countdown-bar", { position: "bottom", mode: "daily", daily_cutoff: "23:59", text: "Order in the next" }))),
  "variants.html": page("Variants",
    label("hero: no images, text box, centred, small") + (await block("ucs-hero", { text_box: true, position_desktop: "mc", height_desktop: "small", full_width: false })) +
    label("countdown: evergreen 1h, row, plain") + (await block("ucs-countdown", { mode: "evergreen", evergreen_hours: 1, layout: "row", style: "plain", bg: "#fff4e5" })) +
    label("countdown: already ended → message") + (await block("ucs-countdown", { end_date: "2020-01-01 00:00", ended: "message" })) +
    label("countdown: already ended → hide (nothing below this line)") + (await block("ucs-countdown", { end_date: "2020-01-01 00:00", ended: "hide" })) +
    label("logos: grid, colour") + (await block("ucs-logos", { mode: "grid", grayscale: false, heading: "As seen in" })) +
    label("reviews: chat style, masonry, featured only") + (await block("ucs-reviews", { layout: "masonry", card_style: "chat", filter: "featured" })) +
    label("reviews: grid, minimal, full text") + (await block("ucs-reviews", { layout: "grid", card_style: "minimal", clamp: 0, columns_desktop: 4 })) +
    label("faq: cards, chevron, 2 columns, only Shipping") + (await block("ucs-faq", { style: "cards", icon: "chevron", columns: "2", group: "shipping", accent: "#ffbd13" })),
    (await block("ucs-countdown-bar", { position: "top", mode: "evergreen", evergreen_hours: 2 })) + (await block("ucs-announcement", { animation: "slide", dismissible: true, uppercase: true }))),
  "product.html": page("Product page reviews",
    label("reviews: this product (tee) — expect 2 + JSON-LD") + (await block("ucs-reviews", { filter: "product", layout: "grid" }, { page_type: "product", product: tee })) +
    label("reviews: product with none, fallback off — expect nothing") + (await block("ucs-reviews", { filter: "product", fallback: false }, { page_type: "product", product: { id: 99, title: "Lonely", url: "/products/lonely" } }))),
  "empty.html": page("Empty (theme editor)",
    label("logos empty") + (await block("ucs-logos", {}, { shop: empty, design: true })) +
    label("faq empty") + (await block("ucs-faq", {}, { shop: empty, design: true })) +
    label("reviews empty") + (await block("ucs-reviews", {}, { shop: empty, design: true })),
    await block("ucs-announcement", {}, { shop: empty, design: true })),
};
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
check((pages["product.html"].match(/class="ucs-rv__card /g) || []).length === 2, "product page should show only the tee's 2 reviews");
check(/"reviewCount":2/.test(pages["product.html"]), "product JSON-LD should count 2 reviews");
check((idx.match(/class="ucs-faq__item"/g) || []).length === 4, "FAQ should show the 4 shown questions");
if (problems.length) {
  console.error("✗ sections harness:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("✓ sections checks passed · rendered:", Object.keys(pages).join(", "), "→", path.relative(process.cwd(), out));
