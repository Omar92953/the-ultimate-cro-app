/** The shared rules (app/lib/rules.ts): the same answers for the admin pages and the MCP tools. Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import { FUNCTION_METAFIELD_LIMIT, isRuleError, RuleError, requireFeature, requireFunctionSize, requirePage, requireSizeGuide, requireStyleSlot } from "../../app/lib/rules";
import { pageLock } from "../../app/lib/plan-gate";

const fails = (fn: () => void, kind: RuleError["kind"], match: RegExp) => {
  try {
    fn();
  } catch (e) {
    assert.ok(isRuleError(e), "a RuleError");
    assert.equal((e as RuleError).kind, kind);
    assert.match((e as RuleError).message, match);
    return;
  }
  assert.fail("expected a RuleError");
};

test("features need their plan, with the words the admin uses", () => {
  fails(() => requireFeature("free", "size_guide"), "plan", /Starter plan/);
  fails(() => requireFeature("starter", "returns"), "plan", /Growth plan/);
  requireFeature("starter", "size_guide");
  requireFeature("growth", "returns");
  // The free trial feature is open.
  requireFeature("free", "size_guide", "size_guide");
});

test("a page is refused exactly when pageLock says so", () => {
  for (const [plan, path, search] of [["free", "/app/designs/size-guide", ""], ["starter", "/app/designs/size-guide", ""], ["free", "/app/designs/faq", "?design=2"], ["starter", "/app/designs/faq", "?design=5"], ["free", "/app/offers", ""]] as const) {
    const lock = pageLock(plan, path, search);
    if (lock) fails(() => requirePage(plan, path, search), "plan", /plan\./);
    else requirePage(plan, path, search);
  }
});

test("styles beyond the plan's count are refused", () => {
  requireStyleSlot("free", 1);
  fails(() => requireStyleSlot("free", 2), "plan", /plan\./);
  requireStyleSlot("starter", 5);
});

test("Function metafields stay under Shopify's limit", () => {
  requireFunctionSize("x".repeat(FUNCTION_METAFIELD_LIMIT), "Your rules");
  fails(() => requireFunctionSize("x".repeat(FUNCTION_METAFIELD_LIMIT + 1), "Your rules"), "input", /too large/);
  // Shopify counts bytes: 5,000 Arabic letters are 10,000 bytes (audit 2026-10-23).
  fails(() => requireFunctionSize("ع".repeat(5000), "Your rules"), "input", /10000 of 9500 bytes/);
});

test("the size guide's limits are said, not silently cut", () => {
  requireSizeGuide({});
  requireSizeGuide({ charts: [{ columns: ["a"], rows: [{}] }] });
  fails(() => requireSizeGuide({ charts: Array.from({ length: 9 }, () => ({})) }), "input", /up to 8 charts/);
  fails(() => requireSizeGuide({ charts: [{ name: "Tees", columns: Array.from({ length: 9 }, () => "x") }] }), "input", /“Tees” can have up to 8 columns/);
  fails(() => requireSizeGuide({ charts: [{ rows: Array.from({ length: 21 }, () => ({})) }] }), "input", /20 sizes/);
  fails(() => requireSizeGuide({ charts: "nope" }), "input", /list of charts/);
});

test("plan and limit errors offer an upgrade, input errors do not", () => {
  assert.equal(new RuleError("x", "plan").upgrade, true);
  assert.equal(new RuleError("x", "limit").upgrade, true);
  assert.equal(new RuleError("x", "input").upgrade, false);
});
