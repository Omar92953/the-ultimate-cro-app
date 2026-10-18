/** Return rules and the words for returns (app/lib/return-rules.ts). Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_RETURN_RULES, excludedTags, reasonCode, returnState, withReturnRulesDefaults } from "../../app/lib/return-rules";
import { FEATURE_PLAN } from "../../app/lib/plans";
import { AREAS, FEATURES, featuresForPath } from "../../app/lib/catalog";

test("the shopper's words become Shopify's reason codes", () => {
  assert.equal(reasonCode("Wrong size, too big"), "SIZE_TOO_LARGE");
  assert.equal(reasonCode("It is too small"), "SIZE_TOO_SMALL");
  assert.equal(reasonCode("Arrived damaged"), "DEFECTIVE");
  assert.equal(reasonCode("Not as expected"), "NOT_AS_DESCRIBED");
  assert.equal(reasonCode("Changed my mind"), "UNWANTED");
  assert.equal(reasonCode("Received the wrong item"), "WRONG_ITEM");
  assert.equal(reasonCode("Other"), "OTHER");
  // The five reasons a store starts with.
  assert.deepEqual(["Wrong size", "Not as expected", "Arrived damaged", "Changed my mind", "Other"].map(reasonCode), ["SIZE_TOO_SMALL", "NOT_AS_DESCRIBED", "DEFECTIVE", "UNWANTED", "OTHER"]);
});

test("return rules are cleaned and keep sensible defaults", () => {
  assert.deepEqual(withReturnRulesDefaults(null), DEFAULT_RETURN_RULES);
  const r = withReturnRulesDefaults({ days: 9999, excludeTags: " Final-Sale, ,gift ", autoApprove: { on: true, reasons: ["Arrived damaged", 5, ""] }, shipping: "merchant", address: "1 Main St" });
  assert.equal(r.days, 365);
  assert.deepEqual(excludedTags(r), ["final-sale", "gift"]);
  assert.deepEqual(r.autoApprove, { on: true, reasons: ["Arrived damaged"] });
  assert.equal(r.shipping, "merchant");
  assert.equal(withReturnRulesDefaults({ days: 0 }).days, 0);
});

test("old return rows map to the new states", () => {
  assert.equal(returnState("pending"), "requested");
  assert.equal(returnState("done"), "closed");
  assert.equal(returnState("refunded"), "refunded");
  assert.equal(returnState("whatever"), "requested");
});

test("Tracking & Returns is its own menu area, on the Growth plan", () => {
  assert.ok(AREAS.some((a) => a.key === "tracking" && a.href === "/app/tracking-returns"));
  assert.equal(FEATURES.track.area, "tracking");
  assert.equal(FEATURES.returns.area, "tracking");
  assert.equal(FEATURE_PLAN.track, "growth");
  assert.equal(FEATURE_PLAN.returns, "growth");
  assert.deepEqual(featuresForPath("/app/returns/rules"), ["returns"]);
  assert.deepEqual(featuresForPath("/app/tracking-returns"), ["returns"]);
});
