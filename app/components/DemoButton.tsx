/**
 * "See live demo": opens the feature's demo store page on crotoolbox.com/demo in a new tab (a design
 * page opens the demo of the template in use, a bundle recipe its own demo). Nothing when the feature
 * has no demo. Addresses: lib/site.ts.
 */
import { Button } from "./fields";
import { demoDesign, demoUrl, hasDemo, hasRecipeDemo } from "../lib/site";
import type { FeatureKey } from "../lib/catalog";
import type { RecipeKey } from "../lib/bundle-recipes";

export function DemoButton({
  feature,
  template,
  recipe,
  slot = "secondary-actions",
  variant,
}: {
  feature: FeatureKey;
  /** The design page's template in use (0 based, -1 when none), to open that template's demo. */
  template?: number;
  recipe?: RecipeKey;
  /** Where on the page: the page's top buttons by default; "" for inline. */
  slot?: string;
  variant?: "primary" | "secondary" | "tertiary";
}) {
  if (recipe ? !hasRecipeDemo(recipe) : !hasDemo(feature)) return null;
  const design = template === undefined ? undefined : demoDesign(feature, template);
  return (
    <Button slot={slot || undefined} variant={variant} href={demoUrl(feature, design, recipe)} target="_blank" icon="view" accessibilityLabel="See live demo (opens in a new tab)">
      See live demo
    </Button>
  );
}
