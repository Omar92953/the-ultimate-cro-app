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

import { toStorefrontCartExtras, withCartExtrasDefaults } from "../../app/lib/cart-extras-design";

test("the discount code box is off until chosen, and its texts reach the store copy", () => {
  assert.equal(withCartExtrasDefaults({}).code.on, false);
  assert.equal(toStorefrontCartExtras(withCartExtrasDefaults({})).c, null);
  const c = toStorefrontCartExtras(withCartExtrasDefaults({ code: { on: true, button: "Use code" }, look: { codeLayout: "stacked" } }));
  assert.equal(c.c?.button, "Use code");
  assert.match(c.cls, /ucs-ce--stack/);
  assert.match(c.c?.applied ?? "", /\{code\}/);
});

test("the discount code box says what each code took off and why a code can't be used", () => {
  const c = toStorefrontCartExtras(withCartExtrasDefaults({ code: { on: true, saved: "Saved {amount}" } })).c!;
  assert.equal(c.saved, "Saved {amount}");
  assert.match(c.later, /checkout/);
  assert.match(c.combine, /\{code\}.*\{other\}/);
  assert.match(c.already, /\{code\}/);
  for (const t of [c.saved, c.later, c.empty, c.already, c.combine, c.error]) assert.doesNotMatch(t, /\s[-–—]\s|--/, "no dashes in shopper text");
  // Stores that saved the box before these texts existed get the defaults.
  assert.equal(withCartExtrasDefaults({ code: { on: true, applied: "{code} ok" } }).code.error, "The code couldn't be checked. Please try again.");
});

test("the floating button defaults to the right and to an automatic height; the no variant texts are kept", async () => {
  const { withWishlistDefaults } = await import("../../app/lib/wishlist-design");
  const d = withWishlistDefaults({});
  assert.equal(d.where.floatPos, "br");
  assert.equal(d.where.floatBottom, 0);
  assert.equal(d.page.from, "From {amount}");
  assert.equal(withWishlistDefaults({ page: { from: "Starting at {amount}", choose: "Pick a size" } }).page.choose, "Pick a size");
});
