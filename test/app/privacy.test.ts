/**
 * Privacy promises made on the privacy pages and in Shopify's protected customer data form.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RETENTION_DAYS } from "../../app/lib/retention";

test("A/B snippet stores and counts only after the shopper allows analytics", () => {
  const s = readFileSync("theme/snippets/ucro-ab.liquid", "utf8");
  assert.match(s, /analyticsProcessingAllowed\(\)\)track\(\);else forget\(\)/);
  assert.match(s, /visitorConsentCollected/);
  // Before consent the only storage access is a read; writes and the view count live in track().
  const before = s.slice(0, s.indexOf("function track"));
  assert.doesNotMatch(before, /setItem|apps\/ucro\/ab|cart\/update/);
});

test("every retention period is set and the privacy pages show them", () => {
  for (const [k, v] of Object.entries(RETENTION_DAYS)) assert.ok(Number.isInteger(v) && v > 0 && v <= 730, k);
  assert.match(readFileSync("app/routes/privacy.tsx", "utf8"), /R\.returnRequest/);
  assert.match(readFileSync("site/src/pages/privacy.astro", "utf8"), /R\.returnRequest/);
});
