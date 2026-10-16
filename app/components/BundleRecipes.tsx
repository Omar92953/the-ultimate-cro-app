/**
 * The bundle recipes as big cards ("What do you want to sell?"): the Create bundle page and the
 * empty Bundles list. Content: lib/bundle-recipes.ts.
 */
import { BUNDLE_RECIPES } from "../lib/bundle-recipes";
import { GroupCards } from "./ui";
import { DemoButton } from "./DemoButton";

export function BundleRecipes() {
  return (
    <GroupCards
      items={BUNDLE_RECIPES.map((r) => ({ key: r.key, title: r.title, about: r.about, href: r.href, chips: [r.best], action: <DemoButton feature="bundles" recipe={r.key} slot="" variant="tertiary" /> }))}
    />
  );
}
