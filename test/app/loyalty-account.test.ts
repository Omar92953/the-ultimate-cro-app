/** Loyalty part 9: the metafields the customer account, checkout and POS extensions read, and the counter helpers. Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import type { AdminClient } from "../../app/lib/admin.server";
import { DEFAULT_LOYALTY, type LoyaltyConfig } from "../../app/lib/loyalty/config";
import { memberPayload, shopPayload } from "../../app/lib/loyalty/account";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loyalty-account-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });
type S = typeof import("../../app/lib/loyalty/account.server");
type P = typeof import("../../app/lib/loyalty/program.server");
let S: S, P: P;
before(async () => {
  for (const m of fs.readdirSync("prisma/migrations").filter((x) => x.includes("loyalty")).sort()) {
    const sql = fs.readFileSync(`prisma/migrations/${m}/migration.sql`, "utf8");
    for (const stmt of sql.split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  }
  [S, P] = await Promise.all([import("../../app/lib/loyalty/account.server"), import("../../app/lib/loyalty/program.server")]);
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

const NOW = new Date("2026-10-23T12:00:00Z");
const cfg: LoyaltyConfig = {
  ...DEFAULT_LOYALTY,
  unit: { one: "star", many: "stars" },
  tiers: { ...DEFAULT_LOYALTY.tiers, on: true, list: [{ id: "gold", name: "Gold", min: 100, multiplier: 1.5, bonus: 0 }] },
  referral: { ...DEFAULT_LOYALTY.referral, on: true },
};

test("memberPayload: points, tier and multiplier, codes not expired (newest first), points per order, referral link", () => {
  const p = memberPayload(
    cfg,
    { points: 120, pending: 30, tier: "gold", referralCode: "SARA7", blocked: false },
    [
      { title: "$5 off", code: "LOY-OLD", expiresAt: new Date("2026-10-01T00:00:00Z"), createdAt: new Date("2026-09-01T00:00:00Z") },
      { title: "$5 off", code: "LOY-A", expiresAt: new Date("2026-12-01T00:00:00Z"), createdAt: new Date("2026-10-01T00:00:00Z") },
      { title: "Free shipping", code: "LOY-B", expiresAt: null, createdAt: new Date("2026-10-20T00:00:00Z") },
      { title: "Store credit", code: "", expiresAt: null, createdAt: new Date("2026-10-21T00:00:00Z") },
    ],
    [
      { orderId: "1001", points: 50, pending: false },
      { orderId: "1001", points: -10, pending: false },
      { orderId: "1002", points: 30, pending: true },
      { orderId: "1003", points: 20, pending: false },
      { orderId: "1003", points: -20, pending: false },
    ],
    "https://shop.example.com/",
    NOW,
  );
  assert.deepEqual(
    { p: p.p, pe: p.pe, t: p.t, x: p.x, r: p.r, l: p.l, u: p.u, b: p.b },
    { p: 120, pe: 30, t: "Gold", x: 1.5, r: "SARA7", l: "https://shop.example.com/?ref=SARA7", u: ["star", "stars"], b: false },
  );
  assert.deepEqual(p.rw, [{ t: "Free shipping", c: "LOY-B", e: null }, { t: "$5 off", c: "LOY-A", e: "2026-12-01" }]);
  assert.deepEqual(p.o, { "1001": { p: 40, pe: false }, "1002": { p: 30, pe: true } }, "fully refunded orders are left out");
  assert.ok(JSON.stringify(p).length < 2000);

  const blocked = memberPayload(cfg, { points: 5, pending: 0, tier: "", referralCode: "X1", blocked: true }, [{ title: "a", code: "C", expiresAt: null, createdAt: NOW }], [], "https://shop.example.com", NOW);
  assert.deepEqual([blocked.b, blocked.r, blocked.l, blocked.rw], [true, "", "", []]);
  const noRef = memberPayload({ ...cfg, referral: { ...cfg.referral, on: false } }, { points: 0, pending: 0, tier: "gone", referralCode: "X1", blocked: false }, [], [], "https://s.example", NOW);
  assert.deepEqual([noRef.l, noRef.t, noRef.x], ["", "", 1]);
});

test("shopPayload: the rules the extensions need, and only rewards that are on", () => {
  const c: LoyaltyConfig = { ...cfg, rewards: [{ ...DEFAULT_LOYALTY.rewards[0], id: "r1", on: true, title: "$5 off", points: 500 }, { ...DEFAULT_LOYALTY.rewards[0], id: "r2", on: false }] };
  const s = shopPayload(c, true, "https://shop.example.com/");
  assert.equal(s.on, true);
  assert.deepEqual(s.u, { one: "star", many: "stars" });
  assert.equal(s.per, c.earn.order.perUnit);
  assert.deepEqual(s.rw.map((r) => r.id), ["r1"]);
  assert.equal(s.ref, "https://shop.example.com");
  assert.equal(shopPayload(c, false, "").on, false);
});

/** A store that records the metafields written (and can be told to change a member while a write runs). */
function fakeAdmin(onSet?: () => Promise<void>) {
  const sets: { ownerId: string; key: string; value: string }[][] = [];
  const admin = {
    graphql: async (q: string, o?: { variables?: { metafields?: { ownerId: string; key: string; value: string }[] } }) => {
      if (/CroLoyaltyAccountShop/.test(q)) return { json: async () => ({ data: { shop: { id: "gid://shopify/Shop/1", primaryDomain: { url: "https://shop.example.com" } } } }) };
      sets.push(o?.variables?.metafields ?? []);
      if (onSet) await onSet();
      return { json: async () => ({ data: { metafieldsSet: { userErrors: [] } } }) };
    },
  } as unknown as AdminClient;
  return { admin, sets };
}

test("pushMemberAccounts writes new and changed members once, and a change made during a write is written next time", async () => {
  const shop = "acct.myshopify.com";
  const a = (await P.memberFor(shop, { id: "11", email: "a@x.com", firstName: "", locale: "", tags: [] }, true))!;
  const b = (await P.memberFor(shop, { id: "12", email: "b@x.com", firstName: "", locale: "", tags: [] }, true))!;
  await P.record(shop, a.id, { kind: "order", points: 40, orderId: "5001" });

  const first = fakeAdmin();
  assert.equal(await S.pushMemberAccounts(first.admin, shop, cfg), 2);
  const written = first.sets.flat();
  assert.deepEqual(written.map((m) => m.ownerId).sort(), ["gid://shopify/Customer/11", "gid://shopify/Customer/12"]);
  const va = JSON.parse(written.find((m) => m.ownerId.endsWith("/11"))!.value);
  assert.equal(va.p, 40);
  assert.deepEqual(va.o, { "5001": { p: 40, pe: false } });
  assert.match(va.l, /^https:\/\/shop\.example\.com\/\?ref=/);

  // Nothing changed: nothing written.
  const again = fakeAdmin();
  assert.equal(await S.pushMemberAccounts(again.admin, shop, cfg), 0);
  assert.equal(again.sets.length, 0);

  // A member changes while their metafield is being written: kept due for the next run.
  await P.record(shop, b.id, { kind: "adjust", points: 7 });
  const racing = fakeAdmin(async () => {
    await new Promise((r) => setTimeout(r, 5));
    await P.record(shop, b.id, { kind: "adjust", points: 3 });
  });
  assert.equal(await S.pushMemberAccounts(racing.admin, shop, cfg), 1);
  const next = fakeAdmin();
  assert.equal(await S.pushMemberAccounts(next.admin, shop, cfg), 1);
  assert.equal(JSON.parse(next.sets.flat()[0].value).p, 10);

  // Asked for one member: written even when not due.
  const one = fakeAdmin();
  assert.equal(await S.pushMemberAccounts(one.admin, shop, cfg, [a.id]), 1);
});

test("pushShopAccount writes the shop's metafield only when it changed, with on false when the program stops", async () => {
  const shop = "acct-shop.myshopify.com";
  const f = fakeAdmin();
  assert.equal(await S.pushShopAccount(f.admin, shop, cfg, true), true);
  assert.equal(await S.pushShopAccount(f.admin, shop, cfg, true), false);
  assert.equal(await S.pushShopAccount(f.admin, shop, cfg, false), true);
  const values = f.sets.flat().map((m) => JSON.parse(m.value).on);
  assert.deepEqual(values, [true, false]);
  assert.equal(f.sets.flat()[0].ownerId, "gid://shopify/Shop/1");
});

test("counter helpers: the store from the token, the customer id, and the rewards a member can use", async () => {
  const C = await import("../../app/lib/loyalty/counter");
  assert.equal(C.shopOf("https://acct.myshopify.com"), "acct.myshopify.com");
  assert.equal(C.shopOf("https://evil.example.com"), null);
  assert.equal(C.customerIdOf("gid://shopify/Customer/123"), "123");
  assert.equal(C.customerIdOf("gid://shopify/Customer/abc"), null);
  assert.equal(C.customerIdOf(undefined), null);
  const base = DEFAULT_LOYALTY.rewards[0];
  const c: LoyaltyConfig = {
    ...cfg,
    rewards: [
      { ...base, id: "code", on: true, kind: "amount", points: 100, tiers: [] },
      { ...base, id: "credit", on: true, kind: "credit", points: 50, tiers: [] },
      { ...base, id: "vip", on: true, kind: "percent", points: 10, tiers: ["gold"] },
      { ...base, id: "off", on: false, kind: "amount", points: 1, tiers: [] },
    ],
  };
  assert.deepEqual(C.rewardsFor(c, { points: 60, tier: "" }, true).map((r) => [r.id, r.enough]), [["code", false]]);
  assert.deepEqual(C.rewardsFor(c, { points: 60, tier: "gold" }, false).map((r) => [r.id, r.enough]), [["code", false], ["credit", true], ["vip", true]]);
});
