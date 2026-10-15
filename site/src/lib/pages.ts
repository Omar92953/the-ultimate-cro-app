/**
 * Title and description of every page, in one list: the pages use them for their <title> and meta
 * description, and /og/<slug>.png draws each page's share image from them.
 * Prices in descriptions come from the app's plans.ts.
 */
import { plans, cheapestPaid, money, trialDays, FEATURE_KEYS, FEATURES, FEATURE_PLAN, PLANS, SITE_AREAS, featureTitle, featureAbout, type FeatureKey } from "./app";
import { FEATURE_COPY } from "./features";
import { USE_CASES } from "./usecases";
import { COMPETITORS } from "./competitors";

const paidList = plans.filter((p) => p.monthly > 0).map((p) => `${p.name} ${money(p.monthly)}`);
const free = plans.find((p) => p.monthly === 0)?.name ?? "Free";

export type PageMeta = {
  slug: string;
  path: string;
  /** The <title>; " | CRO Toolbox" is added unless it already names the app. */
  title: string;
  description: string;
  /** Short line on the share image (defaults to the title). */
  ogTitle?: string;
  ogKicker?: string;
};

export const PAGES = {
  home: {
    slug: "home",
    path: "/",
    title: "CRO Toolbox: upsells, bundles, cart drawer and more for Shopify",
    description:
      `CRO Toolbox is one Shopify app for upsells, cross sells, six kinds of bundles, discounts, a cart drawer, reviews, countdowns and checkout rules. Works with any Online Store 2.0 theme, no code. Free plan, paid plans from ${money(cheapestPaid.monthly)} a month.`,
    ogTitle: "Sell more per order, with one app",
    ogKicker: "Shopify app",
  },
  pricing: {
    slug: "pricing",
    path: "/pricing/",
    title: "Pricing",
    description:
      `CRO Toolbox pricing: ${free}, ${paidList.slice(0, -1).join(", ")} and ${paidList.at(-1)} a month, or yearly. Every paid plan has a ${trialDays} day free trial. See what each plan includes and its orders per month.`,
    ogTitle: "Simple pricing. Free plan included.",
    ogKicker: "Pricing",
  },
  support: {
    slug: "support",
    path: "/support/",
    title: "Support",
    description: "How to get help with CRO Toolbox: contact support, what to include in your message and where to find setup guides.",
    ogTitle: "We're here to help",
    ogKicker: "Support",
  },
  privacy: {
    slug: "privacy",
    path: "/privacy/",
    title: "Privacy policy",
    description: "What data the CRO Toolbox Shopify app and this website collect, why, where it's kept and how it's deleted.",
    ogKicker: "Legal",
  },
  terms: {
    slug: "terms",
    path: "/terms/",
    title: "Terms of service",
    description: "The terms for using the CRO Toolbox Shopify app and this website.",
    ogKicker: "Legal",
  },
} satisfies Record<string, PageMeta>;

export const featureSlug = (k: string) => k.replace(/_/g, "-");
export const featurePath = (k: FeatureKey) => `/features/${featureSlug(k)}/`;
export const areaPath = (a: string) => `/features/${a}/`;

/** "Included on the Free plan" / "On the Starter plan and above". */
export const planLine = (k: FeatureKey) => {
  const p = PLANS[FEATURE_PLAN[k]];
  return p.monthly === 0 ? `Included on the ${p.name} plan` : `On the ${p.name} plan and above`;
};

export const FEATURE_PAGES: Record<FeatureKey, PageMeta> = Object.fromEntries(
  FEATURE_KEYS.map((k) => [
    k,
    {
      slug: `feature-${featureSlug(k)}`,
      path: featurePath(k),
      title: `${featureTitle(k)} for Shopify`,
      description: `${featureAbout(k)} ${FEATURE_COPY[k].who} ${planLine(k)} of CRO Toolbox.`.slice(0, 300),
      ogTitle: featureTitle(k),
      ogKicker: SITE_AREAS.find((a) => a.key === FEATURES[k].area)?.title ?? "Feature",
    },
  ]),
) as Record<FeatureKey, PageMeta>;

export const AREA_PAGES: PageMeta[] = SITE_AREAS.map((a) => ({
  slug: `area-${a.key}`,
  path: areaPath(a.key),
  title: `${a.title} features for Shopify`,
  description: `${a.intro} ${a.features.length ? `${a.features.length} features in CRO Toolbox.` : ""}`.trim(),
  ogTitle: `${a.title}: every feature`,
  ogKicker: "Features",
}));

export const MORE_PAGES = {
  features: {
    slug: "features",
    path: "/features/",
    title: "Features: offers, bundles, storefront, cart and checkout",
    description: `Every CRO Toolbox feature in one place: ${FEATURE_KEYS.length} features across offers, storefront, cart, checkout and analytics, for any Online Store 2.0 theme.`,
    ogTitle: "Every feature, one app",
    ogKicker: "Features",
  },
  bundles: {
    slug: "bundles",
    path: "/bundles/",
    title: "Shopify bundles: six ways to sell more together",
    description:
      "Frequently bought together, kits, mix and match boxes, growing discounts, build while browsing and any N for one price. All six bundle types in CRO Toolbox, priced by Shopify at checkout.",
    ogTitle: "Six ways to bundle",
    ogKicker: "Bundles",
  },
  useCases: {
    slug: "use-cases",
    path: "/use-cases/",
    title: "Use cases: what to set up for your store",
    description: "Which CRO Toolbox features to set up to raise order value, and for beauty, fashion, food and drink, home and gift stores.",
    ogTitle: "What to set up for your store",
    ogKicker: "Use cases",
  },
  compare: {
    slug: "compare",
    path: "/compare/",
    title: "Compare CRO Toolbox with other Shopify apps",
    description: "How CRO Toolbox compares with Bundler, Simple Bundles, Fast Bundle, Kaching, BOGOS, Rebuy, Vitals and Section Store, with sources and the date we checked.",
    ogTitle: "How CRO Toolbox compares",
    ogKicker: "Compare",
  },
} satisfies Record<string, PageMeta>;

export const USE_CASE_PAGES: PageMeta[] = USE_CASES.map((u) => ({ slug: `use-${u.slug}`, path: `/use-cases/${u.slug}/`, title: u.title, description: u.description, ogKicker: u.kind === "Goal" ? "Use case" : "Industry" }));

export const COMPARE_PAGES: PageMeta[] = COMPETITORS.map((c) => ({
  slug: `compare-${c.slug}`,
  path: `/compare/cro-toolbox-vs-${c.slug}/`,
  title: `CRO Toolbox vs ${c.name}`,
  description: `CRO Toolbox and ${c.name} side by side: what each app covers and what each costs, with sources and the date checked.`,
  ogTitle: `CRO Toolbox vs ${c.name}`,
  ogKicker: "Compare",
}));

export const ALL_PAGES: PageMeta[] = [...Object.values(PAGES), ...Object.values(MORE_PAGES), ...Object.values(FEATURE_PAGES), ...AREA_PAGES, ...USE_CASE_PAGES, ...COMPARE_PAGES];
