/** Wishlist settings (app/lib/wishlist-design.ts). Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import { toStorefrontWishlist, withWishlistDefaults } from "../../app/lib/wishlist-design";

test("the wishlist is on by default, and the on/off reaches the store copy", () => {
  assert.equal(withWishlistDefaults({}).on, true);
  assert.equal(withWishlistDefaults({ on: false }).on, false);
  assert.equal(toStorefrontWishlist(withWishlistDefaults({ on: false })).on, false);
});

test("shopper texts have defaults, no dashes, and are kept short", () => {
  const p = withWishlistDefaults({ page: { added: "x".repeat(200) } }).page;
  assert.equal(p.added.length, 40);
  for (const t of [p.failed, p.soldOut, p.empty, p.heading]) assert.doesNotMatch(t, /[—–]/);
  assert.equal(p.soldOut, "Sold out");
});
