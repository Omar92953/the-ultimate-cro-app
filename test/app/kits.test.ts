/**
 * Bundle products ("kits", app/lib/kits.ts): prices and checks. Run: npm run test:app
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { blankKit, kitVariantPrice, validateKit } from "../../app/lib/kits";

test("% off follows the items' total, so a pricier option costs more", () => {
  const kit = { pricing: "percent" as const, pct: 10, price: 0, compareAt: true };
  assert.deepEqual(kitVariantPrice(kit, 100), { price: "90.00", compareAtPrice: "100.00" });
  assert.deepEqual(kitVariantPrice(kit, 120), { price: "108.00", compareAtPrice: "120.00" });
});

test("fixed price; compare-at only when it's higher and switched on", () => {
  assert.deepEqual(kitVariantPrice({ pricing: "fixed", pct: 0, price: 99, compareAt: true }, 120), { price: "99.00", compareAtPrice: "120.00" });
  assert.deepEqual(kitVariantPrice({ pricing: "fixed", pct: 0, price: 99, compareAt: true }, 80), { price: "99.00", compareAtPrice: null });
  assert.deepEqual(kitVariantPrice({ pricing: "fixed", pct: 0, price: 99, compareAt: false }, 120), { price: "99.00", compareAtPrice: null });
  assert.deepEqual(kitVariantPrice({ pricing: "percent", pct: 0, price: 0, compareAt: true }, 50), { price: "50.00", compareAtPrice: null });
});

test("checks: two items, or one item as a multipack; no duplicates; a price", () => {
  const item = (id: string, qty = 1) => ({ productId: id, title: id, image: null, qty });
  assert.ok(validateKit({ ...blankKit(), title: "Kit", items: [item("a")] }).length > 0);
  assert.deepEqual(validateKit({ ...blankKit(), title: "3-pack", items: [item("a", 3)] }), []);
  assert.deepEqual(validateKit({ ...blankKit(), title: "Kit", items: [item("a"), item("b")] }), []);
  assert.ok(validateKit({ ...blankKit(), title: "Kit", items: [item("a"), item("a")] }).some((e) => /twice/.test(e)));
  assert.ok(validateKit({ ...blankKit(), title: "Kit", pricing: "fixed", price: 0, items: [item("a"), item("b")] }).some((e) => /price/.test(e)));
});
