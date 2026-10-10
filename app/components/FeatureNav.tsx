/**
 * The same top of the page everywhere (from app/lib/catalog.ts): a breadcrumb back to the
 * feature's category, and the feature's own tabs (e.g. Reviews | Design). Render both as direct
 * children of <s-page>.
 */
import { category, feature, type FeatureKey } from "../lib/catalog";
import { Tabs } from "./ui";

/** Breadcrumb to the feature's category (Offers & bundles, Sections…). */
export function CategoryCrumb({ feature: key }: { feature: FeatureKey }) {
  const cat = category(feature(key).cat);
  return (
    <s-link slot="breadcrumb-actions" href={cat.href}>
      {cat.title}
    </s-link>
  );
}

/** Breadcrumb to the feature's first page (for pages that edit one item: an offer, a review…). */
export function FeatureCrumb({ feature: key }: { feature: FeatureKey }) {
  const f = feature(key);
  return (
    <s-link slot="breadcrumb-actions" href={f.tabs[0].href}>
      {f.title}
    </s-link>
  );
}

/** The feature's pages as tabs; nothing when it has only one page. */
export function FeatureTabs({ feature: key }: { feature: FeatureKey }) {
  const tabs = feature(key).tabs;
  return tabs.length > 1 ? <Tabs items={tabs.map((t) => ({ label: t.label, to: t.href }))} /> : null;
}
