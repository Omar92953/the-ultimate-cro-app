/**
 * Sales per offer (Offers overview and lists): which offer a cart line counts for.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { offerKeys } from "../../app/lib/results.server";
import { offerStats } from "../../app/lib/offer-stats";

const line = (attrs: Record<string, string>, extra: Record<string, unknown> = {}) => ({
  customAttributes: Object.entries(attrs).map(([key, value]) => ({ key, value })),
  discountedTotalSet: { shopMoney: { amount: "10" } },
  lineItemGroup: null,
  ...extra,
});

test("a line counts for the offer that added it, a gift deal, a bundle, or an app deal's discount", () => {
  assert.deepEqual(offerKeys(line({ _source: "upsell", _offer: "buy-more" })), ["o:buy-more"]);
  assert.deepEqual(offerKeys(line({ _cro_gift: "free-mug" })), ["o:free-mug"]);
  assert.deepEqual(offerKeys(line({}, { lineItemGroup: { id: "g1", title: "Box", productId: "gid://shopify/Product/9", quantity: 1 } })), ["b:gid://shopify/Product/9"]);
  const deal = line({}, { discountAllocations: [{ discountApplication: { title: "Buy 2 get 1" } }, { discountApplication: { title: "Store's own sale" } }] });
  assert.deepEqual(offerKeys(deal, new Set(["Buy 2 get 1"])), ["t:Buy 2 get 1"]);
  // Offer items from before `_offer` existed still count toward offers in general, but not toward one offer.
  assert.deepEqual(offerKeys(line({ _source: "cross_sell" })), ["s:cross_sell"]);
  // Sections and tools are not offers.
  assert.deepEqual(offerKeys(line({ _source: "quick_add" })), []);
});

test("an offer's stats add up its keys", () => {
  const by = [{ key: "o:fbt", orders: 3, revenue: 90 }, { key: "t:FBT", orders: 2, revenue: 40.5 }];
  assert.deepEqual(offerStats(by, ["o:fbt", "t:FBT"]), { revenue: 130.5, orders: 3 });
  assert.equal(offerStats(by, ["o:none"]), undefined);
  assert.equal(offerStats(null, ["o:fbt"]), undefined);
});
