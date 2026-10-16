/**
 * Which plan a page needs. Shared by the app frame (shows an upgrade card instead of a locked
 * page) and the server (refuses saves on a locked page). Prices and plans: plans.ts.
 */
import { featuresForPath, type FeatureKey } from "./catalog";
import { FEATURE_PLAN, PLANS, PLAN_KEYS, atLeast, limitOf, planAbove, planRank, type PlanKey } from "./plans";

/** Can this plan try this feature for free? Only the next plan's features, and only if the plan has a trial slot. */
export function canTry(plan: PlanKey, f: FeatureKey) {
  return PLANS[plan].limits.trialFeatures > 0 && planRank(FEATURE_PLAN[f]) === planRank(plan) + 1;
}

/** Does the plan lock this feature? The free trial feature (plans.ts `trialFeatures`) counts as unlocked. */
export function isLocked(plan: PlanKey, f: FeatureKey, trial: FeatureKey | null = null) {
  if (atLeast(plan, FEATURE_PLAN[f])) return false;
  return !(trial === f && canTry(plan, f));
}

export type PageLock =
  | { kind: "feature"; feature: FeatureKey; needs: PlanKey }
  | { kind: "design"; slot: number; allowed: number; needs: PlanKey };

/**
 * null when the plan opens this page. A page shared by several features needs the cheapest of
 * them (e.g. the reviews list is part of both review features). `search` is the query string
 * (?design=N for designs 2–5).
 */
export function pageLock(plan: PlanKey, pathname: string, search = "", trial: FeatureKey | null = null): PageLock | null {
  const features = featuresForPath(pathname);
  if (features.length) {
    const needs = features.map((f) => FEATURE_PLAN[f]).sort((a, b) => PLAN_KEYS.indexOf(a) - PLAN_KEYS.indexOf(b))[0];
    // The store's free trial of a next-plan feature (plans.ts `trialFeatures`) opens its pages.
    if (trial && features.includes(trial) && canTry(plan, trial)) return null;
    if (!atLeast(plan, needs)) {
      return { kind: "feature", feature: features.find((f) => FEATURE_PLAN[f] === needs)!, needs };
    }
  }
  const slot = Number(new URLSearchParams(search).get("design"));
  const allowed = limitOf(plan, "designsPerSection");
  if (Number.isInteger(slot) && slot > 1 && allowed !== null && slot > allowed) {
    return { kind: "design", slot, allowed, needs: planAbove("designsPerSection", slot - 1, plan) ?? "pro" };
  }
  return null;
}
