/**
 * After a plan change the loyalty widget follows the new plan (live check on Testing 3, 2026-10-24: on Starter the
 * launcher still said "Join and earn rewards" though no points are earned below Growth). Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import type { AdminClient } from "../../app/lib/admin.server";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plan-loyalty-test-"));
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
  delete process.env.CRO_PLAN_OVERRIDE;
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Keeps the last storefront copy of the program ($app:cro_design "loyalty"). */
function fakeAdmin() {
  const saved: { handle?: string; config?: { on: boolean }; calls: number } = { calls: 0 };
  const admin = {
    graphql: async (q: string, o?: { variables?: Record<string, any> }) => { // eslint-disable-line @typescript-eslint/no-explicit-any -- raw GraphQL variables
      saved.calls++;
      if (/metaobjectUpsert/.test(q)) {
        const v = o!.variables!;
        saved.handle = v.handle.handle;
        saved.config = JSON.parse(v.metaobject.fields.find((f: { key: string }) => f.key === "config").value);
        return new Response(JSON.stringify({ data: { metaobjectUpsert: { metaobject: { id: "gid://shopify/Metaobject/1", handle: v.handle.handle }, userErrors: [] } } }));
      }
      return new Response(JSON.stringify({ data: {} }));
    },
  } as unknown as AdminClient;
  return { admin, saved };
}

test("plan change: the loyalty widget is hidden below Growth and back after an upgrade; stores without a program are left alone", async () => {
  const { republishLoyalty } = await import("../../app/lib/loyalty/storefront.server");
  const shop = "plan-loy.myshopify.com";

  const none = fakeAdmin();
  process.env.CRO_PLAN_OVERRIDE = "starter";
  assert.equal(await republishLoyalty(none.admin, shop), false);
  assert.equal(none.saved.calls, 0, "no program: nothing written to the store");

  await prisma.loyaltyProgram.create({ data: { shop, on: true } });
  for (const [plan, on] of [["starter", false], ["free", false], ["growth", true], ["pro", true]] as const) {
    const fa = fakeAdmin();
    process.env.CRO_PLAN_OVERRIDE = plan;
    assert.equal(await republishLoyalty(fa.admin, shop), true);
    assert.equal(fa.saved.handle, "loyalty");
    assert.equal(fa.saved.config?.on, on, `${plan}: widget ${on ? "shown" : "hidden"}`);
  }

  // Switched off by the merchant: hidden on every plan.
  await prisma.loyaltyProgram.update({ where: { shop }, data: { on: false } });
  const off = fakeAdmin();
  process.env.CRO_PLAN_OVERRIDE = "pro";
  await republishLoyalty(off.admin, shop);
  assert.equal(off.saved.config?.on, false);
});
