/**
 * The map of the app, in one place. The side menu, the hub pages, every page's breadcrumb, the
 * tabs at the top of each feature and the plan locks all come from here, so they always agree:
 *
 *   Menu:     (Home) · Offers · Tracking & Returns · Section library · Cart & Checkout · Analytics · Settings
 *   A hub:    every area lists its features (the Section library and Cart & Checkout by group)
 *   A page:   breadcrumb = its area's hub · heading = the feature · tabs = the feature's pages
 *             (e.g. Customer reviews: Reviews | Design)
 *
 * Shared by client and server.
 */
import { DEAL_TYPES, type DealKind } from "./deals";
import { BUNDLE_RECIPES } from "./bundle-recipes";

export type AreaKey = "offers" | "tracking" | "library" | "cart";

export const AREAS: { key: AreaKey; title: string; href: string; intro: string }[] = [
  { key: "offers", title: "Offers", href: "/app/offers", intro: "Raise the order value with upsells, bundles, cross sells and discounts." },
  { key: "library", title: "Section library", href: "/app/library", intro: "Ready-made sections for your store: reviews, banners, bars, timers, product-page tools and more. Pick one, preview it, add it to your theme." },
  { key: "tracking", title: "Tracking & Returns", href: "/app/tracking-returns", intro: "Let shoppers track their orders and ask for returns on your store, and handle the returns here: approve, send a label, refund." },
  { key: "cart", title: "Cart & Checkout", href: "/app/cart-checkout", intro: "The cart first (cart offers, free shipping bar, gift note), then inside Shopify checkout: payment and delivery rules, order limits, the thank-you page and a one-click offer after payment." },
];
export const isArea = (v: unknown): v is AreaKey => AREAS.some((a) => a.key === v);
export const area = (key: AreaKey) => AREAS.find((a) => a.key === key)!;

/** Hub groups, in the order each hub shows them: the Cart group, then the Checkout group on Cart & Checkout; the rest on the Section library. */
export type GroupKey = "cart" | "checkout" | "social" | "bars" | "product" | "content";
export const GROUPS: { key: GroupKey; title: string; area: AreaKey }[] = [
  { key: "cart", title: "Cart", area: "cart" },
  { key: "checkout", title: "Checkout", area: "cart" },
  { key: "social", title: "Social proof", area: "library" },
  { key: "bars", title: "Bars & urgency", area: "library" },
  { key: "product", title: "Product page", area: "library" },
  { key: "content", title: "Sections", area: "library" },
];

export type FeatureTab = { label: string; href: string };
/**
 * `about`: one plain sentence (hub cards, upgrade cards). `area`: its hub and menu item.
 * `group`: its group on the Storefront hub. `also`: other hubs that list it too (e.g. the
 * free-shipping bar also shows in the cart).
 */
export type Feature = {
  title: string;
  area: AreaKey;
  group?: GroupKey;
  also?: AreaKey[];
  about: string;
  tabs: FeatureTab[];
  /** More pages that belong to it without a tab of their own (e.g. the bundle editors). */
  paths?: string[];
};

const design = (href: string): FeatureTab => ({ label: "Style", href });
/** The deal kinds the Discounts feature holds (fixed bundles sit in Bundles, upgrades in Upsell). */
const DISCOUNT_KINDS: DealKind[] = ["bogo", "volume", "gift"];

export const FEATURES = {
  // Offers
  upsell: {
    title: "Upsell offers",
    area: "offers",
    about: "“Buy 2, save 10%”, bigger sizes and upgrades to a better option.",
    tabs: [{ label: "Quantity & sizes", href: "/app/offers/upsell" }, { label: DEAL_TYPES.upgrade.title, href: "/app/deals/upgrade" }, design("/app/designs/upsell")],
    paths: ["/app/styles/upsell"],
  },
  cross_sell: { title: "Cross sell offers", area: "offers", about: "“Pairs well with” products shoppers tick and add in one click.", tabs: [{ label: "Offers", href: "/app/offers/cross-sell" }, design("/app/designs/cross-sell")], paths: ["/app/styles/cross_sell"] },
  bundles: {
    title: "Bundles",
    area: "offers",
    about: "Frequently bought together, fixed bundles, mix and match, build your own, tiered and fixed price bundles.",
    // One list of every bundle (mix & match, bundle products, frequently bought together); their
    // editors keep their own addresses.
    tabs: [...BUNDLE_RECIPES.map((r, i) => ({ label: r.short, href: i === 0 ? "/app/bundles" : `/app/bundles?tab=${r.key}` })), design("/app/designs/bundles")],
    paths: ["/app/kits", "/app/deals/fixed", "/app/styles/bundles"],
  },
  discounts: {
    title: "Discounts",
    area: "offers",
    about: "Buy X get Y, volume discounts and a gift with purchase, applied at checkout.",
    tabs: DISCOUNT_KINDS.map((k) => ({ label: DEAL_TYPES[k].title, href: `/app/deals/${k}` })),
  },
  addons: { title: "Add-ons", area: "offers", about: "Gift wrapping and other extras ticked under Add to cart, plus a gift message.", tabs: [{ label: "Add-ons", href: "/app/offers/add-ons" }], paths: ["/app/styles/upsell/addons"] },
  personalize: { title: "Personalization", area: "offers", about: "Engraving or names on the product with a live preview, saved on the order, with an optional fee.", tabs: [{ label: "Personalization", href: "/app/offers/personalization" }], paths: ["/app/styles/upsell/personalize"] },
  // Storefront · cart
  cart_offers: { title: "Offers in your theme's cart", area: "cart", group: "cart", about: "Cross sell offers inside your theme's own cart drawer.", tabs: [{ label: "Offers", href: "/app/offers/cross-sell" }, design("/app/styles/cross_sell")] },
  cart_extras: { title: "Gift note & delivery date", area: "cart", group: "cart", about: "“This is a gift”, a gift message, a delivery date and a discount code box in the cart. Gift and date details are saved on the order.", tabs: [design("/app/designs/cart-extras")] },
  // Storefront · social proof
  reviews: { title: "Customer reviews", area: "library", group: "social", about: "Text, photo and video reviews with WhatsApp, Instagram and TikTok badges.", tabs: [{ label: "Reviews", href: "/app/sections/reviews" }, design("/app/designs/reviews")] },
  product_reviews: { title: "Product page reviews", area: "library", group: "social", about: "A review card or the star rating next to the price and Add to cart.", tabs: [design("/app/designs/product-reviews"), { label: "Reviews", href: "/app/sections/reviews" }] },
  sales_pop: { title: "Sales pop-ups", area: "library", group: "social", about: "Small pop-ups with recent purchases from your store.", tabs: [{ label: "Settings", href: "/app/boosters" }] },
  trust_badges: { title: "Trust badges", area: "library", group: "social", about: "Payment, shipping and guarantee badges under Add to cart.", tabs: [{ label: "Settings", href: "/app/boosters" }] },
  logos: { title: "Scrolling logos and text", area: "library", group: "social", about: "Logos or short texts in a scrolling strip or a grid.", tabs: [{ label: "Logos", href: "/app/sections/logos" }, design("/app/designs/logos")] },
  // Storefront · bars & urgency
  announcements: { title: "Announcement bar", area: "library", group: "bars", about: "Rotating messages at the top, with free-shipping progress.", tabs: [{ label: "Messages", href: "/app/sections/announcements" }, design("/app/designs/announcement")] },
  countdown: { title: "Countdown timers", area: "library", group: "bars", about: "Timers for the header, footer, home page, product pages and cart page.", tabs: [design("/app/designs/countdown-bar")] },
  shipping_bar: { title: "Free shipping bar", area: "cart", group: "cart", about: "Shows how much more to spend for free shipping, in the cart and at the top of the store.", tabs: [design("/app/designs/shipping-bar")] },
  stock_urgency: { title: "Stock urgency", area: "library", group: "bars", about: "“Only 3 left” on product pages when stock is low.", tabs: [{ label: "Settings", href: "/app/boosters" }] },
  // Storefront · product page
  sticky_atc: { title: "Sticky add to cart", area: "library", group: "product", about: "An Add to cart bar that stays on screen while shoppers scroll.", tabs: [{ label: "Settings", href: "/app/boosters" }] },
  quick_add: { title: "Quick add to cart", area: "library", group: "product", about: "A button on every product card; sizes open a small picker.", tabs: [design("/app/designs/quick-add")] },
  delivery: { title: "Delivery estimate", area: "library", group: "product", about: "“Order within 2h 15m and get it Thu to Sat” on product pages and the cart.", tabs: [design("/app/designs/delivery")] },
  size_guide: { title: "Size guide", area: "library", group: "product", about: "Size charts and a size recommendation on the product page, answered from the height and weight ranges you set.", tabs: [design("/app/designs/size-guide")] },
  stock: { title: "Back in stock & pre-order", area: "library", group: "product", about: "“Notify me” on sold-out products, and “Pre-order” on products you still sell when out of stock.", tabs: [{ label: "Requests", href: "/app/stock" }, design("/app/designs/stock")] },
  wishlist: { title: "Wishlist", area: "library", group: "product", about: "Hearts on products and cards, a wishlist page with “price dropped” badges and a share link.", tabs: [design("/app/designs/wishlist")] },
  // Storefront · sections
  hero: { title: "Hero banners", area: "library", group: "content", about: "A banner with separate desktop and mobile images.", tabs: [{ label: "Banners", href: "/app/designs/hero" }] },
  image_carousel: { title: "Image carousel", area: "library", group: "content", about: "Pictures that scroll, each with an optional title, text, button and link.", tabs: [design("/app/designs/image-carousel")] },
  videos: { title: "Video carousel", area: "library", group: "content", about: "Shoppable videos, each linked to a product.", tabs: [{ label: "Videos", href: "/app/videos" }, design("/app/designs/video-carousel")] },
  faq: { title: "FAQ", area: "library", group: "content", about: "Questions and answers with search and group buttons.", tabs: [{ label: "Questions", href: "/app/sections/faq" }, design("/app/designs/faq")] },
  quiz: { title: "Product quiz", area: "library", group: "content", about: "A few questions that lead shoppers to the right products, with add to cart.", tabs: [design("/app/designs/quiz")] },
  collection_pills: { title: "Collection pills", area: "library", group: "content", about: "A row of buttons to your collections, with the current one highlighted.", tabs: [design("/app/designs/collection-pills")] },
  // Storefront · header & pages
  track: { title: "Track order page", area: "tracking", about: "A page where shoppers look up their order and its delivery status, and that sells too: recommendations, a next order discount, buy again, an after delivery message and an apology for late orders.", tabs: [design("/app/pages/track")] },
  returns: { title: "Returns", area: "tracking", about: "A page where shoppers ask for a return. It becomes a real Shopify return you approve, send a label for and refund.", tabs: [{ label: "Requests", href: "/app/returns" }, { label: "Rules", href: "/app/returns/rules" }, design("/app/pages/returns")], paths: ["/app/tracking-returns"] },
  // Checkout
  return_saving: { title: "Return saving rules", area: "tracking", about: "Offer store credit (with a bonus) or an exchange before a refund, approve returns by rule and put returned items back in stock.", tabs: [{ label: "Saving rules", href: "/app/returns/saving" }] },
  payment_rules: { title: "Payment rules", area: "cart", group: "checkout", about: "Hide, rename or reorder payment methods at checkout.", tabs: [{ label: "Payment", href: "/app/checkout/payment" }] },
  delivery_rules: { title: "Delivery rules", area: "cart", group: "checkout", about: "Hide, rename or reorder delivery options at checkout.", tabs: [{ label: "Delivery", href: "/app/checkout/delivery" }] },
  order_limits: { title: "Order limits", area: "cart", group: "checkout", about: "Minimum and maximum order amounts and quantities at checkout.", tabs: [{ label: "Limits", href: "/app/checkout/limits" }] },
  thank_you: { title: "Thank-you page", area: "cart", group: "checkout", about: "Extra modules on the thank-you page after checkout.", tabs: [{ label: "Modules", href: "/app/checkout/thank-you" }] },
  ab_tests: { title: "A/B tests", area: "offers", about: "Show half of your shoppers another version of an upsell or cross sell (words, discount, style) and see which earns more.", tabs: [{ label: "Tests", href: "/app/offers/tests" }] },
  post_purchase: { title: "After-purchase offer", area: "offers", group: "checkout", also: ["cart"], about: "A one-click offer shoppers can add right after paying.", tabs: [{ label: "Offer", href: "/app/checkout/after-purchase" }] },
} satisfies Record<string, Feature>;

export type FeatureKey = keyof typeof FEATURES;
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];
export const feature = (key: FeatureKey): Feature => FEATURES[key];
/** A feature's main page (its first tab). */
export const featureHref = (key: FeatureKey) => FEATURES[key].tabs[0].href;
/** The features a hub lists: its own, plus those shown there too (`also`). */
export const featuresIn = (a: AreaKey) => FEATURE_KEYS.filter((k) => feature(k).area === a || (feature(k).also ?? []).includes(a));

/**
 * The Offers hub's four groups. Each group's pages show its tabs (FeatureNav), so add-ons,
 * personalization and the after-purchase offer sit with the upsells they belong to.
 */
export type OfferGroupKey = "upsell" | "cross_sell" | "bundles" | "discounts";
export type OfferGroup = { key: OfferGroupKey; title: string; about: string; features: FeatureKey[]; tabs: FeatureTab[]; chips?: string[] };
export const OFFER_GROUPS: OfferGroup[] = [
  {
    key: "upsell",
    title: "Upsell",
    about: "Sell more of the same: quantity breaks, bigger sizes, upgrades, add-ons and a one-click offer after payment.",
    features: ["upsell", "addons", "personalize", "post_purchase"],
    tabs: [
      ...FEATURES.upsell.tabs.filter((t) => t.label !== "Style"),
      { label: "Add-ons", href: featureHref("addons") },
      { label: "Personalization", href: featureHref("personalize") },
      { label: "After purchase", href: featureHref("post_purchase") },
      design("/app/styles/upsell"),
    ],
  },
  {
    key: "bundles",
    title: "Bundles",
    about: "Sets of products at one price: frequently bought together, fixed, mix and match, build your own, tiered and fixed price bundles.",
    features: ["bundles"],
    tabs: [...FEATURES.bundles.tabs.filter((t) => t.label !== "Style"), design("/app/styles/bundles")],
    chips: BUNDLE_RECIPES.slice(0, 4).map((r) => r.short),
  },
  { key: "cross_sell", title: "Cross sell", about: "“Pairs well with” products shoppers tick and add in one click, on the product page or in the cart.", features: ["cross_sell"], tabs: [...FEATURES.cross_sell.tabs.filter((t) => t.label !== "Style"), design("/app/styles/cross_sell")] },
  { key: "discounts", title: "Discounts", about: "Buy X get Y, volume discounts and a free gift once the cart reaches an amount.", features: ["discounts"], tabs: FEATURES.discounts.tabs },
];
/** Which feature a deal kind's pages belong to. */
export const dealFeature = (kind: DealKind): FeatureKey => (kind === "fixed" ? "bundles" : kind === "upgrade" ? "upsell" : "discounts");
/** The offer group a feature belongs to, if any. */
export const offerGroupOf = (key: FeatureKey) => OFFER_GROUPS.find((g) => g.features.includes(key)) ?? null;

/** Which feature a Store-sections list or an offer type belongs to. */
export const LIST_FEATURE = { reviews: "reviews", faq: "faq", logos: "logos", announcements: "announcements" } as const satisfies Record<string, FeatureKey>;
export const OFFER_FEATURE: Record<string, FeatureKey> = { upsell: "upsell", "cross-sell": "cross_sell" };

/**
 * Which features a page belongs to (an address like /app/offers/upsell/new belongs to the feature
 * whose tab is /app/offers/upsell). Pages shared by several features list them all.
 */
export function featuresForPath(pathname: string): FeatureKey[] {
  const path = pathname.replace(/\.data$/, "").replace(/\/+$/, "");
  const under = (href: string) => path === href || path.startsWith(`${href}/`);
  // How well a feature's pages match: the longest address that contains this page. When one feature owns a
  // more specific address (Add-ons' style under the Upsell group's), only the most specific ones count.
  const depth = (k: FeatureKey) => Math.max(0, ...[...FEATURES[k].tabs.map((t) => t.href.split("?")[0]), ...((FEATURES[k] as Feature).paths ?? [])].filter(under).map((h) => h.length));
  const hits = FEATURE_KEYS.map((k) => [k, depth(k)] as const).filter(([, n]) => n > 0);
  const best = Math.max(0, ...hits.map(([, n]) => n));
  return hits.filter(([, n]) => n === best).map(([k]) => k);
}

/** Which area (menu item) a page belongs to: its features' area, or the hub it is. */
export function areaForPath(pathname: string): AreaKey | null {
  const path = pathname.replace(/\.data$/, "").replace(/\/+$/, "");
  const hub = AREAS.find((a) => path === a.href);
  if (hub) return hub.key;
  const f = featuresForPath(path)[0];
  return f ? feature(f).area : null;
}
