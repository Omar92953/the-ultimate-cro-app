/**
 * The app's outside addresses: the marketing website and the live demos.
 *
 * The live demos (demos/ in this repo) are served by the website project at https://crotoolbox.com/demo/,
 * but are not part of the public website: nothing links to them and search engines are told to skip them. They open only from the
 * app's "See live demo" buttons, through demoUrl().
 *
 * Demo addresses: a feature's key with underscores as hyphens (cross_sell → /cross-sell/), its
 * designs as #design-1, #design-2…, bundle recipes under /bundles/<recipe>/ (anyN → any-n), all under
 * DEMO_URL (/demo).
 * Shared by client and server; the demo build reads DEMOS and DEMO_RECIPES and fails when they don't
 * match what it builds.
 */
import type { FeatureKey } from "./catalog";
import type { RecipeKey } from "./bundle-recipes";

export const SITE_URL = "https://crotoolbox.com";
/** The website's video tutorials page (same list as app/lib/tutorials.ts). */
export const TUTORIALS_URL = `${SITE_URL}/tutorials/`;
/**
 * Help center: `helpUrl()` is the front page, `helpUrl("bundles")` an article. Only use slugs that
 * exist in site/src/content/help/ (file name without .md); the link check (scripts/check-links.mjs)
 * fails on a slug that is missing.
 */
export const helpUrl = (slug?: string) => `${SITE_URL}/help/${slug ? `${slug}/` : ""}`;
/** Every help slug the app links to (checked by scripts/check-links.mjs). */
export const HELP_SLUGS_USED = ["getting-started", "plans-and-billing", "good-to-know", "upsell-offers", "cross-sell-offers", "bundles", "storefront-sections", "discounts-addons-personalization"];
/** Where merchants send feature ideas (Cloudflare Email Routing to the app's inbox). An inbox, not a promise to build them. */
export const FEATURE_IDEAS_EMAIL = "features@crotoolbox.com";
export const DEMO_URL = `${SITE_URL}/demo`;
/** The App Store listing. Placeholder until the listing is live (confirm the handle then). */
export const APP_STORE_URL = "https://apps.shopify.com/cro-toolbox";

/** Features with a live demo: every feature of catalog.ts today. */
export const DEMOS: FeatureKey[] = [
  "upsell", "cross_sell", "bundles", "discounts", "addons", "personalize",
  "ab_tests", "cart_offers", "cart_extras",
  "reviews", "product_reviews", "sales_pop", "trust_badges", "logos",
  "announcements", "countdown", "shipping_bar", "stock_urgency",
  "sticky_atc", "quick_add", "delivery", "size_guide", "stock", "wishlist",
  "hero", "image_carousel", "videos", "faq", "quiz", "collection_pills",
  "header", "track", "returns", "return_saving",
  "compare_table", "benefits", "product_tabs", "guarantee", "before_after", "shoppable", "recently_viewed", "how_it_works", "email_popup",
  "payment_rules", "delivery_rules", "order_limits", "thank_you", "post_purchase",
];
/** Bundle recipes with their own live demo page. */
export const DEMO_RECIPES: RecipeKey[] = ["fbt", "kit", "mixmatch", "growing", "browse", "anyN"];

/**
 * Features whose demo starts with the app's templates, in the order their design page lists them
 * (template 1 is #design-1…), and how many templates the demo shows. The demo build checks these.
 */
export const DEMO_TEMPLATES: Partial<Record<FeatureKey, number>> = {
  upsell: 6, cross_sell: 6, personalize: 4, cart_extras: 4,
  reviews: 6, product_reviews: 3, logos: 6, announcements: 6, countdown: 6, shipping_bar: 6,
  quick_add: 5, delivery: 4, size_guide: 4, stock: 4, wishlist: 4, hero: 5, videos: 6, faq: 6, quiz: 4,
  header: 6, track: 4, returns: 4,
  compare_table: 4, benefits: 4, product_tabs: 4, guarantee: 4, before_after: 3, shoppable: 3, recently_viewed: 3, how_it_works: 4, email_popup: 4,
};

export const hasDemo = (key: FeatureKey) => DEMOS.includes(key);
export const hasRecipeDemo = (key: RecipeKey) => DEMO_RECIPES.includes(key);
/** The demo design that shows template number `index` (0 based) of a design page, if the demo has it. */
export function demoDesign(featureKey: FeatureKey, index: number): number | undefined {
  return index >= 0 && index < (DEMO_TEMPLATES[featureKey] ?? 0) ? index + 1 : undefined;
}
export const demoSlug = (featureKey: string) => featureKey.replace(/_/g, "-");
export const recipeSlug = (recipeKey: string) => recipeKey.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

/** The demo page path: /<feature>/, /<feature>/#design-2, /bundles/<recipe>/. */
export function demoPath(featureKey: FeatureKey, design?: number, recipe?: RecipeKey): string {
  const base = recipe ? `/bundles/${recipeSlug(recipe)}/` : `/${demoSlug(featureKey)}/`;
  return design ? `${base}#design-${design}` : base;
}

/** The full demo address, for "See live demo" buttons (open in a new tab). */
export const demoUrl = (featureKey: FeatureKey, design?: number, recipe?: RecipeKey) => DEMO_URL + demoPath(featureKey, design, recipe);
