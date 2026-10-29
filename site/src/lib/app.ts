/**
 * What the site knows about the app, read from the app's own source at build time, so prices,
 * limits and features on the site never drift from the app:
 *   - prices, trials and limits: app/lib/plans.ts
 *   - features and areas: app/lib/catalog.ts
 *   - the 6 bundle recipes: app/lib/bundle-recipes.ts
 *   - the offer types: app/lib/offer-types.ts
 *   - data retention periods: app/lib/retention.ts
 */
import { PLANS, PLAN_KEYS, FEATURE_PLAN, EXTRA_PLAN, GUARANTEE, atLeast, type Plan, type PlanKey, type Limits } from "../../../app/lib/plans";
import { BUNDLE_RECIPES, type Recipe, type RecipeKey } from "../../../app/lib/bundle-recipes";
import { OFFER_TYPES, type OfferTypeKey } from "../../../app/lib/offer-types";
export { RETENTION_DAYS } from "../../../app/lib/retention";
import { FEATURES, FEATURE_KEYS as ALL_FEATURE_KEYS, AREAS as ALL_AREAS, SITE_HIDDEN, featuresIn as allFeaturesIn, type FeatureKey, type AreaKey } from "../../../app/lib/catalog";

/** Features still being built (catalog.ts SITE_HIDDEN) are left out of the website until they launch. */
const FEATURE_KEYS = ALL_FEATURE_KEYS.filter((k) => !SITE_HIDDEN.includes(k));
const featuresIn = (a: AreaKey) => allFeaturesIn(a).filter((k) => !SITE_HIDDEN.includes(k));
const AREAS = ALL_AREAS.filter((a) => featuresIn(a.key).length > 0);

export { PLANS, PLAN_KEYS, FEATURE_PLAN, EXTRA_PLAN, GUARANTEE, atLeast, FEATURES, FEATURE_KEYS, AREAS, featuresIn };
export { BUNDLE_RECIPES, OFFER_TYPES };
export type { OfferTypeKey };
export type { Limits, Plan, PlanKey, FeatureKey, AreaKey, Recipe, RecipeKey };

/** House rule: no dashes in visible text. The app's titles use a few ("Add-ons"); show them plainly. */
export const plain = (s: string) =>
  s
    .replace(/Mix-and-match/gi, (m) => (m[0] === "M" ? "Mix and match" : "mix and match"))
    .replace(/(\w)-(\w)/g, "$1 $2")
    .replace(/[“”]/g, "\"");

export const plans = PLAN_KEYS.map((k) => PLANS[k]);
export const paidPlans = plans.filter((p) => p.monthly > 0);
export const cheapestPaid = paidPlans[0];
export const trialDays = Math.max(...plans.map((p) => p.trialDays));

/** "$5.99", "$59", "Free". */
export const money = (n: number) => (n === 0 ? "$0" : `$${n % 1 ? n.toFixed(2) : n}`);

/** How much a year costs on the yearly price compared with 12 monthly payments, in whole percent. */
export const yearlySaving = (p: Plan) => (p.monthly ? Math.round((1 - p.yearly / (p.monthly * 12)) * 100) : 0);

/** "50 orders a month", "Unlimited orders". */
export const ordersText = (p: Plan) =>
  p.limits.monthlyOrders === null ? "Unlimited orders" : `${p.limits.monthlyOrders.toLocaleString("en-US")} orders a month`;

export const featureTitle = (k: FeatureKey) => plain(FEATURES[k].title);
/**
 * Where the website's one line must differ from the app's catalog.ts until the app catches up (the app is
 * frozen while in App Store review). Remove an entry once catalog.ts says the same.
 */
const ABOUT_NOW: Partial<Record<FeatureKey, string>> = {
  ab_tests: "Split your shoppers between up to four versions of an upsell or cross sell (words, discount, style) and see which earns more.",
};
export const featureAbout = (k: FeatureKey) => plain(ABOUT_NOW[k] ?? FEATURES[k].about);
export const planName = (k: PlanKey) => PLANS[k].name;

/** Checkout features run inside Shopify checkout (they have no storefront widget). */
export const CHECKOUT_ONLY: FeatureKey[] = ["payment_rules", "delivery_rules", "order_limits", "thank_you", "post_purchase"];

/** The areas the site presents, in order. Analytics isn't a catalog area (it has no features to switch on). */
export type SiteArea = { key: AreaKey | "analytics"; title: string; intro: string; features: FeatureKey[] };
export const SITE_AREAS: SiteArea[] = [
  ...AREAS.map((a) => ({
    key: a.key,
    title: a.title,
    intro: plain(a.intro),
    // An offer shown at checkout (after-purchase) is listed under Checkout only, not twice.
    features: featuresIn(a.key).filter((k) => !(a.key === "offers" && CHECKOUT_ONLY.includes(k))),
  })),
  {
    key: "analytics",
    title: "Analytics",
    intro: "See what the app sells: sales from its offers and widgets over the last 30 days, results per offer and per bundle, and a holdout test.",
    features: [],
  },
];
