/** What a save forgets (app/lib/short-cache.server.ts). Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import { forgetOrders, forgetShop, namesToForget, remember, rememberLive } from "../../app/lib/short-cache.server";

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

test("rememberLive: a new order shows at once on a quick store; a slow read shows the last numbers meanwhile", async () => {
  const shop = "e.myshopify.com";
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let orders = 1;
  let delay = 0;
  let loads = 0;
  const load = async () => {
    loads += 1;
    const n = orders;
    await sleep(delay);
    return n;
  };
  const get = () => rememberLive(shop, "home-results", 60000, load, 50);
  // First visit waits for the read; a second one uses it.
  assert.deepEqual(await get(), { value: 1, stale: false });
  assert.deepEqual(await get(), { value: 1, stale: false });
  assert.equal(loads, 1);
  // Quick store: a new order is read again and shown on the same visit.
  orders = 2;
  forgetOrders(shop);
  assert.deepEqual(await get(), { value: 2, stale: false });
  // Big store: the read takes longer than the wait, so the last numbers show while it goes on.
  orders = 3;
  delay = 150;
  forgetOrders(shop);
  assert.deepEqual(await get(), { value: 2, stale: true });
  assert.deepEqual(await get(), { value: 2, stale: true });
  assert.equal(loads, 3, "one background read, not one per visit");
  await sleep(160);
  assert.deepEqual(await get(), { value: 3, stale: false });
  // An order that arrives while a read is running: that read may have missed it, so it stays old.
  orders = 4;
  forgetOrders(shop);
  assert.deepEqual(await get(), { value: 3, stale: true });
  orders = 5;
  forgetOrders(shop);
  await sleep(160);
  const after = await get();
  assert.equal(after.stale, true, "read again after the second order");
  await sleep(160);
  assert.deepEqual(await get(), { value: 5, stale: false });
  // Other saves mark the orders old too (Refresh), never dropping the last numbers.
  forgetShop(shop);
  delay = 150;
  assert.deepEqual(await get(), { value: 5, stale: true });
  await sleep(160);
});
