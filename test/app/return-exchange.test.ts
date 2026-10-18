/** Exchanges on returns (lib/return-exchange.ts, lib/return-exchange.server.ts) against a fake Shopify admin and a throwaway database. Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import type { AdminClient } from "../../app/lib/admin.server";
import { parseExchange, priceDifference } from "../../app/lib/return-exchange";
import { withReturnRulesDefaults } from "../../app/lib/return-rules";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ret-ex-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

type E = typeof import("../../app/lib/return-exchange.server");
type S = typeof import("../../app/lib/return-saving.server");
let E: E, S: S;
before(async () => {
  for (const m of ["20261010130000_return_requests", "20261017000000_shopify_returns", "20261021000000_return_saving", "20261022000000_return_exchanges"]) {
    for (const stmt of fs.readFileSync(`prisma/migrations/${m}/migration.sql`, "utf8").split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  }
  E = await import("../../app/lib/return-exchange.server");
  S = await import("../../app/lib/return-saving.server");
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

const line = (over: Record<string, unknown> = {}) => ({ key: "7", fli: "gid://shopify/FulfillmentLineItem/7", qty: 2, title: "Linen shirt", from: "Medium", to: "Large", variantId: "gid://shopify/ProductVariant/55", oldPrice: 40, newPrice: 40, ...over });

test("the price difference is paid by the shopper when positive, refunded when negative", () => {
  assert.equal(priceDifference([line()]), 0);
  assert.equal(priceDifference([line({ newPrice: 45.5 })]), 11);
  assert.equal(priceDifference([line({ newPrice: 35, qty: 1 }), line({ newPrice: 41, qty: 1 })]), -4);
  assert.deepEqual(parseExchange(JSON.stringify({ lines: [line()], diff: "3" }))?.diff, 3);
  assert.equal(parseExchange("nope"), null);
  assert.equal(parseExchange(JSON.stringify({ lines: [] })), null);
});

function fake(opts: { refund?: boolean; holdFails?: boolean; processError?: string } = {}) {
  const calls: { op: string; vars: Record<string, any> }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  let processed = false;
  const admin = {
    graphql: async (query: string, o?: { variables?: Record<string, any> }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const v = o?.variables ?? {};
      const op = /(?:mutation|query)\s+(\w+)/.exec(query)?.[1] ?? "";
      calls.push({ op, vars: v });
      const data = (d: unknown) => ({ json: async () => ({ data: d }) });
      switch (op) {
        case "CroReturnCreateExchange": return data({ returnCreate: { return: { id: "gid://shopify/Return/5", name: "#1042-R1", status: "OPEN" }, userErrors: [] } });
        case "CroExchangeDetail":
          return data({ return: { id: "gid://shopify/Return/5", order: { id: "gid://shopify/Order/1" },
            returnLineItems: { nodes: [{ id: "gid://shopify/ReturnLineItem/8", quantity: 2, processedQuantity: processed ? 2 : 0 }] },
            exchangeLineItems: { nodes: [{ id: "gid://shopify/ExchangeLineItem/9", quantity: 2, processedQuantity: processed ? 2 : 0 }] } } });
        case "CroOrderFos": return data({ order: { fulfillmentOrders: { nodes: processed ? [{ id: "gid://shopify/FulfillmentOrder/1", status: "CLOSED" }, { id: "gid://shopify/FulfillmentOrder/2", status: "OPEN" }] : [{ id: "gid://shopify/FulfillmentOrder/1", status: "CLOSED" }] } } });
        case "CroSuggestEx": return data({ return: { suggestedFinancialOutcome: { financialTransfer: opts.refund ? { suggestedTransactions: [{ amountSet: { shopMoney: { amount: "6.00", currencyCode: "EUR" } }, parentTransaction: { id: "gid://shopify/OrderTransaction/3" } }] } : null } } });
        case "CroProcessExchange":
          if (opts.processError) return data({ returnProcess: { return: null, userErrors: [{ message: opts.processError }] } });
          processed = true;
          return data({ returnProcess: { return: { id: "r", status: "OPEN" }, userErrors: [] } });
        case "CroHold":
          if (opts.holdFails) return data({ fulfillmentOrderHold: { fulfillmentHold: null, userErrors: [{ message: "Cannot hold" }] } });
          return data({ fulfillmentOrderHold: { fulfillmentHold: { id: "gid://shopify/FulfillmentHold/4" }, userErrors: [] } });
        case "CroRelease": return data({ fulfillmentOrderReleaseHold: { fulfillmentOrder: { id: "x", status: "OPEN" }, userErrors: [] } });
        default: return data({});
      }
    },
  };
  return { admin: admin as unknown as AdminClient, calls };
}

async function row(over: Record<string, unknown> = {}) {
  const r = await prisma.returnRequest.create({ data: { shop: "s.myshopify.com", orderId: "gid://shopify/Order/1", orderName: "#1042", email: "a@b.com", items: "[]", reason: "Wrong size", status: "requested", resolution: "exchange", quote: 80, currency: "EUR", exchange: JSON.stringify({ lines: [line()], diff: 0 }), ...over } });
  return r.id;
}

test("approving an exchange: return with exchange lines, process it, hold the new shipment", async () => {
  const a = fake();
  const id = await row();
  const out = await E.approveExchange(a.admin, "s.myshopify.com", id);
  const create = a.calls.find((c) => c.op === "CroReturnCreateExchange")!.vars.input;
  assert.deepEqual(create.exchangeLineItems, [{ variantId: "gid://shopify/ProductVariant/55", quantity: 2 }]);
  assert.equal(create.returnLineItems[0].fulfillmentLineItemId, "gid://shopify/FulfillmentLineItem/7");
  assert.equal(create.returnLineItems[0].returnReason, "OTHER");
  assert.equal(create.returnLineItems[0].customerNote, "Wrong size");
  const proc = a.calls.find((c) => c.op === "CroProcessExchange")!.vars.input;
  assert.deepEqual(proc.exchangeLineItems, [{ id: "gid://shopify/ExchangeLineItem/9", quantity: 2 }]);
  assert.deepEqual(proc.returnLineItems, [{ id: "gid://shopify/ReturnLineItem/8", quantity: 2 }]);
  assert.equal(proc.financialTransfer, undefined, "an even exchange moves no money");
  assert.deepEqual(a.calls.filter((c) => c.op === "CroHold").map((c) => c.vars.id), ["gid://shopify/FulfillmentOrder/2"]);
  assert.deepEqual(out.holds, [{ fo: "gid://shopify/FulfillmentOrder/2", hold: "gid://shopify/FulfillmentHold/4" }]);
  const saved = await prisma.returnRequest.findUnique({ where: { id } });
  assert.deepEqual({ status: saved?.status, returnId: saved?.returnId, name: saved?.returnName }, { status: "approved", returnId: "gid://shopify/Return/5", name: "#1042-R1" });
  assert.equal(JSON.parse(saved!.holds).length, 1);
});

test("a cheaper exchange is refunded the difference; a failed hold says not to ship", async () => {
  const a = fake({ refund: true, holdFails: true });
  const id = await row({ exchange: JSON.stringify({ lines: [line({ newPrice: 37 })], diff: -6 }) });
  const out = await E.approveExchange(a.admin, "s.myshopify.com", id);
  const proc = a.calls.find((c) => c.op === "CroProcessExchange")!.vars.input;
  assert.deepEqual(proc.financialTransfer, { issueRefund: { orderTransactions: [{ parentId: "gid://shopify/OrderTransaction/3", transactionAmount: { amount: "6.00", currencyCode: "EUR" } }] } });
  assert.match(out.warning, /Do not ship it until the items arrive/);
  assert.equal(out.holds.length, 0);
});

test("a failure after the return was made is retried without a second return", async () => {
  const bad = fake({ processError: "Shopify is busy" });
  const id = await row();
  await assert.rejects(E.approveExchange(bad.admin, "s.myshopify.com", id), /busy/);
  assert.equal((await prisma.returnRequest.findUnique({ where: { id } }))?.returnId, "gid://shopify/Return/5");
  const good = fake();
  await E.approveExchange(good.admin, "s.myshopify.com", id);
  assert.ok(!good.calls.some((c) => c.op === "CroReturnCreateExchange"), "the return already exists");
  assert.ok(good.calls.some((c) => c.op === "CroProcessExchange"));
});

test("when the items arrive the held shipments are released and the exchange is sent", async () => {
  const a = fake();
  const id = await row();
  await E.approveExchange(a.admin, "s.myshopify.com", id);
  await E.releaseExchange(a.admin, "s.myshopify.com", id);
  const rel = a.calls.find((c) => c.op === "CroRelease")!.vars;
  assert.deepEqual({ id: rel.id, holdIds: rel.holdIds }, { id: "gid://shopify/FulfillmentOrder/2", holdIds: ["gid://shopify/FulfillmentHold/4"] });
  const saved = await prisma.returnRequest.findUnique({ where: { id } });
  assert.deepEqual({ status: saved?.status, holds: saved?.holds }, { status: "exchanged", holds: "[]" });
});

test("exchanges need Pro and the merchant's switch", async () => {
  const rules = withReturnRulesDefaults({ saving: { exchange: { on: true } } });
  const id = await row();
  await assert.rejects(S.approveAndSettle(fake().admin, "s.myshopify.com", id, rules, false), /Pro plan/);
  await assert.rejects(S.approveAndSettle(fake().admin, "s.myshopify.com", id, withReturnRulesDefaults({}), true), /Pro plan|switched on/);
  const a = fake();
  const out = await S.approveAndSettle(a.admin, "s.myshopify.com", id, rules, true);
  assert.equal(out.status, "approved");
  assert.ok(a.calls.some((c) => c.op === "CroReturnCreateExchange"));
});

test("the report counts exchanges at the price of the new items", async () => {
  const { returnSavings } = await import("../../app/lib/orders-lookup.server");
  await prisma.returnRequest.create({ data: { shop: "x.myshopify.com", orderId: "o", orderName: "#9", email: "a@b.com", items: "[]", reason: "x", status: "exchanged", resolution: "exchange", currency: "EUR", exchange: JSON.stringify({ lines: [line({ qty: 2, newPrice: 45 })], diff: 10 }) } });
  const r = await returnSavings("x.myshopify.com");
  assert.deepEqual(r.exchanges, { count: 1, value: 90 });
});
