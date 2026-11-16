/** Order lookups that found nothing are limited per store and typed email, in the database (audit 2026-11-14, A8). Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lookup-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
type G = typeof import("../../app/lib/lookup-guard.server");
let G: G;
before(async () => {
  const sql = fs.readFileSync("prisma/migrations/20261116000000_lookup_miss/migration.sql", "utf8");
  for (const stmt of sql.split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  G = await import("../../app/lib/lookup-guard.server");
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("one email is blocked after 20 misses in an hour, from any visitor; others still work; an hour later it works again", async () => {
  const now = new Date();
  for (let i = 0; i < G.MISSES_PER_EMAIL; i++) await G.countMiss("a.myshopify.com", "Sara@Example.com", now);
  assert.equal(await G.lookupBlocked("a.myshopify.com", "sara@example.com", now), true);
  assert.equal(await G.lookupBlocked("a.myshopify.com", "other@example.com", now), false);
  assert.equal(await G.lookupBlocked("b.myshopify.com", "sara@example.com", now), false, "another store is not touched");
  assert.equal(await G.lookupBlocked("a.myshopify.com", "sara@example.com", new Date(now.getTime() + 61 * 60_000)), false);
});

test("a whole store is braked after 300 misses in an hour, and privacy requests remove the rows", async () => {
  const now = new Date();
  await prisma.lookupMiss.createMany({ data: Array.from({ length: G.MISSES_PER_STORE }, (_, i) => ({ shop: "c.myshopify.com", email: `x${i}@example.com`, createdAt: now })) });
  assert.equal(await G.lookupBlocked("c.myshopify.com", "new@example.com", now), true);
  assert.equal((await G.redactLookupEmail("c.myshopify.com", "X1@example.com")).count, 1);
  await G.removeShopLookups("c.myshopify.com");
  assert.equal(await prisma.lookupMiss.count({ where: { shop: "c.myshopify.com" } }), 0);
});
