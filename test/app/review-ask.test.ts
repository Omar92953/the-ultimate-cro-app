/**
 * The App Store review request on Home (review-ask.ts): asked only after the app added orders, at most once in 60
 * days, never after the merchant reviewed. Run: npm run test:app
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { REVIEW_GAP_DAYS, REVIEW_MIN_ORDERS, afterReview, reviewDue } from "../../app/lib/review-ask";

const now = new Date("2026-10-26T12:00:00Z");
const fresh = { reviewAt: null, reviewDone: false };

test("asks only once the app added enough orders", () => {
  assert.equal(reviewDue(fresh, null, now), false);
  assert.equal(reviewDue(fresh, 0, now), false);
  assert.equal(reviewDue(fresh, REVIEW_MIN_ORDERS - 1, now), false);
  assert.equal(reviewDue(fresh, REVIEW_MIN_ORDERS, now), true);
});

test("waits the gap after asking, and stops after a review", () => {
  const day = 86400000;
  assert.equal(reviewDue({ reviewAt: new Date(now.getTime() - (REVIEW_GAP_DAYS - 1) * day).toISOString(), reviewDone: false }, 10, now), false);
  assert.equal(reviewDue({ reviewAt: new Date(now.getTime() - REVIEW_GAP_DAYS * day).toISOString(), reviewDone: false }, 10, now), true);
  assert.equal(reviewDue({ reviewAt: null, reviewDone: true }, 10, now), false);
});

test("Shopify's answers", () => {
  assert.deepEqual(afterReview("success", now), { reviewAt: now.toISOString() });
  assert.deepEqual(afterReview("cooldown-period", now), { reviewAt: now.toISOString() });
  assert.deepEqual(afterReview("annual-limit-reached", now), { reviewAt: now.toISOString() });
  assert.deepEqual(afterReview("already-reviewed", now), { reviewDone: true });
  assert.deepEqual(afterReview("merchant-ineligible", now), { reviewDone: true });
  for (const code of ["recently-installed", "mobile-app", "cancelled", "already-open", "open-in-progress", "", "anything"]) assert.equal(afterReview(code, now), null);
});
