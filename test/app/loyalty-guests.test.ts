/**
 * Guest checkouts and the program's count-from date (Omar, 2026-10-24: "customers that ordered before and entered
 * their email in the checkout can create customer account and take their points", controlled by the store).
 * Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_LOYALTY, toStorefrontLoyalty, withLoyaltyDefaults, type LoyaltyConfig } from "../../app/lib/loyalty/config";
import type { OrderFacts } from "../../app/lib/loyalty/points";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loyalty-guests-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

type P = typeof import("../../app/lib/loyalty/program.server");
let P: P;
before(async () => {
  for (const m of fs.readdirSync("prisma/migrations").filter((x) => /^\d/.test(x)).sort()) {
    const sql = fs.readFileSync(`prisma/migrations/${m}/migration.sql`, "utf8");
    for (const stmt of sql.split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  }
  P = await import("../../app/lib/loyalty/program.server");
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

const cfg = (patch: Partial<LoyaltyConfig> = {}): LoyaltyConfig => ({ ...DEFAULT_LOYALTY, pendingDays: 0, ...patch });
const order = (id: string, customerId: string, account: boolean | undefined, createdAt = new Date().toISOString()): OrderFacts => ({
  id,
  name: `#${id}`,
  createdAt,
  customer: { id: customerId, email: `c${customerId}@example.com`, firstName: "", locale: "en", tags: [], ...(account === undefined ? {} : { account }) },
  paid: true,
  cancelled: false,
  subtotal: 40,
  shipping: 0,
  taxes: 0,
});
const points = async (shop: string, customerId: string) => (await prisma.loyaltyMember.findUnique({ where: { shop_customerId: { shop, customerId } } }))?.points ?? null;

test("guest orders earn as the store chose: right away, once they have an account, or not at all", async () => {
  // Right away (the default): the points wait for the email's customer.
  assert.ok(await P.syncOrder("g-now.myshopify.com", cfg(), order("1", "10", false)));
  assert.equal(await points("g-now.myshopify.com", "10"), 40);
  // Once they create an account: nothing as a guest, the same order earns when read with the account.
  const acc = cfg({ guests: "account" });
  assert.equal(await P.syncOrder("g-acc.myshopify.com", acc, order("2", "20", false)), null);
  assert.equal(await points("g-acc.myshopify.com", "20"), null, "no member yet");
  assert.ok(await P.syncOrder("g-acc.myshopify.com", acc, order("2", "20", true)));
  assert.equal(await points("g-acc.myshopify.com", "20"), 40);
  // Not at all: guests earn nothing, account holders do; an unknown account (older reads) counts as an account.
  const off = cfg({ guests: "off" });
  assert.equal(await P.syncOrder("g-off.myshopify.com", off, order("3", "30", false)), null);
  assert.ok(await P.syncOrder("g-off.myshopify.com", off, order("4", "31", true)));
  assert.ok(await P.syncOrder("g-off.myshopify.com", off, order("5", "32", undefined)));
});

test("an order placed before the program counts from never earns; one that earned is still taken back on a refund", async () => {
  const shop = "g-from.myshopify.com";
  const from = new Date(Date.now() - 5 * 86_400_000).toISOString();
  const c = cfg({ from });
  assert.equal(await P.syncOrder(shop, c, order("old", "40", true, new Date(Date.now() - 30 * 86_400_000).toISOString())), null);
  assert.equal(await points(shop, "40"), null);
  assert.ok(await P.syncOrder(shop, c, order("new", "40", true)));
  assert.equal(await points(shop, "40"), 40);
  // Earned before the date moved (turned on again later): a refund still takes its points back.
  const earned = new Date(Date.now() - 2 * 86_400_000).toISOString();
  assert.ok(await P.syncOrder(shop, cfg(), order("mid", "41", true, earned)));
  const later = cfg({ from: new Date().toISOString() });
  await P.syncOrder(shop, later, { ...order("mid", "41", true, earned), subtotal: 10 });
  assert.equal(await points(shop, "41"), 10);
});

test("the program remembers the date it counts from: the start (with its past days), or when it was turned on again", async () => {
  const shop = "g-start.myshopify.com";
  await P.setProgramOn(shop, true, 30);
  const first = (await P.getProgram(shop)).config.from!;
  assert.ok(Math.abs(Date.parse(first) - (Date.now() - 30 * 86_400_000)) < 60_000, first);
  await P.setProgramOn(shop, false);
  assert.equal((await P.getProgram(shop)).config.from, first, "kept while off");
  await P.setProgramOn(shop, true, 90);
  const again = (await P.getProgram(shop)).config.from!;
  assert.ok(Math.abs(Date.parse(again) - Date.now()) < 60_000, "turned on again: from now");
  // Saving the settings never stores the date in them.
  await P.saveProgramConfig(shop, (await P.getProgram(shop)).config);
  assert.equal(JSON.parse((await prisma.loyaltyProgram.findUniqueOrThrow({ where: { shop } })).config).from, undefined);
});

test("the setting is cleaned, and the widget and the checkout blocks know it", async () => {
  assert.equal(withLoyaltyDefaults({}).guests, "now");
  assert.equal(withLoyaltyDefaults({ guests: "account" }).guests, "account");
  assert.equal(withLoyaltyDefaults({ guests: "maybe" }).guests, "now");
  assert.equal(toStorefrontLoyalty(cfg(), true).gu, true);
  assert.equal(toStorefrontLoyalty(cfg({ guests: "off" }), true).gu, false);
  assert.equal(toStorefrontLoyalty(cfg({ autoJoin: false }), true).gu, false);
  const { shopPayload } = await import("../../app/lib/loyalty/account");
  assert.equal(shopPayload(cfg({ guests: "account" }), true, "").gu, "account");
  assert.equal(shopPayload(cfg({ autoJoin: false }), true, "").gu, "off");
});
