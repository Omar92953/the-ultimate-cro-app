/** Tracking sources, the shared shape, the cache rules, keys and the webhook (docs/research/tracking-returns.md §9). Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { buildTracking, cleanEvents, fromShopifyEvent, isFresh, sourcesToTry } from "../../app/lib/tracking";
import { fromTrackInfo } from "../../app/lib/tracking/provider.server";
import { decrypt, encrypt, last4, sameSecret } from "../../app/lib/tracking/secret.server";

// The database is set before anything that imports it.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "track-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
type T = typeof import("../../app/lib/tracking/tracking.server");
let T: T;
before(async () => {
  for (const m of ["20261019000000_tracking", "20261026000000_carrier_links"]) {
    const sql = fs.readFileSync(`prisma/migrations/${m}/migration.sql`, "utf8");
    for (const stmt of sql.split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  }
  T = await import("../../app/lib/tracking/tracking.server");
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("Shopify's event statuses become ours", () => {
  assert.equal(fromShopifyEvent("DELIVERED"), "delivered");
  assert.equal(fromShopifyEvent("out_for_delivery"), "out");
  assert.equal(fromShopifyEvent("IN_TRANSIT"), "transit");
  assert.equal(fromShopifyEvent("FAILURE"), "problem");
  assert.equal(fromShopifyEvent("LABEL_PRINTED"), "info");
  assert.equal(fromShopifyEvent(null), "info");
});

test("events are cleaned, newest first, and delivered always wins", () => {
  const events = cleanEvents([
    { status: "transit", city: "Cairo", country: "EG", message: "Left the hub", at: "2026-10-12T08:00:00Z" },
    { status: "delivered", city: "Giza", message: "Delivered", at: "2026-10-14T10:00:00Z" },
    { status: "weird", message: "x".repeat(500), at: "2026-10-11T08:00:00Z" },
    { status: "info", at: "not a date" },
  ]);
  assert.equal(events.length, 3);
  assert.equal(events[0].status, "delivered");
  assert.equal(events[2].status, "info");
  assert.equal(events[2].message.length, 200);
  const t = buildTracking({ events, estimated: "2026-10-13T00:00:00Z" });
  assert.equal(t.status, "delivered");
  assert.equal(t.delivered, "2026-10-14T10:00:00.000Z");
  assert.equal(t.place, "Giza");
  assert.equal(buildTracking({ events: [] }).status, "info");
});

test("Shopify's own data: events, or at least when it left and its status", async () => {
  const { shopifyTracking } = await import("../../app/lib/orders-lookup.server");
  const f = { displayStatus: "IN_TRANSIT", deliveredAt: null, inTransitAt: "2026-10-10T09:00:00Z", estimatedDeliveryAt: "2026-10-15T00:00:00Z", trackingInfo: [], events: { nodes: [{ status: "IN_TRANSIT", city: "Leeds", province: "ENG", country: "GB", message: "Arrived at depot", happenedAt: "2026-10-11T12:00:00Z" }] } };
  const t = shopifyTracking(f)!;
  assert.equal(t.status, "transit");
  assert.equal(t.place, "Leeds, ENG, GB");
  assert.equal(t.estimated, "2026-10-15T00:00:00.000Z");
  const bare = shopifyTracking({ ...f, events: { nodes: [] } })!;
  assert.equal(bare.events.length, 1);
  assert.equal(shopifyTracking({ displayStatus: null, deliveredAt: null, estimatedDeliveryAt: null, trackingInfo: [] }), null);
});

test("the sources are tried in the agreed order", () => {
  assert.deepEqual(sourcesToTry("webhook"), ["webhook", "own", "live", "shopify"]);
  assert.deepEqual(sourcesToTry("own"), ["own", "live", "shopify"]);
  assert.deepEqual(sourcesToTry("live"), ["live", "shopify"]);
  assert.deepEqual(sourcesToTry("shopify"), ["shopify"]);
});

test("cached answers: fresh for 6 hours, final once delivered, left alone after 60 days", () => {
  const now = Date.parse("2026-10-18T12:00:00Z");
  const h = (n: number) => new Date(now - n * 3_600_000).toISOString();
  assert.equal(isFresh({ checkedAt: h(2), status: "transit", createdAt: h(48) }, now), true);
  assert.equal(isFresh({ checkedAt: h(7), status: "transit", createdAt: h(48) }, now), false);
  assert.equal(isFresh({ checkedAt: h(100), status: "delivered", createdAt: h(200) }, now), true);
  assert.equal(isFresh({ checkedAt: h(100), status: "transit", createdAt: h(61 * 24) }, now), true);
});

test("a tracking service's answer becomes our shape", () => {
  const t = fromTrackInfo({
    latest_status: { status: "OutForDelivery" },
    time_metrics: { estimated_delivery_date: { from: "2026-10-18T00:00:00Z", to: "2026-10-19T00:00:00Z" } },
    tracking: { providers: [{ events: [
      { time_iso: "2026-10-18T07:00:00Z", description: "Out for delivery", stage: "OutForDelivery", address: { city: "Berlin", state: "BE", country: "DE" } },
      { time_iso: "2026-10-16T07:00:00Z", description: "Arrived", stage: "InTransit", address: { city: "Hamburg", state: "", country: "DE" } },
    ] }] },
  })!;
  assert.equal(t.status, "out");
  assert.equal(t.place, "Berlin, BE, DE");
  assert.equal(t.estimated, "2026-10-19T00:00:00.000Z");
  assert.equal(t.events.length, 2);
  assert.equal(fromTrackInfo({}), null);
  assert.equal(fromTrackInfo(null), null);
});

test("keys are encrypted, never shown whole, and compared safely", () => {
  const c = encrypt("sk_live_1234567890abcd");
  assert.ok(!c.includes("1234567890"));
  assert.equal(decrypt(c), "sk_live_1234567890abcd");
  assert.equal(decrypt(c.slice(0, -3) + "AAA"), null);
  assert.equal(decrypt("garbage"), null);
  assert.equal(last4("sk_live_1234567890abcd"), "abcd");
  assert.equal(sameSecret("abc", "abc"), true);
  assert.equal(sameSecret("abc", "abd"), false);
  assert.equal(sameSecret("", ""), false);
});

const shopifyData = buildTracking({ events: [{ status: "transit", message: "Shopify says", at: "2026-10-10T00:00:00Z" }] });

test("every tracking source (live, own key, webhook) is on Growth and Pro; the webhook gets a secret link", async () => {
  for (const s of ["live", "own", "webhook"]) await assert.rejects(T.saveSource("a.myshopify.com", "starter", s), /Growth and Pro/);
  await assert.rejects(T.saveSource("a.myshopify.com", "pro", "own"), /Paste and test/);
  await assert.rejects(T.saveKey("a.myshopify.com", "starter", "some-key-123456"), /Growth and Pro/);
  process.env.TRACKING_PROVIDER_KEY = "our-account-key"; // live tracking can be chosen once our account is set up
  await T.saveSource("a.myshopify.com", "pro", "live");
  delete process.env.TRACKING_PROVIDER_KEY;
  assert.equal((await T.getTrackingConfig("a.myshopify.com", "pro")).source, "live");
  // Downgraded: it shows as Shopify's data again.
  assert.equal((await T.getTrackingConfig("a.myshopify.com", "growth")).source, "live", "Growth keeps live tracking");
  assert.equal((await T.getTrackingConfig("a.myshopify.com", "starter")).source, "shopify");
  await T.saveSource("b.myshopify.com", "pro", "webhook");
  const cfg = await T.getTrackingConfig("b.myshopify.com", "pro");
  assert.match(cfg.webhookUrl, /\/tracking\/hook\/b\.myshopify\.com\/[\w-]{20,}$/);
  const before = cfg.webhookUrl;
  await T.regenerateSecret("b.myshopify.com");
  assert.notEqual((await T.getTrackingConfig("b.myshopify.com", "pro")).webhookUrl, before);
});

test("a pushed update shows on the Track page, from the right link only", async () => {
  const secret = (await T.getTrackingConfig("b.myshopify.com", "growth")).webhookUrl.split("/").pop()!;
  const body = { number: "RR1", status: "out", estimated: "2026-10-20T00:00:00Z", events: [{ status: "out", city: "Oslo", country: "NO", message: "Out for delivery", at: "2026-10-18T06:00:00Z" }] };
  assert.equal(await T.ingestPush("b.myshopify.com", "wrong", body), false);
  assert.equal(await T.ingestPush("c.myshopify.com", secret, body), false);
  assert.equal(await T.ingestPush("b.myshopify.com", secret, { nothing: true }), false);
  assert.equal(await T.ingestPush("b.myshopify.com", secret, body), true);
  const r = await T.resolveTracking("b.myshopify.com", "pro", { number: "RR1", carrier: "", country: "" }, shopifyData);
  assert.equal(r.via, "webhook");
  assert.equal(r.tracking?.place, "Oslo, NO");
  // Below Growth the same store shows Shopify's data.
  assert.equal((await T.resolveTracking("b.myshopify.com", "starter", { number: "RR1", carrier: "", country: "" }, shopifyData)).via, "shopify");
  // A number nothing pushed falls back to Shopify's data.
  const other = await T.resolveTracking("b.myshopify.com", "pro", { number: "RR2", carrier: "", country: "" }, shopifyData);
  assert.equal(other.via, "shopify");
  assert.equal(other.tracking?.events[0].message, "Shopify says");
});

test("the default is Shopify's data, and live tracking without our key falls back to it", async () => {
  const r = await T.resolveTracking("new.myshopify.com", "pro", { number: "X1", carrier: "", country: "" }, shopifyData);
  assert.equal(r.via, "shopify");
  delete process.env.TRACKING_PROVIDER_KEY;
  // Without our account's key, live tracking can't be chosen, and a store that had it falls back.
  await assert.rejects(T.saveSource("d.myshopify.com", "pro", "live"), /isn't switched on yet/);
  await prisma.trackingConfig.create({ data: { shop: "d.myshopify.com", source: "live" } });
  const live = await T.resolveTracking("d.myshopify.com", "pro", { number: "X2", carrier: "", country: "" }, shopifyData);
  assert.equal(live.via, "shopify");
  assert.equal((await prisma.trackingUsage.count()), 0, "nothing counted when nothing was sent");
});

test("uninstall removes the store's tracking settings and cache", async () => {
  await T.removeShopTracking("b.myshopify.com");
  assert.equal((await T.getTrackingConfig("b.myshopify.com", "growth")).chosen, false);
  assert.equal(await prisma.trackingCache.count({ where: { shop: "b.myshopify.com" } }), 0);
});

test("the order's prices are read in the currency the shopper paid in", async () => {
  const { orderPrices } = await import("../../app/lib/orders-lookup.server");
  const set = (amount: string, currencyCode = "EUR") => ({ presentmentMoney: { amount, currencyCode } });
  assert.deepEqual(orderPrices({ subtotalPriceSet: set("78.005"), totalShippingPriceSet: set("0"), totalDiscountsSet: set("7.8"), totalTaxSet: set("0"), totalPriceSet: set("70.2") }), { currency: "EUR", subtotal: 78.01, shipping: 0, discounts: 7.8, tax: 0, total: 70.2, refunded: 0 });
  assert.equal(orderPrices({ subtotalPriceSet: set("78"), totalPriceSet: set("70.2"), totalRefundedSet: set("25.5") })?.refunded, 25.5);
  assert.equal(orderPrices({}), null);
  assert.equal(orderPrices({ subtotalPriceSet: set("10"), totalPriceSet: null }), null);
});

test("every tracking source is on Growth and Pro, with live tracking limits of 200 and 500 shipments a month", async () => {
  const { sourceAllowed, liveLimit } = await import("../../app/lib/tracking");
  assert.equal(sourceAllowed("growth", "shopify"), true);
  assert.deepEqual([liveLimit("growth"), liveLimit("pro"), liveLimit("starter")], [200, 500, 0]);
  for (const s of ["live", "own", "webhook"] as const) {
    assert.equal(sourceAllowed("starter", s), false, s);
    assert.equal(sourceAllowed("growth", s), true, s);
    assert.equal(sourceAllowed("pro", s), true, s);
  }
});

test("carrier links: only https links with {number}, matched by carrier name, * for any other carrier", async () => {
  const { carrierUrl, cleanCarrierLinks } = await import("../../app/lib/tracking");
  const links = cleanCarrierLinks([
    { name: "Bosta", url: "https://bosta.co/tracking-shipments?shipment-number={number}" },
    { name: "bosta ", url: "https://other.example/{number}" }, // same carrier twice: the first wins
    { name: "No number", url: "https://x.example/track" },
    { name: "Plain http", url: "http://x.example/{number}" },
    { name: "*", url: "https://parcelsapp.com/en/tracking/{number}" },
  ]);
  assert.equal(links.length, 2);
  assert.equal(carrierUrl(links, "BOSTA", "AB 12"), "https://bosta.co/tracking-shipments?shipment-number=AB%2012");
  assert.equal(carrierUrl(links, "Local courier", "99"), "https://parcelsapp.com/en/tracking/99");
  assert.equal(carrierUrl(links, "Bosta", null), "");
  assert.equal(carrierUrl([], "Bosta", "1"), "");
});

test("AfterShip, TrackingMore and Ship24 answers and webhooks read into one shape", async () => {
  const P = await import("../../app/lib/tracking/provider.server");
  // AfterShip Tracking API 2026-07 tracking (also the webhook's msg)
  const as = { tracking_number: "1Z999", tag: "InTransit", courier_estimated_delivery_date: { estimated_delivery_date: "2026-10-24" }, checkpoints: [
    { checkpoint_time: "2026-10-20T08:00:00+00:00", city: "Louisville", state: "KY", country_region_name: "United States", message: "Departed facility", tag: "InTransit" },
    { checkpoint_time: "2026-10-19T08:00:00+00:00", city: "", state: "", country_region: "USA", message: "Label created", tag: "InfoReceived" },
  ] };
  const a = P.fromAfterShip(as)!;
  assert.equal(a.status, "transit");
  assert.equal(a.place, "Louisville, KY, United States");
  assert.equal(a.estimated, "2026-10-24T00:00:00.000Z");
  assert.equal(P.fromAfterShip({ tag: "Pending", checkpoints: [] }), null);
  const aPush = P.PROVIDERS.find((p) => p.id === "aftership")!.parsePush!({ event: "tracking_update", msg: { ...as, tag: "Delivered", shipment_delivery_date: "2026-10-23T10:00:00+00:00" } })!;
  assert.equal(aPush.number, "1Z999");
  assert.equal(aPush.tracking.status, "delivered");

  // TrackingMore v4 tracking (also the webhook's data)
  const tm = { tracking_number: "LX123", delivery_status: "pickup", scheduled_delivery_date: "2026-10-22", origin_info: { trackinfo: [
    { checkpoint_date: "2026-10-21T09:00:00+08:00", tracking_detail: "Out for delivery", location: "Shenzhen", checkpoint_delivery_status: "pickup" },
  ] }, destination_info: { trackinfo: [] } };
  const t = P.fromTrackingMore(tm)!;
  assert.equal(t.status, "out");
  assert.equal(t.place, "Shenzhen");
  assert.equal(P.fromTrackingMore({ delivery_status: "notfound" }), null);
  assert.equal(P.PROVIDERS.find((p) => p.id === "trackingmore")!.parsePush!({ meta: { code: 200 }, data: tm })!.number, "LX123");

  // Ship24 tracking result (trackers/track and webhooks)
  const s24 = { tracker: { trackingNumber: "S24-1" }, shipment: { statusMilestone: "failed_attempt", delivery: { estimatedDeliveryDate: "2026-10-25T00:00:00Z" } }, events: [
    { status: "Delivery attempted, nobody home", occurrenceDatetime: "2026-10-21T15:00:00Z", location: "Dubai", statusMilestone: "failed_attempt" },
  ] };
  const s = P.fromShip24(s24)!;
  assert.equal(s.status, "problem");
  assert.equal(s.events[0].message, "Delivery attempted, nobody home");
  assert.equal(P.PROVIDERS.find((p) => p.id === "ship24")!.parsePush!({ trackings: [s24] })!.number, "S24-1");

  // Each service's webhook is only read by its own parser.
  const parsers = P.PROVIDERS.filter((p) => p.parsePush);
  for (const [body, id] of [[{ msg: as }, "aftership"], [{ data: tm }, "trackingmore"], [{ trackings: [s24] }, "ship24"]] as const) {
    assert.deepEqual(parsers.filter((p) => p.parsePush!(body)).map((p) => p.id), [id]);
  }
});

test("typed updates show first and can be removed", async () => {
  await assert.rejects(T.addManualUpdate("m.myshopify.com", "starter", "LOCAL1", "Bosta", { status: "transit", place: "Cairo", message: "" }), /Growth and Pro/);
  await T.addManualUpdate("m.myshopify.com", "pro", "LOCAL1", "Bosta", { status: "transit", place: "Cairo, Egypt", message: "At the hub" });
  await T.addManualUpdate("m.myshopify.com", "pro", "LOCAL1", "Bosta", { status: "out", place: "Giza", message: "With the driver" });
  const r = await T.resolveTracking("m.myshopify.com", "pro", { number: "LOCAL1", carrier: "Bosta", country: "" }, shopifyData);
  assert.equal(r.via, "manual");
  assert.equal(r.tracking?.status, "out");
  assert.equal(r.tracking?.events.length, 2);
  assert.equal(r.tracking?.place, "Giza");
  // Below Growth the store's typed updates are not shown.
  assert.equal((await T.resolveTracking("m.myshopify.com", "starter", { number: "LOCAL1", carrier: "", country: "" }, shopifyData)).via, "shopify");
  await T.clearManualUpdates("m.myshopify.com", "LOCAL1");
  assert.equal((await T.resolveTracking("m.myshopify.com", "pro", { number: "LOCAL1", carrier: "", country: "" }, shopifyData)).via, "shopify");
});

test("17TRACK carrier codes come from Shopify's carrier name, only when the match is unambiguous", async () => {
  const { carrierKeyFrom } = await import("../../app/lib/tracking/provider.server");
  const list = [
    { key: 100487, _name: "Bosta" },
    { key: 100821, _name: "MyLerz" },
    { key: 101069, _name: "Mylerz (DZ)" },
    { key: 1, _name: "J&T Express (EG)" },
    { key: 2, _name: "J&T Express (ID)" },
    { key: 100006, _name: "Aramex" },
  ];
  assert.equal(carrierKeyFrom(list, "Bosta"), 100487);
  assert.equal(carrierKeyFrom(list, "bosta "), 100487);
  assert.equal(carrierKeyFrom(list, "MyLerz"), 100821); // the exact name wins over "Mylerz (DZ)"
  assert.equal(carrierKeyFrom(list, "J&T Express (EG)"), 1);
  assert.equal(carrierKeyFrom(list, "J&T Express"), null); // several countries: left to auto-detection
  assert.equal(carrierKeyFrom(list, "Some local courier"), null);
  assert.equal(carrierKeyFrom(list, ""), null);
});
