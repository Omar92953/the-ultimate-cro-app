/** A/B tests for offers (lib/ab-tests.ts, lib/ab-tests.server.ts). Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import type { AdminClient } from "../../app/lib/admin.server";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ab-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

import { applyOverrides, changesDiscount, cleanOverrides, compareGroups, functionAb, normalCdf, toStorefrontAbTests, validateTest, type AbTest } from "../../app/lib/ab-tests";
import { buildDiscountConfig } from "../../app/lib/cro.server";
import type { Rule } from "../../app/lib/types";

const cross: Rule = { id: "gid://shopify/Metaobject/1", handle: "rule-cross", kind: "cross_sell", name: "Pairs", active: true, priority: 1, triggerType: "all", triggerProducts: [], triggerCollections: [], offeredProducts: [{ id: "gid://shopify/Product/2", title: "Socks" }], tiers: [], upsellType: "quantity", optionName: "", placements: ["product"], headline: "Pairs well with", subheadline: "", buttonLabel: "Add selected", discountPercent: 10, discountLabel: "" };
const upsell: Rule = { ...cross, id: "gid://shopify/Metaobject/2", handle: "rule-up", kind: "upsell", name: "Buy more", offeredProducts: [], tiers: [{ qty: 1, pct: 0 }, { qty: 2, pct: 10 }, { qty: 3, pct: 15, badge: "Popular" }], headline: "Buy more, save more", buttonLabel: "", discountPercent: 0 };

test("version B's changes are cleaned: known fields, right kind, sane numbers", () => {
  assert.deepEqual(cleanOverrides("cross_sell", { headline: "Hi", discountPercent: "25.555", tiers: [{ qty: 2, pct: 5 }], nonsense: 1 }), { headline: "Hi", discountPercent: 25.56 });
  assert.deepEqual(cleanOverrides("upsell", { discountPercent: 30, tiers: [{ qty: "2", pct: "20", badge: "Best" }] }), { tiers: [{ qty: 2, pct: 20, badge: "Best" }] });
  assert.equal(cleanOverrides("upsell", { design: 99 }).design, 5);
  assert.equal(cleanOverrides("upsell", { headline: "x".repeat(500) }).headline?.length, 120);
  assert.deepEqual(cleanOverrides("upsell", null), {});
});

test("a test is only valid with a real change that keeps the offer valid", () => {
  assert.match(validateTest(null, "upsell", {})[0], /Choose/);
  assert.match(validateTest(cross, "upsell", { headline: "x" })[0], /not a upsell|not an upsell|upsell/);
  assert.match(validateTest(cross, "cross_sell", {})[0], /Change at least one thing/);
  assert.deepEqual(validateTest(cross, "cross_sell", { discountPercent: 20 }), []);
  assert.match(validateTest(cross, "cross_sell", { discountPercent: 150 }).join(" "), /between 0 and 100/);
  assert.match(validateTest(upsell, "upsell", { tiers: [{ qty: 1, pct: 0 }, { qty: 4, pct: 20 }] }).join(" "), /same quantities/);
  assert.match(validateTest(upsell, "upsell", { tiers: [{ qty: 1, pct: 0 }, { qty: 2, pct: 95 }, { qty: 3, pct: 15 }] }).join(" "), /between 0 and 90/);
  assert.deepEqual(validateTest(upsell, "upsell", { tiers: [{ qty: 1, pct: 0 }, { qty: 2, pct: 20 }, { qty: 3, pct: 30 }] }), []);
  const variant: Rule = { ...upsell, upsellType: "variant", optionName: "Size", tiers: [{ qty: 1, pct: 0, value: "M" }, { qty: 1, pct: 10, value: "L" }] };
  assert.deepEqual(validateTest(variant, "upsell", { tiers: [{ qty: 1, pct: 0, value: "m" }, { qty: 1, pct: 20, value: "L" }] }), []);
  assert.equal(changesDiscount({ headline: "x" }), false);
  assert.equal(changesDiscount({ discountPercent: 5 }), true);
});

test("B laid over the offer; the storefront and the discount engine get B's full values", () => {
  const b = { headline: "You might like", discountPercent: 25 };
  assert.equal(applyOverrides(cross, b).headline, "You might like");
  assert.equal(applyOverrides(upsell, { discountPercent: 40 }).discountPercent, 0, "an upsell has no cross sell discount");
  const t: AbTest = { id: "ab_t1", name: "T", offer: "rule-cross", kind: "cross_sell", status: "running", startedAt: "2026-10-01T00:00:00Z", endedAt: null, winner: null, b };
  const store = toStorefrontAbTests([t, { ...t, id: "ab_old", offer: "rule-up", status: "stopped" }], [cross, upsell]);
  assert.deepEqual(Object.keys(store), ["rule-cross"]);
  assert.equal(store["rule-cross"].id, "ab_t1");
  assert.equal(store["rule-cross"].b.discount_percent, 25);
  assert.equal(store["rule-cross"].b.subheadline, "");
  assert.deepEqual(functionAb(t, cross), { id: "ab_t1", b: { pct: 25, label: "You might like" } });
  assert.equal(functionAb({ ...t, status: "stopped" }, cross), null);
  const ut: AbTest = { ...t, id: "ab_u", offer: "rule-up", kind: "upsell", b: { tiers: [{ qty: 1, pct: 0 }, { qty: 2, pct: 20 }, { qty: 3, pct: 30 }] } };
  assert.deepEqual((functionAb(ut, upsell)?.b as { tiers?: unknown } | undefined)?.tiers, [{ qty: 1, pct: 0 }, { qty: 2, pct: 20 }, { qty: 3, pct: 30 }]);
});

test("the discount configuration carries the test only for running tests of that offer", () => {
  const t: AbTest = { id: "ab_t1", name: "T", offer: "rule-cross", kind: "cross_sell", status: "running", startedAt: "", endedAt: null, winner: null, b: { discountPercent: 25 } };
  const { config } = buildDiscountConfig([cross, upsell], [], [], [t]);
  assert.equal((config.crossSell[0] as { ab?: { id: string } }).ab?.id, "ab_t1");
  assert.equal((config.upsell[0] as { ab?: unknown }).ab, undefined);
  const none = buildDiscountConfig([cross, upsell], [], [], [{ ...t, status: "stopped" }]).config;
  assert.equal((none.crossSell[0] as { ab?: unknown }).ab, undefined);
  assert.equal(JSON.stringify(buildDiscountConfig([cross, upsell]).config), JSON.stringify(none), "with no test the configuration is exactly what it was");
});

test("which version is ahead, and how sure we are", () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6);
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-3);
  const g = (views: number, orders: number, revenue = orders * 50) => ({ views, orders, revenue, adds: orders });
  assert.equal(compareGroups(g(50, 5), g(60, 6)).verdict, "wait");
  assert.equal(compareGroups(g(500, 2), g(500, 3)).verdict, "wait", "too few orders");
  const clear = compareGroups(g(1000, 80), g(1000, 130));
  assert.equal(clear.leader, "B");
  assert.equal(clear.verdict, "clear");
  assert.ok(clear.sure! > 99);
  const close = compareGroups(g(1000, 50), g(1000, 52));
  assert.equal(close.verdict, "close");
  assert.equal(compareGroups(g(500, 25), g(500, 25)).leader, null);
  assert.equal(compareGroups(g(300, 30), g(300, 20)).leader, "A");
  assert.equal(clear.rate.a, 0.08);
  assert.equal(clear.perView.b, 6.5);
});

/* ---------------------------------------------- with a database and orders -- */
type S = typeof import("../../app/lib/ab-tests.server");
let S: S;
before(async () => {
  const sql = fs.readFileSync("prisma/migrations/20261020000000_ab_views/migration.sql", "utf8");
  for (const stmt of sql.split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  S = await import("../../app/lib/ab-tests.server");
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

const order = (at: string, attr: string | null, total: string, source?: string, cancelled = false) => ({
  createdAt: at, cancelledAt: cancelled ? at : null, totalPriceSet: { shopMoney: { amount: total } },
  customAttributes: attr ? [{ key: "_cro_ab", value: attr }] : [], lineItems: { nodes: [{ customAttributes: source ? [{ key: "_source", value: source }] : [] }] },
});
const ordersAdmin = (orders: unknown[]) => ({ graphql: async () => ({ json: async () => ({ data: { orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: orders } } }) }) }) as unknown as AdminClient;

test("groups are read from the cart attribute", () => {
  assert.deepEqual(S.parseGroups("ab_1:A,ab_2:B"), { ab_1: "A", ab_2: "B" });
  assert.deepEqual(S.parseGroups("junk,ab_1:X"), {});
  assert.deepEqual(S.parseGroups(undefined), {});
});

test("results count views we saw and orders that carry the test, inside the test's dates", async () => {
  const t: AbTest = { id: "ab_res1", name: "T", offer: "rule-cross", kind: "cross_sell", status: "running", startedAt: new Date(Date.now() - 5 * 864e5).toISOString(), endedAt: null, winner: null, b: {} };
  for (let i = 0; i < 3; i++) await S.countView("s.myshopify.com", t.id, "A");
  await S.countView("s.myshopify.com", t.id, "B");
  await S.countView("other.myshopify.com", t.id, "B");
  const day = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
  const res = await S.testResults(ordersAdmin([
    order(day(1), "ab_res1:A", "40.00", "cross_sell"),
    order(day(2), "ab_res1:B", "60.00"),
    order(day(2), "ab_res1:B,ab_other:A", "10.00", "cross_sell"),
    order(day(3), null, "999.00"),
    order(day(4), "ab_other:B", "999.00"),
    order(day(9), "ab_res1:A", "999.00"),
    order(day(1), "ab_res1:B", "999.00", undefined, true),
  ]), "s.myshopify.com", [t]);
  const r = res[t.id];
  assert.deepEqual(r.a, { views: 3, orders: 1, revenue: 40, adds: 1 });
  assert.deepEqual(r.b, { views: 1, orders: 2, revenue: 70, adds: 1 });
  assert.equal(r.verdict, "wait");
  assert.deepEqual(await S.testResults(ordersAdmin([]), "s.myshopify.com", []), {});
});

test("uninstall removes the store's counted views", async () => {
  await S.removeShopAb("s.myshopify.com");
  assert.equal(await prisma.abView.count({ where: { shop: "s.myshopify.com" } }), 0);
  assert.equal(await prisma.abView.count({ where: { shop: "other.myshopify.com" } }), 1);
});
