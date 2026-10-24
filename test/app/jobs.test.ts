/** The background jobs (audit 2026-10-23, round 2: 5.2 to 5.5). Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import type { AdminClient } from "../../app/lib/admin.server";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobs-test-"));
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

test("5.2: a store that takes too long never holds up the others, and is skipped while it is still running", async () => {
  const { runStores } = await import("../../app/lib/loyalty/sync.server");
  let release: () => void = () => {};
  const slow = new Promise<void>((r) => (release = r));
  const done: string[] = [];
  const one = async (shop: string) => {
    if (shop === "slow") await slow;
    done.push(shop);
  };
  await runStores(["slow", "a", "b"], one, 30);
  assert.deepEqual(done, ["a", "b"], "the next stores ran after the budget");
  await runStores(["slow", "c"], one, 30);
  assert.deepEqual(done, ["a", "b", "c"], "the slow store, still running, was skipped");
  release();
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(done, ["a", "b", "c", "slow"]);
  await runStores(["slow"], one, 30);
  assert.deepEqual(done.at(-1), "slow", "once done it runs again");
});

test("5.3: one failing step after the stores never skips the next steps", async () => {
  const { afterStores } = await import("../../app/lib/loyalty/sync.server");
  const ran: string[] = [];
  await afterStores([
    ["pending", async () => { throw new Error("db down"); }],
    ["emails", async () => void ran.push("emails")],
    ["usage", async () => void ran.push("usage")],
  ]);
  assert.deepEqual(ran, ["emails", "usage"]);
});

test("5.4: THROTTLED answers are tried again (at most 2 times) with a short wait", async () => {
  const A = await import("../../app/lib/admin.server");
  A.GQL_RETRY.waitMs = 1;
  const store = (answers: unknown[]) => {
    let n = 0;
    const admin = {
      graphql: async () => {
        const a = answers[Math.min(n++, answers.length - 1)];
        if (a instanceof Error) throw a;
        return { json: async () => a };
      },
    } as unknown as AdminClient;
    return { admin, calls: () => n };
  };
  const throttled = { errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] };
  const ok = { data: { shop: { id: "1" } } };
  const twice = store([throttled, new Error("GraphQL Client: Throttled"), ok]);
  assert.deepEqual(await A.gql(twice.admin, "query { shop { id } }"), { shop: { id: "1" } });
  assert.equal(twice.calls(), 3);
  const always = store([throttled]);
  await assert.rejects(A.gql(always.admin, "query { shop { id } }"), /Throttled/);
  assert.equal(always.calls(), 3, "the first try and 2 more");
  const other = store([{ errors: [{ message: "Field 'x' doesn't exist" }] }]);
  await assert.rejects(A.gql(other.admin, "query { x }"), /doesn't exist/);
  assert.equal(other.calls(), 1, "other errors are not tried again");
});

test("5.5: the daily cleanup also sweeps old tracking usage and expired assistant connection requests", async () => {
  const { dailyCleanup } = await import("../../app/lib/retention.server");
  const now = new Date();
  await prisma.trackingUsage.create({ data: { shop: "s.myshopify.com", month: "2020-01", count: 3 } });
  await prisma.trackingUsage.create({ data: { shop: "s.myshopify.com", month: now.toISOString().slice(0, 7), count: 1 } });
  await prisma.mcpClient.create({ data: { id: "c1", name: "AI", redirectUris: "[]" } });
  await prisma.mcpRequest.create({ data: { id: "r-old", clientId: "c1", redirectUri: "https://x", state: "", challenge: "c", expiresAt: new Date(now.getTime() - 60_000) } });
  await prisma.mcpRequest.create({ data: { id: "r-new", clientId: "c1", redirectUri: "https://x", state: "", challenge: "c", expiresAt: new Date(now.getTime() + 600_000) } });
  await dailyCleanup(now);
  assert.deepEqual((await prisma.trackingUsage.findMany()).map((u) => u.month), [now.toISOString().slice(0, 7)]);
  assert.deepEqual((await prisma.mcpRequest.findMany()).map((r) => r.id), ["r-new"]);
});
