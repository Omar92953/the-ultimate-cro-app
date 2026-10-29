/** Money and points (audit 2026-10-23, round 2: 3.4 to 3.8). Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "money-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

before(async () => {
  for (const m of fs.readdirSync("prisma/migrations").filter((x) => /^\d/.test(x)).sort()) {
    const sql = fs.readFileSync(`prisma/migrations/${m}/migration.sql`, "utf8");
    for (const stmt of sql.split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  }
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

const who = (id: string) => ({ id, email: `${id}@example.com`, firstName: "", locale: "", tags: [] as string[] });

test("3.4: an order's pending points released in the meantime are still taken back by its refund", async () => {
  const P = await import("../../app/lib/loyalty/program.server");
  const shop = "race.myshopify.com";
  const m = (await P.memberFor(shop, who("1"), true))!;
  await P.record(shop, m.id, { kind: "order", points: 50, status: "pending", orderId: "9001", availableAt: new Date(Date.now() - 1000) });
  await P.releasePending();
  // The refund was worked out while the points were still pending.
  await P.record(shop, m.id, { kind: "refund", points: -20, status: "pending", orderId: "9001", dedupe: "refund:9001:30:0" });
  const after = await prisma.loyaltyMember.findUniqueOrThrow({ where: { id: m.id } });
  assert.deepEqual([after.points, after.pending], [30, 0]);
  const rows = await prisma.loyaltyEvent.findMany({ where: { shop, memberId: m.id } });
  assert.equal(rows.reduce((n, r) => n + r.points, 0), 30, "the ledger adds up");
});

test("3.5: two long units with the same start are two units (the key is hashed, not cut)", async () => {
  const U = await import("../../app/lib/usage.server");
  const shop = "keys.myshopify.com";
  await U.setExtra(shop, "loyaltyOrders", true);
  const long = "X".repeat(60);
  assert.equal(await U.allowUnit(shop, "growth", "loyaltyOrders", 999, `ship:${long}A`), true);
  assert.equal(await U.allowUnit(shop, "growth", "loyaltyOrders", 999, `ship:${long}B`), true);
  assert.equal(await U.allowUnit(shop, "growth", "loyaltyOrders", 999, `ship:${long}A`), true);
  assert.equal(await prisma.usageEvent.count({ where: { shop } }), 2, "billed once each");
  assert.equal(U.unitKey("liveShipments", "ship:LX1"), "liveShipments:ship:LX1", "short keys stay readable");
});

test("3.6: a shipment whose first registration fails is counted once, and registered again next time", async () => {
  const T = await import("../../app/lib/tracking/tracking.server");
  const shop = "count.myshopify.com";
  process.env.TRACKING_PROVIDER_KEY = "test-key";
  await prisma.trackingConfig.create({ data: { shop, source: "live" } });
  const real = globalThis.fetch;
  let registerTries = 0;
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    if (u.includes("/register")) {
      registerTries++;
      if (registerTries === 1) throw new Error("network down");
      return new Response(JSON.stringify({ code: 0, data: {} }));
    }
    if (u.includes("/gettrackinfo")) return new Response(JSON.stringify({ code: 0, data: { accepted: [] } }));
    return new Response("[]");
  }) as typeof fetch;
  try {
    const s = { number: "LX9", carrier: "", country: "" };
    await T.resolveTracking(shop, "growth", s, null);
    await T.resolveTracking(shop, "growth", s, null);
    assert.equal(registerTries, 2, "registered again after the failure");
    assert.equal((await prisma.trackingUsage.findFirstOrThrow({ where: { shop } })).count, 1, "counted once");
  } finally {
    globalThis.fetch = real;
    delete process.env.TRACKING_PROVIDER_KEY;
  }
});

test("3.7: a free product reward covers the product's price when the code is made", async () => {
  const { rewardDiscountInput } = await import("../../app/lib/loyalty/rewards.server");
  const r = { id: "p", on: true, kind: "product" as const, title: "Free tote", points: 300, value: 0, minimum: 0, days: 30, product: { id: "gid://shopify/Product/7", title: "Tote", price: 20 }, tiers: [] };
  const now = rewardDiscountInput(r, "RWD-1", "gid://shopify/Customer/1", new Date(), 26.5);
  assert.deepEqual((now.input as { customerGets: { value: unknown } }).customerGets.value, { discountAmount: { amount: "26.50", appliesOnEachItem: false } });
  const saved = rewardDiscountInput(r, "RWD-2", "gid://shopify/Customer/1", new Date());
  assert.deepEqual((saved.input as { customerGets: { value: unknown } }).customerGets.value, { discountAmount: { amount: "20.00", appliesOnEachItem: false } }, "the saved price when Shopify can't say");
});

test("3.8: points back from a reward Shopify refused are not spent, not earned and not a store change", async () => {
  const { summarize } = await import("../../app/lib/loyalty/analytics.server");
  const P = await import("../../app/lib/loyalty/program.server");
  const at = new Date();
  const s = summarize({ members: [], events: [{ kind: "redeem", points: -100, createdAt: at }, { kind: "redeem_back", points: 100, createdAt: at }, { kind: "redeem", points: -50, createdAt: at }], rewards: [], codes: [], referrals: [], orders: [] }, 30, at);
  assert.deepEqual([s.points.spent, s.points.earned, s.points.byStore], [50, 0, 0]);
  const shop = "back.myshopify.com";
  const m = (await P.memberFor(shop, who("2"), true))!;
  await P.record(shop, m.id, { kind: "redeem_back", points: 100 });
  assert.equal((await prisma.loyaltyMember.findUniqueOrThrow({ where: { id: m.id } })).lifetime, 0, "not earned (lifetime and tiers)");
});
