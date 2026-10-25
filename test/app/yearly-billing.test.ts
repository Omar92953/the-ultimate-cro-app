/**
 * Growth yearly and Pro yearly (Omar, 2026-10-25): Shopify App Pricing only bills usage on monthly plans, so Growth and
 * Pro are monthly with "Allow extra", and their yearly plans have the same features with hard limits. Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PLANS, planApproveUrl, planFromSubscription } from "../../app/lib/plans";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yearly-test-"));
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

test("the yearly plans are the same plans: their handles and names read as Growth and Pro", () => {
  assert.equal(PLANS.growth.yearlyHandle, "growth-yearly");
  assert.equal(PLANS.pro.yearlyHandle, "pro-yearly");
  for (const [v, plan] of [["growth-yearly", "growth"], ["Growth yearly", "growth"], ["pro-yearly", "pro"], ["Pro yearly", "pro"], ["growth", "growth"]] as const) assert.equal(planFromSubscription(v), plan, v);
});

test("choosing yearly opens the yearly plan for Growth and Pro, and the yearly price of Starter", () => {
  const shop = "s.myshopify.com";
  assert.equal(planApproveUrl(shop, "app", "growth", true), "https://admin.shopify.com/store/s/charges/app/plans/growth-yearly?interval=ANNUAL");
  assert.equal(planApproveUrl(shop, "app", "pro", true), "https://admin.shopify.com/store/s/charges/app/plans/pro-yearly?interval=ANNUAL");
  assert.equal(planApproveUrl(shop, "app", "growth", false), "https://admin.shopify.com/store/s/charges/app/plans/growth?interval=EVERY_30_DAYS");
  assert.equal(planApproveUrl(shop, "app", "starter", true), "https://admin.shopify.com/store/s/charges/app/plans/starter?interval=ANNUAL");
});

test("a yearly subscription is known by its handle, name or Shopify's interval", async () => {
  const { isYearly } = await import("../../app/lib/billing.server");
  for (const v of ["growth-yearly", "Pro yearly", "ANNUAL"]) assert.equal(isYearly(v), true, v);
  for (const v of ["growth", "Pro", "EVERY_30_DAYS", null]) assert.equal(isYearly(v), false, String(v));
  assert.equal(isYearly("Growth", "ANNUAL"), true);
});

test("on yearly billing every extra is off and the bars say why; the store's choices come back on monthly billing", async () => {
  const U = await import("../../app/lib/usage.server");
  const shop = "yearly.myshopify.com";
  await U.setExtra(shop, "loyaltyOrders", true);
  await U.setExtra(shop, "liveShipments", true);
  assert.equal((await U.extrasFor(shop)).loyaltyOrders, true);
  await U.setBillingYearly(shop, true);
  assert.deepEqual(await U.extrasFor(shop), { liveShipments: false, loyaltyOrders: false, loyaltyEmails: false });
  // At the limit: no unit over, even when a caller still had the switch on.
  assert.equal(await U.allowUnit(shop, "growth", "loyaltyOrders", 500, "order:1", true), false);
  assert.equal(await U.allowUnit(shop, "growth", "liveShipments", 200, "ship:1"), false);
  assert.equal(await U.allowUnit(shop, "growth", "loyaltyOrders", 10, "order:2", true), true, "within the limit as always");
  const bars = await U.usageSummary(shop, "growth", new Date(), true);
  assert.ok(bars.length && bars.every((b) => b.yearly && !b.extra));
  await U.setBillingYearly(shop, false);
  assert.equal((await U.extrasFor(shop)).loyaltyOrders, true, "kept for monthly billing");
  assert.equal(await U.allowUnit(shop, "growth", "loyaltyOrders", 500, "order:3", true), true);
});
