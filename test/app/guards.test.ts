/**
 * Guards with no test before the audit (2026-10-23, area 8): the post-purchase token check, the daily retention
 * cleanup and the per-visitor rate limit of the app proxy. Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { SignJWT, UnsecuredJWT } from "jose";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guards-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "the-app-secret", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

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

const sign = (payload: Record<string, unknown>, secret = "the-app-secret", exp = "5m") =>
  new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(exp).sign(new TextEncoder().encode(secret));
const input = (shop: string, ref: string | null) => ({ input_data: { shop: { domain: shop }, ...(ref ? { initialPurchase: { referenceId: ref } } : {}) } });

test("post-purchase: only a token Shopify signed with the app's secret, for a real store and purchase, is accepted", async () => {
  const { verifyPostPurchaseToken } = await import("../../app/lib/post-purchase.server");
  assert.deepEqual(await verifyPostPurchaseToken(await sign(input("shop-a.myshopify.com", "ref-1"))), { referenceId: "ref-1", shop: "shop-a.myshopify.com" });
  await assert.rejects(verifyPostPurchaseToken(await sign(input("shop-a.myshopify.com", "ref-1"), "another-secret")), "signed with another secret");
  await assert.rejects(verifyPostPurchaseToken(new UnsecuredJWT(input("shop-a.myshopify.com", "ref-1")).encode()), "an unsigned token (alg none)");
  await assert.rejects(verifyPostPurchaseToken(await sign(input("shop-a.myshopify.com", "ref-1"), "the-app-secret", "-1m")), "an expired token");
  await assert.rejects(verifyPostPurchaseToken(await sign(input("shop-a.myshopify.com", null))), "no purchase");
  await assert.rejects(verifyPostPurchaseToken(await sign(input("evil.example.com", "ref-1"))), "not a Shopify store");
  await assert.rejects(verifyPostPurchaseToken("not-a-token"));
});

test("retention: each kind of shopper data is deleted after its period, and newer rows stay", async () => {
  const { pruneOldData } = await import("../../app/lib/retention.server");
  const { RETENTION_DAYS: d } = await import("../../app/lib/retention");
  const now = new Date("2026-10-23T12:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
  const shop = "keep.myshopify.com";
  const alert = (email: string, createdAt: Date, notifiedAt: Date | null) => prisma.stockAlert.create({ data: { shop, productId: "1", variantId: email, productTitle: "P", email, createdAt, notifiedAt } });
  await alert("told-old@x.com", ago(400), ago(d.stockAlertSent + 1));
  await alert("told-new@x.com", ago(400), ago(d.stockAlertSent - 1));
  await alert("waiting-old@x.com", ago(d.stockAlertWaiting + 1), null);
  await alert("waiting-new@x.com", ago(d.stockAlertWaiting - 1), null);
  for (const [id, days] of [["old", d.returnRequest + 1], ["new", d.returnRequest - 1]] as const) await prisma.returnRequest.create({ data: { shop, orderId: id, orderName: `#${id}`, email: `${id}@x.com`, items: "[]", reason: "Other", createdAt: ago(days) } });
  for (const [id, days] of [["old", d.reviewerEmail + 1], ["new", d.reviewerEmail - 1]] as const) await prisma.reviewerEmail.create({ data: { shop, reviewId: id, email: `${id}@x.com`, createdAt: ago(days) } });
  for (const [id, days] of [["old", d.trackingCache + 1], ["new", d.trackingCache - 1]] as const) await prisma.trackingCache.create({ data: { shop, number: id, via: "live", data: "{}", checkedAt: ago(days) } });
  for (const [id, days] of [["old", d.trackCode + 1], ["new", d.trackCode - 1]] as const) await prisma.trackCode.create({ data: { shop, orderId: id, kind: "next", code: `C-${id}`, endsAt: ago(days) } });

  assert.equal(await pruneOldData(now), 6);
  assert.deepEqual((await prisma.stockAlert.findMany({ orderBy: { email: "asc" } })).map((a) => a.email), ["told-new@x.com", "waiting-new@x.com"]);
  for (const model of [prisma.returnRequest, prisma.reviewerEmail, prisma.trackCode] as unknown as { count: () => Promise<number> }[]) assert.equal(await model.count(), 1);
  assert.deepEqual((await prisma.trackingCache.findMany()).map((t) => t.number), ["new"]);
});

test("proxy rate limit: per store and per visitor, within 10 minutes", async () => {
  const { tooMany } = await import("../../app/lib/proxy-guard.server");
  const req = (ip: string) => new Request("https://app.example/proxy", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });
  for (let i = 0; i < 3; i++) assert.equal(tooMany(req("198.51.100.1"), "a.myshopify.com", "test", 3), false);
  assert.equal(tooMany(req("198.51.100.1"), "a.myshopify.com", "test", 3), true, "the 4th try from the same visitor");
  assert.equal(tooMany(req("198.51.100.2"), "a.myshopify.com", "test", 3), false, "another visitor");
  assert.equal(tooMany(req("198.51.100.1"), "b.myshopify.com", "test", 3), false, "another store");
  assert.equal(tooMany(req("198.51.100.1"), "a.myshopify.com", "other", 3), false, "another bucket");
});
