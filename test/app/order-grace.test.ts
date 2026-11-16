/**
 * The monthly order limit, enforced after a grace (app/lib/plans.ts orderGrace, audit A7). Run: npm run test:app
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ORDER_GRACE_DAYS, orderBlockText, orderGrace } from "../../app/lib/plans";

const DAY = 86_400_000;
const t0 = new Date("2026-11-03T10:00:00Z");
const later = (days: number) => new Date(t0.getTime() + days * DAY);

test("first time over: the grace starts and nothing is blocked", () => {
  const g = orderGrace("starter", 600, null, null, t0);
  assert.equal(g.over, true);
  assert.equal(g.blocked, false);
  assert.deepEqual(g.stored, { since: t0.toISOString(), plan: "starter" });
  assert.equal(g.changed, true);
  assert.equal(g.endsAt, later(ORDER_GRACE_DAYS).toISOString());
});

test("still over: same grace, blocked once it has run out", () => {
  const prev = { since: t0.toISOString(), plan: "starter" as const };
  const mid = orderGrace("starter", 900, null, prev, later(10));
  assert.equal(mid.blocked, false);
  assert.equal(mid.changed, false);
  const after = orderGrace("starter", 900, null, prev, later(ORDER_GRACE_DAYS));
  assert.equal(after.blocked, true);
  assert.equal(after.changed, false);
});

test("a new month under the limit keeps the grace while last month was over", () => {
  const prev = { since: t0.toISOString(), plan: "starter" as const };
  // Dec 2: 40 orders so far, November had 5,000. Not blocked (not over now), grace kept.
  const g = orderGrace("starter", 40, 5000, prev, later(29));
  assert.equal(g.over, false);
  assert.equal(g.blocked, false);
  assert.deepEqual(g.stored, prev);
  assert.equal(g.changed, false);
  // Over again on Dec 5, past the 30 days: blocked straight away, no fresh grace.
  assert.equal(orderGrace("starter", 600, null, g.stored, later(32)).blocked, true);
});

test("the grace ends when last month and this month are both within the plan", () => {
  const prev = { since: t0.toISOString(), plan: "starter" as const };
  const g = orderGrace("starter", 120, 480, prev, later(40));
  assert.equal(g.stored, null);
  assert.equal(g.changed, true);
  // Last month unknown: kept.
  assert.deepEqual(orderGrace("starter", 120, null, prev, later(40)).stored, prev);
});

test("an upgrade starts a new grace, a downgrade keeps the old one", () => {
  const prev = { since: t0.toISOString(), plan: "starter" as const };
  const up = orderGrace("growth", 1500, null, prev, later(35));
  assert.equal(up.blocked, false);
  assert.deepEqual(up.stored, { since: later(35).toISOString(), plan: "growth" });
  const down = orderGrace("free", 1500, null, prev, later(35));
  assert.equal(down.blocked, true);
  assert.deepEqual(down.stored, { since: t0.toISOString(), plan: "free" });
  assert.equal(down.changed, true);
});

test("an upgrade that covers the orders clears it; Pro has no order limit", () => {
  const prev = { since: t0.toISOString(), plan: "starter" as const };
  const g = orderGrace("growth", 700, null, prev, later(35));
  assert.equal(g.over, false);
  assert.equal(g.stored, null);
  assert.equal(g.changed, true);
  const pro = orderGrace("pro", 50_000, null, prev, later(35));
  assert.equal(pro.blocked, false);
  assert.equal(pro.stored, null);
});

test("an order count that couldn't be read never blocks", () => {
  const prev = { since: t0.toISOString(), plan: "starter" as const };
  const g = orderGrace("starter", null, null, prev, later(60));
  assert.equal(g.blocked, false);
  assert.equal(g.changed, false);
});

test("the blocked message names the plan to move to and has no dashes", () => {
  const msg = orderBlockText("starter", 800);
  assert.equal(msg, "Your store has 800 orders this month and the Starter plan includes 500 orders a month. Upgrade to Growth to switch on new offers. Offers already on keep running.");
  assert.match(orderBlockText("growth", 3000), /Upgrade to Pro/);
  assert.doesNotMatch(msg, /[—–]/);
});
