/**
 * The demo store's catalog and content: products (pictures drawn by src/lib/art.ts), collections,
 * reviews, questions, logos and announcements. Names, prices and texts are made up for the demo.
 */
import { STORE_ROOT } from "./shell.mjs";
import { BASE } from "./base.mjs";

const { productImage } = await import("../../site/src/lib/art.ts");
/** Product picture address: a real file from site/public/products when there is one (by handle, then by art kind), else the drawn SVG. */
const KIND_OF = {};
export const imgUrl = (handle) => {
  const real = productImage(handle, KIND_OF[handle] ?? "");
  return `${BASE}/img/${handle}.${real ? real.ext : "svg"}`;
};
const IMG = imgUrl;

/** [handle, title, art kind, tint, price $, compare at $, variants?, extra] */
const P = [
  ["glow-serum", "Glow Serum", "serum", null, 34, 40, { name: "Size", values: [["30 ml", 34], ["50 ml", 46]] }, { tags: ["skincare", "glow"] }],
  ["daily-cream", "Daily Cream", "cream", null, 28, null, null, { tags: ["skincare"] }],
  ["oat-soap", "Oat Soap", "soap", null, 9, null, null, { tags: ["skincare", "gift"] }],
  ["sea-shampoo", "Sea Shampoo", "bottle", null, 19, null, null, { tags: ["skincare"] }],
  ["cedar-candle", "Cedar Candle", "candle", null, 22, null, null, { tags: ["home", "candle"] }],
  ["fig-candle", "Fig Candle", "candle", "#7a4b5c", 22, null, null, { tags: ["home", "candle"] }],
  ["amber-candle", "Amber Candle", "candle", "#a8692b", 22, null, null, { tags: ["home", "candle"] }],
  ["linen-candle", "Linen Candle", "candle", "#8e9aa6", 22, null, null, { tags: ["home", "candle"] }],
  ["sage-candle", "Sage Candle", "candle", "#6f8a6a", 22, null, null, { tags: ["home", "candle"] }],
  ["rose-candle", "Rose Candle", "candle", "#b86b7b", 24, null, null, { tags: ["home", "candle"], stock: 0 }],
  ["clay-mug", "Clay Mug", "mug", null, 18, null, null, { tags: ["home", "gift"] }],
  ["monstera-pot", "Monstera Pot", "plant", null, 32, null, null, { tags: ["home"] }],
  ["studio-tee", "Studio Tee", "tee", null, 26, null, { name: "Size", values: [["S", 26], ["M", 26], ["L", 26], ["XL", 28]] }, { tags: ["apparel"] }],
  ["canvas-tote", "Canvas Tote", "tote", null, 24, null, null, { tags: ["apparel", "gift"] }],
  ["ribbed-socks", "Ribbed Socks", "socks", null, 12, null, null, { tags: ["socks"] }],
  ["stripe-socks", "Stripe Socks", "socks", "#b5523b", 12, null, null, { tags: ["socks"] }],
  ["wool-socks", "Wool Socks", "socks", "#6b705c", 14, null, null, { tags: ["socks"] }],
  ["navy-socks", "Navy Socks", "socks", "#22305a", 12, null, null, { tags: ["socks"] }],
  ["mustard-socks", "Mustard Socks", "socks", "#c99a2e", 12, null, null, { tags: ["socks"] }],
  ["cloud-socks", "Cloud Socks", "socks", "#9fb4c7", 12, null, null, { tags: ["socks"] }],
  ["forest-socks", "Forest Socks", "socks", "#3f6a3b", 12, null, null, { tags: ["socks"] }],
  ["gift-wrap", "Gift wrapping", "gift", "#b08968", 4, null, null, { tags: ["addon"] }],
  ["care-kit", "Calm Night Kit", "gift", "#6b5ca5", 62, 74, null, { tags: ["cro-bundle", "kit"] }],
  ["candle-box", "Candle Box (pick 3)", "gift", "#8b5e3c", 56, 66, null, { tags: ["cro-bundle"] }],
  ["skin-set", "Build Your Skin Set", "gift", "#c98b5e", 0, null, null, { tags: ["cro-bundle"] }],
  ["sock-drawer", "Any 3 Socks", "socks", "#3d5a80", 30, null, null, { tags: ["cro-bundle"] }],
  ["engraved-mug", "Engraved Mug", "mug", "#f1ece4", 24, null, null, { tags: ["personalize"] }],
];

for (const [handle, , kind] of P) KIND_OF[handle] = kind;
export const ART = P.map(([handle, , kind, tint]) => ({ handle, kind, tint }));

let vid = 1000;
const inventory = (stock) => (stock === undefined ? { inventory_management: "shopify", inventory_quantity: 24, inventory_policy: "deny" } : { inventory_management: "shopify", inventory_quantity: stock, inventory_policy: "deny" });

/** Liquid product objects (what blocks see), by handle. */
export const products = {};
/** /products/<handle>.js JSON, by handle. */
export const catalog = {};

P.forEach(([handle, title, , , price, compare, opts, extra], i) => {
  const id = 7000 + i;
  const img = IMG(handle);
  const media = { media_type: "image", src: img, width: 800, height: 800, aspect_ratio: 1, alt: title, id: 9000 + i };
  const stock = extra?.stock;
  const variants = opts
    ? opts.values.map(([v, pr], k) => ({ id: ++vid, title: v, price: pr * 100, compare_at_price: compare ? compare * 100 : null, available: stock !== 0, options: [v], option1: v, ...inventory(k === 0 ? 3 : stock) }))
    : [{ id: ++vid, title: "Default Title", price: price * 100, compare_at_price: compare ? compare * 100 : null, available: stock !== 0, options: ["Default Title"], option1: "Default Title", ...inventory(handle === "glow-serum" ? 3 : stock) }];
  const first = variants.find((v) => v.available) ?? variants[0];
  products[handle] = {
    id,
    title,
    handle,
    url: `${STORE_ROOT}products/${handle}`,
    available: variants.some((v) => v.available),
    variants,
    price: variants[0].price,
    compare_at_price: compare ? compare * 100 : null,
    selected_or_first_available_variant: first,
    first_available_variant: first,
    has_only_default_variant: !opts,
    featured_media: media,
    featured_image: media,
    media: [media],
    images: [media],
    tags: extra?.tags ?? [],
    collections: [],
    options: opts ? [opts.name] : ["Title"],
    options_with_values: opts ? [{ name: opts.name, values: opts.values.map((x) => x[0]) }] : [],
    description: "",
  };
  catalog[handle] = {
    id,
    title,
    handle,
    url: `${STORE_ROOT}products/${handle}`,
    featured_image: img,
    images: [img],
    media: [{ src: img, preview_image: { src: img } }],
    price: variants[0].price,
    price_min: Math.min(...variants.map((v) => v.price)),
    compare_at_price: compare ? compare * 100 : null,
    available: variants.some((v) => v.available),
    tags: extra?.tags ?? [],
    options: opts ? [{ name: opts.name, position: 1, values: opts.values.map((x) => x[0]) }] : [{ name: "Title", position: 1, values: ["Default Title"] }],
    variants: variants.map((v) => ({ id: v.id, title: v.title, price: v.price, compare_at_price: v.compare_at_price, available: v.available, options: v.options, option1: v.option1, featured_image: null, inventory_quantity: v.inventory_quantity, inventory_management: v.inventory_management, inventory_policy: v.inventory_policy })),
  };
});

const COLS = {
  all: P.filter((p) => !(p[7]?.tags ?? []).some((t) => ["cro-bundle", "addon"].includes(t))).map((p) => p[0]),
  candles: P.filter((p) => p[7]?.tags?.includes("candle")).map((p) => p[0]),
  skincare: P.filter((p) => p[7]?.tags?.includes("skincare")).map((p) => p[0]),
  socks: P.filter((p) => p[7]?.tags?.includes("socks")).map((p) => p[0]),
  home: P.filter((p) => p[7]?.tags?.includes("home")).map((p) => p[0]),
  apparel: P.filter((p) => p[7]?.tags?.includes("apparel")).map((p) => p[0]),
  gifts: ["oat-soap", "clay-mug", "canvas-tote", "cedar-candle"],
  bestsellers: ["glow-serum", "studio-tee", "cedar-candle", "clay-mug", "daily-cream", "canvas-tote", "ribbed-socks", "monstera-pot"],
};
const TITLES = { all: "All products", bestsellers: "Best sellers" };
export const collectionHandles = COLS;

/** Liquid collection objects, by handle. */
export const collections = {};
for (const [handle, list] of Object.entries(COLS)) {
  const title = TITLES[handle] ?? handle[0].toUpperCase() + handle.slice(1);
  collections[handle] = { id: 600 + Object.keys(collections).length, handle, title, url: `${STORE_ROOT}collections/${handle}`, products: list.map((h) => products[h]), products_count: list.length, all_products_count: list.length };
  for (const h of list) products[h].collections.push({ id: collections[handle].id, handle, title });
}

// ---------------------------------------------------------------- content metaobjects --
const daysAgo = (d) => new Date(Date.UTC(2026, 9, 14) - d * 86400e3).toISOString().slice(0, 10);
const reviewProduct = (h) => ({ id: products[h].id, title: products[h].title, url: products[h].url, featured_image: products[h].featured_media });
export const reviews = [
  ["Maya R.", "The serum sinks in fast and my skin looks brighter after a week. Already ordered a second bottle.", 5, "glow-serum", "Austin", true, "google"],
  ["Daniel K.", "Smells like a forest after rain. Burns evenly and lasts a long time.", 5, "cedar-candle", "Leeds", true, null],
  ["Priya S.", "Soft, thick and the size guide was spot on.", 5, "studio-tee", "Toronto", true, "instagram"],
  ["Lucas M.", "Great mug, keeps coffee warm and looks lovely on the shelf.", 4, "clay-mug", "Lyon", false, null],
  ["Hannah B.", "Bought the candle box as a gift. Beautifully packed, my sister loved it.", 5, "candle-box", "Dublin", true, "tiktok"],
  ["Sam O.", "Light, gentle cream. No greasy feeling at all.", 5, "daily-cream", "Melbourne", true, null],
].map(([name, text, rating, h, location, verified, source], i) =>
  ({ name, text, rating, product: reviewProduct(h), location, date: daysAgo(i * 4 + 2), verified, featured: i < 4, active: true, position: i + 1, source, media: i === 1 || i === 4 ? products[h].featured_media : null }),
);

export const faq = [
  ["How long does delivery take?", "Orders ship within one working day and arrive in 2 to 4 working days.", "Shipping"],
  ["Do you ship abroad?", "Yes, to over 30 countries. Shipping costs are shown at checkout.", "Shipping"],
  ["Can I return an item?", "Unused items can be returned within 30 days for a full refund.", "Returns"],
  ["How do I start a return?", "Use the Returns page with your order number and email.", "Returns"],
  ["Which payment methods do you accept?", "Cards, Shop Pay, Apple Pay and PayPal.", "Payment"],
  ["Are your candles vegan?", "Yes. They are made from soy wax with cotton wicks.", "Products"],
].map(([question, answer, group], i) => ({ question, answer, group, position: i + 1, active: true }));

const logoSvg = (text, color) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="60"><text x="110" y="42" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="34" fill="${color}">${text}</text></svg>`)}`;
export const logos = [
  ["Arbor", "#2f4b3a"],
  ["Quill", "#7a2e3a"],
  ["Halden", "#1d4ed8"],
  ["Morrow", "#a8692b"],
  ["Ostra", "#111111"],
  ["Vale", "#6b5ca5"],
].map(([name, color], i) => ({ name, image: { media_type: "image", src: logoSvg(name, color), width: 220, height: 60, aspect_ratio: 220 / 60, alt: name }, link: "", position: i + 1 }));

export const announcements = [
  ["Free shipping on orders over $50", "truck"],
  ["New: the autumn candle collection", "fire"],
  ["Order by 2 pm for same day dispatch", "clock"],
].map(([message, icon], i) => ({ message, icon, link: "", position: i + 1, active: true }));

/** What the Track order and Returns pages show for any order number and email. */
export const order = {
  name: "#1042",
  currency: "USD",
  createdAt: "2026-10-09T10:00:00Z",
  cancelled: false,
  payment: "PAID",
  fulfillment: "FULFILLED",
  items: [
    { key: "11", title: "Glow Serum", variant: "30 ml", quantity: 1, image: IMG("glow-serum"), price: 34, swaps: [{ id: "101", title: "50 ml", price: 46 }] },
    { key: "12", title: "Cedar Candle", variant: null, quantity: 2, image: IMG("cedar-candle"), price: 22, swaps: [{ id: "201", title: "Fig", price: 22 }, { id: "202", title: "Amber", price: 22 }] },
  ],
  nextOrder: { code: "NEXT-3FA9C2D1", percent: 10, minimum: 0, endsAt: "2026-11-18T00:00:00Z", currency: "USD" },
  prices: { currency: "USD", subtotal: 78, shipping: 0, discounts: 7.8, tax: 0, total: 70.2 },
  shipments: [{ status: "IN_TRANSIT", company: "UPS", number: "1Z999AA10123456784", url: "#", delivered: null, estimated: "2026-10-16T00:00:00Z" }],
};

/** The Track page's recommendation rows for the demo order: real demo products that are not in the order. */
const rec = (handle) => {
  const p = catalog[handle];
  const v = p.variants.find((x) => x.available) ?? p.variants[0];
  return { handle, title: p.title, image: p.featured_image, price: (v.price / 100).toFixed(2), currency: "USD", variantId: v.id };
};
order.recs = { like: ["daily-cream", "oat-soap", "sea-shampoo", "clay-mug"].map(rec), complete: ["fig-candle", "amber-candle"].map(rec) };

/** "Buy again" for the demo order: the serum is in stock (its first demo variant), the candle is shown as sold out. */
order.buyAgain = { items: [{ variantId: catalog["glow-serum"].variants[0].id, quantity: 1, title: "Glow Serum (30 ml)" }], soldOut: ["Cedar Candle"] };

/** Recent purchases for sales pop ups (no names, ever). */
export const recent = (now) => [
  { product: "Cedar Candle", handle: "cedar-candle", image: IMG("cedar-candle"), city: "Austin", at: new Date(now - 4 * 60e3).toISOString() },
  { product: "Glow Serum", handle: "glow-serum", image: IMG("glow-serum"), city: "Leeds", at: new Date(now - 11 * 60e3).toISOString() },
  { product: "Studio Tee", handle: "studio-tee", image: IMG("studio-tee"), city: null, at: new Date(now - 26 * 60e3).toISOString() },
];
