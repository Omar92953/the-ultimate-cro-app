/**
 * Website and live demo addresses (app/lib/site.ts): every catalog feature and bundle recipe has a
 * demo, and demoUrl() builds the addresses the demo build writes (demos/build.mjs checks the same).
 * Run: npm run test:app
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FEATURE_KEYS } from "../../app/lib/catalog";
import { BUNDLE_RECIPES } from "../../app/lib/bundle-recipes";
import { DEMOS, DEMO_RECIPES, DEMO_URL, demoUrl, hasDemo } from "../../app/lib/site";

test("DEMOS lists every catalog feature, once", () => {
  assert.deepEqual([...DEMOS].sort(), [...FEATURE_KEYS].sort());
  assert.equal(new Set(DEMOS).size, DEMOS.length);
});

test("DEMO_RECIPES lists every bundle recipe", () => {
  assert.deepEqual([...DEMO_RECIPES].sort(), BUNDLE_RECIPES.map((r) => r.key).sort());
});

test("demoUrl", () => {
  assert.equal(DEMO_URL, "https://demo.crotoolbox.com");
  assert.equal(demoUrl("upsell"), "https://demo.crotoolbox.com/upsell/");
  assert.equal(demoUrl("cross_sell", 2), "https://demo.crotoolbox.com/cross-sell/#design-2");
  assert.equal(demoUrl("bundles", undefined, "anyN"), "https://demo.crotoolbox.com/bundles/any-n/");
  assert.equal(demoUrl("bundles", 3, "mixmatch"), "https://demo.crotoolbox.com/bundles/mixmatch/#design-3");
  assert.equal(hasDemo("faq"), true);
});
