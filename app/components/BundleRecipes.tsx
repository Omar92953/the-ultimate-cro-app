/**
 * The bundle recipes as big cards ("What do you want to sell?"): the Create bundle page and the
 * empty Bundles list. Content: lib/bundle-recipes.ts.
 */
import { BUNDLE_RECIPES, type RecipeKey } from "../lib/bundle-recipes";
import { GroupCards } from "./ui";
import { DemoButton } from "./DemoButton";

/** The recipe cards; `only` shows just one (the empty Bundles tab). */
export function BundleRecipes({ only }: { only?: RecipeKey }) {
  return (
    <GroupCards
      items={BUNDLE_RECIPES.filter((r) => !only || r.key === only).map((r) => ({ key: r.key, title: r.title, about: r.about, href: r.href, chips: [r.best], action: <DemoButton feature="bundles" recipe={r.key} slot="" variant="tertiary" /> }))}
    />
  );
}
