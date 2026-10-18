/** The Analytics "Track & Returns" numbers (results.server.ts, track-sell.server.ts): real orders only. Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import type { AdminClient } from "../../app/lib/admin.server";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "track-results-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

type R = typeof import("../../app/lib/results.server");
type T = typeof import("../../app/lib/track-sell.server");
let R: R, T: T;
before(async () => {
  for (const m of ["20261023000000_track_codes", "20261024000000_track_stats"]) {
    for (const stmt of fs.readFileSync(`prisma/migrations/${m}/migration.sql`, "utf8").split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  }
  R = await import("../../app/lib/results.server");
  T = await import("../../app/lib/track-sell.server");
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

const line = (source: string | null, amount: number) => ({ customAttributes: source ? [{ key: "_source", value: source }] : [], discountedTotalSet: { shopMoney: { amount: String(amount) } }, lineItemGroup: null });
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const order = (id: string, days: number, total: number, lines: ReturnType<typeof line>[], codes: string[] = []) => ({ id, createdAt: ago(days), cancelledAt: null, discountCodes: codes, totalPriceSet: { shopMoney: { amount: String(total), currencyCode: "USD" } }, customAttributes: [], lineItems: { nodes: lines } });
const admin = (orders: unknown[]) => ({ graphql: async () => ({ json: async () => ({ data: { orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: orders } } }) }) }) as unknown as AdminClient;

test("lookups are counted per day and summed over the window", async () => {
  await T.countLookup("l.myshopify.com");
  await T.countLookup("l.myshopify.com");
  await T.countLookup("other.myshopify.com");
  await prisma.trackStat.create({ data: { shop: "l.myshopify.com", day: ago(10).slice(0, 10), visits: 5 } });
  await prisma.trackStat.create({ data: { shop: "l.myshopify.com", day: ago(45).slice(0, 10), visits: 9 } });
  assert.equal(await T.lookupsSince("l.myshopify.com", 30), 7, "today's 2 and 5 ten days ago; not the 45 days old ones, not another shop");
});

test("track results: marked cart lines and the codes the page gave, last 30 days only, cancelled orders left out", async () => {
  const shop = "r.myshopify.com";
  const mk = (orderId: string, kind: string, code: string) => prisma.trackCode.create({ data: { shop, orderId, kind, code, percent: 10, endsAt: new Date(Date.now() + 1e9) } });
  await mk("o1", "next", "NEXT-AAAA0001");
  await mk("o2", "friend", "FRIEND-BBBB0002");
  await mk("o3", "offer-t1", "TRACK-CCCC0003");
  await mk("shared", "shared", "THANKS10");
  await prisma.trackCode.create({ data: { shop: "someone-else.myshopify.com", orderId: "x", kind: "next", code: "NEXT-OTHER000", endsAt: new Date(Date.now() + 1e9) } });
  const orders = [
    order("a", 2, 100, [line("track_recs", 30), line("cross_sell", 20), line(null, 50)]),
    order("b", 3, 80, [line("track_recs", 10), line("track_recs", 5), line("track_offer", 15), line("buy_again", 40)]),
    order("c", 4, 60, [line("buy_again", 60)], ["next-aaaa0001"]),
    order("d", 5, 40, [line(null, 40)], ["THANKS10", "SOMETHING"]),
    order("e", 6, 30, [line(null, 30)], ["NEXT-OTHER000"]),
    order("f", 40, 500, [line("track_recs", 500), line("buy_again", 500)], ["FRIEND-BBBB0002"]),
    { ...order("g", 1, 70, [line("track_offer", 70)], ["TRACK-CCCC0003"]), cancelledAt: ago(1) },
    order("h", 7, 90, [line("track_offer", 25)], ["TRACK-CCCC0003", "FRIEND-BBBB0002"]),
  ];
  const r = await R.getResults(admin(orders), R.DEFAULT_EXPERIMENT, shop);
  assert.deepEqual(r.track.recs, { orders: 2, revenue: 45 }, "two orders, 30 + 10 + 5; the 40 day old one is outside the 30 days");
  assert.deepEqual(r.track.offers, { orders: 2, revenue: 40 }, "the cancelled order is left out");
  assert.deepEqual(r.track.buyAgain, { orders: 2, revenue: 100 });
  assert.deepEqual(r.track.codes, { orders: 3, revenue: 190, byKind: { next: 2, friend: 0, delay: 0, offer: 1 } }, "next order code (any case), the shared code and an offer code; another shop's code and unknown codes do not count");
  const bare = await R.getResults(admin(orders), R.DEFAULT_EXPERIMENT);
  assert.equal(bare.track.codes.orders, 0, "without a shop there are no codes to match");
  assert.equal(R.codeGroup("offer-t1"), "offer");
  assert.equal(R.codeGroup("mystery"), null);
});
