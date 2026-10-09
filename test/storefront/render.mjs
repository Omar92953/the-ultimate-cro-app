/**
 * Local storefront harness: renders the theme app extension's real Liquid blocks with LiquidJS
 * and mock shop data, so the storefront JS can be exercised in a browser without a store.
 *
 *   node test/storefront/render.mjs && npx http-server test/storefront/out   (or python3 -m http.server)
 *
 * LiquidJS is close to, not identical to, Shopify Liquid — this catches logic and JSON errors,
 * it does not replace testing on a development store.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Liquid } from "liquidjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ext = path.resolve(here, "../../extensions/cro-storefront");
const out = path.join(here, "out");
fs.mkdirSync(path.join(out, "assets"), { recursive: true });
for (const f of fs.readdirSync(path.join(ext, "assets"))) fs.copyFileSync(path.join(ext, "assets", f), path.join(out, "assets", f));

const locale = JSON.parse(fs.readFileSync(path.join(ext, "locales/en.default.json"), "utf8"));
const MONEY_FORMAT = "LE {{amount}}";

const engine = new Liquid({ root: [path.join(ext, "blocks"), path.join(ext, "snippets")], extname: ".liquid", strictFilters: true });
engine.registerTag("schema", {
  parse(token, remain) {
    this.tpls = [];
    const stream = this.liquid.parser.parseStream(remain);
    stream.on("tag:endschema", () => stream.stop()).on("template", () => {}).on("end", () => { throw new Error("schema not closed"); });
    stream.start();
  },
  *render() {},
});
const money = (cents) => `LE ${(Number(cents) / 100).toFixed(2)}`;
engine.registerFilter("money", money);
engine.registerFilter("image_url", (img, opts) => (img ? `${img.src || img}${String(img.src || img).includes("?") ? "&" : "?"}width=${720}` : ""));
engine.registerFilter("image_tag", (url, ...args) => `<img src="${url}" alt="" loading="lazy" width="400" height="400">`);
engine.registerFilter("placeholder_svg_tag", (name, cls) => `<svg class="${cls}" viewBox="0 0 10 10"></svg>`);
engine.registerFilter("asset_url", (name) => `assets/${name}`);
engine.registerFilter("t", (key) => key.split(".").reduce((o, k) => (o ? o[k] : undefined), locale) ?? key);

// ---------------------------------------------------------------- mock data --
const img = (n) => ({ src: `https://picsum.photos/seed/ucro${n}/400/400` });
const variant = (id, title, price, available = true) => ({ id, title, price, available });
const product = (id, title, variants, extra = {}) => ({
  id,
  title,
  handle: title.toLowerCase().replace(/\W+/g, "-"),
  url: `/products/${title.toLowerCase().replace(/\W+/g, "-")}`,
  available: variants.some((v) => v.available),
  variants,
  price: variants[0].price,
  selected_or_first_available_variant: variants.find((v) => v.available) || variants[0],
  first_available_variant: variants.find((v) => v.available),
  has_only_default_variant: variants.length === 1,
  featured_media: img(id),
  collections: [],
  ...extra,
});
const P = {
  batman: product(1, "Batman keychain", [variant(101, "Default Title", 14900)]),
  sticker: product(2, "Sticker pack", [variant(201, "Small", 5000), variant(202, "Large", 9000), variant(203, "XL", 12000, false)]),
  cairokee: product(3, "Cairokee keychain", [variant(301, "Default Title", 14900)]),
  soldout: product(4, "Sold-out poster", [variant(401, "Default Title", 20000, false)]),
  poster1: product(5, "Poster One", [variant(501, "Default Title", 14900)]),
  poster2: product(6, "Poster Two", [variant(601, "A3", 14900), variant(602, "A2", 19900)]),
  poster3: product(7, "Poster Three", [variant(701, "Default Title", 14900)]),
  frame: product(8, "Frame", [variant(801, "Default Title", 9900)]),
  bundle: product(9, "Any 3 posters", [variant(901, "Default Title", 39900)]),
};
// Tee: Color × Size, sizes priced up, one sold-out combination.
const teeVariants = [];
let tvId = 1000;
for (const color of ["Black", "White"]) {
  for (const [size, price] of [["S", 2000], ["M", 2000], ["L", 2400], ["XL", 2800]]) {
    const v = variant(++tvId, `${color} / ${size}`, price, !(color === "White" && size === "XL"));
    v.options = [color, size];
    teeVariants.push(v);
  }
}
P.tee = product(30, "Basic tee", teeVariants, {
  options_with_values: [{ name: "Color", values: ["Black", "White"] }, { name: "Size", values: ["S", "M", "L", "XL"] }],
});
for (const p of Object.values(P)) for (const v of p.variants) v.options = v.options || [v.title];
const keychains = { id: 50, handle: "keychains", products: [P.batman, P.cairokee] };
P.batman.collections = [keychains];
P.cairokee.collections = [keychains];
const frames = { id: 51, handle: "frames", url: "/collections/frames", products: [P.frame] };
P.frame.collections = [frames];

const f = (value) => ({ value });
const metaobject = (handle, fields) => ({ system: { handle }, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, f(v)])) });
const collectionOf = (items) => Object.assign(Object.fromEntries(items.map((m) => [m.system.handle, m])), { values: items });

const rules = [
  metaobject("rule-cross-1", {
    kind: "cross_sell", active: true, priority: 5, trigger_type: "products", trigger_products: [P.batman], trigger_collections: [],
    offered_products: [P.sticker, P.cairokee, P.soldout, P.batman], placements: ["product", "drawer"], headline: "Pairs well with",
    subheadline: "Tick what you like", button_label: "Add selected to cart", discount_percent: 10.0,
  }),
  metaobject("rule-cross-2", {
    kind: "cross_sell", active: true, priority: 50, trigger_type: "all", trigger_products: [], trigger_collections: [],
    offered_products: [P.frame], placements: ["product"], headline: "Lower priority — must not win", discount_percent: 0,
  }),
  metaobject("rule-upsell-1", {
    kind: "upsell", active: true, priority: 1, trigger_type: "collections", trigger_products: [], trigger_collections: [keychains],
    tiers: [{ qty: 1, pct: 0 }, { qty: 2, pct: 10 }, { qty: 3, pct: 15, badge: "Most popular" }], placements: ["product"], headline: "Buy more, save more",
  }),
  metaobject("rule-paused", { kind: "upsell", active: false, priority: 0, trigger_type: "all", tiers: [{ qty: 5, pct: 50 }], placements: ["product"], headline: "PAUSED — must not show" }),
];

const video = (n) => ({
  alt: `Video ${n}`,
  preview_image: img(100 + n),
  sources: [
    { mime_type: "application/x-mpegURL", url: "https://example.com/v.m3u8", height: 1080 },
    { mime_type: "video/mp4", url: `https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4?h=1080&n=${n}`, height: 1080 },
    { mime_type: "video/mp4", url: `https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4?h=720&n=${n}`, height: 720 },
    { mime_type: "video/mp4", url: `https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4?h=360&n=${n}`, height: 360 },
  ],
});
const slides = [
  metaobject("s1", { video: video(1), product: P.batman, caption: "Unboxing" }),
  metaobject("s2", { video: video(2), product: P.sticker, caption: "" }),
  metaobject("s3", { video: video(3), product: null, caption: "No product linked" }),
  metaobject("s4", { video: null, image: img(44), product: P.soldout, caption: "Image slide" }),
  metaobject("s5", { video: video(5), product: P.cairokee, caption: "" }),
];

const steps = [
  metaobject("st1", { label: "Choose 2 posters", required: true, min_picks: 2, max_picks: 2, products: [P.poster1, P.poster2, P.poster3, P.soldout], collection: null }),
  metaobject("st2", { label: "Add a frame (optional)", required: false, min_picks: 0, max_picks: 1, products: null, collection: frames }),
];
const bundles = [metaobject("bundle-1", { name: "Any 3", active: true, product: P.bundle, steps, allow_duplicates: true, hide_sold_out: true })];

const shop = {
  name: "Harness shop",
  money_format: MONEY_FORMAT,
  metaobjects: {
    "$app:cro_settings": collectionOf([metaobject("settings", { cross_sell_enabled: true, upsell_enabled: true, videos_enabled: true, bundles_enabled: true })]),
    "$app:cro_rule": collectionOf(rules),
    "$app:cro_carousel": collectionOf([metaobject("main", { slides })]),
    "$app:cro_bundle": collectionOf(bundles),
  },
};

// The upsell look as the app saves it ($app:cro_design "upsell", see app/lib/upsell-design.ts).
const listDesign = { list: true, label: "Buy [quantity]", ss: true, save: "Save [percent]%", pi: true, il: "#[n]", own: false, btn: "Add to cart", hc: "ucro__heading--medium ucro__heading--label", cls: "", rad: "custom", css: "--ucro-align: left; --ucro-gap: 12px; --ucro-pt: 12px; --ucro-pb: 12px; --ucro-accent: #2563eb; --ucro-radius: 12px;" };
const shopWith = (extraRules, design) => ({
  ...shop,
  metaobjects: { ...shop.metaobjects, "$app:cro_rule": collectionOf(extraRules), ...(design ? { "$app:cro_design": collectionOf([metaobject("upsell", { config: design })]) } : {}) },
});
const quantityListRule = metaobject("rule-qty-tee", {
  kind: "upsell", active: true, priority: 1, trigger_type: "all", upsell_type: "quantity",
  tiers: [{ qty: 1, pct: 0 }, { qty: 2, pct: 10, badge: "Most popular" }, { qty: 3, pct: 15 }], placements: ["product"], headline: "Buy more, save more",
});
const sizeRule = metaobject("rule-size-tee", {
  kind: "upsell", active: true, priority: 1, trigger_type: "all", upsell_type: "variant", option_name: "Size",
  tiers: [{ value: "M", pct: 0 }, { value: "L", pct: 10, badge: "Best value" }, { value: "XL", pct: 20 }], placements: ["product"], headline: "Choose your size",
});

// Block settings = schema defaults (what a merchant gets right after adding the block).
function defaults(name) {
  const src = fs.readFileSync(path.join(ext, "blocks", `${name}.liquid`), "utf8");
  const schema = JSON.parse(src.split("{% schema %}")[1].split("{% endschema %}")[0]);
  return Object.fromEntries(schema.settings.filter((s) => s.id).map((s) => [s.id, s.default ?? (s.type === "checkbox" ? false : "")]));
}

async function block(name, ctx, overrides = {}, shopObj = shop) {
  const settings = { ...defaults(name), ...overrides };
  // Shopify objects are global (visible inside rendered snippets), like on a real store.
  const globals = { shop: shopObj, request: { design_mode: false, page_type: ctx.page_type }, template: { name: ctx.page_type }, cart: ctx.cart ?? { items: [] } };
  return engine.renderFile(name, { ...ctx, block: { id: name, settings, shopify_attributes: "" } }, { globals });
}

const productPage = await Promise.all([
  block("ucro-upsell", { product: P.batman, page_type: "product" }),
  block("ucro-cross-sell", { product: P.batman, page_type: "product" }),
]);
const carousel = await block("ucro-video-carousel", { product: P.batman, page_type: "product" });
// Video carousel designed in the app ($app:cro_design "videos"): page rules, wording, hidden parts.
const vcDesign = (extra) => ({ ...shop, metaobjects: { ...shop.metaobjects, "$app:cro_design": collectionOf([metaobject("videos", { config: { h: "Watch", sub: "", hc: "ucro__heading--small", ap: false, sp: true, sa: false, al: "Buy", ar: false, cls: " ucro-hide-mobile", so: "everywhere", pt: [], hs: [], css: "--ucro-vc-desktop: 3;", ...extra } })]) } });
const vcChecks = {
  designed: await block("ucro-video-carousel", { product: P.batman, page_type: "product" }, {}, vcDesign({})),
  onlyHome: await block("ucro-video-carousel", { product: P.batman, page_type: "product" }, {}, vcDesign({ so: "only", pt: ["index"] })),
  onlyProduct: await block("ucro-video-carousel", { product: P.batman, page_type: "product" }, {}, vcDesign({ so: "only", pt: ["product"] })),
  exceptHandle: await block("ucro-video-carousel", { product: P.batman, page_type: "product" }, {}, vcDesign({ so: "except", hs: [P.batman.handle] })),
};
console.log("video carousel:", JSON.stringify({
  default: { heading: /ucro__heading--large">See it in action/.test(carousel), arrows: carousel.includes("ucro-vc__nav"), add: carousel.includes("ucro-vc__add"), autoplay: carousel.includes('data-autoplay="true"') },
  designed: { heading: /ucro__heading--small">Watch/.test(vcChecks.designed), arrows: vcChecks.designed.includes("ucro-vc__nav"), add: vcChecks.designed.includes("ucro-vc__add"), price: vcChecks.designed.includes("ucro-vc__price"), autoplay: vcChecks.designed.includes('data-autoplay="false"'), cls: vcChecks.designed.includes('class="ucro ucro-vc ucro-hide-mobile"') },
  onlyHome: vcChecks.onlyHome.includes("ucro-vc__track"),
  onlyProduct: vcChecks.onlyProduct.includes("ucro-vc__track"),
  exceptHandle: vcChecks.exceptHandle.includes("ucro-vc__track"),
}));
const drawer = await block("ucro-cart-offers", { page_type: "product" });
// Cross-sell designed in the app ($app:cro_design "cross_sell"): Shopify recommendations when no rule matches.
const crossDesign = (extra) => ({ ...shop, metaobjects: { ...shop.metaobjects, "$app:cro_design": collectionOf([metaobject("cross_sell", { config: { fb: "none", rh: "Pairs well with", rl: 4, btn: "Add selected to cart", hc: "ucro__heading--medium", cls: " ucro-cross--panel", rad: "theme", css: "--ucro-pt: 16px; --ucro-pb: 16px;", ...extra } })]) } });
const recs = await block("ucro-cross-sell", { product: P.frame, page_type: "product" }, {}, crossDesign({ fb: "recommendations", rh: "You may also like", rl: 3 }));
const crossNoPanel = await block("ucro-cross-sell", { product: P.batman, page_type: "product" }, {}, crossDesign({ cls: "", btn: "Add these" }));
console.log("cross-sell:", JSON.stringify({
  defaultPanel: productPage[1].includes('class="ucro ucro-cross ucro-cross--panel"'),
  recommendations: recs.includes('data-mode="recommend"') && recs.includes("You may also like") && recs.includes('data-limit="3"'),
  noPanel: crossNoPanel.includes('class="ucro ucro-cross"') && crossNoPanel.includes("Add these") === false ? "rule label wins" : crossNoPanel.includes('class="ucro ucro-cross"'),
  neverPreTicked: !/ucro-offer__check" checked/.test(productPage[1]),
}));
const bundlePage = await block("ucro-bundle-builder", { product: P.bundle, page_type: "product" });
// Bundle builder designed in the app ($app:cro_design "bundles"): the theme's own button adds the bundle.
const bundleDesign = (extra) => ({ ...shop, metaobjects: { ...shop.metaobjects, "$app:cro_design": collectionOf([metaobject("bundles", { config: { h: "Pick your set", sub: "", hc: "ucro__heading--large", pk: "Choose", pd: "Chosen", sm: true, val: "Worth [amount]", sv: "Save [amount]", st: true, tb: false, btn: "Add set", rem: "[remaining] to go", css: "--ucro-cols-d: 3; --ucro-accent: #16a34a;", ...extra } })]) } });
const bundleThemeBtn = await block("ucro-bundle-builder", { product: P.bundle, page_type: "product" }, {}, bundleDesign({ tb: true }));
const bundleStyled = await block("ucro-bundle-builder", { product: P.bundle, page_type: "product" }, {}, bundleDesign({}));
console.log("bundle builder:", JSON.stringify({
  default: { heading: /ucro__heading--medium">Build your bundle/.test(bundlePage), pick: />Add<\/button>/.test(bundlePage), theme: bundlePage.includes('data-theme-button="false"'), summary: bundlePage.includes("data-picks") },
  styled: { heading: /ucro__heading--large">Pick your set/.test(bundleStyled), pick: />Choose<\/button>/.test(bundleStyled), sticky: bundleStyled.includes("is-sticky"), words: bundleStyled.includes('data-t-remaining="[remaining] to go"'), css: bundleStyled.includes("--ucro-accent: #16a34a") },
  themeButton: bundleThemeBtn.includes('data-theme-button="true"'),
  noSummary: !(await block("ucro-bundle-builder", { product: P.bundle, page_type: "product" }, {}, bundleDesign({ sm: false }))).includes("data-picks"),
}));
const noteDesign = await engine.renderFile("ucro-upsell", { product: P.frame, block: { id: "x", settings: defaults("ucro-upsell"), shopify_attributes: "" } }, { globals: { shop, request: { design_mode: true }, template: { name: "product" }, cart: { items: [] } } });
const cartPage = await block("ucro-cross-sell", { page_type: "cart", cart: { items: [{ product_id: P.batman.id, product: P.batman }, { product_id: P.cairokee.id, product: P.cairokee }] } });

const shell = fs.readFileSync(path.join(here, "shell.html"), "utf8");
const page = (title, productId, variantId, body) =>
  shell.replaceAll("{{TITLE}}", title).replaceAll("{{PRODUCT_ID}}", productId).replaceAll("{{VARIANT_ID}}", variantId).replace("{{BODY}}", body).replace("{{DRAWER_EMBED}}", drawer);

fs.writeFileSync(path.join(out, "product.html"), page("Product page", P.batman.id, 101, productPage.join("\n") + `<div class="page-width">${recs}</div>` + carousel));
fs.writeFileSync(path.join(out, "bundle.html"), page("Bundle page", P.bundle.id, 901, bundlePage));
fs.writeFileSync(path.join(out, "bundle-theme-button.html"), page("Bundle page (theme button)", P.bundle.id, 901, bundleThemeBtn));
fs.writeFileSync(path.join(out, "editor-note.html"), noteDesign);

// Upsell: grouped list + a size picker per item; and size-upgrade tiers.
const teeSv = P.tee.variants[1]; // Black / M
const teeCtx = { product: { ...P.tee, selected_or_first_available_variant: teeSv }, page_type: "product" };
const sizePicker = `<fieldset class="product-form__input"><legend>Size</legend>${["S", "M", "L", "XL"].map((s) => `<input type="radio" id="opt-size-${s}" name="Size-1" value="${s}"${s === "M" ? " checked" : ""}><label for="opt-size-${s}">${s}</label>`).join("")}</fieldset>`;
const teeScript = `<script>window.__variants=${JSON.stringify(P.tee.variants)};document.addEventListener('change',function(e){if(!e.target.name||e.target.name.indexOf('Size')!==0)return;var id=document.querySelector('#product-form-main [name="id"]');var cur=window.__variants.find(function(v){return String(v.id)===id.value});var next=window.__variants.find(function(v){return v.options[0]===cur.options[0]&&v.options[1]===e.target.value});if(next){id.value=next.id;window.publish(window.PUB_SUB_EVENTS.variantChange,{data:{variant:{id:next.id}}});}});</script>`;
fs.writeFileSync(path.join(out, "upsell-list.html"), page("Tee — grouped list", P.tee.id, teeSv.id,
  sizePicker + (await block("ucro-upsell", teeCtx, {}, shopWith([quantityListRule], listDesign))) + teeScript));
fs.writeFileSync(path.join(out, "upsell-size.html"), page("Tee — size upgrade", P.tee.id, teeSv.id,
  sizePicker + (await block("ucro-upsell", teeCtx, {}, shopWith([sizeRule], { ...listDesign, hc: "ucro__heading--medium" }))) + teeScript));
// "See it on my store": the draft design shows only in the theme editor (design mode).
{
  const withDraft = { ...shopWith([quantityListRule]), metaobjects: { ...shopWith([quantityListRule]).metaobjects, "$app:cro_design": collectionOf([metaobject("upsell", { config: listDesign }), metaobject("upsell_draft", { config: { ...listDesign, list: false, cls: " ucro-scheme color-accent-2" } })]) } };
  const render = (design_mode) => engine.renderFile("ucro-upsell", { ...teeCtx, block: { id: "u", settings: {}, shopify_attributes: "" } }, { globals: { shop: withDraft, request: { design_mode, page_type: "product" }, template: { name: "product" }, cart: { items: [] } } });
  const [live, editor] = [await render(false), await render(true)];
  console.log("upsell draft:", JSON.stringify({ liveIsList: live.includes("ucro-upsell--list"), liveNoScheme: !live.includes("ucro-scheme"), editorScheme: editor.includes("ucro-scheme color-accent-2"), editorCards: !editor.includes("ucro-upsell--list") }));
}
// Bundles built anywhere: "Add to bundle" on a product page, "+" on the step collection's cards, the tray.
{
  // Shopify adds an embed's schema stylesheet itself; the harness links it.
  const embed = async (ctx) => '<link rel="stylesheet" href="assets/ucro-bundle-tray.css">' + await engine.renderFile("ucro-bundle-tray", { ...ctx, block: { id: "bt", settings: {}, shopify_attributes: "" } }, { globals: { shop, request: { design_mode: false, page_type: ctx.page_type }, template: { name: ctx.page_type }, cart: { items: [] } } });
  const atb = await block("ucro-add-to-bundle", { product: P.poster2, page_type: "product" });
  fs.writeFileSync(path.join(out, "bundle-anywhere-product.html"), page("Poster Two — Add to bundle", P.poster2.id, 601, atb + (await embed({ page_type: "product", product: P.poster2 }))));
  const card = (p) => `<li class="card-wrapper" style="list-style:none;width:180px;border:1px solid #ddd;padding:8px"><a href="${p.url}"><img src="${p.featured_media.src}" width="160" height="160" alt=""><br>${p.title}</a></li>`;
  const grid = `<ul style="display:flex;gap:12px;padding:0">${[P.frame, P.poster1, P.poster3, P.batman].map(card).join("")}</ul>`;
  fs.writeFileSync(path.join(out, "bundle-anywhere-collection.html"), page("Frames collection", P.frame.id, 801, grid + (await embed({ page_type: "collection", collection: frames }))));
  console.log("bundle anywhere:", JSON.stringify({ button: atb.includes("data-ucro-atb") ? atb.match(/data-fits="([^"]*)"/)[1] : "none" }));
}
fs.writeFileSync(path.join(out, "cart-page.html"), cartPage);
fs.writeFileSync(path.join(out, "catalog.json"), JSON.stringify(P, (k, v) => (k === "collections" ? undefined : v)));
console.log("rendered:", fs.readdirSync(out).join(", "));
