/**
 * The 10 minute loyalty run reads every changed order even when there are more than one run can read: the next run
 * goes on from where this one stopped (audit 2026-10-23). Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import type { AdminClient } from "../../app/lib/admin.server";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loyalty-sync-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products", CRO_PLAN_OVERRIDE: "pro" });

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

const DAY = 86_400_000;

/** A store with `n` paid orders changed over the last 80 days (oldest first), and no customers to read. */
function store(n: number) {
  const now = Date.now();
  const orders = Array.from({ length: n }, (_, i) => {
    const at = new Date(now - 80 * DAY + i * 3_600_000).toISOString();
    return { id: `gid://shopify/Order/${1000 + i}`, name: `#${1000 + i}`, createdAt: new Date().toISOString(), updatedAt: at, cancelledAt: null, discountCodes: [], displayFinancialStatus: "PAID", currentSubtotalPriceSet: { shopMoney: { amount: "10.00", currencyCode: "USD" } }, currentShippingPriceSet: { shopMoney: { amount: "0" } }, currentTotalTaxSet: { shopMoney: { amount: "0" } }, customer: { id: `gid://shopify/Customer/${5000 + i}`, locale: "en", tags: [], state: "ENABLED", defaultEmailAddress: { emailAddress: `c${i}@example.com`, marketingState: "NOT_SUBSCRIBED" } } };
  });
  const admin = {
    graphql: async (q: string, o?: { variables?: { q?: string; after?: string | null; first?: number } }) => {
      const op = /(query|mutation) (\w+)/.exec(q)?.[2] ?? "";
      const v = o?.variables ?? {};
      let data: unknown = {};
      if (op === "CroLoyaltyOrders") {
        const since = /updated_at:>='([^']+)'/.exec(v.q ?? "")?.[1] ?? "";
        const list = orders.filter((x) => x.updatedAt >= since);
        const start = v.after ? Number(v.after) : 0;
        const page = list.slice(start, start + (v.first ?? 50));
        data = { orders: { pageInfo: { hasNextPage: start + page.length < list.length, endCursor: String(start + page.length) }, nodes: page } };
      } else if (op === "CroLoyaltyCustomers") data = { customers: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } };
      return { json: async () => ({ data }) };
    },
  } as unknown as AdminClient;
  return admin;
}

test("more changed orders than one run reads: the next run goes on, so every order earns", async () => {
  const shop = "many.myshopify.com";
  const { DEFAULT_LOYALTY } = await import("../../app/lib/loyalty/config");
  await prisma.loyaltyProgram.create({ data: { shop, on: true, config: JSON.stringify({ ...DEFAULT_LOYALTY, pendingDays: 0 }), syncedAt: new Date(Date.now() - 90 * DAY) } });
  const { syncShop } = await import("../../app/lib/loyalty/sync.server");
  const admin = store(600);
  await syncShop(shop, admin);
  await syncShop(shop, admin);
  assert.equal(await prisma.loyaltyEvent.count({ where: { shop, kind: "order" } }), 600, "every order earned");
  assert.equal(await prisma.loyaltyMember.count({ where: { shop } }), 600);
  // Once caught up, the run starts from the present again.
  const p = await prisma.loyaltyProgram.findUniqueOrThrow({ where: { shop } });
  assert.ok(Date.now() - p.syncedAt!.getTime() < 60_000);
});
