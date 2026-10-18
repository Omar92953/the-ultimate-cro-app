/**
 * Plan lines for the keyword pages (src/keywords/): which plan unlocks a feature and what it costs,
 * read from the app's plans.ts. Kept apart from lib/keywords.ts, which loads the page files.
 */
import { PLANS, FEATURE_PLAN, FEATURES, money, ordersText, featureTitle, type FeatureKey } from "./app";

/** The plan that unlocks a feature, for tables and answers: "Free", "Starter ($5.99 a month)". */
export const planOf = (k: FeatureKey) => {
  const p = PLANS[FEATURE_PLAN[k]];
  return p.monthly ? `${p.name} (${money(p.monthly)} a month)` : p.name;
};

/** One line per feature: which plan unlocks it and what that plan costs and allows. */
export const planRows = (keys: FeatureKey[]) =>
  keys.map((k) => {
    const p = PLANS[FEATURE_PLAN[k]];
    const limits = p.monthly
      ? `${money(p.monthly)} a month or ${money(p.yearly)} a year, ${p.trialDays} day free trial, ${ordersText(p).toLowerCase()}`
      : `Free: ${p.limits.offerSlots} offers on at once, ${ordersText(p).toLowerCase()}`;
    return { key: k, feature: featureTitle(k), plan: p.name, limits, area: FEATURES[k].area };
  });

/** The Free plan's limits, for answers: "3 offers on at once and 50 orders a month". */
export const freeLimits = () => `${PLANS.free.limits.offerSlots} offers on at once and ${ordersText(PLANS.free).toLowerCase()}`;

