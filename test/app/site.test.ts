/**
 * Website and live demo addresses (app/lib/site.ts): every catalog feature and bundle recipe has a
 * demo, and demoUrl() builds the addresses the demo build writes (demos/build.mjs checks the same).
 * Run: npm run test:app
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FEATURE_KEYS } from "../../app/lib/catalog";
import { BUNDLE_RECIPES } from "../../app/lib/bundle-recipes";
import { DEMOS, DEMO_RECIPES, DEMO_TEMPLATES, DEMO_URL, demoDesign, demoUrl, hasDemo } from "../../app/lib/site";

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

test("demoDesign: template N of a design page is demo design N, within what the demo shows", () => {
  assert.equal(demoDesign("upsell", 0), 1);
  assert.equal(demoDesign("countdown", 5), 6);
  assert.equal(demoDesign("countdown", 6), undefined);
  assert.equal(demoDesign("upsell", -1), undefined);
  assert.equal(demoDesign("contact", 0), undefined);
  for (const k of Object.keys(DEMO_TEMPLATES)) assert.ok(DEMOS.includes(k as (typeof DEMOS)[number]), k);
});
