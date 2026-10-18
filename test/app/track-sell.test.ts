/** What the Track page sells: the next order discount (lib/track-sell.ts, lib/track-sell.server.ts). Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import type { AdminClient } from "../../app/lib/admin.server";
import { buyAgainFor, isLate, withTrackSellDefaults } from "../../app/lib/track-sell";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "track-sell-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

type S = typeof import("../../app/lib/track-sell.server");
let S: S;
before(async () => {
  for (const stmt of fs.readFileSync("prisma/migrations/20261023000000_track_codes/migration.sql", "utf8").split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  S = await import("../../app/lib/track-sell.server");
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

function fake(opts: { taken?: boolean } = {}) {
  const calls: { op: string; vars: Record<string, any> }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const store = new Map<string, string>();
  const admin = {
    graphql: async (query: string, o?: { variables?: Record<string, any> }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const v = o?.variables ?? {};
      const op = /(?:mutation|query)\s+(\w+)/.exec(query)?.[1] ?? "";
      calls.push({ op, vars: v });
      const data = (d: unknown) => ({ json: async () => ({ data: d }) });
      switch (op) {
        case "CroTrackShipCode": return data({ discountCodeFreeShippingCreate: { codeDiscountNode: { id: "gid://shopify/DiscountCodeNode/2" }, userErrors: [] } });
        case "CroTrackCode": return data({ discountCodeBasicCreate: opts.taken ? { codeDiscountNode: null, userErrors: [{ message: "Code must be unique. Please try a different code." }] } : { codeDiscountNode: { id: "gid://shopify/DiscountCodeNode/1" }, userErrors: [] } });
        case "CroFindCode": return data({ codeDiscountNodeByCode: { id: "gid://shopify/DiscountCodeNode/9" } });
        case "CroTrackCodeUpdate": return data({ discountCodeBasicUpdate: { codeDiscountNode: { id: "x" }, userErrors: [] } });
        case "CroTrackSell": return data({ metaobjectByHandle: store.has("track_sell") ? { field: { value: store.get("track_sell") } } : null });
        case "CroUpsert": store.set(v.handle.handle, v.metaobject.fields[0].value); return data({ metaobjectUpsert: { metaobject: { id: "m", handle: v.handle.handle }, userErrors: [] } });
        default: return data({});
      }
    },
  };
  return { admin: admin as unknown as AdminClient, calls, store };
}

test("the settings are cleaned and the next order discount is off until chosen", () => {
  assert.equal(withTrackSellDefaults({}).nextOrder.on, false);
  const n = withTrackSellDefaults({ nextOrder: { on: true, mode: "shared", percent: 500, minimum: -3, days: 0, sharedCode: " thanks-15! " } }).nextOrder;
  assert.deepEqual(n, { on: true, mode: "shared", percent: 90, minimum: 0, days: 1, sharedCode: "THANKS15" });
  assert.equal(withTrackSellDefaults({ nextOrder: { sharedCode: "x" } }).nextOrder.sharedCode, "THANKS10", "too short: the default");
});

const per = { on: true, mode: "perOrder" as const, percent: 10, minimum: 50, days: 30, sharedCode: "THANKS10" };

test("one single use code per order with a real expiry, the same one every time", async () => {
  const a = fake();
  const first = await S.nextOrderCode(a.admin, "s.myshopify.com", "gid://shopify/Order/1", per);
  assert.match(first!.code, /^NEXT-[0-9A-F]{8}$/);
  assert.deepEqual({ percent: first!.percent, minimum: first!.minimum }, { percent: 10, minimum: 50 });
  const d = a.calls.find((c) => c.op === "CroTrackCode")!.vars.d;
  assert.equal(d.usageLimit, 1);
  assert.equal(d.customerGets.value.percentage, 0.1);
  assert.equal(d.minimumRequirement.subtotal.greaterThanOrEqualToSubtotal, "50.00");
  assert.deepEqual(d.context, { all: "ALL" });
  const days = (Date.parse(d.endsAt) - Date.now()) / 864e5;
  assert.ok(days > 29.9 && days < 30.1, "30 days");
  assert.equal(Date.parse(first!.endsAt), Date.parse(d.endsAt));
  const again = await S.nextOrderCode(a.admin, "s.myshopify.com", "gid://shopify/Order/1", per);
  assert.equal(again!.code, first!.code);
  assert.equal(a.calls.filter((c) => c.op === "CroTrackCode").length, 1, "no second discount made");
  const other = await S.nextOrderCode(a.admin, "s.myshopify.com", "gid://shopify/Order/2", per);
  assert.notEqual(other!.code, first!.code);
});

test("off means no code, and an expired code is not shown again", async () => {
  const a = fake();
  assert.equal(await S.nextOrderCode(a.admin, "s.myshopify.com", "gid://shopify/Order/3", { ...per, on: false }), null);
  assert.equal(a.calls.length, 0);
  await prisma.trackCode.create({ data: { shop: "s.myshopify.com", orderId: "gid://shopify/Order/4", kind: "next", code: "NEXT-OLD", percent: 10, minimum: 0, endsAt: new Date(Date.now() - 1000) } });
  assert.equal(await S.nextOrderCode(a.admin, "s.myshopify.com", "gid://shopify/Order/4", per), null);
});

test("a shared code is made when saved, renewed when it exists, and shown only while it lasts", async () => {
  const a = fake();
  const sell = await S.saveTrackSell(a.admin, "sh.myshopify.com", { nextOrder: { ...per, mode: "shared", sharedCode: "THANKS15", percent: 15, minimum: 0 } });
  assert.equal(sell.nextOrder.sharedCode, "THANKS15");
  assert.equal(a.calls.find((c) => c.op === "CroTrackCode")!.vars.d.usageLimit, undefined, "shared: no use limit");
  const shown = await S.nextOrderCode(a.admin, "sh.myshopify.com", "gid://shopify/Order/5", sell.nextOrder);
  assert.deepEqual({ code: shown?.code, percent: shown?.percent }, { code: "THANKS15", percent: 15 });
  // Saving again when the code already exists moves its end date instead of failing.
  const b = fake({ taken: true });
  await S.saveTrackSell(b.admin, "sh.myshopify.com", { nextOrder: { ...per, mode: "shared", sharedCode: "THANKS15" } });
  assert.ok(b.calls.some((c) => c.op === "CroTrackCodeUpdate" && c.vars.id === "gid://shopify/DiscountCodeNode/9"));
  await prisma.trackCode.updateMany({ where: { shop: "sh.myshopify.com", kind: "shared" }, data: { endsAt: new Date(Date.now() - 1000) } });
  assert.equal(await S.nextOrderCode(a.admin, "sh.myshopify.com", "gid://shopify/Order/6", sell.nextOrder), null, "expired");
});


test("buy again: items in stock go to the cart, sold out ones are named, the merchant's filter applies", () => {
  const line = (title: string, over: Record<string, unknown> = {}) => ({ variantId: 5, title, variant: "M", quantity: 2, available: true, productType: "Shirts", tags: ["basics"], ...over });
  const lines = [line("Tee"), line("Hoodie", { available: false, productType: "Hoodies", tags: ["winter"] }), line("Cap", { productType: "Hats", tags: [], variantId: 0 })];
  const all = buyAgainFor(lines, { on: true, only: "all", list: "" });
  assert.deepEqual(all.items, [{ variantId: 5, quantity: 2, title: "Tee (M)" }]);
  assert.deepEqual(all.soldOut, ["Hoodie (M)"]);
  assert.deepEqual(buyAgainFor(lines, { on: true, only: "types", list: "shirts, hats" }).soldOut, []);
  assert.deepEqual(buyAgainFor(lines, { on: true, only: "tags", list: "Winter" }), { items: [], soldOut: ["Hoodie (M)"] });
  assert.deepEqual(buyAgainFor(lines, { on: true, only: "tags", list: "nothing" }), { items: [], soldOut: [] });
  assert.equal(withTrackSellDefaults({ buyAgain: { on: true, only: "types", list: " Shirts ,, Hats " } }).buyAgain.list, "Shirts, Hats");
});

test("after delivery: settings are cleaned, and the friend code is its own code for the same order", async () => {
  const d = withTrackSellDefaults({ afterDelivery: { on: true, review: "url", reviewUrl: "http://nope", friend: { on: true, percent: 200, days: 0 } } }).afterDelivery;
  assert.deepEqual({ on: d.on, review: d.review, reviewUrl: d.reviewUrl, returnsLink: d.returnsLink }, { on: true, review: "product", reviewUrl: "", returnsLink: true }, "only https review pages are kept");
  assert.deepEqual(d.friend, { on: true, percent: 90, minimum: 0, days: 1 });
  assert.equal(withTrackSellDefaults({ afterDelivery: { review: "url", reviewUrl: "https://reviews.example/store" } }).afterDelivery.reviewUrl, "https://reviews.example/store");
  const a = fake();
  const next = await S.givenCode(a.admin, "f.myshopify.com", "gid://shopify/Order/1", "next", "NEXT", { percent: 10, minimum: 0, days: 30 }, "next order");
  const friend = await S.givenCode(a.admin, "f.myshopify.com", "gid://shopify/Order/1", "friend", "FRIEND", { percent: 15, minimum: 20, days: 14 }, "friend");
  assert.match(friend!.code, /^FRIEND-[0-9A-F]{8}$/);
  assert.notEqual(friend!.code, next!.code);
  assert.equal((await S.givenCode(a.admin, "f.myshopify.com", "gid://shopify/Order/1", "friend", "FRIEND", { percent: 15, minimum: 20, days: 14 }, "friend"))!.code, friend!.code);
  const dInput = a.calls.filter((c) => c.op === "CroTrackCode").map((c) => c.vars.d);
  assert.equal(dInput.length, 2, "one discount each, none for the repeat");
  assert.equal(dInput[1].usageLimit, 1);
  assert.equal(dInput[1].customerGets.value.percentage, 0.15);
});


test("a shipment is late a day after its expected date, or when the carrier says there is a problem", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  const d = (n: number) => new Date(now + n * 86_400_000).toISOString();
  assert.equal(isLate({ delivered: null, estimated: d(1), status: "transit" }, now), false);
  assert.equal(isLate({ delivered: null, estimated: d(-0.5), status: "transit" }, now), false, "a few hours late is not late yet");
  assert.equal(isLate({ delivered: null, estimated: d(-2), status: "transit" }, now), true);
  assert.equal(isLate({ delivered: d(-1), estimated: d(-5), status: "delivered" }, now), false);
  assert.equal(isLate({ delivered: null, estimated: null, status: "problem" }, now), true);
  assert.equal(isLate({ delivered: null, estimated: null, status: "transit" }, now), false, "no expected date, nothing to be late against");
  const w = withTrackSellDefaults({ delay: { on: true, gift: "shipping", percent: 500, days: 0 } }).delay;
  assert.deepEqual(w, { on: true, gift: "shipping", percent: 90, days: 1 });
});

test("a delay code can be free shipping: its own kind, single use, with a real expiry", async () => {
  const a = fake();
  const code = await S.givenCode(a.admin, "d.myshopify.com", "gid://shopify/Order/1", "delay", "SORRY", { percent: 0, minimum: 0, days: 14, shipping: true }, "delay");
  assert.match(code!.code, /^SORRY-/);
  assert.ok(!a.calls.some((c) => c.op === "CroTrackCode"), "no percentage discount made");
  assert.equal(a.calls.length, 1);
});
