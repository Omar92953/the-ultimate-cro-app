/** customers/redact also removes what is kept by order (audit 2026-10-23, round 2: 2.2). Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "redact-orders-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

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

test("2.2: return requests and Track page codes of the redacted orders go, whatever email they have", async () => {
  const { redactOrders } = await import("../../app/lib/orders-lookup.server");
  const shop = "redact.myshopify.com";
  const ret = (orderId: string, email: string) => prisma.returnRequest.create({ data: { shop, orderId, orderName: "#1", email, items: "[]", reason: "Other" } });
  await ret("gid://shopify/Order/111", "old-address@example.com");
  await ret("gid://shopify/Order/222", "keep@example.com");
  await prisma.returnRequest.create({ data: { shop: "other.myshopify.com", orderId: "gid://shopify/Order/111", orderName: "#1", email: "x@example.com", items: "[]", reason: "Other" } });
  const code = (orderId: string, kind: string) => prisma.trackCode.create({ data: { shop, orderId, kind, code: `C-${orderId}-${kind}`, endsAt: new Date() } });
  await code("gid://shopify/Order/111", "next");
  await code("gid://shopify/Order/111", "friend");
  await code("gid://shopify/Order/222", "next");
  await code("shared", "shared");

  const gone = await redactOrders(shop, [111, "333"]);
  assert.equal(gone, 3);
  assert.deepEqual((await prisma.returnRequest.findMany({ where: { shop } })).map((r) => r.orderId), ["gid://shopify/Order/222"]);
  assert.deepEqual((await prisma.trackCode.findMany({ where: { shop }, orderBy: { orderId: "asc" } })).map((c) => c.orderId), ["gid://shopify/Order/222", "shared"]);
  assert.equal(await prisma.returnRequest.count({ where: { shop: "other.myshopify.com" } }), 1, "another store's row with the same order id stays");
  assert.equal(await redactOrders(shop, []), 0);
});
