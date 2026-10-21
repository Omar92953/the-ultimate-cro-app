/** Track page output switches (lib/order-pages.ts): parsed safely, and only the parts switched off reach the store. Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TRACK_SHOW, toStorefrontOrderPage, withOrderPageDefaults } from "../../app/lib/order-pages";

test("every part shows by default, also for designs saved before the switches", () => {
  assert.deepEqual(withOrderPageDefaults({}, "track").show, DEFAULT_TRACK_SHOW);
  assert.deepEqual(withOrderPageDefaults({ show: { timeline: "no", link: 0 } }, "track").show, DEFAULT_TRACK_SHOW);
  assert.deepEqual(toStorefrontOrderPage(withOrderPageDefaults({}, "track")).sh, {});
});

test("only the parts switched off go to the store", () => {
  const c = withOrderPageDefaults({ show: { timeline: false, link: false, items: true } }, "track");
  assert.equal(c.show.timeline, false);
  assert.equal(c.show.items, true);
  assert.deepEqual(toStorefrontOrderPage(c).sh, { timeline: false, link: false });
});

test("the Returns page sends no Track page switches", () => {
  assert.deepEqual(toStorefrontOrderPage(withOrderPageDefaults({ show: { items: false } }, "returns")).sh, {});
});
