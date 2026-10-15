/**
 * The app's outside addresses: the marketing website and the live demos.
 *
 * The live demos (demos/ in this repo, deployed to demo.crotoolbox.com) are not part of the public
 * website: nothing links to them and search engines are told to skip them. They open only from the
 * app's "See live demo" buttons, through demoUrl().
 *
 * Demo addresses: a feature's key with underscores as hyphens (cross_sell → /cross-sell/), its
 * designs as #design-1, #design-2…, bundle recipes under /bundles/<recipe>/ (anyN → any-n).
 * Shared by client and server; the demo build reads DEMOS and DEMO_RECIPES and fails when they don't
 * match what it builds.
 */
import type { FeatureKey } from "./catalog";
import type { RecipeKey } from "./bundle-recipes";

export const SITE_URL = "https://crotoolbox.com";
export const DEMO_URL = "https://demo.crotoolbox.com";
/** The App Store listing. Placeholder until the listing is live (confirm the handle then). */
export const APP_STORE_URL = "https://apps.shopify.com/cro-toolbox";

/** Features with a live demo: every feature of catalog.ts today. */
export const DEMOS: FeatureKey[] = [
  "upsell", "cross_sell", "bundles", "discounts", "addons", "personalize",
  "cart_tools", "cart_offers", "cart_extras",
  "reviews", "product_reviews", "sales_pop", "trust_badges", "logos",
  "announcements", "countdown", "shipping_bar", "stock_urgency",
  "sticky_atc", "quick_add", "delivery", "stock", "wishlist",
  "hero", "image_carousel", "videos", "faq", "quiz", "collection_pills",
  "header", "footer", "contact", "track", "returns",
  "payment_rules", "delivery_rules", "order_limits", "thank_you", "post_purchase",
];
/** Bundle recipes with their own live demo page. */
export const DEMO_RECIPES: RecipeKey[] = ["fbt", "kit", "mixmatch", "growing", "browse", "anyN"];

export const hasDemo = (key: FeatureKey) => DEMOS.includes(key);
export const demoSlug = (featureKey: string) => featureKey.replace(/_/g, "-");
export const recipeSlug = (recipeKey: string) => recipeKey.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

/** The demo page path: /<feature>/, /<feature>/#design-2, /bundles/<recipe>/. */
export function demoPath(featureKey: FeatureKey, design?: number, recipe?: RecipeKey): string {
  const base = recipe ? `/bundles/${recipeSlug(recipe)}/` : `/${demoSlug(featureKey)}/`;
  return design ? `${base}#design-${design}` : base;
}

/** The full demo address, for "See live demo" buttons (open in a new tab). */
export const demoUrl = (featureKey: FeatureKey, design?: number, recipe?: RecipeKey) => DEMO_URL + demoPath(featureKey, design, recipe);
