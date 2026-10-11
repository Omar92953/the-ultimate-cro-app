/**
 * The map of the app, in one place. The side menu, the hub pages, every page's breadcrumb, the
 * tabs at the top of each feature and the plan locks all come from here, so they always agree:
 *
 *   Menu:     (Home) · Offers · Storefront · Cart · Checkout · Analytics · Settings
 *   A hub:    Offers, Storefront, Cart and Checkout list their features (Storefront by group)
 *   A page:   breadcrumb = its area's hub · heading = the feature · tabs = the feature's pages
 *             (e.g. Customer reviews: Reviews | Design)
 *
 * Shared by client and server.
 */
import { DEAL_KINDS, DEAL_TYPES } from "./deals";

export type AreaKey = "offers" | "storefront" | "cart" | "checkout";

export const AREAS: { key: AreaKey; title: string; href: string; intro: string }[] = [
  { key: "offers", title: "Offers", href: "/app/offers", intro: "Raise the order value: upsells, cross-sells, bundles, deals and add-ons." },
  { key: "storefront", title: "Storefront", href: "/app/storefront", intro: "Everything shoppers see on your store: reviews, bars, timers, product-page tools, sections and pages." },
  { key: "cart", title: "Cart", href: "/app/cart", intro: "The cart drawer and everything in it: offers, the free-shipping bar, gift notes and checkout buttons." },
  { key: "checkout", title: "Checkout", href: "/app/checkout", intro: "Inside Shopify checkout: payment and delivery rules, order limits, the thank-you page and a one-click offer after payment." },
];
export const isArea = (v: unknown): v is AreaKey => AREAS.some((a) => a.key === v);
export const area = (key: AreaKey) => AREAS.find((a) => a.key === key)!;

/** Storefront groups, in the order the hub shows them. */
export type GroupKey = "social" | "bars" | "product" | "content" | "pages";
export const GROUPS: { key: GroupKey; title: string }[] = [
  { key: "social", title: "Social proof" },
  { key: "bars", title: "Bars & urgency" },
  { key: "product", title: "Product page" },
  { key: "content", title: "Sections" },
  { key: "pages", title: "Header & pages" },
];

export type FeatureTab = { label: string; href: string };
/**
 * `about`: one plain sentence (hub cards, upgrade cards). `area`: its hub and menu item.
 * `group`: its group on the Storefront hub. `also`: other hubs that list it too (e.g. the
 * free-shipping bar also shows in the cart).
 */
export type Feature = { title: string; area: AreaKey; group?: GroupKey; also?: AreaKey[]; about: string; tabs: FeatureTab[] };

const design = (href: string): FeatureTab => ({ label: "Design", href });

export const FEATURES = {
  // Offers
  upsell: { title: "Upsell offers", area: "offers", about: "“Buy 2, save 10%” and bigger-size offers on product pages.", tabs: [{ label: "Offers", href: "/app/offers/upsell" }, design("/app/designs/upsell")] },
  cross_sell: { title: "Cross-sell offers", area: "offers", about: "“Pairs well with” products shoppers tick and add in one click.", tabs: [{ label: "Offers", href: "/app/offers/cross-sell" }, design("/app/designs/cross-sell")] },
  bundles: {
    title: "Bundles",
    area: "offers",
    about: "Mix-and-match bundles, bundles sold as their own product, fixed bundles, buy X get Y, volume, gift and upgrade deals.",
    tabs: [{ label: "Mix & match", href: "/app/bundles" }, { label: "Bundle products", href: "/app/kits" }, ...DEAL_KINDS.map((k) => ({ label: DEAL_TYPES[k].title, href: `/app/deals/${k}` })), design("/app/designs/bundles")],
  },
  addons: { title: "Add-ons", area: "offers", about: "Gift wrapping and other extras ticked under Add to cart, plus a gift message.", tabs: [design("/app/designs/add-ons")] },
  personalize: { title: "Personalization", area: "offers", about: "Engraving or names on the product with a live preview, saved on the order, with an optional fee.", tabs: [design("/app/designs/personalize")] },
  // Cart
  cart_tools: { title: "Cart drawer", area: "cart", about: "A slide-out cart with Shop Pay / Apple Pay buttons, the best discount applied, and a shareable cart link.", tabs: [design("/app/designs/cart-tools")] },
  cart_offers: { title: "Offers in your theme's cart", area: "cart", about: "Cross-sell offers inside your theme's own cart drawer.", tabs: [{ label: "Offers", href: "/app/offers/cross-sell" }, design("/app/designs/cross-sell")] },
  cart_extras: { title: "Gift note & delivery date", area: "cart", about: "“This is a gift”, a gift message and a delivery date picked in the cart — all on the order.", tabs: [design("/app/designs/cart-extras")] },
  // Storefront · social proof
  reviews: { title: "Customer reviews", area: "storefront", group: "social", about: "Text, photo and video reviews with WhatsApp, Instagram and TikTok badges.", tabs: [{ label: "Reviews", href: "/app/sections/reviews" }, design("/app/designs/reviews")] },
  product_reviews: { title: "Product page reviews", area: "storefront", group: "social", about: "A review card or the star rating next to the price and Add to cart.", tabs: [design("/app/designs/product-reviews"), { label: "Reviews", href: "/app/sections/reviews" }] },
  sales_pop: { title: "Sales pop-ups", area: "storefront", group: "social", about: "Small pop-ups with recent purchases from your store.", tabs: [{ label: "Settings", href: "/app/boosters" }] },
  trust_badges: { title: "Trust badges", area: "storefront", group: "social", about: "Payment, shipping and guarantee badges under Add to cart.", tabs: [{ label: "Settings", href: "/app/boosters" }] },
  logos: { title: "Scrolling logos and text", area: "storefront", group: "social", about: "Logos or short texts in a scrolling strip or a grid.", tabs: [{ label: "Logos", href: "/app/sections/logos" }, design("/app/designs/logos")] },
  // Storefront · bars & urgency
  announcements: { title: "Announcement bar", area: "storefront", group: "bars", about: "Rotating messages at the top, with free-shipping progress.", tabs: [{ label: "Messages", href: "/app/sections/announcements" }, design("/app/designs/announcement")] },
  countdown: { title: "Countdown timers", area: "storefront", group: "bars", about: "Timers for the header, footer, home page, product pages and cart page.", tabs: [design("/app/designs/countdown-bar")] },
  shipping_bar: { title: "Free shipping bar", area: "storefront", group: "bars", also: ["cart"], about: "Shows how much more to spend for free shipping, in the cart and at the top of the store.", tabs: [design("/app/designs/shipping-bar")] },
  stock_urgency: { title: "Stock urgency", area: "storefront", group: "bars", about: "“Only 3 left” on product pages when stock is low.", tabs: [{ label: "Settings", href: "/app/boosters" }] },
  // Storefront · product page
  sticky_atc: { title: "Sticky add to cart", area: "storefront", group: "product", about: "An Add to cart bar that stays on screen while shoppers scroll.", tabs: [{ label: "Settings", href: "/app/boosters" }] },
  quick_add: { title: "Quick add to cart", area: "storefront", group: "product", about: "A button on every product card; sizes open a small picker.", tabs: [design("/app/designs/quick-add")] },
  delivery: { title: "Delivery estimate", area: "storefront", group: "product", about: "“Order within 2h 15m and get it Thu – Sat” on product pages and the cart.", tabs: [design("/app/designs/delivery")] },
  stock: { title: "Back in stock & pre-order", area: "storefront", group: "product", about: "“Notify me” on sold-out products, and “Pre-order” on products you still sell when out of stock.", tabs: [{ label: "Requests", href: "/app/stock" }, design("/app/designs/stock")] },
  wishlist: { title: "Wishlist", area: "storefront", group: "product", about: "Hearts on products and cards, a wishlist page with “price dropped” badges and a share link.", tabs: [design("/app/designs/wishlist")] },
  // Storefront · sections
  hero: { title: "Hero banners", area: "storefront", group: "content", about: "A banner with separate desktop and mobile images.", tabs: [{ label: "Banners", href: "/app/designs/hero" }] },
  image_carousel: { title: "Image carousel", area: "storefront", group: "content", about: "Pictures that scroll, each with an optional title, text, button and link.", tabs: [design("/app/designs/image-carousel")] },
  videos: { title: "Video carousel", area: "storefront", group: "content", about: "Shoppable videos, each linked to a product.", tabs: [{ label: "Videos", href: "/app/videos" }, design("/app/designs/video-carousel")] },
  faq: { title: "FAQ", area: "storefront", group: "content", about: "Questions and answers with search and group buttons.", tabs: [{ label: "Questions", href: "/app/sections/faq" }, design("/app/designs/faq")] },
  quiz: { title: "Product quiz", area: "storefront", group: "content", about: "A few questions that lead shoppers to the right products, with add to cart.", tabs: [design("/app/designs/quiz")] },
  collection_pills: { title: "Collection pills", area: "storefront", group: "content", about: "A row of buttons to your collections, with the current one highlighted.", tabs: [design("/app/designs/collection-pills")] },
  // Storefront · header & pages
  header: { title: "Header", area: "storefront", group: "pages", about: "Your store's header, designed in the app.", tabs: [design("/app/designs/header")] },
  footer: { title: "Footer", area: "storefront", group: "pages", about: "Your store's footer, designed in the app.", tabs: [design("/app/designs/footer")] },
  contact: { title: "Contact page", area: "storefront", group: "pages", about: "A contact page with a form and your store's details.", tabs: [design("/app/pages/contact")] },
  track: { title: "Track order page", area: "storefront", group: "pages", about: "A page where shoppers look up their order and its delivery status.", tabs: [design("/app/pages/track")] },
  returns: { title: "Returns page", area: "storefront", group: "pages", about: "A page where shoppers ask for a return, and the requests in one list.", tabs: [{ label: "Requests", href: "/app/returns" }, design("/app/pages/returns")] },
  // Checkout
  payment_rules: { title: "Payment rules", area: "checkout", about: "Hide, rename or reorder payment methods at checkout.", tabs: [{ label: "Payment", href: "/app/checkout/payment" }] },
  delivery_rules: { title: "Delivery rules", area: "checkout", about: "Hide, rename or reorder delivery options at checkout.", tabs: [{ label: "Delivery", href: "/app/checkout/delivery" }] },
  order_limits: { title: "Order limits", area: "checkout", about: "Minimum and maximum order amounts and quantities at checkout.", tabs: [{ label: "Limits", href: "/app/checkout/limits" }] },
  thank_you: { title: "Thank-you page", area: "checkout", about: "Extra modules on the thank-you page after checkout.", tabs: [{ label: "Modules", href: "/app/checkout/thank-you" }] },
  post_purchase: { title: "After-purchase offer", area: "checkout", about: "A one-click offer shoppers can add right after paying.", tabs: [{ label: "Offer", href: "/app/checkout/after-purchase" }] },
} satisfies Record<string, Feature>;

export type FeatureKey = keyof typeof FEATURES;
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];
export const feature = (key: FeatureKey): Feature => FEATURES[key];
/** A feature's main page (its first tab). */
export const featureHref = (key: FeatureKey) => FEATURES[key].tabs[0].href;
/** The features a hub lists: its own, plus those shown there too (`also`). */
export const featuresIn = (a: AreaKey) => FEATURE_KEYS.filter((k) => feature(k).area === a || (feature(k).also ?? []).includes(a));

/** Which feature a Store-sections list or an offer type belongs to. */
export const LIST_FEATURE = { reviews: "reviews", faq: "faq", logos: "logos", announcements: "announcements" } as const satisfies Record<string, FeatureKey>;
export const OFFER_FEATURE: Record<string, FeatureKey> = { upsell: "upsell", "cross-sell": "cross_sell" };

/**
 * Which features a page belongs to (an address like /app/offers/upsell/new belongs to the feature
 * whose tab is /app/offers/upsell). Pages shared by several features list them all.
 */
export function featuresForPath(pathname: string): FeatureKey[] {
  const path = pathname.replace(/\.data$/, "").replace(/\/+$/, "");
  return FEATURE_KEYS.filter((k) => FEATURES[k].tabs.some((t) => path === t.href || path.startsWith(`${t.href}/`)));
}

/** Which area (menu item) a page belongs to: its features' area, or the hub it is. */
export function areaForPath(pathname: string): AreaKey | null {
  const path = pathname.replace(/\.data$/, "").replace(/\/+$/, "");
  const hub = AREAS.find((a) => path === a.href);
  if (hub) return hub.key;
  const f = featuresForPath(path)[0];
  return f ? feature(f).area : null;
}
