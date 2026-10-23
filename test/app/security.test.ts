/** Security (audit 2026-10-23, round 2: 1.4 to 1.8). Run: npm run test:app */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "security-test-"));
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

const DAY = 86_400_000;

test("1.4: an assistant's registration is kept while used and removed after 90 days unused", async () => {
  const A = await import("../../app/lib/mcp/auth.server");
  const now = Date.now();
  await prisma.mcpClient.create({ data: { id: "old-unused", name: "a", redirectUris: "[]", createdAt: new Date(now - 100 * DAY) } });
  await prisma.mcpClient.create({ data: { id: "old-used-lately", name: "b", redirectUris: "[]", createdAt: new Date(now - 300 * DAY), lastUsedAt: new Date(now - 10 * DAY) } });
  await prisma.mcpClient.create({ data: { id: "used-long-ago", name: "c", redirectUris: "[]", createdAt: new Date(now - 300 * DAY), lastUsedAt: new Date(now - 100 * DAY) } });
  await prisma.mcpClient.create({ data: { id: "new", name: "d", redirectUris: '["https://claude.ai/cb"]' } });
  await A.startRequest({ clientId: "new", redirectUri: "https://claude.ai/cb", state: "", challenge: "a".repeat(43), method: "S256" });
  assert.ok((await prisma.mcpClient.findUniqueOrThrow({ where: { id: "new" } })).lastUsedAt, "a connect marks it used");
  await A.sweepMcp(new Date(now));
  assert.deepEqual((await prisma.mcpClient.findMany({ orderBy: { id: "asc" } })).map((c) => c.id), ["new", "old-used-lately"]);
});

test("1.5: calls in one batch are checked against the rate limit one after another", async () => {
  const S = await import("../../app/lib/mcp/server.server");
  const L = await import("../../app/lib/mcp/limits.server");
  S.registerTools({ name: "t_read_batch", description: "x", needs: "read", schema: {}, run: async () => "ok" });
  const was = L.LIMITS.perMinute;
  L.LIMITS.perMinute = 3;
  try {
    const grant = { id: "batch1", shop: "batch.myshopify.com", kind: "token" as const, name: "x", scope: "read" as const, allowPublish: false };
    await S.handleBody(grant, Array.from({ length: 6 }, (_, i) => ({ jsonrpc: "2.0", id: i + 1, method: "tools/call", params: { name: "t_read_batch", arguments: {} } })));
    const rows = await prisma.mcpAudit.findMany({ where: { grantId: "batch1" } });
    assert.equal(rows.filter((r) => r.result !== "limited").length, 3, "only the limit's worth ran");
    assert.equal(rows.filter((r) => r.result === "limited").length, 3);
  } finally {
    L.LIMITS.perMinute = was;
  }
});

test("1.6: a body that says it is too large is refused before it is read", async () => {
  const { tooLarge } = await import("../../app/lib/body-limit.server");
  assert.equal(tooLarge(new Request("https://x/", { method: "POST", headers: { "content-length": String(300 * 1024) }, body: "x" }), 256 * 1024), true);
  assert.equal(tooLarge(new Request("https://x/", { method: "POST", headers: { "content-length": "10" }, body: "0123456789" }), 256 * 1024), false);
  assert.equal(tooLarge(new Request("https://x/", { method: "POST", body: "x" }), 256 * 1024), false, "no length: checked after reading");
});

test("1.7: without the app secret, production refuses to sign or check anything", async () => {
  const { appSecret } = await import("../../app/lib/app-secret.server");
  const { flowSigned } = await import("../../app/lib/loyalty/integrations.server");
  const env = { secret: process.env.SHOPIFY_API_SECRET, node: process.env.NODE_ENV };
  try {
    delete process.env.SHOPIFY_API_SECRET;
    process.env.NODE_ENV = "production";
    assert.throws(() => appSecret(), /SHOPIFY_API_SECRET/);
    // A Flow request signed with an empty key must not pass.
    const body = '{"shopify_domain":"x.myshopify.com"}';
    assert.equal(flowSigned(body, createHmac("sha256", "").update(body).digest("base64")), false);
    process.env.NODE_ENV = "development";
    assert.equal(appSecret(), "development-only");
  } finally {
    process.env.SHOPIFY_API_SECRET = env.secret;
    process.env.NODE_ENV = env.node;
  }
  assert.equal(appSecret(), "s");
});

test("1.8: two new shipments at the same moment can't both take the last live shipment of the month", async () => {
  const T = await import("../../app/lib/tracking/tracking.server");
  const { PLANS } = await import("../../app/lib/plans");
  const shop = "race-ship.myshopify.com";
  process.env.TRACKING_PROVIDER_KEY = "test-key";
  await prisma.trackingConfig.create({ data: { shop, source: "live" } });
  const limit = PLANS.growth.limits.liveShipments!;
  await prisma.trackingUsage.create({ data: { shop, month: new Date().toISOString().slice(0, 7), count: limit - 1 } });
  const real = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ code: 0, data: { accepted: [] } }))) as unknown as typeof fetch;
  try {
    await Promise.all(["R1", "R2"].map((n) => T.resolveTracking(shop, "growth", { number: n, carrier: "", country: "" }, null)));
    assert.equal((await prisma.trackingUsage.findFirstOrThrow({ where: { shop } })).count, limit, "exactly the limit, not one over");
  } finally {
    globalThis.fetch = real;
    delete process.env.TRACKING_PROVIDER_KEY;
  }
});
