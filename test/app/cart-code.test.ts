/** Discount code box: its own card in the Cart group (Omar, 2026-10-22), on the cart extras design and block. Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import { FEATURES, featuresForPath, featuresIn } from "../../app/lib/catalog";
import { FEATURE_PLAN } from "../../app/lib/plans";
import { DEMOS, DEMO_TEMPLATES } from "../../app/lib/site";

test("the Discount code box has its own card and page, with the plan of the block it shares", () => {
  const f = FEATURES.cart_code;
  assert.equal(f.group, "cart");
  assert.ok(featuresIn("cart").includes("cart_code"));
  assert.equal(f.tabs[0].href, "/app/designs/cart-code");
  // Saves on its page are checked against its own feature, which needs the same plan as Gift note & delivery date.
  assert.deepEqual(featuresForPath("/app/designs/cart-code"), ["cart_code"]);
  assert.deepEqual(featuresForPath("/app/designs/cart-extras"), ["cart_extras"]);
  assert.equal(FEATURE_PLAN.cart_code, FEATURE_PLAN.cart_extras);
  assert.ok(DEMOS.includes("cart_code"));
  assert.equal(DEMO_TEMPLATES.cart_code, DEMO_TEMPLATES.cart_extras);
});
