/** Loyalty core: settings, order points, refunds and cancellations, pending and expiry, signups, privacy. Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_LOYALTY, withLoyaltyDefaults, type LoyaltyConfig } from "../../app/lib/loyalty/config";
import { isExcluded, newReferralCode, orderBase, orderPoints, type OrderFacts } from "../../app/lib/loyalty/points";

// The database is set before anything that imports it.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loyalty-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
type P = typeof import("../../app/lib/loyalty/program.server");
let P: P;
before(async () => {
  for (const m of ["20261027000000_loyalty_core", "20261028000000_loyalty_rewards"]) {
    const sql = fs.readFileSync(`prisma/migrations/${m}/migration.sql`, "utf8");
    for (const stmt of sql.split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  }
  P = await import("../../app/lib/loyalty/program.server");
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

const cfg = (patch: Partial<LoyaltyConfig> = {}): LoyaltyConfig => ({ ...DEFAULT_LOYALTY, ...patch });
const order = (o: Partial<OrderFacts> = {}): OrderFacts => ({
  id: "1001",
  name: "#1001",
  createdAt: "2026-10-20T10:00:00Z",
  customer: { id: "77", email: "sara@example.com", firstName: "", locale: "en", tags: [] },
  paid: true,
  cancelled: false,
  subtotal: 50,
  shipping: 5,
  taxes: 7,
  ...o,
});
const member = (shop: string, customerId = "77") => prisma.loyaltyMember.findUniqueOrThrow({ where: { shop_customerId: { shop, customerId } } });

test("settings are cleaned: fractions of a point per unit, ranges, names", () => {
  const c = withLoyaltyDefaults({ earn: { order: { perUnit: "0.5", shipping: "yes" }, signup: { points: -5 } }, pendingDays: 400, unit: { one: "", many: "stars" } });
  assert.equal(c.earn.order.perUnit, 0.5);
  assert.equal(c.earn.order.shipping, false);
  assert.equal(c.earn.signup.points, 0);
  assert.equal(c.pendingDays, 90);
  assert.deepEqual(c.unit, { one: "point", many: "stars" });
  assert.deepEqual(withLoyaltyDefaults(null), DEFAULT_LOYALTY);
});

test("an order earns on its paid money, rounded down; shipping and taxes only when chosen", () => {
  assert.equal(orderPoints(cfg(), order()), 50);
  assert.equal(orderPoints(cfg({ earn: { ...DEFAULT_LOYALTY.earn, order: { on: true, perUnit: 1, shipping: true, taxes: true } } }), order()), 62);
  assert.equal(orderPoints(cfg({ earn: { ...DEFAULT_LOYALTY.earn, order: { on: true, perUnit: 0.5, shipping: false, taxes: false } } }), order({ subtotal: 49.99 })), 24);
  assert.equal(orderPoints(cfg(), order({ paid: false })), 0, "cash on delivery not paid yet");
  assert.equal(orderPoints(cfg(), order({ cancelled: true })), 0);
  assert.equal(orderBase(cfg(), order({ subtotal: 0 })), 0);
  assert.equal(isExcluded(["Wholesale"], ["wholesale"]), true);
  assert.equal(isExcluded(["vip"], []), false);
  assert.match(newReferralCode(), /^[A-HJ-NP-Z2-9]{7}$/);
});

test("a paid order: pending points and a member, once however often it is read", async () => {
  const shop = "a.myshopify.com";
  const r = await P.syncOrder(shop, cfg(), order());
  assert.deepEqual(r && { points: r.points }, { points: 50 });
  await P.syncOrder(shop, cfg(), order());
  await P.syncOrder(shop, cfg(), order());
  const m = await member(shop);
  assert.equal(m.pending, 50);
  assert.equal(m.points, 0);
  assert.equal(m.orders, 1);
  assert.equal(m.spent, 62);
  assert.equal(await prisma.loyaltyEvent.count({ where: { shop } }), 1);
});

test("a refund takes points back from where they are, a cancellation takes the rest", async () => {
  const shop = "a.myshopify.com";
  await P.syncOrder(shop, cfg(), order({ subtotal: 20 })); // a 30 refund
  let m = await member(shop);
  assert.equal(m.pending, 20);
  await P.syncOrder(shop, cfg(), order({ subtotal: 20 })); // read again: nothing more
  assert.equal((await member(shop)).pending, 20);
  await P.syncOrder(shop, cfg(), order({ subtotal: 20, cancelled: true }));
  m = await member(shop);
  assert.equal(m.pending, 0);
  assert.equal(m.spent, 0);
  const kinds = (await prisma.loyaltyEvent.findMany({ where: { shop }, orderBy: { id: "asc" } })).map((e) => `${e.kind}:${e.points}`);
  assert.deepEqual(kinds, ["order:50", "refund:-30", "cancel:-20"]);
});

test("pending points become usable on their day; a first order bonus comes once", async () => {
  const shop = "b.myshopify.com";
  const c = cfg({ earn: { ...DEFAULT_LOYALTY.earn, firstOrder: { on: true, points: 25 } } });
  await P.syncOrder(shop, c, order({ id: "1" }));
  await P.syncOrder(shop, c, order({ id: "2", subtotal: 10 }));
  let m = await member(shop);
  assert.equal(m.pending, 50 + 25 + 10);
  await P.releasePending(new Date(Date.now() + 15 * 86_400_000));
  m = await member(shop);
  assert.equal(m.pending, 0);
  assert.equal(m.points, 85);
  assert.equal(m.lifetime, 85);
});

test("with no pending days points are usable at once; refunds never go below zero", async () => {
  const shop = "c.myshopify.com";
  const c = cfg({ pendingDays: 0 });
  await P.syncOrder(shop, c, order());
  let m = await member(shop);
  assert.equal(m.points, 50);
  assert.ok(await P.adjustPoints(shop, m.id, -45, "Spent on a reward"));
  await P.syncOrder(shop, c, order({ subtotal: 0 })); // fully refunded after the points were spent
  m = await member(shop);
  assert.equal(m.points, 0);
});

test("excluded tags, and customers who didn't join when joining is manual, earn nothing", async () => {
  const shop = "d.myshopify.com";
  assert.equal(await P.syncOrder(shop, cfg({ excludeTags: "wholesale, staff" }), order({ customer: { id: "9", email: "w@example.com", firstName: "", locale: "", tags: ["Wholesale"] } })), null);
  assert.equal(await P.syncOrder(shop, cfg({ autoJoin: false }), order({ customer: { id: "10", email: "x@example.com", firstName: "", locale: "", tags: [] } })), null);
  assert.equal(await P.syncOrder(shop, cfg(), order({ customer: null })), null, "guest checkout");
  assert.equal(await prisma.loyaltyMember.count({ where: { shop } }), 0);
});

test("an active account gets the signup points once; an account not activated yet waits", async () => {
  const shop = "e.myshopify.com";
  const cust = { id: "55", email: "new@example.com", firstName: "", locale: "en", tags: [] };
  assert.equal(await P.syncSignup(shop, cfg(), { ...cust, accountActive: false }), null);
  assert.ok(await P.syncSignup(shop, cfg(), { ...cust, accountActive: true }));
  assert.equal(await P.syncSignup(shop, cfg(), { ...cust, accountActive: true }), null);
  assert.equal((await member(shop, "55")).points, 100);
});

test("points expire after days without activity", async () => {
  const shop = "f.myshopify.com";
  await P.syncOrder(shop, cfg({ pendingDays: 0 }), order());
  const later = new Date(Date.now() + 400 * 86_400_000);
  assert.equal(await P.expireInactive(shop, cfg(), later), 0, "expiry off");
  assert.equal(await P.expireInactive(shop, cfg({ expiry: { on: true, days: 365 } }), later), 1);
  assert.equal((await member(shop)).points, 0);
});

test("privacy: a customer's loyalty rows are counted and removed; uninstall removes the store's", async () => {
  const shop = "a.myshopify.com";
  assert.deepEqual(await P.loyaltyHeldFor(shop, "77", ""), { members: 1, events: 3 });
  assert.equal(await P.redactLoyaltyCustomer(shop, "", "sara@example.com"), 1);
  assert.equal(await prisma.loyaltyEvent.count({ where: { shop } }), 0);
  await P.syncOrder("g.myshopify.com", cfg(), order());
  await P.setProgramOn("g.myshopify.com", true);
  await P.removeShopLoyalty("g.myshopify.com");
  assert.equal(await prisma.loyaltyMember.count({ where: { shop: "g.myshopify.com" } }), 0);
  assert.equal(await prisma.loyaltyProgram.count({ where: { shop: "g.myshopify.com" } }), 0);
});

test("turning the program on starts from now: older orders don't earn", async () => {
  const shop = "h.myshopify.com";
  const before = Date.now();
  await P.setProgramOn(shop, true);
  const p = await P.getProgram(shop);
  assert.equal(p.on, true);
  assert.ok(p.syncedAt && p.syncedAt.getTime() >= before - 1000);
  await P.setProgramOn(shop, false);
  await P.setProgramOn(shop, true);
  assert.ok((await P.getProgram(shop)).syncedAt);
});

test("the first time on, the store can also count orders of the last 30 or 90 days", async () => {
  await P.setProgramOn("i.myshopify.com", true, 30);
  const at = (await P.getProgram("i.myshopify.com")).syncedAt!.getTime();
  assert.ok(Math.abs(at - (Date.now() - 30 * 86_400_000)) < 5000);
  await P.setProgramOn("j.myshopify.com", true, 999);
  assert.ok(Math.abs((await P.getProgram("j.myshopify.com")).syncedAt!.getTime() - (Date.now() - 90 * 86_400_000)) < 5000, "at most 90 days");
});

test("an Admin API order reads into the engine's shape", async () => {
  const { factsFromNode } = await import("../../app/lib/loyalty/sync.server");
  const f = factsFromNode({
    id: "gid://shopify/Order/123", name: "#1006", createdAt: "2026-10-18T00:00:00Z", cancelledAt: null, displayFinancialStatus: "PARTIALLY_REFUNDED",
    currentSubtotalPriceSet: { shopMoney: { amount: "24.95", currencyCode: "USD" } }, currentShippingPriceSet: { shopMoney: { amount: "5" } }, currentTotalTaxSet: null,
    customer: { id: "gid://shopify/Customer/9", locale: "en", tags: ["vip"], state: "DISABLED", defaultEmailAddress: { emailAddress: "Sara@Example.com" } },
  });
  assert.deepEqual(f, { id: "123", name: "#1006", createdAt: "2026-10-18T00:00:00Z", customer: { id: "9", email: "sara@example.com", firstName: "", locale: "en", tags: ["vip"] }, paid: true, cancelled: false, subtotal: 24.95, shipping: 5, taxes: 0 });
  assert.equal(factsFromNode({ ...{ id: "gid://shopify/Order/1", name: "#1", createdAt: "", cancelledAt: null, currentSubtotalPriceSet: null, currentShippingPriceSet: null, currentTotalTaxSet: null, customer: null }, displayFinancialStatus: "PENDING" }).paid, false);
});

/* ---------------------------------------------------------------- rewards -- */
type Call = { query: string; variables: Record<string, unknown> };
function fakeAdmin(fail = false) {
  const calls: Call[] = [];
  const admin = {
    graphql: async (query: string, opts?: { variables?: Record<string, unknown> }) => {
      calls.push({ query, variables: opts?.variables ?? {} });
      const data = query.includes("currencyCode") && !query.includes("mutation")
        ? { shop: { currencyCode: "EGP" } }
        : query.includes("storeCreditAccountCredit")
          ? { storeCreditAccountCredit: { userErrors: fail ? [{ message: "No customer account" }] : [] } }
          : query.includes("discountCodeFreeShippingCreate")
            ? { discountCodeFreeShippingCreate: { codeDiscountNode: fail ? null : { id: "gid://shopify/DiscountCodeNode/2" }, userErrors: fail ? [{ message: "Bad" }] : [] } }
            : { discountCodeBasicCreate: { codeDiscountNode: fail ? null : { id: "gid://shopify/DiscountCodeNode/1" }, userErrors: fail ? [{ message: "Code taken" }] : [] } };
      return new Response(JSON.stringify({ data }));
    },
  };
  return { admin: admin as never, calls };
}

test("rewards are cleaned: kinds, values, a free product needs its product", () => {
  const c = withLoyaltyDefaults({ rewards: [
    { id: "a", kind: "percent", value: 150, points: 0 },
    { id: "b", kind: "product" },
    { id: "c", kind: "product", product: { id: "gid://shopify/Product/9", title: "Sample", price: "4.5" } },
    { id: "a", kind: "amount", value: 5 },
  ] });
  assert.deepEqual(c.rewards.map((r) => [r.id, r.kind, r.value, r.points]), [["a", "percent", 100, 1], ["c", "product", 0, 500]]);
  assert.equal(c.rewards[1].product?.price, 4.5);
  assert.equal(c.rewards[1].title, "A free product");
});

test("each reward kind makes the right Shopify discount, for that customer only", async () => {
  const { rewardDiscountInput } = await import("../../app/lib/loyalty/rewards.server");
  const end = new Date("2026-12-01T00:00:00Z");
  const base = { id: "x", on: true, title: "Reward", points: 100, value: 5, minimum: 20, days: 30, product: null };
  const amount = rewardDiscountInput({ ...base, kind: "amount" }, "RWD-1", "gid://shopify/Customer/7", end);
  assert.equal(amount.kind, "basic");
  assert.deepEqual((amount.input as { context: unknown }).context, { customers: { add: ["gid://shopify/Customer/7"] } });
  assert.deepEqual((amount.input as { customerGets: unknown }).customerGets, { value: { discountAmount: { amount: "5.00", appliesOnEachItem: false } }, items: { all: true } });
  assert.equal((amount.input as { usageLimit: number }).usageLimit, 1);
  assert.deepEqual((amount.input as { tags: string[] }).tags, ["cro-loyalty"]);
  assert.deepEqual((amount.input as { minimumRequirement: unknown }).minimumRequirement, { subtotal: { greaterThanOrEqualToSubtotal: "20.00" } });
  assert.deepEqual((rewardDiscountInput({ ...base, kind: "percent", value: 15 }, "C", "g", end).input as { customerGets: { value: unknown } }).customerGets.value, { percentage: 0.15 });
  assert.equal(rewardDiscountInput({ ...base, kind: "shipping" }, "C", "g", end).kind, "shipping");
  const prod = rewardDiscountInput({ ...base, kind: "product", product: { id: "gid://shopify/Product/9", title: "Sample", price: 4.5 } }, "C", "g", end).input as { customerGets: unknown };
  assert.deepEqual(prod.customerGets, { value: { discountAmount: { amount: "4.50", appliesOnEachItem: false } }, items: { products: { productsToAdd: ["gid://shopify/Product/9"] } } });
});

test("spending points: all or nothing, a code is kept, and points come back when Shopify refuses", async () => {
  const R = await import("../../app/lib/loyalty/rewards.server");
  const shop = "r.myshopify.com";
  const c = cfg({ pendingDays: 0 });
  await P.syncOrder(shop, c, order({ subtotal: 600, customer: { id: "300", email: "r@example.com", firstName: "", locale: "", tags: [] } }));
  const m = await member(shop, "300");
  assert.equal(m.points, 600);
  const ok = fakeAdmin();
  const got = await R.redeem(ok.admin, shop, c, m.id, "r1");
  assert.match(got.code, /^RWD-[0-9A-F]{8}$/);
  assert.equal((await member(shop, "300")).points, 100);
  await assert.rejects(R.redeem(ok.admin, shop, c, m.id, "r1"), R.NotEnoughPoints);
  assert.equal((await member(shop, "300")).points, 100, "nothing taken when there isn't enough");
  assert.equal((await R.memberRewards(shop, m.id)).length, 1);
  await P.adjustPoints(shop, m.id, 500, "test");
  const bad = fakeAdmin(true);
  await assert.rejects(R.redeem(bad.admin, shop, c, m.id, "r2"), /Bad/);
  assert.equal((await member(shop, "300")).points, 600, "points given back");
  await assert.rejects(R.redeem(ok.admin, shop, c, m.id, "nope"), /isn't available/);
});

test("store credit rewards go to the customer's store credit in the store's currency", async () => {
  const R = await import("../../app/lib/loyalty/rewards.server");
  const shop = "s.myshopify.com";
  const c = cfg({ pendingDays: 0, rewards: [{ id: "cr", on: true, kind: "credit", title: "10 store credit", points: 100, value: 10, minimum: 0, days: 30, product: null }] });
  await P.syncOrder(shop, c, order({ subtotal: 150, customer: { id: "301", email: "s@example.com", firstName: "", locale: "", tags: [] } }));
  const m = await member(shop, "301");
  const fa = fakeAdmin();
  const got = await R.redeem(fa.admin, shop, c, m.id, "cr");
  assert.equal(got.code, "");
  const credit = fa.calls.find((x) => x.query.includes("storeCreditAccountCredit"))!;
  assert.deepEqual(credit.variables, { id: "gid://shopify/Customer/301", input: { creditAmount: { amount: "10.00", currencyCode: "EGP" } } });
  assert.equal((await member(shop, "301")).points, 50);
});
