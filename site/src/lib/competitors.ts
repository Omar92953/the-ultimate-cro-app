/**
 * Facts about other Shopify apps for the /compare/ pages. Rules: only what a source says, with the
 * source and the date checked; never guess. Anything not checked shows as "Not checked" on the page.
 * `level` says how sure we are: "vendor" = the app's own Shopify App Store listing or website, opened
 * on the date below; "third party" = review sites, often out of date. Update this file when you check a listing yourself.
 */
export type Source = { label: string; url: string };
export type Competitor = {
  slug: string;
  name: string;
  listing: string;
  /** What the app is mainly for, from its listing name and description. */
  focus: string;
  pricing: string[];
  /** Rating and review count shown on its listing on the checked date. */
  rating?: string;
  level: "vendor" | "third party";
  sources: Source[];
  /** Capabilities its listing name or description states. Missing = not checked. */
  has: Partial<Record<Capability, true>>;
};

export type Capability = "bundles" | "quantity" | "cross_sell" | "bogo" | "gift" | "reviews" | "sections" | "checkout_rules" | "post_purchase";
export const CAPABILITIES: { key: Capability; label: string }[] = [
  { key: "bundles", label: "Bundles (mix and match, kits, fixed sets)" },
  { key: "quantity", label: "Quantity breaks" },
  { key: "cross_sell", label: "Cross sells and upsells" },
  { key: "bogo", label: "Buy X get Y" },
  { key: "gift", label: "Free gift with purchase" },
  { key: "reviews", label: "Product reviews" },
  { key: "sections", label: "Storefront sections (hero, FAQ, carousels…)" },
  { key: "checkout_rules", label: "Payment and delivery rules, order limits" },
  { key: "post_purchase", label: "One click offer after payment" },
];
/** CRO Toolbox: every capability above is in the app today (catalog.ts). */
export const OURS: Record<Capability, true> = { bundles: true, quantity: true, cross_sell: true, bogo: true, gift: true, reviews: true, sections: true, checkout_rules: true, post_purchase: true };

export const CHECKED = "October 18, 2026";

export const COMPETITORS: Competitor[] = [
  {
    slug: "bundler",
    name: "Bundler",
    listing: "https://apps.shopify.com/bundler-product-bundles",
    focus: "Product bundles and discounts.",
    pricing: ["Free plan (Buy X get Y, quantity breaks, product page upsells)", "Premium $9.99 a month (adds mix and match, free shipping, funnel upsells)", "Executive $19.99 a month (adds bundle analytics)", "7 day free trial on paid plans"],
    rating: "4.9 from 2,739 reviews",
    level: "vendor",
        sources: [{ label: "Shopify App Store listing", url: "https://apps.shopify.com/bundler-product-bundles" }],
    has: { bundles: true, quantity: true, bogo: true, cross_sell: true },
  },
  {
    slug: "simple-bundles",
    name: "Simple Bundles",
    listing: "https://apps.shopify.com/simple-bundles",
    focus: "Bundles and kits, with inventory synced to the bundled items.",
    pricing: ["Free: 3 bundles and 50 orders a month", "Basic $14 a month (unlimited bundles)", "Grow & Advanced $39 a month", "Plus $149 a month", "Yearly billing saves 17%"],
    rating: "4.9 from 807 reviews",
    level: "vendor",
    sources: [
      { label: "Shopify App Store listing", url: "https://apps.shopify.com/simple-bundles" },
      { label: "simplebundles.com", url: "https://www.simplebundles.com/" },
    ],
    has: { bundles: true, bogo: true, quantity: true, cross_sell: true },
  },
  {
    slug: "fast-bundle",
    name: "Fast Bundle",
    listing: "https://apps.shopify.com/fast-bundle-product-bundles",
    focus: "Product bundles.",
    pricing: ["Free on development stores", "Standard $19 a month (up to $1,000 of bundle sales), $49 (up to $3,000), $139 (up to $10,000)", "Priced by monthly bundle sales", "7 day free trial on paid plans"],
    rating: "5.0 from 3,564 reviews",
    level: "vendor",
        sources: [{ label: "Shopify App Store listing", url: "https://apps.shopify.com/fast-bundle-product-bundles" }],
    has: { bundles: true, quantity: true, bogo: true, cross_sell: true },
  },
  {
    slug: "kaching",
    name: "Kaching Bundles",
    listing: "https://apps.shopify.com/bundle-deals",
    focus: "Bundles and upsells.",
    pricing: ["Free on development stores", "Starter $14.99, Scale $29.99, Pro $59.99 a month", "Each plan capped by the extra revenue the app makes ($1,000, $5,000, $10,000)", "7 day free trial on paid plans"],
    rating: "5.0 from 6,396 reviews",
    level: "vendor",
        sources: [{ label: "Shopify App Store listing", url: "https://apps.shopify.com/bundle-deals" }],
    has: { bundles: true, cross_sell: true, quantity: true, bogo: true, gift: true },
  },
  {
    slug: "bogos",
    name: "BOGOS",
    listing: "https://apps.shopify.com/freegifts",
    focus: "Free gifts, buy X get Y, bundles and upsells.",
    pricing: ["Free plan: 30 orders in total", "Basic $29.99 a month (300 orders a month)", "Grow $49.99 a month, Plus $109.99 a month", "$0.05 for each extra order", "7 day free trial on paid plans"],
    rating: "5.0 from 4,503 reviews",
    level: "vendor",
        sources: [{ label: "Shopify App Store listing", url: "https://apps.shopify.com/freegifts" }],
    has: { gift: true, bogo: true, bundles: true, quantity: true, post_purchase: true },
  },
  {
    slug: "rebuy",
    name: "Rebuy",
    listing: "https://apps.shopify.com/rebuy",
    focus: "Personalized upsells and cross sells, bundles and post purchase offers.",
    pricing: ["Rebuy Monetize (post purchase offers): free", "Packages from $25 a month for one package, priced by monthly orders", "Platform One listed at $534 a month", "14 day free trial on paid packages"],
    rating: "Not shown: the Shopify App Store page says the app is not currently available there",
    level: "vendor",
        sources: [{ label: "rebuyengine.com pricing", url: "https://www.rebuyengine.com/pricing" }],
    has: { cross_sell: true, bundles: true, post_purchase: true },
  },
  {
    slug: "vitals",
    name: "Vitals",
    listing: "https://apps.shopify.com/vitals",
    focus: "Many storefront tools in one app (reviews, bundles and more).",
    pricing: ["One plan: $29.99 a month", "Usage based charges after about $1,000 a month in Vitals sales", "7 day free trial"],
    rating: "4.9 from 2,983 reviews",
    level: "vendor",
    sources: [
      { label: "Shopify App Store listing", url: "https://apps.shopify.com/vitals" },
      { label: "vitals.app", url: "https://vitals.app/all-apps" },
    ],
    has: { reviews: true, bundles: true, bogo: true, gift: true, sections: true },
  },
  {
    slug: "section-store",
    name: "Section Store",
    listing: "https://apps.shopify.com/section-factory",
    focus: "Theme sections you buy or add one by one.",
    pricing: ["Free to install (free sections, others paid once)", "Section Store Plus $15 a month (bundles, mix and match, quantity breaks, cart drawer)", "14 day free trial on Plus"],
    rating: "4.9 from 2,986 reviews",
    level: "vendor",
        sources: [{ label: "Shopify App Store listing", url: "https://apps.shopify.com/section-factory" }],
    has: { sections: true, bundles: true, quantity: true },
  },
];
