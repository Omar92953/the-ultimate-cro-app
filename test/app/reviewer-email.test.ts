/** Verified buyer backed by orders (lib/reviewer-email.server.ts) and the privacy redacts. Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import type { AdminClient } from "../../app/lib/admin.server";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reviewer-email-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_orders" });

let R: typeof import("../../app/lib/reviewer-email.server");
before(async () => {
  for (const stmt of fs.readFileSync("prisma/migrations/20261025000000_reviewer_emails/migration.sql", "utf8").split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  R = await import("../../app/lib/reviewer-email.server");
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

type Order = { name: string; email: string | null; cancelledAt: string | null; lineItems: { nodes: { product: { id: string } | null }[] } };
const order = (name: string, email: string, products: string[], cancelledAt: string | null = null): Order => ({ name, email, cancelledAt, lineItems: { nodes: products.map((id) => ({ product: { id } })) } });
function fake(orders: Order[]) {
  const queries: string[] = [];
  const admin = {
    graphql: async (_q: string, o: { variables: { q: string } }) => {
      queries.push(o.variables.q);
      return { json: async () => ({ data: { orders: { nodes: orders } } }) };
    },
  } as unknown as AdminClient;
  return { admin, queries };
}

test("an order with the email ticks the review", async () => {
  const f = fake([order("#1004", "Ana@Example.com", ["gid://shopify/Product/1"])]);
  const r = await R.checkReviewerOrders(f.admin, " ana@example.com ");
  assert.deepEqual(r, { found: true, message: "Order #1004 found." });
  assert.equal(f.queries[0], 'email:"ana@example.com"');
});

test("no order, a bad email, a cancelled order or another person's email is not verified", async () => {
  assert.equal((await R.checkReviewerOrders(fake([]).admin, "ana@example.com")).message, "No order with this email.");
  assert.equal((await R.checkReviewerOrders(fake([]).admin, "nope")).found, false);
  assert.equal((await R.checkReviewerOrders(fake([order("#1", "ana@example.com", [], "2026-01-01")]).admin, "ana@example.com")).found, false);
  assert.equal((await R.checkReviewerOrders(fake([order("#2", "other@example.com", [])]).admin, "ana@example.com")).found, false);
});

test("a product review needs an order with that product", async () => {
  const orders = [order("#1005", "ana@example.com", ["gid://shopify/Product/2"]), order("#1004", "ana@example.com", ["gid://shopify/Product/1"])];
  const yes = await R.checkReviewerOrders(fake(orders).admin, "ana@example.com", "gid://shopify/Product/1");
  assert.deepEqual(yes, { found: true, message: "Order #1004 found with this product." });
  const no = await R.checkReviewerOrders(fake(orders).admin, "ana@example.com", "gid://shopify/Product/9");
  assert.equal(no.found, false);
  assert.match(no.message, /no order with this product/);
});

test("the email is stored per review, cleared when empty, and redacted by customer and by shop", async () => {
  await R.setReviewerEmail("a.myshopify.com", "r1", "Ana@Example.com");
  await R.setReviewerEmail("a.myshopify.com", "r2", "bob@example.com");
  await R.setReviewerEmail("b.myshopify.com", "r3", "ana@example.com");
  assert.equal(await R.getReviewerEmail("a.myshopify.com", "r1"), "ana@example.com");
  await R.setReviewerEmail("a.myshopify.com", "r2", "");
  assert.equal(await R.getReviewerEmail("a.myshopify.com", "r2"), "");
  assert.equal((await R.reviewerEmailsFor("a.myshopify.com", "ANA@example.com")).length, 1);
  assert.equal((await R.redactReviewerEmail("a.myshopify.com", "Ana@Example.com")).count, 1);
  assert.equal(await R.getReviewerEmail("a.myshopify.com", "r1"), "");
  assert.equal(await R.getReviewerEmail("b.myshopify.com", "r3"), "ana@example.com", "other shops untouched");
  await R.redactReviewerEmails("b.myshopify.com");
  assert.equal(await R.getReviewerEmail("b.myshopify.com", "r3"), "");
  await R.setReviewerEmail("a.myshopify.com", "r4", "c@example.com");
  await R.removeReviewerEmail("a.myshopify.com", "r4");
  assert.equal(await R.getReviewerEmail("a.myshopify.com", "r4"), "");
});
