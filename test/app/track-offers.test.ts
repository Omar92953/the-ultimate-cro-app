/** Track page offers (Pro): lib/track-offers.ts and track-offers.server.ts. Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import type { AdminClient } from "../../app/lib/admin.server";
import { trackOfferProblem, withTrackOfferDefaults, withTrackOffersDefaults } from "../../app/lib/track-offers";
import { requireTrackOffers } from "../../app/lib/rules";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "track-offers-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

type S = typeof import("../../app/lib/track-offers.server");
let S: S;
before(async () => {
  for (const stmt of fs.readFileSync("prisma/migrations/20261023000000_track_codes/migration.sql", "utf8").split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  S = await import("../../app/lib/track-offers.server");
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

const P1 = "gid://shopify/Product/1", P2 = "gid://shopify/Product/2";
function fake(stock: Record<string, boolean> = { [P1]: true, [P2]: true }) {
  const calls: { op: string; vars: Record<string, any> }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const store = new Map<string, string>();
  const admin = {
    graphql: async (query: string, o?: { variables?: Record<string, any> }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const v = o?.variables ?? {};
      const op = /(?:mutation|query)\s+(\w+)/.exec(query)?.[1] ?? "";
      calls.push({ op, vars: v });
      const data = (d: unknown) => ({ json: async () => ({ data: d }) });
      switch (op) {
        case "CroTrackOffers": return data({ metaobjectByHandle: store.has("track_offers") ? { field: { value: store.get("track_offers") } } : null });
        case "CroUpsert": store.set(v.handle.handle, v.metaobject.fields[0].value); return data({ metaobjectUpsert: { metaobject: { id: "m", handle: v.handle.handle }, userErrors: [] } });
        case "CroShopCurrency": return data({ shop: { currencyCode: "USD" } });
        case "CroTrackOfferProducts": return data({ nodes: (v.ids as string[]).map((id) => ({ id, handle: `p${id.split("/").pop()}`, title: `Product ${id.split("/").pop()}`, status: "ACTIVE", featuredMedia: null, variants: { nodes: [{ id: `gid://shopify/ProductVariant/${id.split("/").pop()}0`, availableForSale: stock[id] !== false, price: "20.00" }] } })) });
        case "CroTrackCode": return data({ discountCodeBasicCreate: { codeDiscountNode: { id: "d" }, userErrors: [] } });
        case "CroTrackShipCode": return data({ discountCodeFreeShippingCreate: { codeDiscountNode: { id: "d" }, userErrors: [] } });
        default: return data({});
      }
    },
  };
  return { admin: admin as unknown as AdminClient, calls, store };
}
const ref = (id: string) => ({ id, title: `Product ${id.split("/").pop()}`, image: null, handle: `p${id.split("/").pop()}` });

test("an offer is cleaned: kind, bounds, products per kind", () => {
  const o = withTrackOfferDefaults({ id: "a b!", name: "  Hello ", kind: "gift", slot: "above", percent: 500, hours: 0, products: [ref(P1), ref(P2), { id: "gid://shopify/Collection/1" }] });
  assert.equal(o.id, "ab");
  assert.deepEqual({ kind: o.kind, slot: o.slot, percent: o.percent, hours: o.hours, products: o.products.length }, { kind: "gift", slot: "above", percent: 0, hours: 1, products: 1 });
  assert.equal(withTrackOfferDefaults({ kind: "discount", percent: 500 }).percent, 90);
  assert.equal(withTrackOfferDefaults({ kind: "cross_sell", percent: 500 }).percent, 90);
  assert.equal(withTrackOfferDefaults({ kind: "nonsense" }).kind, "cross_sell");
  assert.equal(withTrackOffersDefaults({ offers: Array.from({ length: 30 }, (_, i) => ({ id: `o${i}`, name: "x" })) }).offers.length, 10);
});

test("what stops an offer: a name, its products, and one offer per slot", () => {
  const base = withTrackOfferDefaults({ id: "a", name: "A", kind: "cross_sell", products: [ref(P1)], active: true, slot: "below" });
  assert.equal(trackOfferProblem(base, []), null);
  assert.match(trackOfferProblem({ ...base, name: "" }, [])!, /name/);
  assert.match(trackOfferProblem({ ...base, products: [] }, [])!, /product/);
  assert.match(trackOfferProblem({ ...base, id: "b", name: "B" }, [base])!, /below slot already shows “A”/);
  assert.equal(trackOfferProblem({ ...base, id: "b", name: "B", slot: "above" }, [base]), null);
  assert.equal(trackOfferProblem({ ...base, id: "b", name: "B", active: false }, [base]), null, "a paused offer can share a slot");
});

test("Pro only", () => {
  assert.doesNotThrow(() => requireTrackOffers("pro"));
  assert.throws(() => requireTrackOffers("growth"), /Pro plan/);
});

test("saving keeps offers, one live offer per slot, and deleting removes it", async () => {
  const a = fake();
  const first = await S.saveTrackOffer(a.admin, { name: "Cross", kind: "cross_sell", products: [ref(P1)], active: true, slot: "below" });
  assert.match(first.id, /^t[0-9a-f]{8}$/);
  await assert.rejects(S.saveTrackOffer(a.admin, { name: "Other", kind: "cross_sell", products: [ref(P2)], active: true, slot: "below" }), /already shows “Cross”/);
  const second = await S.saveTrackOffer(a.admin, { name: "Ship", kind: "shipping", active: true, slot: "above" });
  assert.equal((await S.getTrackOffers(a.admin)).offers.length, 2);
  await S.saveTrackOffer(a.admin, { ...first, headline: "New headline" });
  assert.equal((await S.getTrackOffers(a.admin)).offers.find((o) => o.id === first.id)!.headline, "New headline");
  await S.deleteTrackOffer(a.admin, second.id);
  assert.deepEqual((await S.getTrackOffers(a.admin)).offers.map((o) => o.id), [first.id]);
});

test("an order's Track page: products with a real code that expires, one per slot, nothing for what is gone", async () => {
  const a = fake({ [P1]: true, [P2]: false });
  await S.saveTrackOffer(a.admin, { name: "Cross", kind: "cross_sell", products: [ref(P1), ref(P2)], percent: 10, hours: 48, active: true, slot: "below" });
  await S.saveTrackOffer(a.admin, { name: "Ship", kind: "shipping", hours: 24, active: true, slot: "above" });
  const out = await S.trackOffersFor(a.admin, "o.myshopify.com", "gid://shopify/Order/1", "USD");
  assert.deepEqual(out.below!.products.map((p) => p.handle), ["p1"], "the sold out product is left out");
  assert.equal(out.below!.products[0].variantId, 10);
  assert.match(out.below!.code!.code, /^TRACK-[0-9A-F]{8}$/);
  const d = a.calls.find((c) => c.op === "CroTrackCode")!.vars.d;
  assert.equal(d.usageLimit, 1);
  assert.equal(d.customerGets.value.percentage, 0.1);
  assert.deepEqual(d.customerGets.items, { products: { productsToAdd: [P1] } }, "the code only discounts the offered products that are in stock");
  assert.ok(Math.abs((Date.parse(d.endsAt) - Date.now()) / 3_600_000 - 48) < 0.1, "48 hours");
  assert.equal(out.above!.kind, "shipping");
  const ship = a.calls.find((c) => c.op === "CroTrackShipCode")!.vars.d;
  assert.ok(Math.abs((Date.parse(ship.endsAt) - Date.now()) / 3_600_000 - 24) < 0.1);
  const again = await S.trackOffersFor(a.admin, "o.myshopify.com", "gid://shopify/Order/1", "USD");
  assert.equal(again.below!.code!.code, out.below!.code!.code, "the same code every time");
  assert.equal(a.calls.filter((c) => c.op === "CroTrackCode").length, 1);
});

test("a gift is free through a one time code on the gift only; an offer with nothing to sell is left out", async () => {
  const a = fake({ [P1]: true, [P2]: false });
  await S.saveTrackOffer(a.admin, { name: "Gift", kind: "gift", products: [ref(P1)], active: true, slot: "above" });
  const g = (await S.trackOffersFor(a.admin, "g.myshopify.com", "gid://shopify/Order/2", "USD")).above!;
  assert.equal(a.calls.find((c) => c.op === "CroTrackCode")!.vars.d.customerGets.value.percentage, 1);
  assert.equal(g.products[0].handle, "p1");
  const b = fake({ [P1]: false, [P2]: false });
  await S.saveTrackOffer(b.admin, { name: "Cross", kind: "cross_sell", products: [ref(P2)], active: true, slot: "below" });
  assert.deepEqual(await S.trackOffersFor(b.admin, "g.myshopify.com", "gid://shopify/Order/3", "USD"), {});
  assert.ok(!b.calls.some((c) => c.op === "CroTrackCode"), "no code made for an offer that shows nothing");
  await S.saveTrackOffer(b.admin, { name: "Paused", kind: "discount", percent: 15, active: false, slot: "above" });
  assert.deepEqual(await S.trackOffersFor(b.admin, "g.myshopify.com", "gid://shopify/Order/3", "USD"), {}, "paused offers are not shown");
});
