/**
 * Plan limits (app/lib/plans.ts, plan-gate.ts, referral code). Run: npm run test:app
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AREAS, FEATURES, GROUPS, OFFER_GROUPS, areaForPath, dealFeature, featuresForPath, featuresIn, offerGroupOf, type FeatureKey } from "../../app/lib/catalog";
import { OFFER_TYPES, OFFER_TYPE_KEYS } from "../../app/lib/offer-types";
import { DEAL_KINDS } from "../../app/lib/deals";
import { BUNDLE_RECIPES, recipeOfBundle } from "../../app/lib/bundle-recipes";
import {
  EXTRA_PLAN,
  GUARANTEE,
  limitOf,
  FEATURE_PLAN,
  PLANS,
  PLAN_KEYS,
  atLeast,
  canResume,
  canUse,
  limitError,
  limitText,
  ordersLine,
  ordersOver,
  overLimit,
  planAbove,
  planFromSubscription,
  planPageUrl,
} from "../../app/lib/plans";
import { canTry, pageLock } from "../../app/lib/plan-gate";

test("every feature has a plan, and prices only go up", () => {
  for (const k of Object.keys(FEATURES)) assert.ok(FEATURE_PLAN[k as FeatureKey], `no plan for ${k}`);
  for (let i = 1; i < PLAN_KEYS.length; i++) {
    assert.ok(PLANS[PLAN_KEYS[i]].monthly > PLANS[PLAN_KEYS[i - 1]].monthly);
  }
});

test("Free has 3 offer slots shared by every offer type", () => {
  assert.equal(limitError("free", "offerSlots", 2), null);
  assert.match(limitError("free", "offerSlots", 3)!, /Free plan includes 3 offer slots\. Upgrade to Starter/);
  assert.equal(limitError("starter", "offerSlots", 500), null);
});

test("each plan tastes the next: checkout rules 3 → 6 → unlimited, offer results 1 → 3 → all", () => {
  assert.equal(limitOf("free", "checkoutRules"), 3);
  assert.equal(limitOf("starter", "checkoutRules"), 6);
  assert.equal(limitOf("growth", "checkoutRules"), null);
  assert.deepEqual(PLAN_KEYS.map((p) => limitOf(p, "offerStats")), [1, 3, null, null]);
  assert.equal(PLANS.free.limits.trialFeatures, 1);
  assert.match(limitError("starter", "checkoutRules", 6)!, /Upgrade to Growth/);
});

test("every paid plan carries the cancel-anytime guarantee and a job", () => {
  assert.match(GUARANTEE, /Cancel/);
  for (const p of PLAN_KEYS) assert.ok(PLANS[p].job.length > 10);
});

test("the next plan up is the cheapest one with room", () => {
  assert.equal(planAbove("offerSlots", 3), "starter");
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
  // Cart is no longer a menu item: its features sit in Storefront, group Cart.
  assert.equal(areaForPath("/app/cart"), null);
  assert.equal(areaForPath("/app/designs/cart-extras"), "storefront");
  assert.equal(AREAS.some((a) => (a.key as string) === "cart"), false);
  assert.equal(FEATURES.cart_extras.group, "cart");
  assert.equal(GROUPS[0].key, "cart");
  assert.equal((FEATURES as Record<string, unknown>).cart_tools, undefined);
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

test("offers sit in four groups, and every offer page shows its group's tabs", () => {
  assert.deepEqual(OFFER_GROUPS.map((g) => g.key), ["upsell", "cross_sell", "bundles", "discounts"]);
  // Every offer type and every deal kind lands in a group.
  for (const k of OFFER_TYPE_KEYS) assert.ok(OFFER_GROUPS.some((g) => g.key === OFFER_TYPES[k].group), k);
  for (const k of DEAL_KINDS) assert.ok(offerGroupOf(dealFeature(k)), k);
  assert.deepEqual(featuresForPath("/app/deals/bogo/new"), ["discounts"]);
  assert.deepEqual(featuresForPath("/app/deals/upgrade"), ["upsell"]);
  assert.deepEqual(featuresForPath("/app/deals/fixed"), ["bundles"]);
  assert.equal(offerGroupOf("addons")?.key, "upsell");
  assert.equal(offerGroupOf("post_purchase")?.key, "upsell");
  assert.equal(areaForPath("/app/checkout/after-purchase"), "offers");
  // The after-purchase offer is still listed on the Checkout hub.
  assert.ok(featuresIn("checkout").includes("post_purchase"));
  // Every bundle editor belongs to Bundles (one list, tabs Bundles · Design).
  assert.deepEqual(featuresForPath("/app/kits/new"), ["bundles"]);
  assert.deepEqual(featuresForPath("/app/bundles/create"), ["bundles"]);
  assert.equal(areaForPath("/app/kits/123"), "offers");
  // One tab per recipe (first is the plain /app/bundles), then Design; every recipe has a tab.
  assert.deepEqual(FEATURES.bundles.tabs.map((t) => t.label), ["Frequently bought together", "Fixed bundle", "Mix and match", "Build your own bundle", "Tiered bundle", "Fixed price bundle", "Style"]);
  assert.deepEqual(featuresForPath("/app/bundles"), ["bundles"]);
  assert.deepEqual(BUNDLE_RECIPES.map((r) => r.key), ["fbt", "kit", "mixmatch", "browse", "growing", "anyN"]);
  assert.equal(recipeOfBundle({ pricing: "tiers", storeWide: false }), "anyN");
  assert.equal(recipeOfBundle({ pricing: "percent_tiers", storeWide: false }), "growing");
  assert.equal(recipeOfBundle({ pricing: "percent", storeWide: true }), "browse");
  assert.equal(recipeOfBundle({ pricing: "fixed", storeWide: false }), "mixmatch");
  // The 6 recipes open real editors.
  assert.equal(BUNDLE_RECIPES.length, 6);
  for (const r of BUNDLE_RECIPES) assert.match(r.href, /^\/app\/(bundles\/new\?recipe=|kits\/new$|deals\/fixed\/new$)/, r.key);
  // Style pages: the group page is open, but the Add-ons and Personalization styles need their own plan.
  assert.equal(pageLock("free", "/app/styles/upsell"), null);
  assert.equal(pageLock("free", "/app/styles/upsell/addons")?.kind, "feature");
  assert.deepEqual(featuresForPath("/app/styles/upsell/addons"), ["addons"]);
  assert.deepEqual(featuresForPath("/app/offers/personalization"), ["personalize"]);
  assert.equal(pageLock("free", "/app/styles/bundles/fbt"), null);
  // Add-ons stay a Starter feature inside the Upsell group.
  assert.deepEqual(pageLock("free", "/app/offers/add-ons"), { kind: "feature", feature: "addons", needs: "starter" });
});

test("designs 2–5 need a plan with more designs per section", () => {
  assert.equal(pageLock("free", "/app/designs/faq", "?design=1"), null);
  assert.deepEqual(pageLock("free", "/app/designs/faq", "?design=2"), { kind: "design", slot: 2, allowed: 1, needs: "starter" });
  assert.equal(pageLock("starter", "/app/designs/faq", "?design=5"), null);
});

test("soft order limit: all of the store's orders in the month", () => {
  assert.deepEqual(PLAN_KEYS.map((k) => limitOf(k, "monthlyOrders")), [50, 500, 1000, null]);
  assert.ok(ordersOver("free", 51));
  assert.ok(!ordersOver("free", 50));
  assert.ok(!ordersOver("starter", null));
  assert.ok(!ordersOver("pro", 1_000_000));
  assert.equal(limitText("monthlyOrders", 500), "500 orders a month");
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

test("Free tries 1 Starter feature: its pages open, others stay locked", () => {
  assert.equal(canTry("free", "addons"), true);
  assert.equal(canTry("free", "upsell"), false); // already free
  assert.equal(canTry("starter", "addons"), false); // already included
  assert.equal(canTry("starter", "payment_rules"), false); // Starter has no trial slot
  assert.equal(pageLock("free", "/app/offers/add-ons")?.kind, "feature");
  assert.equal(pageLock("free", "/app/designs/add-ons", "", "addons"), null);
  assert.equal(pageLock("free", "/app/offers/personalization", "", "addons")?.kind, "feature");
});

test("countdown places and thank-you modules: Free 1 and 2, then unlimited", () => {
  assert.equal(limitError("free", "countdownPlaces", 0), null);
  assert.match(limitError("free", "countdownPlaces", 1) ?? "", /Starter/);
  assert.equal(limitError("free", "thankYouModules", 1), null);
  assert.match(limitError("free", "thankYouModules", 2) ?? "", /Starter/);
  assert.equal(limitError("starter", "countdownPlaces", 9), null);
});

test("plan cards: an orders line, then at least 3 short feature lines", () => {
  for (const k of PLAN_KEYS) {
    assert.ok(PLANS[k].highlights.length >= 3, k);
    assert.ok(PLANS[k].highlights.every((h) => h.length <= 40), k);
    assert.match(ordersLine(k).rest, /orders monthly/, k);
  }
  assert.equal(ordersLine("pro").amount, "Unlimited");
  assert.equal(ordersLine("starter").amount, "500");
});
