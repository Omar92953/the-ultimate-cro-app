/** Return rules and the words for returns (app/lib/return-rules.ts). Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import { creditFor, matchesAutoRule, withSaving, DEFAULT_RETURN_RULES, excludedTags, reasonCode, returnState, withReturnRulesDefaults } from "../../app/lib/return-rules";
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


test("return saving rules are cleaned", () => {
  const s = withSaving({ credit: { on: true, bonus: 250, expiryDays: -4 }, restock: "yes", rules: [{ reasons: ["Wrong size", 5, ""], tags: " Basics ,Tees", maxValue: "99.999", maxDays: 9999 }, ...Array.from({ length: 20 }, () => ({}))] });
  assert.deepEqual(s.credit, { on: true, bonus: 100, expiryDays: 0 });
  assert.deepEqual(withSaving({ exchange: { on: true, extra: "yes" } }).exchange, { on: true, extra: false });
  assert.equal(s.restock, false);
  assert.equal(s.rules.length, 10);
  assert.deepEqual(s.rules[0], { reasons: ["Wrong size"], tags: "basics ,tees", maxValue: 100, maxDays: 365 });
  assert.deepEqual(withSaving(undefined), { creditWhen: "received", exchange: { on: false, extra: false }, credit: { on: false, bonus: 0, expiryDays: 0 }, restock: false, rules: [] });
});

test("a return is approved when one rule holds on every condition it sets", () => {
  const ctx = { reason: "Wrong size", tags: ["basics"], orderValue: 80, daysSinceDelivery: 5 };
  const rule = { reasons: [], tags: "", maxValue: 0, maxDays: 0 };
  assert.equal(matchesAutoRule([], ctx), false);
  assert.equal(matchesAutoRule([rule], ctx), true, "a rule with no conditions matches everything");
  assert.equal(matchesAutoRule([{ ...rule, reasons: ["wrong size"] }], ctx), true, "reasons ignore case");
  assert.equal(matchesAutoRule([{ ...rule, reasons: ["Changed my mind"] }], ctx), false);
  assert.equal(matchesAutoRule([{ ...rule, tags: "final-sale, basics" }], ctx), true);
  assert.equal(matchesAutoRule([{ ...rule, tags: "final-sale" }], ctx), false);
  assert.equal(matchesAutoRule([{ ...rule, maxValue: 100 }], ctx), true);
  assert.equal(matchesAutoRule([{ ...rule, maxValue: 50 }], ctx), false);
  assert.equal(matchesAutoRule([{ ...rule, maxDays: 7 }], ctx), true);
  assert.equal(matchesAutoRule([{ ...rule, maxDays: 3 }], ctx), false);
  assert.equal(matchesAutoRule([{ ...rule, maxDays: 7 }], { ...ctx, daysSinceDelivery: null }), false, "unknown delivery date never matches a days rule");
  assert.equal(matchesAutoRule([{ ...rule, maxValue: 10 }, { ...rule, reasons: ["Wrong size"], maxDays: 30 }], ctx), true, "any rule can approve");
});

test("credit is the refund value plus the bonus, to the cent", () => {
  assert.equal(creditFor(50, 10), 55);
  assert.equal(creditFor(33.33, 15), 38.33);
  assert.equal(creditFor(20, 0), 20);
});
