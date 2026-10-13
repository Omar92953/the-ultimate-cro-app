/**
 * The same top of the page everywhere (from app/lib/catalog.ts): a breadcrumb back to the
 * feature's category, and the feature's own tabs (e.g. Reviews | Design). Render both as direct
 * children of <s-page>.
 */
import { area, feature, offerGroupOf, type FeatureKey } from "../lib/catalog";
import { Tabs } from "./ui";

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
export function FeatureTabs({ feature: key }: { feature: FeatureKey }) {
  const tabs = offerGroupOf(key)?.tabs ?? feature(key).tabs;
  // Design is set apart from the feature's content (offers, reviews, messages…).
  return tabs.length > 1 ? <Tabs items={tabs.map((t) => ({ label: t.label, to: t.href, side: t.label === "Design" }))} /> : null;
}
