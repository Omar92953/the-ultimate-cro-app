/**
 * The bundle recipes as big cards ("What do you want to sell?"): the Create bundle page and the
 * empty Bundles list. Content: lib/bundle-recipes.ts.
 */
import type { ReactNode } from "react";
import { BUNDLE_RECIPES, type RecipeKey } from "../lib/bundle-recipes";
import { GroupCards } from "./ui";
import { BundleIcon, CrossSellIcon, DiscountIcon, UpsellIcon } from "./icons";
import { DemoButton } from "./DemoButton";

const ICONS: Record<RecipeKey, ReactNode> = {
  fbt: <CrossSellIcon />,
  kit: <BundleIcon />,
  mixmatch: <BundleIcon />,
  growing: <DiscountIcon />,
  browse: <UpsellIcon />,
  anyN: <DiscountIcon />,
};

export function BundleRecipes() {
  return (
    <GroupCards
      items={BUNDLE_RECIPES.map((r) => ({ key: r.key, title: r.title, about: r.about, href: r.href, icon: ICONS[r.key], chips: [r.best], action: <DemoButton feature="bundles" recipe={r.key} slot="" variant="tertiary" /> }))}
    />
  );
}
