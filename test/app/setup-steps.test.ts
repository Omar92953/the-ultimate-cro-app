/** Home's theme steps (app/lib/setup-steps.ts). Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import { themeSteps } from "../../app/lib/setup-steps";

test("embed step: any app embed on; place step: any block that is not an embed", () => {
  assert.deepEqual(themeSteps(null), { embed: false, place: false });
  assert.deepEqual(themeSteps({ boosters: true, upsell: false }), { embed: true, place: false });
  assert.deepEqual(themeSteps({ boosters: false, upsell: true }), { embed: false, place: true });
  assert.deepEqual(themeSteps({ boosters: true, drawer: true, reviews: true }), { embed: true, place: true });
});
