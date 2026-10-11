/**
 * Which plan a page needs. Shared by the app frame (shows an upgrade card instead of a locked
 * page) and the server (refuses saves on a locked page). Prices and plans: plans.ts.
 */
import { featuresForPath, type FeatureKey } from "./catalog";
import { FEATURE_PLAN, PLAN_KEYS, atLeast, limitOf, planAbove, type PlanKey } from "./plans";

export type PageLock =
  | { kind: "feature"; feature: FeatureKey; needs: PlanKey }
  | { kind: "design"; slot: number; allowed: number; needs: PlanKey };

/**
 * null when the plan opens this page. A page shared by several features needs the cheapest of
 * them (e.g. the reviews list is part of both review features). `search` is the query string
 * (?design=N for designs 2–5).
 */
export function pageLock(plan: PlanKey, pathname: string, search = ""): PageLock | null {
  const features = featuresForPath(pathname);
  if (features.length) {
    const needs = features.map((f) => FEATURE_PLAN[f]).sort((a, b) => PLAN_KEYS.indexOf(a) - PLAN_KEYS.indexOf(b))[0];
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
