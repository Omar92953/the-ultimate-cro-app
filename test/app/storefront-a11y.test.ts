/**
 * Storefront markup built by the scripts (audit 2026-10-23, round 2: 1.9, 6.4, 6.5). The scripts build HTML in the
 * shopper's browser, so these read the source of what they build. Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

const asset = (f: string) => fs.readFileSync(`extensions/cro-storefront/assets/${f}`, "utf8");

test("1.9: the cart drawer never builds an image address into HTML", () => {
  const src = asset("ucro-drawer.js");
  assert.doesNotMatch(src, /src="'\s*\+\s*o\.img/);
  assert.match(src, /img\.src = o\.img/);
});

test("6.4: each rating star is read as 'n out of 5', the star itself is hidden from screen readers", () => {
  const src = asset("ucs-reviews.js");
  assert.match(src, /<span aria-hidden="true">★<\/span><span class="ucs-rv__sr">' \+ n \+ ' out of 5<\/span><\/label>/);
});

test("6.5: the size guide's unit choices have their own names", () => {
  const src = asset("ucs-size-guide.js");
  assert.match(src, /<select name="hu" aria-label="/);
  assert.match(src, /<select name="wu" aria-label="/);
});
