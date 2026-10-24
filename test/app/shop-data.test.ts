/**
 * shop/redact removes every row of the store from every table that has a shop column, and nothing of other stores
 * (audit 2026-10-23). The tables are read from the database itself, so a new table that is forgotten in
 * lib/shop-data.server.ts makes this fail. Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shop-data-test-"));
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

type Col = { name: string; type: string; notnull: number; dflt_value: unknown; pk: number };

/** Every table with a "shop" column, and its columns. */
async function shopTables() {
  const tables: { name: string }[] = await prisma.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'`);
  const out: { table: string; cols: Col[] }[] = [];
  for (const t of tables) {
    const cols: Col[] = await prisma.$queryRawUnsafe(`PRAGMA table_info("${t.name}")`);
    if (cols.some((c) => c.name === "shop")) out.push({ table: t.name, cols });
  }
  return out;
}

/** One row for this store, with a made up value in every required column. */
async function fill(table: string, cols: Col[], shop: string) {
  const pks = cols.filter((x) => Number(x.pk) > 0).length;
  // An INTEGER primary key alone is the automatic id.
  const use = cols.filter((c) => !(Number(c.pk) === 1 && /INT/i.test(c.type) && pks === 1));
  const value = (c: Col) => {
    if (c.name === "shop") return shop;
    if (/INT|REAL|DECIMAL|FLOAT|DOUBLE|NUMERIC/i.test(c.type)) return 1;
    if (/BOOL/i.test(c.type)) return 0;
    if (/DATE|TIME/i.test(c.type)) return new Date().toISOString();
    return `${shop}-${c.name}`;
  };
  await prisma.$executeRawUnsafe(`INSERT INTO "${table}" (${use.map((c) => `"${c.name}"`).join(", ")}) VALUES (${use.map(() => "?").join(", ")})`, ...use.map(value));
}

test("shop/redact empties every table with a shop column for that store only", async () => {
  const tables = await shopTables();
  assert.ok(tables.length >= 20, `found ${tables.length} tables`);
  for (const t of tables) for (const shop of ["gone.myshopify.com", "stays.myshopify.com"]) await fill(t.table, t.cols, shop);
  const { removeShopData } = await import("../../app/lib/shop-data.server");
  await removeShopData("gone.myshopify.com");
  const left: string[] = [];
  for (const t of tables) {
    const [gone] = (await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM "${t.table}" WHERE shop = ?`, "gone.myshopify.com")) as { n: bigint | number }[];
    const [stays] = (await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM "${t.table}" WHERE shop = ?`, "stays.myshopify.com")) as { n: bigint | number }[];
    if (Number(gone.n) !== 0) left.push(t.table);
    assert.equal(Number(stays.n), 1, `${t.table}: another store's row was removed`);
  }
  assert.deepEqual(left, [], `rows left after shop/redact in: ${left.join(", ")}`);
});
