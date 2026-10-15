/**
 * Facts about other Shopify apps for the /compare/ pages. Rules: only what a source says, with the
 * source and the date checked; never guess. Anything not checked shows as "Not checked" on the page.
 * `level` says how sure we are: "vendor" = the app's own listing or website (as found by a web search
 * on the date below; we could not open the pages from our build environment), "third party" = review
 * sites, often out of date. Update this file when you check a listing yourself.
 */
export type Source = { label: string; url: string };
export type Competitor = {
  slug: string;
  name: string;
  listing: string;
  /** What the app is mainly for, from its listing name and description. */
  focus: string;
  pricing: string[];
  level: "vendor" | "third party";
  sources: Source[];
  /** Capabilities its listing name or description states. Missing = not checked. */
  has: Partial<Record<Capability, true>>;
};

export type Capability = "bundles" | "quantity" | "cross_sell" | "bogo" | "gift" | "cart_drawer" | "reviews" | "sections" | "checkout_rules" | "post_purchase";
export const CAPABILITIES: { key: Capability; label: string }[] = [
  { key: "bundles", label: "Bundles (mix and match, kits, fixed sets)" },
  { key: "quantity", label: "Quantity breaks" },
  { key: "cross_sell", label: "Cross sells and upsells" },
  { key: "bogo", label: "Buy X get Y" },
  { key: "gift", label: "Free gift with purchase" },
  { key: "cart_drawer", label: "Cart drawer" },
  { key: "reviews", label: "Product reviews" },
  { key: "sections", label: "Storefront sections (hero, FAQ, carousels…)" },
  { key: "checkout_rules", label: "Payment and delivery rules, order limits" },
  { key: "post_purchase", label: "One click offer after payment" },
];
/** CRO Toolbox: every capability above is in the app today (catalog.ts). */
export const OURS: Record<Capability, true> = { bundles: true, quantity: true, cross_sell: true, bogo: true, gift: true, cart_drawer: true, reviews: true, sections: true, checkout_rules: true, post_purchase: true };

export const CHECKED = "October 15, 2026";

export const COMPETITORS: Competitor[] = [
  {
    slug: "bundler",
    name: "Bundler",
    listing: "https://apps.shopify.com/bundler-product-bundles",
    focus: "Product bundles and discounts.",
    pricing: ["Free plan", "Premium $9.99 a month", "Executive $19.99 a month", "7 day free trial on paid plans"],
    level: "third party",
    sources: [{ label: "ShopDigest", url: "https://www.shopdigest.com/shopify/apps/bundler-product-bundles" }],
    has: { bundles: true },
  },
  {
    slug: "simple-bundles",
    name: "Simple Bundles",
    listing: "https://apps.shopify.com/simple-bundles",
    focus: "Bundles and kits, with inventory synced to the bundled items.",
    pricing: ["Free: 3 bundles and 50 orders a month", "Basic $14 a month", "Grow & Advanced $39 a month", "Plus $149 a month", "Yearly billing saves about 17%"],
    level: "vendor",
    sources: [
      { label: "Shopify App Store listing", url: "https://apps.shopify.com/simple-bundles" },
      { label: "simplebundles.com", url: "https://www.simplebundles.com/" },
    ],
    has: { bundles: true },
  },
  {
    slug: "fast-bundle",
    name: "Fast Bundle",
    listing: "https://apps.shopify.com/fast-bundle",
    focus: "Product bundles.",
    pricing: ["Paid plans from $19 a month, priced by monthly bundle sales", "Reviews disagree on a free plan for live stores", "7 day free trial"],
    level: "third party",
    sources: [{ label: "Bundle app reviews (2026)", url: "https://www.setubridge.com/shopify-fast-bundle-alternatives/" }],
    has: { bundles: true },
  },
  {
    slug: "kaching",
    name: "Kaching Bundles",
    listing: "https://apps.shopify.com/bundle-deals",
    focus: "Bundles and upsells.",
    pricing: ["Free on development stores", "Starter $14.99, Scale $29.99, Pro $59.99 a month", "Each plan capped by the extra revenue the app makes"],
    level: "third party",
    sources: [{ label: "ShopDigest", url: "https://www.shopdigest.com/shopify/apps/bundle-deals" }],
    has: { bundles: true, cross_sell: true },
  },
  {
    slug: "bogos",
    name: "BOGOS",
    listing: "https://apps.shopify.com/freegifts",
    focus: "Free gifts, buy X get Y, bundles and upsells.",
    pricing: ["Free plan reported as limited to 30 orders in total", "Paid plans from $29.99 a month (300 orders)", "7 day free trial"],
    level: "third party",
    sources: [{ label: "Digismoothie review", url: "https://www.digismoothie.com/app/bogos" }],
    has: { gift: true, bogo: true, bundles: true },
  },
  {
    slug: "rebuy",
    name: "Rebuy",
    listing: "https://apps.shopify.com/rebuy",
    focus: "Personalized upsells and cross sells.",
    pricing: ["Free on development stores", "Usage based, reported from about $25 a month and rising with orders", "Free trial"],
    level: "third party",
    sources: [{ label: "Digismoothie review", url: "https://www.digismoothie.com/app/rebuy" }],
    has: { cross_sell: true },
  },
  {
    slug: "vitals",
    name: "Vitals",
    listing: "https://apps.shopify.com/vitals",
    focus: "Many storefront tools in one app (reviews, bundles and more).",
    pricing: ["$29.99 a month plus usage based charges", "7 day free trial"],
    level: "vendor",
    sources: [
      { label: "Shopify App Store listing", url: "https://apps.shopify.com/vitals" },
      { label: "vitals.app", url: "https://vitals.app/all-apps" },
    ],
    has: { reviews: true, bundles: true },
  },
  {
    slug: "section-store",
    name: "Section Store",
    listing: "https://apps.shopify.com/section-factory",
    focus: "Theme sections you buy or add one by one.",
    pricing: ["Free to install", "Most sections $0 to $9, paid once", "Section Store Plus $15 a month (bundles, quantity breaks, cart drawer)"],
    level: "vendor",
    sources: [{ label: "section.store", url: "https://section.store/" }],
    has: { sections: true, bundles: true, quantity: true, cart_drawer: true },
  },
];
