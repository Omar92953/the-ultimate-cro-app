/**
 * Mix & match bundles (app/lib/types.ts, app/lib/validate.ts): pricing kinds and tier checks.
 * Run: npm run test:app
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { bundlePricing, growingPricing, type Bundle } from "../../app/lib/types";
import { validateBundle } from "../../app/lib/validate";

const base = (patch: Partial<Bundle> = {}): Bundle => ({
  name: "Build your box",
  active: true,
  product: { id: "gid://shopify/Product/1", title: "Box", image: null },
  steps: [{ label: "Choose your items", required: true, min: 1, max: 6, products: [], collection: { id: "gid://shopify/Collection/9", title: "All", image: null } }],
  allowDuplicates: false,
  hideSoldOut: true,
  pricing: "percent_tiers",
  percentOff: 0,
  tiers: [{ qty: 2, price: 10 }, { qty: 3, price: 15 }],
  extras: [],
  storeWide: true,
  ...patch,
});

test("pricing kinds: unknown values fall back to one fixed price", () => {
  assert.equal(bundlePricing("percent_tiers"), "percent_tiers");
  assert.equal(bundlePricing("amount_tiers"), "amount_tiers");
  assert.equal(bundlePricing("nonsense"), "fixed");
  assert.equal(bundlePricing(undefined), "fixed");
  assert.ok(growingPricing("percent_tiers") && growingPricing("amount_tiers"));
  assert.ok(!growingPricing("tiers") && !growingPricing("percent"));
});

test("growing % tiers: valid, and checked for range, order and duplicates", () => {
  assert.deepEqual(validateBundle(base(), []), []);
  assert.match(validateBundle(base({ tiers: [] }), []).join(" "), /at least one discount tier/);
  assert.match(validateBundle(base({ tiers: [{ qty: 2, price: 95 }] }), []).join(" "), /between 1% and 90%/);
  assert.match(validateBundle(base({ tiers: [{ qty: 2, price: 10 }, { qty: 2, price: 15 }] }), []).join(" "), /same number of items/);
  assert.match(validateBundle(base({ tiers: [{ qty: 2, price: 15 }, { qty: 3, price: 10 }] }), []).join(" "), /at least the same discount/);
  assert.match(validateBundle(base({ tiers: [{ qty: 9, price: 15 }] }), []).join(" "), /more items than the steps allow/);
});

test("growing amount tiers: amounts above 0", () => {
  assert.deepEqual(validateBundle(base({ pricing: "amount_tiers", tiers: [{ qty: 2, price: 5 }, { qty: 3, price: 10 }] }), []), []);
  assert.match(validateBundle(base({ pricing: "amount_tiers", tiers: [{ qty: 2, price: 0 }] }), []).join(" "), /amount above 0/);
});

test("growing % tiers round the final price like checkout", async () => {
  const { bundlePrice } = await import("../../app/lib/bundle-price");
  const pricing = { kind: "percent_tiers" as const, percent: 0, tiers: [{ qty: 2, price: 10 }, { qty: 3, price: 15 }] };
  // $600.00 + $629.95 at 10% = $1,106.955 → checkout charges $1,106.96.
  assert.equal(bundlePrice(pricing, 0, [60000, 62995]).price, 110696);
  assert.equal(bundlePrice(pricing, 0, [60000, 62995, 74995]).price, 168292);
});
