/**
 * The same top of the page everywhere (from app/lib/catalog.ts): a breadcrumb back to the
 * feature's category, and the feature's own tabs (e.g. Reviews | Design). Render both as direct
 * children of <s-page>.
 */
import { area, feature, featuresForPath, offerGroupOf, type FeatureKey } from "../lib/catalog";
import { isLocked } from "../lib/plan-gate";
import { Tabs } from "./ui";
import { usePlan } from "./Upgrade";

/** Breadcrumb to the feature's hub (Offers, Storefront, Cart, Checkout). */
export function CategoryCrumb({ feature: key }: { feature: FeatureKey }) {
  const hub = area(feature(key).area);
  return (
    <s-link slot="breadcrumb-actions" href={hub.href}>
      {hub.title}
    </s-link>
  );
}

/** The feature's pages as tabs (an offer group's pages for offers); nothing when there's only one page. */
/** A group's Style tab also stays chosen on the style editors it leads to. */
const STYLE_EDITORS: Record<string, string[]> = {
  "/app/styles/upsell": ["/app/designs/upsell"],
  "/app/styles/cross_sell": ["/app/designs/cross-sell"],
  "/app/styles/bundles": ["/app/designs/bundles"],
};

export function FeatureTabs({ feature: key }: { feature: FeatureKey }) {
  const { plan, trial } = usePlan();
  const tabs = offerGroupOf(key)?.tabs ?? feature(key).tabs;
  // A tab is locked when every feature on its page is locked by the plan (the free trial feature counts as open).
  const locked = (href: string) => {
    const fs = featuresForPath(href.split("?")[0]);
    return fs.length > 0 && fs.every((f) => isLocked(plan, f, trial));
  };
  // Style is set apart from the feature's content (offers, reviews, messages…).
  return tabs.length > 1 ? <Tabs items={tabs.map((t) => ({ label: t.label, to: t.href, side: t.label === "Style", locked: locked(t.href), also: STYLE_EDITORS[t.href] }))} /> : null;
}
