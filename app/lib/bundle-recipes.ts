/**
 * The 6 bundle recipes the "Create bundle" chooser offers (docs/plans/bundles-overhaul.md). Each
 * opens the right editor with presets (mix & match recipes through ?recipe=).
 */
export type RecipeKey = "fbt" | "kit" | "mixmatch" | "growing" | "browse" | "anyN";

export type Recipe = { key: RecipeKey; title: string; about: string; best: string; href: string };

export const BUNDLE_RECIPES: Recipe[] = [
  { key: "fbt", title: "Frequently bought together", about: "A set of items shown on each item's page, with a discount when they're bought together.", best: "Best for accessories that go with a product", href: "/app/deals/fixed/new" },
  { key: "kit", title: "Kit sold as one product", about: "A ready-made set with its own page, picture and price; the cart shows it as one line.", best: "Best for gift sets, starter kits and multipacks", href: "/app/kits/new" },
  { key: "mixmatch", title: "Mix & match box", about: "Shoppers pick items from a collection on the box's own page, for one price.", best: "Best for build your own box", href: "/app/bundles/new?recipe=mixmatch" },
  { key: "growing", title: "Build your bundle, save more", about: "The more items shoppers add, the bigger the discount (2 items 10% off, 3 items 15%…).", best: "Best for bigger orders", href: "/app/bundles/new?recipe=growing" },
  { key: "browse", title: "Build while browsing", about: "Shoppers add items to their bundle from collection pages while a tray follows them.", best: "Best for big catalogues and long collections", href: "/app/bundles/new?recipe=browse" },
  { key: "anyN", title: "Any 3 for one price", about: "Any 3 for $30, any 6 for $55, picked from a long collection.", best: "Best for socks, candles and snacks", href: "/app/bundles/new?recipe=anyN" },
];

export const isRecipe = (v: unknown): v is RecipeKey => BUNDLE_RECIPES.some((r) => r.key === v);
