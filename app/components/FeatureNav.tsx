/**
 * The same top of the page everywhere (from app/lib/catalog.ts): a breadcrumb back to the
 * feature's category, and the feature's own tabs (e.g. Reviews | Design). Render both as direct
 * children of <s-page>.
 */
import { area, feature, type FeatureKey } from "../lib/catalog";
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

/** The feature's pages as tabs; nothing when it has only one page. */
export function FeatureTabs({ feature: key }: { feature: FeatureKey }) {
  const tabs = feature(key).tabs;
  return tabs.length > 1 ? <Tabs items={tabs.map((t) => ({ label: t.label, to: t.href }))} /> : null;
}
