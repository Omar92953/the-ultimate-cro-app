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
  for (const m of ["20261019000000_tracking", "20261027000000_loyalty_core", "20261028000000_loyalty_rewards", "20261029000000_loyalty_tiers", "20261030000000_loyalty_referrals", "20261031000000_loyalty_emails", "20261101000000_loyalty_integrations", "20261102000000_usage_extras", "20261103000000_loyalty_account_metafield", "20261106000000_loyalty_count_from"]) {
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
  assert.deepEqual(await P.loyaltyHeldFor(shop, "77", ""), { members: 1, events: 3, referrals: 0, emails: 0 });
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
  assert.deepEqual(f, { id: "123", name: "#1006", createdAt: "2026-10-18T00:00:00Z", customer: { id: "9", email: "sara@example.com", firstName: "", locale: "en", tags: ["vip"], marketing: false, account: false }, paid: true, cancelled: false, subtotal: 24.95, shipping: 5, taxes: 0 });
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
  const base = { id: "x", on: true, title: "Reward", points: 100, value: 5, minimum: 20, days: 30, product: null, tiers: [] as string[] };
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
  const c = cfg({ pendingDays: 0, rewards: [{ id: "cr", on: true, kind: "credit", title: "10 store credit", points: 100, value: 10, minimum: 0, days: 30, product: null, tiers: [] }] });
  await P.syncOrder(shop, c, order({ subtotal: 150, customer: { id: "301", email: "s@example.com", firstName: "", locale: "", tags: [] } }));
  const m = await member(shop, "301");
  const fa = fakeAdmin();
  const got = await R.redeem(fa.admin, shop, c, m.id, "cr");
  assert.equal(got.code, "");
  const credit = fa.calls.find((x) => x.query.includes("storeCreditAccountCredit"))!;
  assert.deepEqual(credit.variables, { id: "gid://shopify/Customer/301", input: { creditAmount: { amount: "10.00", currencyCode: "EGP" } } });
  assert.equal((await member(shop, "301")).points, 50);
});

test("the Rewards page content and the widget look are cleaned; templates only change the look", async () => {
  const { applyLoyaltyPreset, toStorefrontLoyalty } = await import("../../app/lib/loyalty/config");
  const c = withLoyaltyDefaults({ page: { title: "", how: [{ t: "Join", x: "x" }, { t: "", x: "dropped" }], faq: [{ q: "Q", a: "" }, { q: "When?", a: "Soon" }] }, widget: { radius: 99, launcher: "icon", accent: "red" } });
  assert.equal(c.page.title, "Rewards");
  assert.deepEqual(c.page.how, [{ t: "Join", x: "x" }]);
  assert.deepEqual(c.page.faq, [{ q: "When?", a: "Soon" }]);
  assert.equal(c.widget.radius, 28);
  assert.equal(c.widget.launcher, "icon");
  assert.equal(c.widget.accent, "#111111", "not a colour: the default");
  const gold = applyLoyaltyPreset(c, "gold");
  assert.equal(gold.widget.accent, "#9a6b12");
  assert.deepEqual(gold.page, c.page);
  assert.equal(applyLoyaltyPreset(c, "nope"), c);
  const sf = toStorefrontLoyalty(c, true);
  assert.equal(sf.w.l, "icon");
  assert.deepEqual(sf.pg.faq, [{ q: "When?", a: "Soon" }]);
});

/* ------------------------------------------------- tiers, campaigns, rules -- */
const tiered = (patch: Partial<LoyaltyConfig> = {}) =>
  cfg({ pendingDays: 0, tiers: { ...DEFAULT_LOYALTY.tiers, on: true }, ...patch });

test("tiers: the highest reached, the next one and how far; multipliers from the tier and a campaign", async () => {
  const { multiplierFor, nextTier, tierFor } = await import("../../app/lib/loyalty/points");
  const c = tiered({ campaigns: [{ id: "c1", name: "Double", multiplier: 2, from: "2026-11-27", to: "2026-11-30" }] });
  assert.equal(tierFor(c, 0)?.name, "Bronze");
  assert.equal(tierFor(c, 1499)?.name, "Silver");
  assert.equal(tierFor(c, 1500)?.name, "Gold");
  assert.deepEqual(nextTier(c, 1200) && { n: nextTier(c, 1200)!.tier.name, need: nextTier(c, 1200)!.need }, { n: "Gold", need: 300 });
  assert.equal(nextTier(c, 5000), null);
  assert.equal(multiplierFor(c, "t3", "2026-11-28T10:00:00Z"), 3, "Gold 1.5 times a double campaign");
  assert.equal(multiplierFor(c, "t2", "2026-12-01T10:00:00Z"), 1.25);
  assert.equal(multiplierFor(cfg(), "t3", "2026-11-28T10:00:00Z"), 1, "tiers off, no campaign");
});

test("product and collection rules: own rate, none, and the first rule wins", async () => {
  const { orderPoints } = await import("../../app/lib/loyalty/points");
  const c = withLoyaltyDefaults({ productRules: [
    { id: "p1", kind: "products", items: [{ id: "gid://shopify/Product/1", title: "Gift card" }], perUnit: 0 },
    { id: "p2", kind: "collections", items: [{ id: "gid://shopify/Collection/5", title: "New" }], perUnit: 3 },
  ] });
  const o = order({ subtotal: 100, lines: [
    { productId: "gid://shopify/Product/1", collectionIds: ["gid://shopify/Collection/5"], amount: 50 },
    { productId: "gid://shopify/Product/2", collectionIds: ["gid://shopify/Collection/5"], amount: 20 },
    { productId: "gid://shopify/Product/3", collectionIds: [], amount: 30 },
  ] });
  assert.equal(orderPoints(c, o), 0 + 60 + 30);
  assert.equal(orderPoints(c, order({ subtotal: 100 })), 100, "no lines: the main rate");
});

test("a member moves up a tier with their orders, gets its bonus once, and earns with its multiplier", async () => {
  const shop = "t.myshopify.com";
  const c = tiered();
  const cust = { id: "400", email: "t@example.com", firstName: "", locale: "", tags: [] };
  await P.syncOrder(shop, c, order({ id: "a1", subtotal: 600, customer: cust }));
  let m = await member(shop, "400");
  assert.equal(m.tier, "t2");
  assert.equal(m.points, 600 + 50, "Silver bonus");
  await P.syncOrder(shop, c, order({ id: "a2", subtotal: 100, customer: cust }));
  m = await member(shop, "400");
  assert.equal(m.points, 650 + 125, "100 at Silver's 1.25");
  // A refund on the second order uses the multiplier it was earned with, even after the tier changed.
  await prisma.loyaltyMember.update({ where: { id: m.id }, data: { tier: "t3" } });
  await P.syncOrder(shop, c, order({ id: "a2", subtotal: 40, customer: cust }));
  assert.equal((await member(shop, "400")).points, 775 - 75);
  assert.equal(await prisma.loyaltyEvent.count({ where: { shop, kind: "tier" } }), 1);
});

test("tiers over the last 12 months: members move down when their points are old", async () => {
  const shop = "u.myshopify.com";
  const c = tiered({ tiers: { ...DEFAULT_LOYALTY.tiers, on: true, period: "year" } });
  await P.syncOrder(shop, c, order({ subtotal: 600, customer: { id: "401", email: "", firstName: "", locale: "", tags: [] } }));
  assert.equal((await member(shop, "401")).tier, "t2");
  await P.reviewTiers(shop, c, new Date(Date.now() + 400 * 86_400_000));
  assert.equal((await member(shop, "401")).tier, "t1");
});

test("cashback: an order earns store credit instead of points, given once when usable", async () => {
  const S = await import("../../app/lib/loyalty/sync.server");
  const shop = "v.myshopify.com";
  const c = cfg({ pendingDays: 0, cashback: { on: true, percent: 5 } });
  await P.syncOrder(shop, c, order({ subtotal: 200, customer: { id: "402", email: "", firstName: "", locale: "", tags: [] } }));
  const m = await member(shop, "402");
  assert.equal(m.points, 0);
  const e = await prisma.loyaltyEvent.findFirstOrThrow({ where: { shop, kind: "order" } });
  assert.equal(e.credit, 10);
  const fa = fakeAdmin();
  assert.equal(await S.issueCashback(fa.admin, shop), 1);
  assert.equal(await S.issueCashback(fa.admin, shop), 0, "never twice");
  const call = fa.calls.find((x) => x.query.includes("storeCreditAccountCredit"))!;
  assert.deepEqual(call.variables, { id: "gid://shopify/Customer/402", input: { creditAmount: { amount: "10.00", currencyCode: "EGP" } } });
});

test("birthday points once a year; a birthday is set once; follows count once per network", async () => {
  const shop = "w.myshopify.com";
  const c = cfg({ pendingDays: 0, earn: { ...DEFAULT_LOYALTY.earn, birthday: { on: true, points: 200 }, social: { on: true, points: 50, links: [{ network: "instagram", url: "https://instagram.com/store" }] } } });
  await P.syncOrder(shop, c, order({ subtotal: 10, customer: { id: "403", email: "", firstName: "", locale: "", tags: [] } }));
  const m = await member(shop, "403");
  assert.equal(await P.setBirthday(shop, m.id, "13-40"), false);
  assert.equal(await P.setBirthday(shop, m.id, "03-14"), true);
  assert.equal(await P.setBirthday(shop, m.id, "04-01"), false, "only once");
  const day = new Date("2027-03-14T08:00:00Z");
  assert.equal(await P.birthdayPoints(shop, c, day), 1);
  assert.equal(await P.birthdayPoints(shop, c, day), 0);
  assert.ok(await P.socialPoints(shop, c, m.id, "instagram"));
  assert.equal(await P.socialPoints(shop, c, m.id, "instagram"), null);
  assert.equal(await P.socialPoints(shop, c, m.id, "tiktok"), null, "not a network the store listed");
  assert.equal((await member(shop, "403")).points, 10 + 200 + 50);
});

test("a reward only some tiers can get is refused for others", async () => {
  const R = await import("../../app/lib/loyalty/rewards.server");
  const shop = "x.myshopify.com";
  const c = tiered({ rewards: [{ id: "g", on: true, kind: "shipping", title: "Free shipping", points: 10, value: 0, minimum: 0, days: 30, product: null, tiers: ["t3"] }] });
  await P.syncOrder(shop, c, order({ subtotal: 100, customer: { id: "404", email: "", firstName: "", locale: "", tags: [] } }));
  const m = await member(shop, "404");
  await assert.rejects(R.redeem(fakeAdmin().admin, shop, c, m.id, "g"), /for Gold members/);
});

/* -------------------------------------------------------------- referrals -- */
const DAY = 86_400_000;
type RF = typeof import("../../app/lib/loyalty/referrals.server");
const rf = (): Promise<RF> => import("../../app/lib/loyalty/referrals.server");
const who = (id: string, email: string) => ({ id, email, firstName: "", locale: "", tags: [] as string[] });

/** A fake Admin API for the referral discounts: ids it made, deleted ones, and each customer's first order. */
function refAdmin(first: Record<string, string> = {}) {
  const calls: Call[] = [];
  const live = new Set<string>();
  let next = 100;
  const admin = {
    graphql: async (query: string, opts?: { variables?: Record<string, unknown> }) => {
      const v = opts?.variables ?? {};
      calls.push({ query, variables: v });
      const ok = { userErrors: [] as unknown[] };
      const made = () => {
        const id = `gid://shopify/DiscountCodeNode/${next++}`;
        live.add(id);
        return { ...ok, codeDiscountNode: { id } };
      };
      let data: Record<string, unknown>;
      if (query.includes("discountCodeBasicCreate")) data = { discountCodeBasicCreate: made() };
      else if (query.includes("discountCodeFreeShippingCreate")) data = { discountCodeFreeShippingCreate: made() };
      else if (query.includes("discountCodeDelete")) {
        live.delete(String(v.id));
        data = { discountCodeDelete: { ...ok, deletedCodeDiscountId: v.id } };
      } else if (query.includes("CroRefExists")) data = { node: live.has(String(v.id)) ? { id: v.id } : null };
      else if (query.includes("CroRefFirst")) {
        const cid = String(v.id).split("/").pop()!;
        data = { customer: { orders: { nodes: first[cid] ? [{ id: `gid://shopify/Order/${first[cid]}` }] : [] } } };
      } else if (query.includes("storeCreditAccountCredit")) data = { storeCreditAccountCredit: ok };
      else if (query.includes("currencyCode")) data = { shop: { currencyCode: "EGP" } };
      else data = { result: ok };
      return new Response(JSON.stringify({ data }));
    },
  };
  const named = (name: string) => calls.filter((x) => x.query.includes(name));
  return { admin: admin as never, calls, live, named };
}

test("referral and affiliate settings are cleaned; the storefront gets the friend's offer only when on", async () => {
  const { toStorefrontLoyalty } = await import("../../app/lib/loyalty/config");
  const c = withLoyaltyDefaults({
    referral: { on: true, friend: { kind: "amount", value: "7.5", minimum: -3 }, gift: { kind: "credit", value: 4 }, monthly: -1 },
    affiliates: [{ id: "a1", name: "", code: " sarah 10!", kind: "shipping", value: 50, commission: 12.5 }, { id: "a2", code: "sarah10" }, { id: "a3", code: "ab" }],
  });
  assert.deepEqual(c.referral, { on: true, friend: { kind: "amount", value: 7.5, minimum: 0 }, gift: { kind: "credit", value: 4 }, monthly: 0 });
  assert.deepEqual(c.affiliates, [{ id: "a1", on: true, name: "SARAH10", code: "SARAH10", kind: "shipping", value: 0, minimum: 0, commission: 12.5 }]);
  assert.deepEqual(withLoyaltyDefaults({ referral: { friend: { kind: "percent", value: 250 } } }).referral.friend, { kind: "percent", value: 100, minimum: 0 });
  assert.deepEqual(toStorefrontLoyalty(c, true).rf, { k: "amount", v: 7.5, m: 0, g: "credit", gv: 4 });
  assert.equal(toStorefrontLoyalty(DEFAULT_LOYALTY, true).rf, null);
});

test("the referral fraud rules, in plain words", async () => {
  const { referralRefusal } = await rf();
  const ok = { referrer: { blocked: false, customerId: "1", email: "m@example.com" }, friend: { id: "2", email: "f@example.com" }, friendReferredBefore: false, rewardedLast30: 0, monthly: 10, firstOrder: true };
  assert.equal(referralRefusal(ok), "");
  assert.equal(referralRefusal({ ...ok, referrer: { ...ok.referrer, blocked: true } }), "The member is blocked");
  assert.equal(referralRefusal({ ...ok, friend: null }), "The order has no customer");
  assert.equal(referralRefusal({ ...ok, friend: { id: "1", email: "x@example.com" } }), "The member used their own code");
  assert.equal(referralRefusal({ ...ok, friend: { id: "3", email: "m@example.com" } }), "The member used their own code", "same email, other account");
  assert.equal(referralRefusal({ ...ok, friendReferredBefore: true }), "This friend was referred before");
  assert.equal(referralRefusal({ ...ok, rewardedLast30: 10 }), "The member reached 10 referrals in 30 days");
  assert.equal(referralRefusal({ ...ok, rewardedLast30: 99, monthly: 0 }), "", "0 = no limit");
  assert.equal(referralRefusal({ ...ok, firstOrder: false }), "Not the friend's first order");
});

test("the friend's discount: for everyone, once per customer, a minimum removed on update", async () => {
  const { friendDiscountInput } = await rf();
  const make = friendDiscountInput({ kind: "percent", value: 10, minimum: 0 }, { title: "Loyalty referrals", code: "REFER-1", oncePerCustomer: true, tags: ["cro-loyalty", "cro-referral"] });
  const i = make.input as Record<string, unknown>;
  assert.equal(make.kind, "basic");
  assert.equal(i.code, "REFER-1");
  assert.deepEqual(i.context, { all: "ALL" });
  assert.equal(i.appliesOncePerCustomer, true);
  assert.deepEqual(i.tags, ["cro-loyalty", "cro-referral"]);
  assert.equal(i.minimumRequirement, undefined);
  assert.deepEqual(i.customerGets, { value: { percentage: 0.1 }, items: { all: true } });
  const up = friendDiscountInput({ kind: "amount", value: 5, minimum: 0 }, { title: "T", oncePerCustomer: false, tags: [] }).input as Record<string, unknown>;
  assert.equal(up.code, undefined, "the code is never changed on update");
  assert.equal(up.startsAt, undefined);
  assert.deepEqual(up.minimumRequirement, { quantity: { greaterThanOrEqualToQuantity: null }, subtotal: { greaterThanOrEqualToSubtotal: null } });
  assert.deepEqual((up.customerGets as { value: unknown }).value, { discountAmount: { amount: "5.00", appliesOnEachItem: false } });
  const ship = friendDiscountInput({ kind: "shipping", value: 0, minimum: 30 }, { title: "T", code: "S", oncePerCustomer: true, tags: [] });
  assert.equal(ship.kind, "shipping");
  assert.deepEqual((ship.input as Record<string, unknown>).minimumRequirement, { subtotal: { greaterThanOrEqualToSubtotal: "30.00" } });
  assert.deepEqual((ship.input as Record<string, unknown>).destination, { all: true });
});

test("referral discounts: made when on, turned off, made again when the type changes, with member codes added again", async () => {
  const R = await rf();
  const shop = "ref1.myshopify.com";
  const c = await P.saveProgramConfig(shop, { referral: { on: true } });
  const fa = refAdmin();
  assert.deepEqual(await R.syncReferralDiscounts(fa.admin, shop, c, true), []);
  let s = await R.getReferralState(shop);
  assert.equal(s.ref?.gen, 1);
  assert.equal(s.ref?.kind, "basic");
  assert.equal(s.ref?.on, true);
  assert.match(String((fa.named("discountCodeBasicCreate")[0].variables.d as { code: string }).code), /^REFER-[0-9A-F]{8}$/);

  await P.syncOrder(shop, c, order({ id: "5001", customer: who("500", "m500@example.com") }));
  const m = await member(shop, "500");
  assert.equal(await R.ensureMemberCode(fa.admin, s, m), true);
  assert.deepEqual(fa.named("discountRedeemCodeBulkAdd")[0].variables, { id: s.ref!.id, codes: [{ code: m.referralCode }] });
  assert.equal(await R.ensureMemberCode(fa.admin, s, await member(shop, "500")), false, "added once");

  // Saving again with nothing changed: no update call.
  await R.syncReferralDiscounts(fa.admin, shop, c, true);
  assert.equal(fa.named("discountCodeBasicUpdate").length, 0);
  const more = withLoyaltyDefaults({ ...c, referral: { ...c.referral, friend: { kind: "percent", value: 15, minimum: 0 } } });
  await R.syncReferralDiscounts(fa.admin, shop, more, true);
  assert.equal(fa.named("discountCodeBasicUpdate").length, 1);

  await R.syncReferralDiscounts(fa.admin, shop, c, false);
  s = await R.getReferralState(shop);
  assert.equal(s.ref?.on, false);
  assert.equal(fa.named("discountCodeDeactivate").length, 1);
  assert.equal(await R.codeOffer(fa.admin, shop, c, m.referralCode), null, "an off discount gives nothing");

  const ship = withLoyaltyDefaults({ ...c, referral: { ...c.referral, friend: { kind: "shipping", value: 0, minimum: 0 } } });
  const old = s.ref!.id;
  assert.deepEqual(await R.syncReferralDiscounts(fa.admin, shop, ship, true), []);
  s = await R.getReferralState(shop);
  assert.equal(s.ref?.gen, 2);
  assert.equal(s.ref?.kind, "shipping");
  assert.equal(fa.live.has(old), false, "the old discount is deleted");
  assert.deepEqual(fa.named("discountRedeemCodeBulkAdd").at(-1)!.variables, { id: s.ref!.id, codes: [{ code: m.referralCode }] });
  assert.equal((await member(shop, "500")).codeGen, 2);

  // Deleted in Shopify by the store: made again on the next save.
  fa.live.delete(s.ref!.id);
  await R.syncReferralDiscounts(fa.admin, shop, ship, true);
  assert.equal((await R.getReferralState(shop)).ref?.gen, 3);

  assert.deepEqual(await R.codeOffer(fa.admin, shop, ship, m.referralCode.toLowerCase()), { k: "shipping", v: 0, m: 0 });
  assert.equal(await R.codeOffer(fa.admin, shop, ship, "NOBODY1"), null);
});

test("affiliate discounts: one per affiliate, made again for a new code, deleted when removed", async () => {
  const R = await rf();
  const shop = "ref5.myshopify.com";
  const aff = { id: "a1", on: true, name: "Sarah", code: "SARAH10", kind: "percent", value: 10, minimum: 0, commission: 10 };
  const c = await P.saveProgramConfig(shop, { affiliates: [aff] });
  const fa = refAdmin();
  assert.deepEqual(await R.syncReferralDiscounts(fa.admin, shop, c, true), []);
  const first = (await R.getReferralState(shop)).aff!.a1;
  assert.equal(first.code, "SARAH10");
  assert.equal((fa.named("discountCodeBasicCreate")[0].variables.d as { code: string; appliesOncePerCustomer: boolean }).appliesOncePerCustomer, false);
  assert.deepEqual(await R.codeOffer(fa.admin, shop, c, "sarah10"), { k: "percent", v: 10, m: 0 });
  const renamed = withLoyaltyDefaults({ ...c, affiliates: [{ ...aff, code: "SARAH20" }] });
  await R.syncReferralDiscounts(fa.admin, shop, renamed, true);
  const second = (await R.getReferralState(shop)).aff!.a1;
  assert.notEqual(second.id, first.id);
  assert.equal(fa.live.has(first.id), false);
  await R.syncReferralDiscounts(fa.admin, shop, withLoyaltyDefaults({ ...c, affiliates: [] }), true);
  assert.deepEqual((await R.getReferralState(shop)).aff, {});
  assert.equal(fa.live.has(second.id), false);
});

test("a friend's first order: the gift is pending, then usable, once however often it is read; a full refund takes it back", async () => {
  const R = await rf();
  const shop = "ref2.myshopify.com";
  const c = cfg({ pendingDays: 14, referral: { on: true, friend: { kind: "percent", value: 10, minimum: 0 }, gift: { kind: "points", value: 200 }, monthly: 10 } });
  await P.syncOrder(shop, c, order({ id: "6001", customer: who("600", "member@example.com") }));
  const m = await member(shop, "600");
  const fa = refAdmin({ "601": "6002" });
  const now = new Date();
  const friendOrder = order({ id: "6002", name: "#6002", customer: who("601", "friend@example.com"), codes: [m.referralCode.toLowerCase()] });
  await P.syncOrder(shop, c, friendOrder);
  await R.matchCodes(fa.admin, shop, c, friendOrder, now);
  await R.matchCodes(fa.admin, shop, c, friendOrder, now);
  const rows = await prisma.loyaltyReferral.findMany({ where: { shop, kind: "referral" } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "rewarded");
  assert.equal(rows[0].referrerId, m.id);
  assert.equal((await member(shop, "600")).pending, m.pending + 200);
  assert.equal((await member(shop, "601")).referredBy, m.id, "the friend's member knows who referred them");

  await P.releasePending(new Date(now.getTime() + 15 * DAY));
  const after = await member(shop, "600");
  assert.equal(after.points, m.points + m.pending + 200);
  assert.equal(after.pending, 0);

  await R.matchCodes(fa.admin, shop, c, { ...friendOrder, subtotal: 0 }, now);
  await R.matchCodes(fa.admin, shop, c, { ...friendOrder, subtotal: 0 }, now);
  assert.equal((await member(shop, "600")).points, after.points - 200);
  assert.equal((await prisma.loyaltyReferral.findFirstOrThrow({ where: { shop, kind: "referral" } })).status, "reversed");
  assert.equal(await prisma.loyaltyEvent.count({ where: { shop, kind: "referral_back" } }), 1);
});

test("refused referrals: the member's own code, a friend's second order, the monthly limit", async () => {
  const R = await rf();
  const shop = "ref3.myshopify.com";
  const c = cfg({ pendingDays: 0, referral: { on: true, friend: { kind: "percent", value: 10, minimum: 0 }, gift: { kind: "points", value: 100 }, monthly: 1 } });
  await P.syncOrder(shop, c, order({ id: "7001", customer: who("700", "m7@example.com") }));
  const m = await member(shop, "700");
  const fa = refAdmin({ "700": "7001", "701": "7100", "702": "7003", "703": "7004" });
  const code = [m.referralCode];
  await R.matchCodes(fa.admin, shop, c, order({ id: "7002", customer: who("700", "m7@example.com"), codes: code }));
  await R.matchCodes(fa.admin, shop, c, order({ id: "7101", customer: who("701", "f1@example.com"), codes: code }));
  await R.matchCodes(fa.admin, shop, c, order({ id: "7003", customer: who("702", "f2@example.com"), codes: code }));
  await R.matchCodes(fa.admin, shop, c, order({ id: "7004", customer: who("703", "f3@example.com"), codes: code }));
  await R.matchCodes(fa.admin, shop, c, order({ id: "7005", customer: who("704", "f4@example.com"), codes: code, paid: false }));
  const rows = await prisma.loyaltyReferral.findMany({ where: { shop }, orderBy: { orderId: "asc" } });
  assert.deepEqual(rows.map((r) => [r.orderId, r.status, r.reason]), [
    ["7002", "refused", "The member used their own code"],
    ["7003", "rewarded", ""],
    ["7004", "refused", "The member reached 1 referrals in 30 days"],
    ["7101", "refused", "Not the friend's first order"],
  ]);
  assert.equal((await member(shop, "700")).points, m.points + 100);
  const stats = await R.referralStats(shop);
  assert.equal(stats.referred, 1);
  assert.equal(stats.refused, 3);
  assert.equal(stats.latest[0].member, "m7@example.com");
});

test("store credit gifts go to the member's store credit once usable", async () => {
  const R = await rf();
  const { issueCashback } = await import("../../app/lib/loyalty/sync.server");
  const shop = "ref6.myshopify.com";
  const c = cfg({ pendingDays: 0, referral: { on: true, friend: { kind: "percent", value: 10, minimum: 0 }, gift: { kind: "credit", value: 5 }, monthly: 0 } });
  await P.syncOrder(shop, c, order({ id: "9001", customer: who("900", "m9@example.com") }));
  const m = await member(shop, "900");
  const fa = refAdmin({ "901": "9002" });
  await R.matchCodes(fa.admin, shop, c, order({ id: "9002", customer: who("901", "f9@example.com"), codes: [m.referralCode] }));
  assert.equal((await member(shop, "900")).points, m.points, "no points for a credit gift");
  assert.equal(await issueCashback(fa.admin, shop), 1);
  assert.equal(await issueCashback(fa.admin, shop), 0, "given once");
  assert.deepEqual(fa.named("storeCreditAccountCredit")[0].variables, { id: "gid://shopify/Customer/900", input: { creditAmount: { amount: "5.00", currencyCode: "EGP" } } });
});

test("affiliate sales: one row per order, kept net of refunds, nothing for an order not paid yet", async () => {
  const R = await rf();
  const shop = "ref4.myshopify.com";
  const c = cfg({ affiliates: [{ id: "a1", on: true, name: "Sarah", code: "SARAH10", kind: "percent", value: 10, minimum: 0, commission: 10 }] });
  const fa = refAdmin();
  const o = order({ id: "8001", subtotal: 80, customer: who("800", "b@example.com"), codes: ["sarah10"] });
  await R.matchCodes(fa.admin, shop, c, { ...o, paid: false });
  assert.equal(await prisma.loyaltyReferral.count({ where: { shop } }), 0);
  await R.matchCodes(fa.admin, shop, c, o);
  await R.matchCodes(fa.admin, shop, c, o);
  await R.matchCodes(fa.admin, shop, c, { ...o, subtotal: 30 });
  let row = await prisma.loyaltyReferral.findFirstOrThrow({ where: { shop } });
  assert.deepEqual([row.kind, row.affiliateId, row.amount, row.status], ["affiliate", "a1", 30, "counted"]);
  assert.deepEqual((await R.referralStats(shop)).affiliates.a1, { orders: 1, sales: 30 });
  await R.matchCodes(fa.admin, shop, c, { ...o, cancelled: true });
  row = await prisma.loyaltyReferral.findFirstOrThrow({ where: { shop } });
  assert.deepEqual([row.amount, row.status], [0, "reversed"]);
  assert.equal(await prisma.loyaltyReferral.count({ where: { shop } }), 1);
});

test("privacy: referral rows are counted and removed for the member and the friend; uninstall removes them", async () => {
  const shop = "ref2.myshopify.com";
  assert.equal((await P.loyaltyHeldFor(shop, "601", "")).referrals, 1, "as the friend");
  assert.equal((await P.loyaltyHeldFor(shop, "600", "")).referrals, 1, "as the member");
  await P.redactLoyaltyCustomer(shop, "601", "");
  assert.equal(await prisma.loyaltyReferral.count({ where: { shop } }), 0);
  await P.removeShopLoyalty("ref4.myshopify.com");
  assert.equal(await prisma.loyaltyReferral.count({ where: { shop: "ref4.myshopify.com" } }), 0);
});

/* ----------------------------------------------------------------- emails -- */
type M = typeof import("../../app/lib/loyalty/mailer.server");
const ml = (): Promise<M> => import("../../app/lib/loyalty/mailer.server");
type OutMail = import("../../app/lib/email/provider.server").OutMail;
type MailProvider = import("../../app/lib/email/provider.server").MailProvider;

/** A fake email service: what was sent, and a sending domain whose DKIM can be switched. */
function fakeMail(o: { ready?: boolean; domains?: boolean; fail?: boolean } = {}) {
  const sent: OutMail[] = [];
  let dkim = false;
  const rec = (domain: string) => ({ id: "77", domain, dkimHost: `pm123._domainkey.${domain}`, dkimValue: "k=rsa;p=ABC", returnPathHost: `pm-bounces.${domain}`, returnPathValue: "pm.mtasv.net", dkimVerified: dkim, returnPathVerified: dkim });
  let domain = "";
  const provider: MailProvider = {
    ready: () => o.ready ?? true,
    domainsReady: () => o.domains ?? true,
    send: async (ms) => {
      sent.push(...ms);
      return ms.map((_, i) => (o.fail ? { ok: false, id: "", error: "Inactive recipient" } : { ok: true, id: `pm-${sent.length - ms.length + i}`, error: "" }));
    },
    addDomain: async (d) => ((domain = d), rec(d)),
    getDomain: async () => rec(domain),
    verifyDomain: async () => rec(domain),
    ensureWebhook: async () => {},
  };
  return { provider, sent, setDkim: (v: boolean) => (dkim = v) };
}
const storeAdmin = () =>
  ({ graphql: async () => new Response(JSON.stringify({ data: { shop: { name: "Sara's <Shop>", email: "owner@sara.example", contactEmail: "help@sara.example", currencyCode: "EGP", primaryDomain: { url: "https://sara.example" } } } })) }) as never;
const withEmails = (patch: Record<string, unknown> = {}) => withLoyaltyDefaults({ ...DEFAULT_LOYALTY, pendingDays: 0, emails: { on: true, ...patch } });

test("email settings are cleaned: a bad sender or logo is dropped, lines stay one line, defaults are complete", async () => {
  const { withEmailDefaults, DEFAULT_EMAILS, EMAIL_KINDS } = await import("../../app/lib/loyalty/emails");
  assert.deepEqual(withEmailDefaults(undefined), DEFAULT_EMAILS);
  const e = withEmailDefaults({ on: true, sender: { email: "not an email", name: 'Sara "<x>"' }, logo: "http://insecure.example/logo.png", texts: { earned: { subject: "You\nearned {points}", body: "" } } });
  assert.equal(e.on, true);
  assert.deepEqual(e.sender, { email: "", name: "Sara x" });
  assert.equal(e.logo, "");
  assert.equal(e.texts.earned.subject, "You earned {points}");
  assert.equal(e.texts.earned.body, DEFAULT_EMAILS.texts.earned.body, "an empty text gets its default back");
  assert.equal(Object.keys(e.texts).length, EMAIL_KINDS.length);
  assert.equal(withEmailDefaults({ sender: { email: "Hello@Sara.Example" } }).sender.email, "hello@sara.example");
});

test("an email is filled in and escaped, with the unsubscribe link in the HTML and the text", async () => {
  const { renderEmail, DEFAULT_EMAILS } = await import("../../app/lib/loyalty/emails");
  const r = renderEmail({ ...DEFAULT_EMAILS, accent: "#ffcc00" }, "earned", { name: "Sara's <Shop>", url: "https://sara.example" }, { points: "120 points", order: "#1042", date: "November 30", balance: "500 points" }, "https://app.example/email/unsubscribe?t=abc");
  assert.equal(r.subject, "You earned 120 points");
  assert.match(r.html, /120 points for order #1042/);
  assert.match(r.html, /Sara&#39;s &lt;Shop&gt;/);
  assert.doesNotMatch(r.html, /<Shop>/);
  assert.match(r.html, /href="https:\/\/app\.example\/email\/unsubscribe\?t=abc"/);
  assert.match(r.html, /background:#ffcc00;color:#111111/, "dark text on a light button");
  assert.match(r.text, /They can be used from November 30\. Your balance: 500 points\./);
  assert.match(r.text, /Unsubscribe: https:\/\/app\.example\/email\/unsubscribe\?t=abc/);
});

test("unsubscribe links are signed per member; a changed link does nothing", async () => {
  const E = await ml();
  const shop = "em0.myshopify.com";
  await P.syncOrder(shop, cfg(), order({ id: "9901", customer: who("990", "u@example.com") }));
  const m = await member(shop, "990");
  const t = E.unsubToken(shop, m.id);
  assert.deepEqual(E.readUnsubToken(t), { shop, memberId: m.id });
  assert.equal(E.readUnsubToken(t.slice(0, -1) + (t.endsWith("A") ? "B" : "A")), null);
  assert.equal(E.readUnsubToken(E.unsubToken(shop, m.id).replace(/^[^.]+/, Buffer.from(`${shop}|${m.id + 1}`).toString("base64url"))), null, "another member's id with this signature");
  assert.equal(await E.unsubscribe("nonsense"), null);
  await E.unsubscribe(t);
  assert.equal((await member(shop, "990")).emailOptOut, true);
});

test("emails: queued by events only when on, sent with the default sender, reminders only with marketing consent", async () => {
  const E = await ml();
  const shop = "em1.myshopify.com";
  const off = cfg({ pendingDays: 0 });
  await P.syncOrder(shop, off, order({ id: "9101", createdAt: new Date().toISOString(), customer: who("910", "a@example.com") }));
  assert.equal(await prisma.loyaltyEmail.count({ where: { shop } }), 0, "emails off: nothing queued");

  const c = withEmails();
  await P.syncOrder(shop, c, order({ id: "9102", createdAt: new Date().toISOString(), customer: { ...who("911", "b@example.com"), marketing: true } }));
  await P.syncOrder(shop, c, order({ id: "9103", createdAt: "2026-01-01T00:00:00Z", customer: who("912", "old@example.com") }));
  assert.deepEqual((await prisma.loyaltyEmail.findMany({ where: { shop } })).map((e) => e.kind), ["earned"], "an old order counted when the program starts sends nothing");
  await E.queueScheduled(shop, c);
  const b = await member(shop, "911");
  assert.equal(b.emailMarketing, true);
  await P.birthdayPoints(shop, withEmails(), new Date());
  await E.notify(shop, c, (await member(shop, "912")).id, "expiring", { date: "2026-12-01T00:00:00Z" }, "x1");
  await E.notify(shop, c, (await member(shop, "912")).id, "expiring", { date: "2026-12-01T00:00:00Z" }, "x1");

  const mail = fakeMail();
  const done = await E.sendQueued(storeAdmin(), shop, c, new Date(), mail.provider);
  const rows = await prisma.loyaltyEmail.findMany({ where: { shop }, orderBy: { id: "asc" } });
  assert.equal(rows.filter((r) => r.kind === "expiring").length, 1, "the same reminder is queued once");
  assert.equal(rows.find((r) => r.kind === "expiring")!.reason, "Not subscribed to email marketing");
  const earned = mail.sent.find((x) => x.tag === "loyalty-earned")!;
  assert.equal(earned.to, "b@example.com");
  assert.equal(earned.from, '"Sara\'s Shop" <rewards@mail.crotoolbox.com>');
  assert.equal(earned.replyTo, "help@sara.example");
  assert.equal(earned.stream, "account");
  assert.equal(earned.subject, "You earned 50 points");
  assert.match(earned.headers[0].value, /^<.*\/email\/unsubscribe\?t=.+>$/);
  assert.deepEqual(earned.headers[1], { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" });
  assert.equal(earned.metadata.member, String(b.id));
  assert.ok(mail.sent.some((x) => x.tag === "loyalty-welcome"), "welcome for new members");
  assert.equal(done.sent, mail.sent.length);
  assert.ok(rows.every((r) => r.status !== "queued"));
  assert.equal(rows.find((r) => r.kind === "earned")!.providerId.startsWith("pm-"), true);

  // Unsubscribed: skipped with the reason.
  await prisma.loyaltyMember.update({ where: { id: b.id }, data: { emailOptOut: true } });
  await E.notify(shop, c, b.id, "reward", { reward: "10% off", code: "RWD-1" }, "r1");
  await E.sendQueued(storeAdmin(), shop, c, new Date(), mail.provider);
  assert.equal((await prisma.loyaltyEmail.findFirstOrThrow({ where: { shop, dedupe: "r1" } })).reason, "Unsubscribed");
});

test("emails are skipped when the service isn't ready, failed when Shopify's address bounces at once, and stop at the monthly limit", async () => {
  const E = await ml();
  const shop = "em2.myshopify.com";
  const c = withEmails();
  await P.syncOrder(shop, c, order({ id: "9201", createdAt: new Date().toISOString(), customer: who("920", "c@example.com") }));
  await E.sendQueued(storeAdmin(), shop, c, new Date(), fakeMail({ ready: false }).provider);
  assert.equal((await prisma.loyaltyEmail.findFirstOrThrow({ where: { shop, kind: "earned" } })).reason, "The email service is not set up yet");
  const m = await member(shop, "920");
  await E.notify(shop, c, m.id, "tier", { tier: "Gold" }, "t1");
  await E.sendQueued(storeAdmin(), shop, c, new Date(), fakeMail({ fail: true }).provider);
  const failed = await prisma.loyaltyEmail.findFirstOrThrow({ where: { shop, dedupe: "t1" } });
  assert.deepEqual([failed.status, failed.reason], ["failed", "Inactive recipient"]);
  const now = new Date();
  await prisma.loyaltyEmail.createMany({ data: Array.from({ length: 10_000 }, () => ({ shop, kind: "earned", status: "sent", sentAt: now })) });
  await E.notify(shop, c, m.id, "tier", { tier: "Gold" }, "t2");
  const mail = fakeMail();
  await E.sendQueued(storeAdmin(), shop, c, now, mail.provider);
  assert.equal(mail.sent.length, 0);
  assert.equal((await prisma.loyaltyEmail.findFirstOrThrow({ where: { shop, dedupe: "t2" } })).reason, "Monthly email limit reached");
  await prisma.loyaltyEmail.deleteMany({ where: { shop } });
});

test("the store's own sender: free mailboxes refused, used once verified, back to the default if it stops verifying", async () => {
  const E = await ml();
  const shop = "em3.myshopify.com";
  await P.saveProgramConfig(shop, {});
  const mail = fakeMail();
  await assert.rejects(E.setupSender(shop, "store@gmail.com", mail.provider), /Free email addresses/);
  await assert.rejects(E.setupSender(shop, "nope", mail.provider), /full email address/);
  await assert.rejects(E.setupSender(shop, "hi@sara.test", fakeMail({ domains: false }).provider), /not set up/);
  const s = await E.setupSender(shop, "Hi@Sara.test", mail.provider);
  assert.deepEqual([s.email, s.domain, s.verified], ["hi@sara.test", "sara.test", false]);
  assert.equal(s.records?.returnPathValue, "pm.mtasv.net");
  const c = withEmails({ sender: { email: "hi@sara.test", name: "Sara" } });
  const store = { name: "Sara's Shop", email: "help@sara.example", url: "https://sara.example", currency: "EGP" };
  assert.equal((await E.fromFor(shop, c, store, mail.provider)).own, false, "not verified yet: the default sender");
  mail.setDkim(true);
  assert.equal((await E.verifySender(shop, mail.provider))?.verified, true);
  const own = await E.fromFor(shop, c, store, mail.provider);
  assert.deepEqual(own, { from: '"Sara" <hi@sara.test>', replyTo: "", own: true });
  mail.setDkim(false);
  assert.equal((await E.fromFor(shop, c, store, mail.provider, new Date(Date.now() + 2 * DAY))).own, false, "checked again a day later");
  assert.equal(((await prisma.loyaltyProgram.findUniqueOrThrow({ where: { shop } })).state.includes('"verified":false')), true);
  await E.removeSender(shop);
  assert.equal(await E.getSender(shop), null);
});

test("bounces and spam complaints stop a member's emails; soft bounces don't", async () => {
  const E = await ml();
  const shop = "em4.myshopify.com";
  await P.syncOrder(shop, cfg(), order({ id: "9401", customer: who("940", "d@example.com") }));
  const m = await member(shop, "940");
  await prisma.loyaltyEmail.create({ data: { shop, memberId: m.id, kind: "earned", status: "sent", providerId: "pm-x" } });
  assert.equal(await E.providerEvent({ RecordType: "Bounce", Type: "SoftBounce", MessageID: "pm-x", Metadata: { shop, member: String(m.id) } }), false);
  assert.equal((await member(shop, "940")).emailOptOut, false);
  assert.equal(await E.providerEvent({ RecordType: "Bounce", Type: "HardBounce", MessageID: "pm-x", Metadata: { shop, member: String(m.id) } }), true);
  assert.equal((await member(shop, "940")).emailOptOut, true);
  assert.equal((await prisma.loyaltyEmail.findFirstOrThrow({ where: { shop, providerId: "pm-x" } })).status, "bounced");
});

test("the Postmark client: one batch per stream, the right streams and headers, errors per email, a domain added before", async () => {
  const { postmark } = await import("../../app/lib/email/provider.server");
  const calls: { url: string; init: RequestInit }[] = [];
  const http = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith("/email/batch")) {
      const n = (JSON.parse(String(init.body)) as unknown[]).length;
      return new Response(JSON.stringify(Array.from({ length: n }, (_, i) => (i === 0 ? { ErrorCode: 0, MessageID: `id-${calls.length}` } : { ErrorCode: 406, Message: "Inactive recipient" }))));
    }
    if (url.endsWith("/domains") && init.method === "POST") return new Response(JSON.stringify({ ErrorCode: 503, Message: "This domain already exists." }), { status: 422 });
    if (url.includes("/domains?")) return new Response(JSON.stringify({ Domains: [{ ID: 5, Name: "sara.test" }] }));
    if (url.endsWith("/domains/5")) return new Response(JSON.stringify({ ID: 5, Name: "sara.test", DKIMVerified: false, DKIMPendingHost: "x._domainkey.sara.test", DKIMPendingTextValue: "k=rsa", ReturnPathDomain: "pm-bounces.sara.test", ReturnPathDomainCNAMEValue: "pm.mtasv.net", ReturnPathDomainVerified: false }));
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  const pm = postmark({ server: "srv", account: "acc", broadcast: "rewards-reminders" }, http);
  const mk = (to: string, stream: "account" | "reminder") => ({ from: "a@b.test", to, subject: "S", html: "<p>h</p>", text: "h", stream, headers: [{ name: "List-Unsubscribe", value: "<https://x>" }], tag: "t", metadata: { shop: "s" } });
  const res = await pm.send([mk("1@x.test", "account"), mk("2@x.test", "reminder"), mk("3@x.test", "account")]);
  assert.deepEqual(res.map((r) => r.ok), [true, true, false]);
  assert.equal(res[2].error, "Inactive recipient");
  const batches = calls.filter((c) => c.url.endsWith("/email/batch")).map((c) => JSON.parse(String(c.init.body)) as { MessageStream: string; To: string; Headers: unknown[] }[]);
  assert.deepEqual(batches.map((b) => b.map((x) => `${x.MessageStream}:${x.To}`)), [["outbound:1@x.test", "outbound:3@x.test"], ["rewards-reminders:2@x.test"]]);
  assert.deepEqual(batches[0][0].Headers, [{ Name: "List-Unsubscribe", Value: "<https://x>" }]);
  assert.equal((calls[0].init.headers as Record<string, string>)["X-Postmark-Server-Token"], "srv");
  const d = await pm.addDomain("sara.test");
  assert.deepEqual([d.id, d.dkimHost, d.dkimValue, d.returnPathHost], ["5", "x._domainkey.sara.test", "k=rsa", "pm-bounces.sara.test"]);
  assert.equal(postmark({ server: "", account: "" }, http).ready(), false);
});

test("scheduled emails: reward ready once until more is earned, points expiring 14 days before, the summary on the 1st", async () => {
  const E = await ml();
  const shop = "em5.myshopify.com";
  const c = withEmails({ texts: { summary: { on: true } } });
  const exp = withLoyaltyDefaults({ ...c, expiry: { on: true, days: 60 } });
  await P.syncOrder(shop, exp, order({ id: "9501", subtotal: 600, customer: { ...who("950", "e@example.com"), marketing: true } }));
  const m = await member(shop, "950");
  const kinds = async () => (await prisma.loyaltyEmail.findMany({ where: { shop, memberId: m.id }, orderBy: { id: "asc" } })).map((e) => e.kind);
  await E.queueScheduled(shop, exp, new Date("2026-11-10T00:00:00Z"));
  await E.queueScheduled(shop, exp, new Date("2026-11-10T01:00:00Z"));
  assert.equal((await kinds()).filter((k) => k === "ready").length, 1);
  const ready = await prisma.loyaltyEmail.findFirstOrThrow({ where: { shop, kind: "ready" } });
  assert.equal(JSON.parse(ready.data).reward, "10% off your order", "the best reward the points get");
  await E.queueScheduled(shop, exp, new Date("2026-12-20T00:00:00Z"));
  assert.equal((await kinds()).filter((k) => k === "ready").length, 1, "nothing earned since: no new one");
  await prisma.loyaltyMember.update({ where: { id: m.id }, data: { lastActivity: new Date("2026-11-01T00:00:00Z") } });
  await E.queueScheduled(shop, exp, new Date("2026-12-20T00:00:00Z"));
  const e = await prisma.loyaltyEmail.findMany({ where: { shop, kind: "expiring" }, orderBy: { id: "asc" } });
  assert.equal(e.length, 2, "one for each time the points were about to expire");
  assert.equal(JSON.parse(e[1].data).date, "2026-12-31T00:00:00.000Z", "60 days after the last activity");
  await E.queueScheduled(shop, exp, new Date("2026-12-01T05:00:00Z"));
  assert.equal((await kinds()).filter((k) => k === "summary").length, 1);
  await E.queueScheduled(shop, exp, new Date("2026-12-01T06:00:00Z"));
  assert.equal((await kinds()).filter((k) => k === "summary").length, 1, "one a month");
});

test("tier and reward emails; privacy removes a member's emails and counts them", async () => {
  const E = await ml();
  const R = await import("../../app/lib/loyalty/rewards.server");
  const shop = "em6.myshopify.com";
  const c = withLoyaltyDefaults({ ...withEmails(), tiers: { ...DEFAULT_LOYALTY.tiers, on: true } });
  await P.syncOrder(shop, c, order({ id: "9601", subtotal: 700, createdAt: new Date().toISOString(), customer: who("960", "f@example.com") }));
  const m = await member(shop, "960");
  const tier = await prisma.loyaltyEmail.findFirstOrThrow({ where: { shop, kind: "tier" } });
  assert.equal(JSON.parse(tier.data).tier, "Silver");
  await R.redeem(fakeAdmin().admin, shop, c, m.id, "r1");
  const reward = await prisma.loyaltyEmail.findFirstOrThrow({ where: { shop, kind: "reward" } });
  assert.match(JSON.parse(reward.data).code, /^RWD-/);
  assert.deepEqual((await prisma.loyaltyEmail.findMany({ where: { shop }, orderBy: { id: "asc" } })).map((x) => x.kind), ["tier", "earned", "reward"]);
  assert.equal((await P.loyaltyHeldFor(shop, "960", "")).emails, 3);
  await E.sendQueued(storeAdmin(), shop, c, new Date(), fakeMail().provider);
  await P.redactLoyaltyCustomer(shop, "960", "");
  assert.equal(await prisma.loyaltyEmail.count({ where: { shop } }), 0);
});

/* ----------------------------------------------------------- integrations -- */
type I = typeof import("../../app/lib/loyalty/integrations.server");
const ig = (): Promise<I> => import("../../app/lib/loyalty/integrations.server");

/** A fake web for the services: answers by address, and keeps every call. */
function fakeWeb(answer: (url: string, init?: RequestInit) => { status: number; body?: unknown }) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const http = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const a = answer(url, init);
    return new Response(JSON.stringify(a.body ?? {}), { status: a.status });
  }) as typeof fetch;
  return { http, calls };
}

test("review points settings are cleaned", () => {
  const c = withLoyaltyDefaults({ earn: { review: { on: true, points: "75", photo: -4 } } });
  assert.deepEqual(c.earn.review, { on: true, points: 75, photo: 0 });
  assert.deepEqual(withLoyaltyDefaults(null).earn.review, { on: false, points: 50, photo: 50 });
});

test("connecting a service: a refused key is not saved; a good one is stored encrypted, shown by its last 4", async () => {
  const S = await ig();
  const shop = "in1.myshopify.com";
  const refused = fakeWeb(() => ({ status: 401 }));
  await assert.rejects(S.connect(shop, "klaviyo", "pk_wrongwrongwrong", refused.http), /Klaviyo refused this key/);
  await assert.rejects(S.connect(shop, "klaviyo", "short", refused.http), /Paste the private api key/);
  assert.equal(await prisma.loyaltyIntegration.count({ where: { shop } }), 0);
  const ok = fakeWeb(() => ({ status: 200 }));
  await S.connect(shop, "klaviyo", "pk_live_1234567890abcd", ok.http);
  const row = await prisma.loyaltyIntegration.findFirstOrThrow({ where: { shop, kind: "klaviyo" } });
  assert.equal(row.last4, "abcd");
  assert.doesNotMatch(row.key, /pk_live/);
  assert.equal((ok.calls[0].init?.headers as Record<string, string>).Authorization, "Klaviyo-API-Key pk_live_1234567890abcd");
  assert.deepEqual(await S.eventTargets(shop), ["klaviyo"]);
  const list = await S.integrationList(shop);
  assert.deepEqual([list.klaviyo.connected, list.klaviyo.last4, list.omnisend.connected], [true, "abcd", false]);
  // Judge.me starts after the newest review there now.
  const jm = fakeWeb(() => ({ status: 200, body: { reviews: [{ id: 40 }, { id: 42 }] } }));
  await S.connect(shop, "judgeme", "jm_token_123456", jm.http);
  assert.equal(JSON.parse((await prisma.loyaltyIntegration.findFirstOrThrow({ where: { shop, kind: "judgeme" } })).state).cursor, 42);
  assert.deepEqual(await S.eventTargets(shop), ["klaviyo"], "Judge.me gets no events");
  await S.setIntegrationOn(shop, "klaviyo", false);
  assert.deepEqual(await S.eventTargets(shop), []);
  await S.disconnect(shop, "klaviyo");
  assert.equal(await prisma.loyaltyIntegration.count({ where: { shop, kind: "klaviyo" } }), 1 - 1);
});

test("loyalty events go to Klaviyo and Omnisend even with emails off, once each, with the member's profile", async () => {
  const S = await ig();
  const E = await ml();
  const shop = "in2.myshopify.com";
  const ok = fakeWeb(() => ({ status: 200 }));
  await S.connect(shop, "klaviyo", "pk_live_aaaabbbbcccc", ok.http);
  await S.connect(shop, "omnisend", "omni_key_ddddeeee", ok.http);
  const c = cfg({ pendingDays: 0, referral: { ...DEFAULT_LOYALTY.referral, on: true } });
  await P.syncOrder(shop, c, order({ id: "9701", createdAt: new Date().toISOString(), customer: who("970", "g@example.com") }));
  const m = await member(shop, "970");
  const rows = await prisma.loyaltyOutbox.findMany({ where: { shop }, orderBy: { id: "asc" } });
  assert.deepEqual(rows.map((r) => `${r.target}:${r.kind}`), ["klaviyo:earned", "omnisend:earned"]);
  assert.equal(await prisma.loyaltyEmail.count({ where: { shop } }), 0, "emails are off");
  assert.equal(await E.notify(shop, c, m.id, "earned", {}, "earned:9701"), false, "queued once");

  const k = S.eventRequest("klaviyo", "pk_x", c, m, rows[0]);
  const kb = JSON.parse(k.init.body).data.attributes;
  assert.equal(k.url, "https://a.klaviyo.com/api/events");
  assert.equal(k.init.headers.revision, "2026-10-15");
  assert.equal(kb.metric.data.attributes.name, "Loyalty points earned");
  assert.equal(kb.profile.data.attributes.email, "g@example.com");
  assert.equal(kb.profile.data.attributes.properties["Loyalty points"], 50);
  assert.equal(kb.profile.data.attributes.properties["Loyalty referral code"], m.referralCode);
  assert.deepEqual([kb.properties.points, kb.properties.order, kb.properties.balance], [50, "#1001", 50]);
  assert.equal(kb.unique_id, `cro-loyalty-${rows[0].id}`);
  const o = S.eventRequest("omnisend", "omni", c, m, rows[1]);
  const ob = JSON.parse(o.init.body);
  assert.deepEqual([o.url, o.init.headers["X-API-KEY"], ob.eventName, ob.origin, ob.contact.email, ob.contact.customProperties.loyaltyPoints], ["https://api.omnisend.com/v5/events", "omni", "Loyalty points earned", "api", "g@example.com", 50]);

  const web = fakeWeb((url) => ({ status: url.includes("klaviyo") ? 202 : 401 }));
  await E.notify(shop, c, m.id, "tier", { tier: "Gold" }, "t-9701");
  const out = await S.sendEvents(shop, c, web.http);
  assert.deepEqual(out, { sent: 2, skipped: 1, failed: 1 }, "Omnisend refused once, its next event waits as not connected");
  const omni = await prisma.loyaltyIntegration.findFirstOrThrow({ where: { shop, kind: "omnisend" } });
  assert.deepEqual([omni.on, omni.error], [false, "Omnisend refused the key. Connect it again."]);
  assert.deepEqual(await S.eventTargets(shop), ["klaviyo"]);
  // Privacy: a member's events go with them.
  await P.redactLoyaltyCustomer(shop, "970", "");
  assert.equal(await prisma.loyaltyOutbox.count({ where: { shop } }), 0);
  await P.removeShopLoyalty(shop);
  assert.equal(await prisma.loyaltyIntegration.count({ where: { shop } }), 0);
});

test("review points: Judge.me reviews after the last read, more with a photo, never twice; approved app reviews once", async () => {
  const S = await ig();
  const shop = "in3.myshopify.com";
  const c = cfg({ pendingDays: 0, earn: { ...DEFAULT_LOYALTY.earn, review: { on: true, points: 50, photo: 25 } } });
  await P.syncOrder(shop, c, order({ id: "9801", customer: who("980", "h@example.com") }));
  const before = (await member(shop, "980")).points;
  await S.connect(shop, "judgeme", "jm_token_abcdef", fakeWeb(() => ({ status: 200, body: { reviews: [{ id: 10 }] } })).http);
  const reviews = [
    { id: 9, reviewer: { email: "h@example.com" } },
    { id: 11, reviewer: { email: "H@example.com" }, pictures: [{ urls: {} }] },
    { id: 12, reviewer: { email: "h@example.com" }, curated: "spam" },
    { id: 13, reviewer: { email: "h@example.com" }, hidden: true },
    { id: 14, reviewer: { email: "nobody@example.com" } },
    { id: 15, reviewer: { email: "h@example.com" } },
  ];
  const web = fakeWeb((url) => ({ status: 200, body: { reviews: url.includes("page=1") ? reviews : [] } }));
  assert.equal(await S.judgeMeReviews(shop, cfg(), web.http), 0, "review points off: Judge.me isn't read");
  assert.equal(web.calls.length, 0);
  assert.equal(await S.judgeMeReviews(shop, c, web.http), 2, "reviews 11 and 15");
  assert.match(web.calls[0].url, /published=true/);
  assert.equal((await member(shop, "980")).points, before + 75 + 50, "review 11 with a photo, review 15");
  assert.equal(await S.judgeMeReviews(shop, c, web.http), 0, "nothing twice");
  assert.equal(JSON.parse((await prisma.loyaltyIntegration.findFirstOrThrow({ where: { shop, kind: "judgeme" } })).state).cursor, 15);
  const own = await S.approvedReviewPoints(shop, c, "gid://shopify/Metaobject/1", "h@example.com");
  assert.ok(own);
  assert.equal(await S.approvedReviewPoints(shop, c, "gid://shopify/Metaobject/1", "h@example.com"), null, "once per review");
  assert.equal(await S.approvedReviewPoints(shop, cfg(), "gid://shopify/Metaobject/2", "h@example.com"), null, "review points off");
  assert.equal((await member(shop, "980")).points, before + 75 + 50 + 50);
});

/* -------------------------------------------------------------- Flow --- */
/** A fake Admin API for Flow: the plan, a customer to look up, and the triggers sent. */
function flowAdmin(o: { plan?: string; customer?: Record<string, unknown> | null } = {}) {
  const triggers: Record<string, unknown>[] = [];
  const admin = {
    graphql: async (query: string, opts?: { variables?: Record<string, unknown> }) => {
      const v = opts?.variables ?? {};
      let data: Record<string, unknown> = {};
      if (query.includes("CroActiveSubscriptions")) data = { currentAppInstallation: { activeSubscriptions: [{ name: o.plan ?? "Pro", status: "ACTIVE", trialDays: 0, createdAt: "2026-01-01T00:00:00Z" }] } };
      else if (query.includes("CroFlowCustomer")) data = { customer: o.customer === undefined ? { locale: "en", tags: [], defaultEmailAddress: { emailAddress: "Flow@Example.com", marketingState: "SUBSCRIBED" } } : o.customer };
      else if (query.includes("flowTriggerReceive")) {
        triggers.push(v);
        data = { flowTriggerReceive: { userErrors: [] } };
      }
      return new Response(JSON.stringify({ data }));
    },
  };
  return { admin: admin as never, triggers };
}

test("Flow calls are checked against the app's secret", async () => {
  const S = await ig();
  const { createHmac } = await import("node:crypto");
  const prev = process.env.SHOPIFY_API_SECRET;
  process.env.SHOPIFY_API_SECRET = "flow-secret";
  const raw = JSON.stringify({ a: 1 });
  const good = createHmac("sha256", "flow-secret").update(raw).digest("base64");
  assert.equal(S.flowSigned(raw, good), true);
  assert.equal(S.flowSigned(raw + " ", good), false);
  assert.equal(S.flowSigned(raw, null), false);
  process.env.SHOPIFY_API_SECRET = prev;
});

test("Flow triggers: sent only while a workflow uses them, for the events Flow has, with the customer", async () => {
  const S = await ig();
  const shop = "fl1.myshopify.com";
  const c = cfg({ pendingDays: 0 });
  await P.syncOrder(shop, c, order({ id: "9901", createdAt: new Date().toISOString(), customer: who("991", "f1@example.com") }));
  assert.equal(await prisma.loyaltyOutbox.count({ where: { shop } }), 0, "no workflow yet");
  await S.flowLifecycle(shop, { flow_trigger_definition_id: "d1", has_enabled_flow: true, timestamp: "2026-10-22T10:00:00Z" });
  await S.flowLifecycle(shop, { flow_trigger_definition_id: "d1", has_enabled_flow: false, timestamp: "2026-10-22T09:00:00Z" });
  assert.deepEqual(await S.eventTargets(shop), ["flow"], "older news is ignored");
  const m = await member(shop, "991");
  const E = await ml();
  await E.notify(shop, c, m.id, "earned", { points: 50, order: "#9901" }, "e1");
  await E.notify(shop, c, m.id, "welcome", {}, "w1");
  await E.notify(shop, c, m.id, "tier", { tier: "Gold" }, "t1");
  assert.deepEqual((await prisma.loyaltyOutbox.findMany({ where: { shop }, orderBy: { id: "asc" } })).map((r) => r.kind), ["earned", "tier"], "Flow has no welcome trigger");
  const fa = flowAdmin();
  assert.deepEqual(await S.sendEvents(shop, c, fetch, new Date(), fa.admin), { sent: 2, skipped: 0, failed: 0 });
  assert.deepEqual(fa.triggers, [
    { handle: "loyalty-points-earned", payload: { customer_id: 991, Points: 50, Balance: m.points, "Order name": "#9901" } },
    { handle: "loyalty-tier-changed", payload: { customer_id: 991, Tier: "Gold", "Moved up": true } },
  ]);
  await S.flowLifecycle(shop, { flow_trigger_definition_id: "d1", has_enabled_flow: false, timestamp: "2026-10-22T11:00:00Z" });
  assert.deepEqual(await S.eventTargets(shop), []);
});

test("Flow's Add loyalty points: once per run, takes points away with a negative number, makes the member, says why it can't", async () => {
  const S = await ig();
  const shop = "fl2.myshopify.com";
  const run = (props: Record<string, unknown>, id = "run1", fa = flowAdmin()) => S.flowAddPoints(fa.admin, shop, { handle: "loyalty-add-points", action_run_id: id, properties: props });
  await P.saveProgramConfig(shop, { pendingDays: 0, excludeTags: "wholesale" });
  assert.deepEqual(await run({ customer_id: "gid://shopify/Customer/5", points: 100 }), { status: 422, message: "The loyalty program is off in CRO Toolbox." });
  await P.setProgramOn(shop, true);
  assert.equal((await run({ customer_id: "gid://shopify/Customer/5", points: 0 })).message, "Points must be a whole number other than 0.");
  assert.equal((await S.flowAddPoints(flowAdmin().admin, shop, { handle: "other" })).status, 400);
  assert.deepEqual(await run({ customer_id: "gid://shopify/Customer/5", points: 100, note: "First review" }), { status: 200, message: "" });
  assert.deepEqual(await run({ customer_id: "gid://shopify/Customer/5", points: 100, note: "First review" }), { status: 200, message: "" }, "Flow retried the same run");
  const m = await member(shop, "5");
  assert.deepEqual([m.points, m.email, m.emailMarketing], [100, "flow@example.com", true]);
  await run({ customer_id: 5, points: -30 }, "run2");
  assert.equal((await member(shop, "5")).points, 70);
  const ev = await prisma.loyaltyEvent.findFirstOrThrow({ where: { shop, kind: "flow", points: 100 } });
  assert.equal(ev.note, "First review");
  assert.equal((await run({ customer_id: 6, points: 10 }, "run3", flowAdmin({ customer: { locale: "", tags: ["Wholesale"], defaultEmailAddress: null } }))).message, "This customer has a tag that keeps them out of the loyalty program.");
});

/* ------------------------------------------------------------- plans ---- */
test("Growth runs loyalty without the Pro parts (kept for an upgrade)", async () => {
  const { forPlan } = await import("../../app/lib/loyalty/config");
  const { accessFor, planned } = await import("../../app/lib/loyalty/plan.server");
  const full = withLoyaltyDefaults({
    tiers: { on: true },
    campaigns: [{ name: "Double", multiplier: 2, from: "2026-11-01", to: "2026-11-30" }],
    productRules: [{ kind: "products", items: [{ id: "gid://shopify/Product/1", title: "A" }], perUnit: 2 }],
    cashback: { on: true, percent: 5 },
    affiliates: [{ id: "a1", code: "SARAH10" }],
    emails: { on: true, sender: { email: "hi@sara.test" } },
  });
  assert.equal(forPlan(full, true), full, "Pro: everything as saved");
  const g = forPlan(full, false);
  assert.deepEqual([g.tiers.on, g.campaigns.length, g.productRules.length, g.cashback.on, g.affiliates[0].on, g.affiliates[0].code, g.emails.sender.email, g.emails.on], [false, 0, 0, false, false, "SARAH10", "", true]);
  assert.equal(full.tiers.on, true, "the saved settings are not changed");
  assert.deepEqual(accessFor("growth"), { plan: "growth", on: true, pro: false, ordersExtra: false, emailsExtra: false });
  assert.equal(accessFor("starter").on, false);
  assert.deepEqual(planned(full, accessFor("pro", { loyaltyOrders: true })).usage, { plan: "pro", ordersExtra: true, emailsExtra: false });
});

test("loyalty orders a month: past the plan's limit orders earn nothing, unless the store allows extra (then each is billed once)", async () => {
  const { planned, accessFor } = await import("../../app/lib/loyalty/plan.server");
  const { PLANS } = await import("../../app/lib/plans");
  const U = await import("../../app/lib/usage.server");
  const shop = "pl1.myshopify.com";
  const was = PLANS.growth.limits.loyaltyOrders;
  PLANS.growth.limits.loyaltyOrders = 1;
  try {
    const c = planned(cfg({ pendingDays: 0 }), accessFor("growth"));
    const now = new Date();
    await P.syncOrder(shop, c, order({ id: "1", createdAt: now.toISOString(), customer: who("1", "a@example.com") }), now);
    assert.equal(await P.syncOrder(shop, c, order({ id: "2", createdAt: now.toISOString(), customer: who("1", "a@example.com") }), now), null, "the second order of the month earns nothing");
    assert.equal((await member(shop, "1")).points, 50);
    await U.setExtra(shop, "loyaltyOrders", true);
    const extra = planned(cfg({ pendingDays: 0 }), accessFor("growth", await U.extrasFor(shop)));
    await P.syncOrder(shop, extra, order({ id: "3", createdAt: now.toISOString(), customer: who("1", "a@example.com") }), now);
    await P.syncOrder(shop, extra, order({ id: "3", createdAt: now.toISOString(), customer: who("1", "a@example.com") }), now);
    assert.equal((await member(shop, "1")).points, 100);
    assert.equal(await prisma.usageEvent.count({ where: { shop, meter: "loyaltyOrders" } }), 1, "billed once");
    const bars = await U.usageSummary(shop, "growth");
    const orders = bars.find((b) => b.meter === "loyaltyOrders")!;
    assert.deepEqual([orders.used, orders.limit, orders.extra, orders.over, orders.price, orders.per], [2, 1, true, 1, 5, 100]);
    assert.deepEqual(bars.map((b) => b.meter), ["liveShipments", "loyaltyOrders", "loyaltyEmails"]);
    assert.deepEqual(await U.usageSummary(shop, "starter"), [], "no bars below Growth");
  } finally {
    PLANS.growth.limits.loyaltyOrders = was;
  }
});

test("past orders counted when the program starts earn points but never use the month's limit or get billed (audit 2026-10-23)", async () => {
  const { planned, accessFor } = await import("../../app/lib/loyalty/plan.server");
  const { PLANS } = await import("../../app/lib/plans");
  const U = await import("../../app/lib/usage.server");
  const shop = "pl3.myshopify.com";
  const was = PLANS.growth.limits.loyaltyOrders;
  PLANS.growth.limits.loyaltyOrders = 1;
  try {
    await U.setExtra(shop, "loyaltyOrders", true);
    const c = planned(cfg({ pendingDays: 0 }), accessFor("growth", await U.extrasFor(shop)));
    const now = new Date();
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 5 * 86_400_000).toISOString();
    // Three orders from before this month (the "last 90 days" when the program starts), then one new order.
    for (const id of ["p1", "p2", "p3"]) await P.syncOrder(shop, c, order({ id, createdAt: lastMonth, customer: who("9", "past@example.com") }), now);
    await P.syncOrder(shop, c, order({ id: "new1", createdAt: now.toISOString(), customer: who("9", "past@example.com") }), now);
    assert.equal((await member(shop, "9")).points, 200, "all four earn");
    assert.equal(await U.usedThisMonth(shop, "loyaltyOrders", now), 1, "only this month's order counts");
    assert.equal(await prisma.usageEvent.count({ where: { shop, meter: "loyaltyOrders" } }), 0, "nothing billed: the new order is within the limit");
    const past = await prisma.loyaltyEvent.findFirstOrThrow({ where: { shop, orderId: "p1", kind: "order" } });
    assert.equal(past.createdAt.toISOString(), lastMonth, "a past order's row is dated when the order was placed");
  } finally {
    PLANS.growth.limits.loyaltyOrders = was;
  }
});

test("one new order read twice at once counts as one order (audit 2026-10-23)", async () => {
  const shop = "twice.myshopify.com";
  const c = cfg({ pendingDays: 0 });
  const o = order({ id: "t1", createdAt: new Date().toISOString(), customer: who("5", "twice@example.com") });
  await Promise.all([P.syncOrder(shop, c, o), P.syncOrder(shop, c, o)]);
  const m = await member(shop, "5");
  assert.equal(m.points, 50);
  assert.equal(m.orders, 1);
});

test("units over a limit go to Shopify App Pricing once each, as billable events", async () => {
  const U = await import("../../app/lib/usage.server");
  const shop = "pl2.myshopify.com";
  const now = new Date();
  assert.equal(await U.allowUnit(shop, "growth", "liveShipments", 10, "ship:A"), true, "within the limit");
  assert.equal(await U.allowUnit(shop, "growth", "liveShipments", 200, "ship:B"), false, "at the limit, extra off");
  await U.setExtra(shop, "liveShipments", true);
  assert.equal(await U.allowUnit(shop, "growth", "liveShipments", 200, "ship:B"), true);
  assert.equal(await U.allowUnit(shop, "starter", "liveShipments", 0, "ship:C"), false, "not on Starter at all");
  const calls: { url: string; body: Record<string, unknown>; agent: string }[] = [];
  const http = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")), agent: String((init?.headers as Record<string, string> | undefined)?.["User-Agent"] ?? "") });
    return new Response(JSON.stringify(url.includes("access_token") ? { access_token: "tok", expires_in: 3600 } : {}), { status: url.includes("access_token") ? 200 : 202 });
  }) as typeof fetch;
  assert.equal(await U.reportUsage(async () => "123", http, now), 0, "no App Events key yet: kept queued");
  process.env.APP_EVENTS_CLIENT_ID = "id";
  process.env.APP_EVENTS_CLIENT_SECRET = "secret";
  try {
    assert.ok((await U.reportUsage(async () => "123", http, now)) >= 1, "every store's queued units");
    const ev = calls.find((c) => c.url.endsWith("/events") && c.body.event_handle === "live-shipments")!;
    assert.equal(ev.url, "https://api.shopify.com/app/2026-10/events");
    assert.deepEqual([ev.body.event_handle, (ev.body.attributes as { value: number }).value, ev.body.shop_id], ["live-shipments", 1, "123"]);
    assert.equal(String(ev.body.idempotency_key).length <= 64, true);
    assert.ok(calls.every((c) => c.agent.startsWith("CRO Toolbox")), "every call names the app (Shopify can answer 403 without it)");
    assert.equal(await U.reportUsage(async () => "123", http, now), 0, "sent once");
  } finally {
    delete process.env.APP_EVENTS_CLIENT_ID;
    delete process.env.APP_EVENTS_CLIENT_SECRET;
  }
});

test("every email shows the store's postal address under the small print (CAN-SPAM)", async () => {
  const { renderEmail, DEFAULT_EMAILS } = await import("../../app/lib/loyalty/emails");
  const r = renderEmail(DEFAULT_EMAILS, "expiring", { name: "Sara Shop", url: "https://sara.example", address: "12 Nile St, Cairo, Egypt" }, { balance: "500 points", date: "December 1" }, "https://u.example");
  assert.match(r.html, /Sara Shop, 12 Nile St, Cairo, Egypt<br><a href="https:\/\/u\.example"/);
  assert.match(r.text, /Sara Shop, 12 Nile St, Cairo, Egypt\nUnsubscribe/);
});
