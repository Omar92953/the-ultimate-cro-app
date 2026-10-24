/**
 * Plan features drawn by theme blocks, which a downgrade switches off on the store without deleting anything
 * (audit 4.2): the storefront copy of each design ($app:cro_design "<handle>", what the block reads) is moved to
 * "<handle>__off", so the block draws nothing; an upgrade moves it back. The editor copies ("_editor", "_draft") stay,
 * so the admin keeps every setting. Free features and the ones the app proxy already checks (Track and Returns pages)
 * are not here. Pure: shared with the tests.
 */
import type { FeatureKey } from "./catalog";
import { MAX_DESIGNS } from "./design-slot.server";
import { isLocked } from "./plan-gate";
import type { PlanKey } from "./plans";

/** Each feature's storefront handles: one design, or designs 1 to MAX_DESIGNS ("key", "key_2"...). */
const ONE = (key: string) => [key];
const SLOTS = (key: string) => [key, ...Array.from({ length: MAX_DESIGNS - 1 }, (_, i) => `${key}_${i + 2}`)];

export const PARKABLE: Partial<Record<FeatureKey, string[]>> = {
  addons: SLOTS("addons"),
  personalize: SLOTS("personalize"),
  cart_extras: ONE("cart_extras"),
  delivery: SLOTS("delivery"),
  size_guide: ONE("size_guide"),
  image_carousel: SLOTS("image_carousel"),
  coverflow: SLOTS("coverflow"),
  videos: SLOTS("videos"),
  quiz: SLOTS("quiz"),
  collection_pills: SLOTS("collection_pills"),
  header: ONE("header"),
  compare_table: SLOTS("compare_table"),
  before_after: SLOTS("before_after"),
  recently_viewed: SLOTS("recently_viewed"),
  shoppable: SLOTS("shoppable"),
  email_popup: ONE("email_popup"),
};

export const parkedHandle = (handle: string) => `${handle}__off`;

/**
 * What a plan change does: `park` the handles of features this plan locks (not parked yet), `unpark` the parked ones
 * it includes again. `parked` is what plan_state remembers.
 */
export function parkPlan(plan: PlanKey, trial: FeatureKey | null, parked: string[], tried: FeatureKey[] = []) {
  const was = new Set(parked);
  const park: string[] = [];
  const unpark: string[] = [];
  for (const [feature, handles] of Object.entries(PARKABLE) as [FeatureKey, string[]][]) {
    const locked = isLocked(plan, feature, trial) && !tried.includes(feature);
    for (const h of handles) {
      if (locked && !was.has(h)) park.push(h);
      if (!locked && was.has(h)) unpark.push(h);
    }
  }
  return { park, unpark };
}
