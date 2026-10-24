/**
 * Loyalty → Points shop (Omar, 2026-10-24): settings cleaning, who sees which product, and getting one: points taken
 * all or nothing, the variant read from Shopify, the limit per customer, the code's amount for points only and points
 * plus money, and points given back when Shopify refuses. Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_LOYALTY, canSeeItem, shopFor, toStorefrontLoyalty, withLoyaltyDefaults, type LoyaltyConfig, type ShopItem } from "../../app/lib/loyalty/config";
import { eventLabel } from "../../app/lib/loyalty/labels";

Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });
// The database is set before anything that imports it.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "points-shop-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
let P: typeof import("../../app/lib/loyalty/program.server");
let S: typeof import("../../app/lib/loyalty/shop.server");
before(async () => {
  for (const m of ["20261019000000_tracking", "20261027000000_loyalty_core", "20261028000000_loyalty_rewards", "20261029000000_loyalty_tiers", "20261030000000_loyalty_referrals", "20261031000000_loyalty_emails", "20261101000000_loyalty_integrations", "20261102000000_usage_extras", "20261103000000_loyalty_account_metafield", "20261106000000_loyalty_count_from"]) {
    const sql = fs.readFileSync(`prisma/migrations/${m}/migration.sql`, "utf8");
    for (const stmt of sql.split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  }
  P = await import("../../app/lib/loyalty/program.server");
  S = await import("../../app/lib/loyalty/shop.server");
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

const item = (o: Partial<ShopItem> = {}): ShopItem => ({
  id: "s1", on: true, product: { id: "gid://shopify/Product/9", title: "Watch", handle: "watch", image: "", price: 50 },
  points: 800, money: 0, only: false, unlisted: false, show: "all", from: 400, limit: 0, ...o,
});
const cfg = (items: ShopItem[], patch: Partial<LoyaltyConfig> = {}): LoyaltyConfig => ({ ...DEFAULT_LOYALTY, pendingDays: 0, shop: { on: true, days: 30, items, collection: false }, ...patch });

type Call = { query: string; variables: Record<string, unknown> };
/** Shopify as the tests need it: variant 91 of product 9 costs 50 (92 is sold out, 93 belongs to product 8). */
function fakeAdmin(fail = false) {
  const calls: Call[] = [];
  const variants: Record<string, unknown> = {
    "gid://shopify/ProductVariant/91": { id: "gid://shopify/ProductVariant/91", price: "50.00", availableForSale: true, product: { id: "gid://shopify/Product/9", status: "ACTIVE" } },
    "gid://shopify/ProductVariant/92": { id: "gid://shopify/ProductVariant/92", price: "50.00", availableForSale: false, product: { id: "gid://shopify/Product/9", status: "ACTIVE" } },
    "gid://shopify/ProductVariant/93": { id: "gid://shopify/ProductVariant/93", price: "20.00", availableForSale: true, product: { id: "gid://shopify/Product/8", status: "ACTIVE" } },
  };
  const admin = {
    graphql: async (query: string, opts?: { variables?: Record<string, unknown> }) => {
      const variables = opts?.variables ?? {};
      calls.push({ query, variables });
      const data = query.includes("CroPointsVariant")
        ? { productVariant: variants[String(variables.id)] ?? null }
        : { discountCodeBasicCreate: { codeDiscountNode: fail ? null : { id: "gid://shopify/DiscountCodeNode/1" }, userErrors: fail ? [{ message: "Code taken" }] : [] } };
      return new Response(JSON.stringify({ data }));
    },
  };
  return { admin: admin as never, calls };
}
const order = (id: string, customer: string, subtotal: number) => ({ id, name: `#${id}`, createdAt: "2026-10-20T10:00:00Z", customer: { id: customer, email: `${customer}@example.com`, firstName: "", locale: "en", tags: [] }, paid: true, cancelled: false, subtotal, shipping: 0, taxes: 0 });
const member = (shop: string, customerId: string) => prisma.loyaltyMember.findUniqueOrThrow({ where: { shop_customerId: { shop, customerId } } });

test("Points shop settings are cleaned: products, money below the price, visibility, unique products", () => {
  const c = withLoyaltyDefaults({ shop: { on: true, days: 900, items: [
    { id: "a", product: { id: "gid://shopify/Product/1", title: "One", price: "20", image: "http://insecure.example/x.png" }, points: 0, money: 25, show: "nope", from: 99999, limit: -2, unlisted: true },
    { id: "b", product: { id: "not a product" } },
    { id: "c", product: { id: "gid://shopify/Product/1", title: "Same product" } },
    { id: "d", product: { id: "gid://shopify/Product/2", title: "Two", price: 30 }, points: 500, money: 10, only: true, unlisted: true, show: "from", from: 200, limit: 2 },
  ] } });
  assert.equal(c.shop.on, true);
  assert.equal(c.shop.days, 365);
  assert.deepEqual(c.shop.items.map((x) => x.id), ["a", "d"]);
  const [a, d] = c.shop.items;
  assert.equal(a.points, 1);
  assert.equal(a.money, 0, "the money part is always less than the price");
  assert.equal(a.show, "all");
  assert.equal(a.from, 1);
  assert.equal(a.limit, 0);
  assert.equal(a.product.image, "");
  assert.equal(a.unlisted, false, "hidden only for products sold only with points");
  assert.deepEqual([d.money, d.only, d.unlisted, d.show, d.from, d.limit], [10, true, true, "from", 200, 2]);
  assert.deepEqual(withLoyaltyDefaults({}).shop, { on: false, days: 30, items: [], collection: false });
});

test("who sees what: everyone, members with enough points, members from a number of points", () => {
  const all = item({ id: "all" }), afford = item({ id: "afford", show: "afford" }), from = item({ id: "from", show: "from", from: 400 }), off = item({ id: "off", on: false });
  const c = cfg([all, afford, from, off]);
  const ids = (points: number | null) => shopFor(c, points).map((x) => x.id);
  assert.deepEqual(ids(null), ["all"], "guests");
  assert.deepEqual(ids(100), ["all"]);
  assert.deepEqual(ids(400), ["all", "from"]);
  assert.deepEqual(ids(800), ["all", "afford", "from"]);
  assert.equal(canSeeItem(off, 10_000), false);
  // The public storefront copy holds only what everyone sees, and nothing when the shop is off.
  assert.deepEqual(toStorefrontLoyalty(c, true).ps?.map((x) => x.id), ["all"]);
  assert.equal(toStorefrontLoyalty({ ...c, shop: { ...c.shop, on: false } }, true).ps, undefined);
  assert.deepEqual(shopFor(c, null)[0], { id: "all", t: "Watch", h: "watch", i: "", p: 800, m: 0, pid: "9", o: false });
});

test("the code takes the variant's price minus the money part off one item of that variant, for this customer only", () => {
  const end = new Date("2026-12-01T00:00:00Z");
  const x = S.shopDiscountInput(item({ money: 10 }), "PTS-1", "gid://shopify/Customer/7", "gid://shopify/ProductVariant/91", 40, end);
  assert.deepEqual(x.customerGets, { value: { discountAmount: { amount: "40.00", appliesOnEachItem: false } }, items: { products: { productVariantsToAdd: ["gid://shopify/ProductVariant/91"] } } });
  assert.deepEqual(x.context, { customers: { add: ["gid://shopify/Customer/7"] } });
  assert.equal(x.usageLimit, 1);
  assert.equal(x.endsAt, end.toISOString());
});

test("getting a product: points all or nothing, the variant from Shopify, the limit, points back when Shopify refuses", async () => {
  const shop = "ps.myshopify.com";
  const c = cfg([item({ limit: 1 }), item({ id: "s2", product: { ...item().product, id: "gid://shopify/Product/8" }, points: 100, money: 5 }), item({ id: "hid", show: "afford", points: 5000 })]);
  await P.syncOrder(shop, c, order("2001", "500", 1000));
  const m = await member(shop, "500");
  assert.equal(m.points, 1000);

  const ok = fakeAdmin();
  await assert.rejects(S.buy(ok.admin, shop, c, m.id, "s1", "93"), /isn't part of this product/, "a variant of another product");
  await assert.rejects(S.buy(ok.admin, shop, c, m.id, "s1", "92"), /sold out/);
  await assert.rejects(S.buy(ok.admin, shop, c, m.id, "s1", "abc"), /Choose an option/);
  await assert.rejects(S.buy(ok.admin, shop, c, m.id, "hid", "91"), /isn't available/, "hidden from members without enough points");
  await assert.rejects(S.buy(ok.admin, shop, c, m.id, "nope", "91"), /isn't available/);
  assert.equal((await member(shop, "500")).points, 1000, "nothing taken so far");

  // Points only: the whole price comes off.
  const got = await S.buy(ok.admin, shop, c, m.id, "s1", "gid://shopify/ProductVariant/91");
  assert.match(got.code, /^PTS-[0-9A-F]{8}$/);
  assert.equal(got.variant, "91");
  assert.equal((await member(shop, "500")).points, 200);
  const create = ok.calls.find((x) => x.query.includes("discountCodeBasicCreate"))!;
  assert.equal((create.variables.d as { customerGets: { value: { discountAmount: { amount: string } } } }).customerGets.value.discountAmount.amount, "50.00");
  const reward = await prisma.loyaltyReward.findFirstOrThrow({ where: { shop, memberId: m.id } });
  assert.deepEqual([reward.kind, reward.points, reward.value, reward.code], ["shop", 800, 50, got.code]);
  const ev = await prisma.loyaltyEvent.findFirstOrThrow({ where: { shop, memberId: m.id, kind: "shop" } });
  assert.equal(eventLabel(ev.kind, ev.note), "Bought with points: Watch");

  // The limit per customer, then not enough points.
  await P.adjustPoints(shop, m.id, 1000, "test");
  await assert.rejects(S.buy(ok.admin, shop, c, m.id, "s1", "91"), /already got this product/);
  await P.adjustPoints(shop, m.id, -1150, "test");
  await assert.rejects(S.buy(ok.admin, shop, c, m.id, "s2", "93"), S.NotEnoughPoints);
  await P.adjustPoints(shop, m.id, 100, "test");

  // Points plus money: the price (20) minus the money part (5) comes off.
  const two = fakeAdmin();
  await S.buy(two.admin, shop, c, m.id, "s2", "93");
  const code2 = two.calls.find((x) => x.query.includes("discountCodeBasicCreate"))!;
  assert.equal((code2.variables.d as { customerGets: { value: { discountAmount: { amount: string } } } }).customerGets.value.discountAmount.amount, "15.00");
  assert.equal((await member(shop, "500")).points, 50);

  // Shopify refuses: the points come back and the refused try doesn't count toward the limit.
  await P.adjustPoints(shop, m.id, 50, "test");
  const before = (await member(shop, "500")).points;
  await assert.rejects(S.buy(fakeAdmin(true).admin, shop, c, m.id, "s2", "93"), /Code taken/);
  assert.equal((await member(shop, "500")).points, before, "points given back");
  await S.buy(fakeAdmin().admin, shop, c, m.id, "s2", "93");
  assert.equal((await member(shop, "500")).points, before - 100);
});

test("blocked members and a shop that is off can't get products", async () => {
  const shop = "ps2.myshopify.com";
  const c = cfg([item()]);
  await P.syncOrder(shop, c, order("2002", "501", 1000));
  const m = await member(shop, "501");
  await assert.rejects(S.buy(fakeAdmin().admin, shop, { ...c, shop: { ...c.shop, on: false } }, m.id, "s1", "91"), /isn't available/);
  await prisma.loyaltyMember.update({ where: { id: m.id }, data: { blocked: true } });
  await assert.rejects(S.buy(fakeAdmin().admin, shop, c, m.id, "s1", "91"), /can't use rewards/);
});

test("points spent in the Points shop count as spent, never as earned", async () => {
  const { summarize } = await import("../../app/lib/loyalty/analytics.server");
  const now = new Date("2026-10-24T12:00:00Z");
  const at = new Date("2026-10-23T12:00:00Z");
  const s = summarize({ members: [], events: [{ kind: "order", points: 1000, createdAt: at }, { kind: "shop", points: -800, createdAt: at }, { kind: "redeem_back", points: 100, createdAt: at }], rewards: [], codes: [], referrals: [], orders: [] } as never, 30, now);
  assert.equal(s.points.earned, 1000);
  assert.equal(s.points.spent, 700);
});

/** Shopify for the only with points sync: our validations (`guard`), product statuses, and every call made. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function storeAdmin(guard: { id: string; enabled: boolean } | null, status: Record<string, string>, coll: { id: string; products: string[]; input?: any } = { id: "", products: [] }) {
  const calls: { op: string; vars: Record<string, any> }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const admin = {
    graphql: async (query: string, o?: { variables?: Record<string, any> }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const op = /(?:mutation|query)\s+(\w+)/.exec(query)?.[1] ?? "";
      const vars = o?.variables ?? {};
      calls.push({ op, vars });
      const data = op === "CroBundleGuard"
        ? { validations: { nodes: guard ? [{ id: guard.id, title: "CRO Toolbox points guard", enabled: guard.enabled, shopifyFunction: { app: { apiKey: "k" } } }] : [] } }
        : op === "CroGuardCreate" ? { validationCreate: { validation: { id: "gid://shopify/Validation/5" }, userErrors: [] } }
          : op === "CroGuardSet" ? { metafieldsSet: { userErrors: [] } }
            : op === "CroGuardOn" || op === "CroGuardOff" ? { validationUpdate: { userErrors: [] } }
              : op === "CroPointsStatus" ? { nodes: (vars.ids as string[]).map((id) => (status[id] ? { id, status: status[id] } : null)) }
                : op === "CroPointsListed" ? (status[vars.p.id] = vars.p.status, { productUpdate: { product: { id: vars.p.id }, userErrors: [] } })
                  : op === "CroPointsCollection" ? { collection: coll.id === vars.id ? { id: coll.id, products: { nodes: coll.products.map((id) => ({ id })) } } : null }
                    : op === "CroPointsCollectionCreate" ? (Object.assign(coll, { id: "gid://shopify/Collection/1", products: [], input: vars.c }), { collectionCreate: { collection: { id: coll.id }, userErrors: [] } })
                      : op === "CroPointsCollectionAdd" ? (coll.products.push(...vars.ids), { collectionAddProducts: { userErrors: [] } })
                        : op === "CroPointsCollectionRemove" ? (coll.products = coll.products.filter((p) => !vars.ids.includes(p)), { collectionRemoveProducts: { userErrors: [] } })
                          : op === "CroPointsCollectionDelete" ? (coll.id = "", { collectionDelete: { userErrors: [] } })
                            : op === "CroPublications" ? { publications: { nodes: [{ id: "gid://shopify/Publication/1", channels: { nodes: [{ handle: "online_store", name: "Online Store" }] } }] } }
                              : op === "CroPublish" ? { publishablePublish: { userErrors: [] } }
                  : {};
      return new Response(JSON.stringify({ data }));
    },
  };
  return { admin: admin as never, calls };
}

test("only with points: the guard lists those products with their money part; hidden ones are unlisted and come back", async () => {
  const shop = "only.myshopify.com";
  await prisma.loyaltyProgram.create({ data: { shop, on: true, state: JSON.stringify({ referral: { id: "keep me" } }) } });
  const P9 = "gid://shopify/Product/9", P8 = "gid://shopify/Product/8", P7 = "gid://shopify/Product/7";
  const status: Record<string, string> = { [P9]: "ACTIVE", [P8]: "ACTIVE", [P7]: "UNLISTED" };
  const items = [
    item({ id: "a", only: true, unlisted: true }),
    item({ id: "b", product: { ...item().product, id: P8 }, only: true, money: 10 }),
    item({ id: "c", product: { ...item().product, id: P7 }, only: true, unlisted: true }), // the merchant unlisted it before
  ];
  const first = storeAdmin(null, status);
  await S.syncPointsShop(first.admin, shop, cfg(items), true);
  const made = first.calls.find((x) => x.op === "CroGuardCreate")!.vars.input;
  assert.equal(made.functionHandle, "cro-validation");
  assert.equal(made.title, "CRO Toolbox points guard");
  assert.deepEqual(JSON.parse(made.metafields[0].value), { points: [{ p: P9, m: 0 }, { p: P8, m: 10 }, { p: P7, m: 0 }] });
  assert.deepEqual(status, { [P9]: "UNLISTED", [P8]: "ACTIVE", [P7]: "UNLISTED" });
  const state = JSON.parse((await prisma.loyaltyProgram.findUniqueOrThrow({ where: { shop } })).state);
  assert.deepEqual(state, { referral: { id: "keep me" }, pointsGuard: true, pointsHidden: [P9] }, "only what the app unlisted is kept; other state stays");

  // Hiding switched off for the watch, and the program stops (plan or switch): everything goes back, the guard turns off.
  const second = storeAdmin({ id: "gid://shopify/Validation/5", enabled: true }, status);
  await S.syncPointsShop(second.admin, shop, cfg(items), false);
  assert.ok(second.calls.some((x) => x.op === "CroGuardOff"));
  assert.deepEqual(status, { [P9]: "ACTIVE", [P8]: "ACTIVE", [P7]: "UNLISTED" }, "the merchant's own unlisted product stays unlisted");
  assert.deepEqual(JSON.parse((await prisma.loyaltyProgram.findUniqueOrThrow({ where: { shop } })).state).pointsHidden, []);

  // Nothing sold only with points and nothing made before: Shopify isn't called at all.
  const none = storeAdmin(null, status);
  await S.syncPointsShop(none.admin, shop, cfg([item()]), true);
  assert.deepEqual(none.calls.map((x) => x.op), []);
});

test("the storefront copy lists the products sold only with points", () => {
  const c = cfg([item({ only: true, show: "afford" }), item({ id: "s2", product: { ...item().product, id: "gid://shopify/Product/8" } }), item({ id: "s3", on: false, only: true, product: { ...item().product, id: "gid://shopify/Product/7" } })]);
  const sf = toStorefrontLoyalty(c, true);
  assert.deepEqual(sf.po, ["9"]);
  assert.deepEqual(sf.ps?.map((x) => x.id), ["s2"]);
});

test("the Points shop collection: made and published with the listed products, kept in step, emptied when off, deleted with the option", async () => {
  const shop = "coll.myshopify.com";
  await prisma.loyaltyProgram.create({ data: { shop, on: true } });
  const P9 = "gid://shopify/Product/9", P8 = "gid://shopify/Product/8", P7 = "gid://shopify/Product/7";
  const status = { [P9]: "ACTIVE", [P8]: "ACTIVE", [P7]: "ACTIVE" };
  const coll = { id: "", products: [] as string[] } as { id: string; products: string[]; input?: { title: string } };
  const items = [item(), item({ id: "b", product: { ...item().product, id: P8 }, only: true, unlisted: true }), item({ id: "c", on: false, product: { ...item().product, id: P7 } })];
  const c = { ...cfg(items), shop: { ...cfg(items).shop, collection: true } };
  const one = storeAdmin(null, status, coll);
  await S.syncPointsShop(one.admin, shop, c, true);
  assert.equal(coll.input?.title, "Points shop");
  assert.deepEqual(coll.products, [P9], "on and not hidden only");
  assert.ok(one.calls.some((x) => x.op === "CroPublish" && x.vars.id === "gid://shopify/Collection/1"), "published to the Online Store");
  const st = () => prisma.loyaltyProgram.findUniqueOrThrow({ where: { shop } }).then((r) => JSON.parse(r.state));
  assert.equal((await st()).pointsCollection, "gid://shopify/Collection/1");

  // A product switched on and the hidden one shown: added; the shop off: emptied, but kept.
  const on = [item(), item({ id: "b", product: { ...item().product, id: P8 }, only: true }), item({ id: "c", product: { ...item().product, id: P7 } })];
  await S.syncPointsShop(storeAdmin(null, status, coll).admin, shop, { ...c, shop: { ...c.shop, items: on } }, true);
  assert.deepEqual(coll.products.sort(), [P7, P8, P9]);
  await S.syncPointsShop(storeAdmin(null, status, coll).admin, shop, { ...c, shop: { ...c.shop, items: on, on: false } }, true);
  assert.deepEqual(coll.products, []);
  assert.equal(coll.id, "gid://shopify/Collection/1");

  // The option off: the app's collection is deleted.
  await S.syncPointsShop(storeAdmin(null, status, coll).admin, shop, { ...c, shop: { ...c.shop, collection: false } }, true);
  assert.equal(coll.id, "");
  assert.equal((await st()).pointsCollection, "");
});
