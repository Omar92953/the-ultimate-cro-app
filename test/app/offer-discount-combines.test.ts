/** The app's own automatic offer discount must combine with order discount codes (Track page codes). Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";

Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

test("a discount made before combining was set gets updated", async () => {
  const { offerDiscountFix, OFFER_COMBINES } = await import("../../app/lib/cro.server");
  assert.deepEqual(OFFER_COMBINES, { orderDiscounts: true, productDiscounts: false, shippingDiscounts: true });
  const old = { title: "CRO Toolbox offers", combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: false } };
  assert.deepEqual(offerDiscountFix(old), { combinesWith: OFFER_COMBINES });
  assert.deepEqual(offerDiscountFix({ title: "Ultimate CRO offers", combinesWith: OFFER_COMBINES }), { title: "CRO Toolbox offers" });
  assert.deepEqual(offerDiscountFix({ title: "Old", combinesWith: null }), { title: "CRO Toolbox offers", combinesWith: OFFER_COMBINES });
});

test("a discount that is already right is left alone", async () => {
  const { offerDiscountFix, OFFER_COMBINES } = await import("../../app/lib/cro.server");
  assert.equal(offerDiscountFix({ title: "CRO Toolbox offers", combinesWith: { ...OFFER_COMBINES } }), null);
});
