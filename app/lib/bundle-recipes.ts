/**
 * The 6 bundle recipes the "Create bundle offer" chooser offers (docs/plans/bundles-overhaul.md).
 * Each opens the right editor with presets (mix and match recipes through ?recipe=). The same
 * list is the Bundles page's tabs. Keys and URLs never change; only the names do.
 */
import { growingPricing, type BundlePricing } from "./types";

export type RecipeKey = "fbt" | "kit" | "mixmatch" | "browse" | "growing" | "anyN";

export type Recipe = {
  key: RecipeKey;
  /** The full name: recipe cards, Create offer, the website. */
  title: string;
  /** The short name: the Bundles tabs. */
  short: string;
  /** The tab's create button. */
  create: string;
  about: string;
  best: string;
  href: string;
};

export const BUNDLE_RECIPES: Recipe[] = [
  { key: "fbt", title: "Frequently bought together", short: "Frequently bought together", create: "Create frequently bought together offer", about: "A set of items shown on each item's page, with a discount when they're bought together.", best: "Best for accessories that go with a product", href: "/app/deals/fixed/new" },
  { key: "kit", title: "Fixed bundle (sold as one product)", short: "Fixed bundle", create: "Create fixed bundle offer", about: "A ready-made set with its own page, picture and price; the cart shows it as one line.", best: "Best for gift sets, starter kits and multipacks", href: "/app/kits/new" },
  { key: "mixmatch", title: "Mix and match", short: "Mix and match", create: "Create mix and match offer", about: "Shoppers pick items from a collection on the bundle's own page, for one price.", best: "Best for build your own box", href: "/app/bundles/new?recipe=mixmatch" },
  { key: "browse", title: "Build your own bundle", short: "Build your own bundle", create: "Create build your own bundle offer", about: "Shoppers add items to their bundle from collection pages while a tray follows them.", best: "Best for big catalogues and long collections", href: "/app/bundles/new?recipe=browse" },
  { key: "growing", title: "Tiered bundle (buy more, save more)", short: "Tiered bundle", create: "Create tiered bundle offer", about: "The more items shoppers add, the bigger the discount (2 items 10% off, 3 items 15%…).", best: "Best for bigger orders", href: "/app/bundles/new?recipe=growing" },
  { key: "anyN", title: "Fixed price bundle (any 3 for $30)", short: "Fixed price bundle", create: "Create fixed price bundle offer", about: "Any 3 for $30, any 6 for $55, picked from a long collection.", best: "Best for socks, candles and snacks", href: "/app/bundles/new?recipe=anyN" },
];

export const isRecipe = (v: unknown): v is RecipeKey => BUNDLE_RECIPES.some((r) => r.key === v);
export const recipe = (key: RecipeKey) => BUNDLE_RECIPES.find((r) => r.key === key)!;

/** Which recipe a mix and match style bundle belongs to, read from how it is set up (recipes aren't stored). */
export function recipeOfBundle(b: { pricing: BundlePricing; storeWide: boolean }): RecipeKey {
  if (b.storeWide) return "browse";
  if (growingPricing(b.pricing)) return "growing";
  if (b.pricing === "tiers") return "anyN";
  return "mixmatch";
}
