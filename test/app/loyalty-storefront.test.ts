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

test("a points purchase puts the code on the cart before the option (the guard refuses it without the code)", () => {
  const src = fs.readFileSync("extensions/cro-storefront/assets/ucs-loyalty.js", "utf8");
  const buy = src.slice(src.indexOf("var buy = function"), src.indexOf("var draw = function"));
  const update = buy.indexOf("cart/update.js"), add = buy.indexOf("cart/add.js");
  assert.ok(update > 0 && add > update, "cart/update.js with the code, then cart/add.js");
  assert.match(buy, /discount_codes/, "codes already on the cart are kept");
  assert.match(fs.readFileSync("test/storefront/sections.mjs", "utf8"), /after '\+\(document\.body\.dataset\.codes/);
});

test("product card points prices go next to a title the shopper sees (Dawn hides a first copy)", () => {
  const src = fs.readFileSync("extensions/cro-storefront/assets/ucs-loyalty.js", "utf8");
  const tags = src.slice(src.indexOf("var cardTags = function"), src.indexOf("var buy = function"));
  assert.match(tags, /getClientRects\(\)\.length/, "hidden title links are skipped");
  assert.match(fs.readFileSync("test/storefront/sections.mjs", "utf8"), /a hidden title link comes first in each card/);
});
