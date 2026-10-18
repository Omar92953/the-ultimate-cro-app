/** "Check against orders" ticks Verified buyer and unticks only its own tick. Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import { applyOrderCheck } from "../../app/lib/verified-check";

test("a found order ticks it and remembers the check did", () => {
  assert.deepEqual(applyOrderCheck({ verified: false, byCheck: false }, true), { verified: true, byCheck: true, unticked: false });
});

test("a later check with no order unticks what an earlier check ticked", () => {
  const first = applyOrderCheck({ verified: false, byCheck: false }, true);
  assert.deepEqual(applyOrderCheck(first, false), { verified: false, byCheck: false, unticked: true });
});

test("a tick the merchant made by hand or saved before is never removed", () => {
  const hand = { verified: true, byCheck: false };
  assert.deepEqual(applyOrderCheck(hand, false), { ...hand, unticked: false });
  const afterFound = applyOrderCheck(hand, true);
  assert.equal(afterFound.byCheck, false);
  assert.deepEqual(applyOrderCheck(afterFound, false), { ...hand, unticked: false });
});

test("nothing found with nothing ticked changes nothing", () => {
  assert.deepEqual(applyOrderCheck({ verified: false, byCheck: false }, false), { verified: false, byCheck: false, unticked: false });
});
