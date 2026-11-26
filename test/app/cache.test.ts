/** What a save forgets (app/lib/short-cache.server.ts). Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import { forgetOrders, forgetShop, namesToForget, remember } from "../../app/lib/short-cache.server";

test("namesToForget: a save clears only what it can change", () => {
  assert.deepEqual(namesToForget("/app/designs/upsell", "draft"), []);
  assert.deepEqual(namesToForget("/app/offers/upsell/new"), ["hub", "home", "bundlepreview"]);
  assert.deepEqual(namesToForget("/app/bundles/x"), ["hub", "home", "bundlepreview"]);
  assert.deepEqual(namesToForget("/app/designs/cross-sell"), ["hub", "home"]);
  assert.deepEqual(namesToForget("/app/settings"), undefined);
  assert.deepEqual(namesToForget("/app/analytics"), undefined);
});

test("forgetShop with names keeps the rest, without names clears the shop only", async () => {
  const loads: Record<string, number> = {};
  const get = (shop: string, name: string) => remember(shop, name, 60000, async () => ((loads[`${shop}|${name}`] = (loads[`${shop}|${name}`] ?? 0) + 1), name));
  for (const n of ["plan", "status", "hub", "home", "style", "preview|a"]) await get("a.myshopify.com", n);
  await get("b.myshopify.com", "hub");
  forgetShop("a.myshopify.com", namesToForget("/app/designs/upsell")!);
  for (const n of ["plan", "status", "hub", "home", "style", "preview|a"]) await get("a.myshopify.com", n);
  assert.deepEqual(Object.fromEntries(["plan", "status", "hub", "home", "style", "preview|a"].map((n) => [n, loads[`a.myshopify.com|${n}`]])), { plan: 1, status: 1, hub: 2, home: 2, style: 1, "preview|a": 1 });
  forgetShop("a.myshopify.com");
  await get("a.myshopify.com", "plan");
  await get("b.myshopify.com", "hub");
  assert.equal(loads["a.myshopify.com|plan"], 2);
  assert.equal(loads["b.myshopify.com|hub"], 1);
});

test("forgetOrders: a new order clears the order reads only, for that shop", async () => {
  const loads: Record<string, number> = {};
  const get = (shop: string, name: string) => remember(shop, name, 600000, async () => ((loads[`${shop}|${name}`] = (loads[`${shop}|${name}`] ?? 0) + 1), name), 3600000);
  const names = ["home-results", "loyalty-analytics-orders", "plan", "hub"];
  for (const n of names) await get("c.myshopify.com", n);
  await get("d.myshopify.com", "home-results");
  forgetOrders("c.myshopify.com");
  for (const n of names) await get("c.myshopify.com", n);
  await get("d.myshopify.com", "home-results");
  assert.deepEqual(Object.fromEntries(names.map((n) => [n, loads[`c.myshopify.com|${n}`]])), { "home-results": 2, "loyalty-analytics-orders": 2, plan: 1, hub: 1 });
  assert.equal(loads["d.myshopify.com|home-results"], 1);
});
