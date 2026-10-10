/**
 * The map of the app, in one place. The side menu, Home's groups, every page's breadcrumb and the
 * tabs at the top of each feature all come from here, so they always agree:
 *
 *   Menu:     Home · Offers & bundles · Sections · Boosters · Header & pages · Settings
 *   A page:   breadcrumb = its category · heading = the feature · tabs = the feature's pages
 *             (e.g. Customer reviews: Reviews | Design)
 *
 * Shared by client and server.
 */
import { DEAL_KINDS, DEAL_TYPES } from "./deals";

export type CategoryKey = "offers" | "sections" | "boosters" | "design";

export const CATEGORIES: { key: CategoryKey; title: string; href: string; intro: string }[] = [
  { key: "offers", title: "Offers & bundles", href: "/app/browse/offers", intro: "Ways to raise the order value: upsells, cross-sells, bundles, deals and add-ons." },
  { key: "sections", title: "Sections", href: "/app/browse/sections", intro: "Sections you place on your store pages: banners, reviews, FAQ, logos, carousels." },
  { key: "boosters", title: "Boosters", href: "/app/browse/boosters", intro: "Small touches across the whole store that nudge shoppers to buy: bars, timers, quick add, pop-ups." },
  { key: "design", title: "Header & pages", href: "/app/browse/design", intro: "Your store's header and pages designed in the app." },
];
export const isCategory = (v: unknown): v is CategoryKey => CATEGORIES.some((c) => c.key === v);
export const category = (key: CategoryKey) => CATEGORIES.find((c) => c.key === key)!;

export type FeatureTab = { label: string; href: string };
export type Feature = { title: string; cat: CategoryKey; tabs: FeatureTab[] };

const design = (href: string): FeatureTab => ({ label: "Design", href });

export const FEATURES = {
  // Offers & bundles
  upsell: { title: "Upsell offers", cat: "offers", tabs: [{ label: "Offers", href: "/app/offers/upsell" }, design("/app/designs/upsell")] },
  cross_sell: { title: "Cross-sell offers", cat: "offers", tabs: [{ label: "Offers", href: "/app/offers/cross-sell" }, design("/app/designs/cross-sell")] },
  bundles: {
    title: "Bundles",
    cat: "offers",
    tabs: [{ label: "Mix & match", href: "/app/bundles" }, ...DEAL_KINDS.map((k) => ({ label: DEAL_TYPES[k].title, href: `/app/deals/${k}` })), design("/app/designs/bundles")],
  },
  addons: { title: "Add-ons", cat: "offers", tabs: [design("/app/designs/add-ons")] },
  // Sections
  hero: { title: "Hero banners", cat: "sections", tabs: [{ label: "Banners", href: "/app/designs/hero" }] },
  reviews: { title: "Customer reviews", cat: "sections", tabs: [{ label: "Reviews", href: "/app/sections/reviews" }, design("/app/designs/reviews")] },
  faq: { title: "FAQ", cat: "sections", tabs: [{ label: "Questions", href: "/app/sections/faq" }, design("/app/designs/faq")] },
  logos: { title: "Scrolling logos and text", cat: "sections", tabs: [{ label: "Logos", href: "/app/sections/logos" }, design("/app/designs/logos")] },
  videos: { title: "Video carousel", cat: "sections", tabs: [{ label: "Videos", href: "/app/videos" }, design("/app/designs/video-carousel")] },
  image_carousel: { title: "Image carousel", cat: "sections", tabs: [design("/app/designs/image-carousel")] },
  collection_pills: { title: "Collection pills", cat: "sections", tabs: [design("/app/designs/collection-pills")] },
  // Boosters
  announcements: { title: "Announcement bar", cat: "boosters", tabs: [{ label: "Messages", href: "/app/sections/announcements" }, design("/app/designs/announcement")] },
  countdown: { title: "Countdown timers", cat: "boosters", tabs: [design("/app/designs/countdown-bar")] },
  shipping_bar: { title: "Free shipping bar", cat: "boosters", tabs: [design("/app/designs/shipping-bar")] },
  quick_add: { title: "Quick add to cart", cat: "boosters", tabs: [design("/app/designs/quick-add")] },
  boosters: { title: "Conversion boosters", cat: "boosters", tabs: [{ label: "Settings", href: "/app/boosters" }] },
  // Header & pages
  header: { title: "Header", cat: "design", tabs: [design("/app/designs/header")] },
  contact: { title: "Contact page", cat: "design", tabs: [design("/app/pages/contact")] },
} satisfies Record<string, Feature>;

export type FeatureKey = keyof typeof FEATURES;
export const feature = (key: FeatureKey): Feature => FEATURES[key];

/** Which feature a Store-sections list or an offer type belongs to. */
export const LIST_FEATURE = { reviews: "reviews", faq: "faq", logos: "logos", announcements: "announcements" } as const satisfies Record<string, FeatureKey>;
export const OFFER_FEATURE: Record<string, FeatureKey> = { upsell: "upsell", "cross-sell": "cross_sell" };
