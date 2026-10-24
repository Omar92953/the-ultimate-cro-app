/**
 * The loyalty script works with the theme's product form (live check on Testing 3, 2026-10-24: themes like Dawn put a
 * hidden installments form first, so the points button went under the price and Add to cart stayed for a product sold
 * only with points). Checked in headless Chrome on test/storefront/out/sections/loyalty-shop-only-dawn.html; this keeps
 * the rule in the source. Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

test("the loyalty script finds the product form like the boosters script, never the first add to cart form", () => {
  const src = fs.readFileSync("extensions/cro-storefront/assets/ucs-loyalty.js", "utf8");
  assert.doesNotMatch(src, /document\.querySelector\('form\[action\*="\/cart\/add"\]'\)/, "no 'first form on the page'");
  assert.match(src, /var mainForm = function/);
  assert.match(src, /\/installment\/i\.test\(f\.id\)/);
  assert.match(src, /f\.querySelector\('\[type="submit"\], button\[name="add"\]'\)/);
  assert.match(fs.readFileSync("test/storefront/sections.mjs", "utf8"), /loyalty-shop-only-dawn\.html/);
});
