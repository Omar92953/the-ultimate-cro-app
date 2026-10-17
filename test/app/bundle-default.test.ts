/**
 * The bundle builder's default look has one source: DEFAULT_BUNDLE_DESIGN (app/lib/bundle-design.ts).
 * The storefront block shows it when no design is saved (the defaults written in the Liquid), and the
 * app preview shows it too, so they must be the same. Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { DEFAULT_BUNDLE_DESIGN, toStorefrontBundle } from "../../app/lib/bundle-design";

const liquid = fs.readFileSync(new URL("../../theme/blocks/ucro-bundle-builder.liquid", import.meta.url), "utf8");
const def = toStorefrontBundle(DEFAULT_BUNDLE_DESIGN);

test("the block's fallback classes and variables equal the app's default design", () => {
  assert.ok(liquid.includes(`{{ d.cls | default: '${def.cls}' }}`), "d.cls default in ucro-bundle-builder.liquid is out of date");
  assert.ok(liquid.includes(`{{ d.css | default: '${def.css}' }}`), "d.css default in ucro-bundle-builder.liquid is out of date");
});

test("the block's fallback words equal the app's default words", () => {
  const w = (key: string) => liquid.match(new RegExp(`${key} \\| default: '([^']*)'`))?.[1];
  assert.equal(w("d.btn"), def.btn);
  assert.equal(w("d.rem"), def.rem);
  assert.equal(w("d.val"), def.val);
  assert.equal(w("d.sv"), def.sv);
  assert.equal(w("d.pd"), def.pd);
  assert.equal(w("d.pk"), def.pk);
  assert.equal(w("d.hc"), def.hc);
});

test("the default look is the filled card with a picked tint and a filled button", () => {
  assert.equal(DEFAULT_BUNDLE_DESIGN.card.style, "filled");
  assert.equal(DEFAULT_BUNDLE_DESIGN.card.pickedTint, true);
  assert.equal(DEFAULT_BUNDLE_DESIGN.pickButton.style, "filled");
  assert.equal(DEFAULT_BUNDLE_DESIGN.button.theme, true);
});
