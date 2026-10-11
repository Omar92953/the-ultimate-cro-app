/**
 * Plan limits (app/lib/plans.ts, plan-gate.ts, referral code). Run: npm run test:app
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AREAS, FEATURES, areaForPath, featuresForPath, featuresIn, type FeatureKey } from "../../app/lib/catalog";
import {
  EXTRA_PLAN,
  FEATURE_PLAN,
  PLANS,
  PLAN_KEYS,
  atLeast,
  canResume,
  canUse,
  limitError,
  ordersOver,
  overLimit,
  planAbove,
  planFromSubscription,
  planPageUrl,
} from "../../app/lib/plans";
import { pageLock } from "../../app/lib/plan-gate";

test("every feature has a plan, and prices only go up", () => {
  for (const k of Object.keys(FEATURES)) assert.ok(FEATURE_PLAN[k as FeatureKey], `no plan for ${k}`);
  for (let i = 1; i < PLAN_KEYS.length; i++) {
    assert.ok(PLANS[PLAN_KEYS[i]].monthly > PLANS[PLAN_KEYS[i - 1]].monthly);
  }
});

test("Free includes one active upsell, cross-sell and bundle-or-deal", () => {
  assert.equal(limitError("free", "upsellOffers", 0), null);
  assert.match(limitError("free", "upsellOffers", 1)!, /Free plan includes 1 active upsell offer\. Upgrade to Starter/);
  assert.match(limitError("free", "bundlesAndDeals", 3)!, /1 active bundle or deal/);
  assert.equal(limitError("starter", "upsellOffers", 500), null);
});

test("the next plan up is the cheapest one with room", () => {
  assert.equal(planAbove("upsellOffers", 1), "starter");
  assert.equal(planAbove("designsPerSection", 1), "starter");
  assert.equal(planAbove("designsPerSection", 5), null);
  assert.equal(planAbove("monthlyOrders", 800, "starter"), "growth");
  assert.equal(planAbove("monthlyOrders", 3000, "starter"), "pro");
});

test("downgrade: only the first N that are on stay on", () => {
  const items = [
    { id: "a", active: true },
    { id: "b", active: false },
    { id: "c", active: true },
    { id: "d", active: true },
  ];
  assert.deepEqual(overLimit(items, 1).map((i) => i.id), ["c", "d"]);
  assert.deepEqual(overLimit(items, 3), []);
  assert.deepEqual(overLimit(items, null), []);
  assert.deepEqual(overLimit(items, 0).map((i) => i.id), ["a", "c", "d"]);
});

test("upgrade: paused items come back without going over the new limit", () => {
  const paused = ["x", "y", "z"];
  assert.deepEqual(canResume(paused, 1, null), paused);
  assert.deepEqual(canResume(paused, 1, 3), ["x", "y"]);
  assert.deepEqual(canResume(paused, 5, 3), []);
});

test("features unlock from their plan up", () => {
  assert.ok(canUse("free", "upsell"));
  // Free matches the competitors' free tiers: checkout rules, wishlist, back in stock…
  assert.ok(canUse("free", "wishlist") && canUse("free", "payment_rules") && canUse("free", "post_purchase"));
  assert.ok(!canUse("free", "quiz"));
  assert.ok(canUse("starter", "quiz"));
  assert.ok(atLeast("growth", "starter") && !atLeast("starter", "growth"));
  // Feature requests ("we build it for you") start on Growth.
  assert.ok(!atLeast("starter", EXTRA_PLAN.featureRequests) && atLeast("growth", EXTRA_PLAN.featureRequests) && atLeast("pro", EXTRA_PLAN.featureRequests));
});

test("pages map to features, and locked pages say which plan they need", () => {
  assert.deepEqual(featuresForPath("/app/offers/upsell/new"), ["upsell"]);
  assert.deepEqual(featuresForPath("/app/offers/upsell.data"), ["upsell"]);
  assert.deepEqual(featuresForPath("/app/settings"), []);
  // Every feature belongs to a hub, and its pages lead back there.
  assert.equal(areaForPath("/app/offers/upsell/new"), "offers");
  assert.equal(areaForPath("/app/designs/quiz"), "storefront");
  assert.equal(areaForPath("/app/checkout/limits"), "checkout");
  assert.equal(areaForPath("/app/cart"), "cart");
  assert.deepEqual(featuresForPath("/app/sections/reviews").sort(), ["product_reviews", "reviews"]);
  assert.equal(pageLock("free", "/app/offers/upsell/new"), null);
  assert.deepEqual(pageLock("free", "/app/designs/quiz"), { kind: "feature", feature: "quiz", needs: "starter" });
  assert.equal(pageLock("starter", "/app/designs/quiz"), null);
  assert.equal(pageLock("free", "/app/checkout/payment"), null);
  // Hubs and the offer picker are never locked.
  assert.equal(pageLock("free", "/app/offers"), null);
  assert.equal(pageLock("free", "/app/offers/new"), null);
  assert.equal(pageLock("free", "/app/storefront"), null);
  // Not features: never locked.
  assert.equal(pageLock("free", "/app"), null);
  assert.equal(pageLock("free", "/app/results"), null);
});

test("designs 2–5 need a plan with more designs per section", () => {
  assert.equal(pageLock("free", "/app/designs/faq", "?design=1"), null);
  assert.deepEqual(pageLock("free", "/app/designs/faq", "?design=2"), { kind: "design", slot: 2, allowed: 1, needs: "starter" });
  assert.equal(pageLock("starter", "/app/designs/faq", "?design=5"), null);
});

test("soft order limit", () => {
  assert.ok(!ordersOver("free", 10000));
  assert.ok(ordersOver("starter", 501));
  assert.ok(!ordersOver("starter", 500));
  assert.ok(!ordersOver("starter", null));
});

test("subscription names and handles map to plans", () => {
  assert.equal(planFromSubscription("starter"), "starter");
  assert.equal(planFromSubscription("Growth"), "growth");
  assert.equal(planFromSubscription("growth_yearly"), "growth");
  assert.equal(planFromSubscription("Pro (annual)"), "pro");
  assert.equal(planFromSubscription("Something else"), null);
  assert.equal(planFromSubscription(null), null);
});

test("plan selection page URL", () => {
  assert.equal(planPageUrl("my-shop.myshopify.com", "cro-toolbox"), "https://admin.shopify.com/store/my-shop/charges/cro-toolbox/pricing_plans");
});

test("every feature is listed on its hub", () => {
  for (const k of Object.keys(FEATURES) as FeatureKey[]) {
    assert.ok(AREAS.some((a) => featuresIn(a.key).includes(k)), `${k} is on no hub`);
  }
});
