/**
 * The map of the app, in one place. The side menu, Home's groups, every page's breadcrumb and the
 * tabs at the top of each feature all come from here, so they always agree:
 *
 *   Menu:     Home · Offers & bundles · Boosters · Sections · Header & pages · Checkout · Settings
 *   A page:   breadcrumb = its category · heading = the feature · tabs = the feature's pages
 *             (e.g. Customer reviews: Reviews | Design)
 *
 * Shared by client and server.
 */
import { DEAL_KINDS, DEAL_TYPES } from "./deals";

export type CategoryKey = "offers" | "sections" | "boosters" | "design" | "checkout";

export const CATEGORIES: { key: CategoryKey; title: string; href: string; intro: string }[] = [
  { key: "offers", title: "Offers & bundles", href: "/app/browse/offers", intro: "Ways to raise the order value: upsells, cross-sells, bundles, deals and add-ons." },
  { key: "boosters", title: "Boosters", href: "/app/browse/boosters", intro: "Work across your whole store once switched on: bars, timers, quick add, pop-ups." },
  { key: "sections", title: "Sections", href: "/app/browse/sections", intro: "Sections you place on your store pages: banners, reviews, FAQ, logos, carousels." },
  { key: "design", title: "Header & pages", href: "/app/browse/design", intro: "Your store's header and pages designed in the app." },
  { key: "checkout", title: "Checkout", href: "/app/browse/checkout", intro: "Inside Shopify checkout: payment and delivery rules, order limits, the thank-you page and a one-click offer after payment." },
];
export const isCategory = (v: unknown): v is CategoryKey => CATEGORIES.some((c) => c.key === v);
export const category = (key: CategoryKey) => CATEGORIES.find((c) => c.key === key)!;

export type FeatureTab = { label: string; href: string };
/** `about`: one plain sentence, shown on the upgrade card when the plan doesn't include it. */
export type Feature = { title: string; cat: CategoryKey; about: string; tabs: FeatureTab[] };

const design = (href: string): FeatureTab => ({ label: "Design", href });

export const FEATURES = {
  // Offers & bundles
  upsell: { title: "Upsell offers", cat: "offers", about: "“Buy 2, save 10%” and bigger-size offers on product pages.", tabs: [{ label: "Offers", href: "/app/offers/upsell" }, design("/app/designs/upsell")] },
  cross_sell: { title: "Cross-sell offers", cat: "offers", about: "“Pairs well with” products shoppers tick and add in one click.", tabs: [{ label: "Offers", href: "/app/offers/cross-sell" }, design("/app/designs/cross-sell")] },
  bundles: {
    title: "Bundles",
    cat: "offers",
    about: "Mix-and-match bundles at one price, plus fixed bundles, buy X get Y, volume, gift and upgrade deals.",
    tabs: [{ label: "Mix & match", href: "/app/bundles" }, { label: "Bundle products", href: "/app/kits" }, ...DEAL_KINDS.map((k) => ({ label: DEAL_TYPES[k].title, href: `/app/deals/${k}` })), design("/app/designs/bundles")],
  },
  addons: { title: "Add-ons", cat: "offers", about: "Gift wrapping and other extras ticked under Add to cart, plus a gift message.", tabs: [design("/app/designs/add-ons")] },
  cart_extras: { title: "Gift note & delivery date", cat: "offers", about: "“This is a gift”, a gift message and a delivery date picked in the cart — all on the order.", tabs: [design("/app/designs/cart-extras")] },
  personalize: { title: "Personalization", cat: "offers", about: "Engraving or names on the product with a live preview, saved on the order, with an optional fee.", tabs: [design("/app/designs/personalize")] },
  // Sections
  hero: { title: "Hero banners", cat: "sections", about: "A banner with separate desktop and mobile images.", tabs: [{ label: "Banners", href: "/app/designs/hero" }] },
  reviews: { title: "Customer reviews", cat: "sections", about: "Text, photo and video reviews with WhatsApp, Instagram and TikTok badges.", tabs: [{ label: "Reviews", href: "/app/sections/reviews" }, design("/app/designs/reviews")] },
  product_reviews: { title: "Product page reviews", cat: "sections", about: "A review card or the star rating next to the price and Add to cart.", tabs: [design("/app/designs/product-reviews"), { label: "Reviews", href: "/app/sections/reviews" }] },
  faq: { title: "FAQ", cat: "sections", about: "Questions and answers with search and group buttons.", tabs: [{ label: "Questions", href: "/app/sections/faq" }, design("/app/designs/faq")] },
  logos: { title: "Scrolling logos and text", cat: "sections", about: "Logos or short texts in a scrolling strip or a grid.", tabs: [{ label: "Logos", href: "/app/sections/logos" }, design("/app/designs/logos")] },
  videos: { title: "Video carousel", cat: "sections", about: "Shoppable videos, each linked to a product.", tabs: [{ label: "Videos", href: "/app/videos" }, design("/app/designs/video-carousel")] },
  image_carousel: { title: "Image carousel", cat: "sections", about: "Pictures that scroll, each with an optional title, text, button and link.", tabs: [design("/app/designs/image-carousel")] },
  quiz: { title: "Product quiz", cat: "sections", about: "A few questions that lead shoppers to the right products, with add to cart.", tabs: [design("/app/designs/quiz")] },
  collection_pills: { title: "Collection pills", cat: "sections", about: "A row of buttons to your collections, with the current one highlighted.", tabs: [design("/app/designs/collection-pills")] },
  // Boosters
  announcements: { title: "Announcement bar", cat: "boosters", about: "Rotating messages at the top, with free-shipping progress.", tabs: [{ label: "Messages", href: "/app/sections/announcements" }, design("/app/designs/announcement")] },
  countdown: { title: "Countdown timers", cat: "boosters", about: "Timers for the header, footer, home page, product pages and cart page.", tabs: [design("/app/designs/countdown-bar")] },
  shipping_bar: { title: "Free shipping bar", cat: "boosters", about: "Shows how much more to spend for free shipping, in the cart and at the top of the store.", tabs: [design("/app/designs/shipping-bar")] },
  quick_add: { title: "Quick add to cart", cat: "boosters", about: "A button on every product card; sizes open a small picker.", tabs: [design("/app/designs/quick-add")] },
  wishlist: { title: "Wishlist", cat: "boosters", about: "Hearts on products and cards, a wishlist page with “price dropped” badges and a share link.", tabs: [design("/app/designs/wishlist")] },
  cart_tools: { title: "Cart drawer & checkout", cat: "boosters", about: "A slide-out cart with Shop Pay / Apple Pay buttons, the best discount applied, and a shareable cart link.", tabs: [design("/app/designs/cart-tools")] },
  delivery: { title: "Delivery estimate", cat: "boosters", about: "“Order within 2h 15m and get it Thu – Sat” on product pages and the cart.", tabs: [design("/app/designs/delivery")] },
  stock: { title: "Back in stock & pre-order", cat: "boosters", about: "“Notify me” on sold-out products, and “Pre-order” on products you still sell when out of stock.", tabs: [{ label: "Requests", href: "/app/stock" }, design("/app/designs/stock")] },
  boosters: { title: "Conversion boosters", cat: "boosters", about: "Sticky add to cart, stock urgency, trust badges and sales pop-ups.", tabs: [{ label: "Settings", href: "/app/boosters" }] },
  // Header & pages
  header: { title: "Header", cat: "design", about: "Your store's header, designed in the app.", tabs: [design("/app/designs/header")] },
  footer: { title: "Footer", cat: "design", about: "Your store's footer, designed in the app.", tabs: [design("/app/designs/footer")] },
  track: { title: "Track order page", cat: "design", about: "A page where shoppers look up their order and its delivery status.", tabs: [design("/app/pages/track")] },
  returns: { title: "Returns page", cat: "design", about: "A page where shoppers ask for a return, and the requests in one list.", tabs: [{ label: "Requests", href: "/app/returns" }, design("/app/pages/returns")] },
  contact: { title: "Contact page", cat: "design", about: "A contact page with a form and your store's details.", tabs: [design("/app/pages/contact")] },
  // Checkout
  checkout_rules: { title: "Payment & delivery rules", cat: "checkout", about: "Hide, rename or reorder payment and delivery methods at checkout.", tabs: [{ label: "Payment", href: "/app/checkout/payment" }, { label: "Delivery", href: "/app/checkout/delivery" }] },
  order_limits: { title: "Order limits", cat: "checkout", about: "Minimum and maximum order amounts and quantities at checkout.", tabs: [{ label: "Limits", href: "/app/checkout/limits" }] },
  thank_you: { title: "Thank-you page", cat: "checkout", about: "Extra modules on the thank-you page after checkout.", tabs: [{ label: "Modules", href: "/app/checkout/thank-you" }] },
  post_purchase: { title: "After-purchase offer", cat: "checkout", about: "A one-click offer shoppers can add right after paying.", tabs: [{ label: "Offer", href: "/app/checkout/after-purchase" }] },
} satisfies Record<string, Feature>;

export type FeatureKey = keyof typeof FEATURES;
export const feature = (key: FeatureKey): Feature => FEATURES[key];

/** Which feature a Store-sections list or an offer type belongs to. */
export const LIST_FEATURE = { reviews: "reviews", faq: "faq", logos: "logos", announcements: "announcements" } as const satisfies Record<string, FeatureKey>;
export const OFFER_FEATURE: Record<string, FeatureKey> = { upsell: "upsell", "cross-sell": "cross_sell" };

/**
 * Which features a page belongs to (an address like /app/offers/upsell/new belongs to the feature
 * whose tab is /app/offers/upsell). Pages shared by several features list them all.
 */
export function featuresForPath(pathname: string): FeatureKey[] {
  const path = pathname.replace(/\.data$/, "").replace(/\/+$/, "");
  return (Object.keys(FEATURES) as FeatureKey[]).filter((k) =>
    FEATURES[k].tabs.some((t) => path === t.href || path.startsWith(`${t.href}/`)),
  );
}
