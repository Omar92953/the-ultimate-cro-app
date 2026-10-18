/**
 * Paying a return back with store credit (lib/return-saving.server.ts) against a fake Shopify admin and a throwaway database:
 * the order of preference (store credit, gift card, discount code), the exact amounts, credit never given twice, and the plan gate.
 * Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import type { AdminClient } from "../../app/lib/admin.server";
import { DEFAULT_RETURN_RULES, withReturnRulesDefaults, withSaving } from "../../app/lib/return-rules";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ret-save-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

type S = typeof import("../../app/lib/return-saving.server");
let S: S;
before(async () => {
  for (const m of ["20261010130000_return_requests", "20261017000000_shopify_returns", "20261021000000_return_saving", "20261022000000_return_exchanges"]) {
    for (const stmt of fs.readFileSync(`prisma/migrations/${m}/migration.sql`, "utf8").split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  }
  S = await import("../../app/lib/return-saving.server");
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

type Call = { op: string; vars: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
function fake(opts: { credit?: "ok" | "errors" | "throws"; gift?: "ok" | "errors" | "throws"; customer?: boolean; suggested?: string[]; location?: boolean; refundError?: string } = {}) {
  const calls: Call[] = [];
  const admin = {
    graphql: async (query: string, o?: { variables?: Record<string, any> }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const v = o?.variables ?? {};
      const op = /(?:mutation|query)\s+(\w+)/.exec(query)?.[1] ?? "";
      calls.push({ op, vars: v });
      const data = (d: unknown) => ({ json: async () => ({ data: d }) });
      switch (op) {
        case "CroReturnApprove": return data({ returnApproveRequest: { return: { id: "r", status: "OPEN" }, userErrors: [] } });
        case "CroReturnDetail2":
          return data({ return: { id: "gid://shopify/Return/1", status: "OPEN", order: { id: "gid://shopify/Order/1", currencyCode: "EUR", customer: opts.customer === false ? null : { id: "gid://shopify/Customer/9" } },
            returnLineItems: { nodes: [{ id: "gid://shopify/ReturnLineItem/5", quantity: 2, processedQuantity: 0, fulfillmentLineItem: { id: "gid://shopify/FulfillmentLineItem/7" } }] },
            reverseFulfillmentOrders: { nodes: [{ id: "gid://shopify/ReverseFulfillmentOrder/3", lineItems: { nodes: [{ id: "gid://shopify/ReverseFulfillmentOrderLineItem/4", totalQuantity: 2, fulfillmentLineItem: { id: "gid://shopify/FulfillmentLineItem/7" } }] } }] } } });
        case "CroSuggest": return data({ return: { suggestedFinancialOutcome: { financialTransfer: { suggestedTransactions: (opts.suggested ?? ["30.00", "20.00"]).map((a) => ({ amountSet: { shopMoney: { amount: a } } })) } } } });
        case "CroCredit":
          if (opts.credit === "throws") throw new AdminErr("Store credit is not enabled");
          return data({ storeCreditAccountCredit: { storeCreditAccountTransaction: {}, userErrors: opts.credit === "errors" ? [{ message: "No store credit" }] : [] } });
        case "CroGift":
          if (opts.gift === "throws") throw new AdminErr("Gift cards are not available");
          return data({ giftCardCreate: opts.gift === "errors" ? { giftCard: null, giftCardCode: null, userErrors: [{ message: "Not on this plan" }] } : { giftCard: { id: "g" }, giftCardCode: "ABCD1234EFGH5678", userErrors: [] } });
        case "CroCode": return data({ discountCodeBasicCreate: { codeDiscountNode: { id: "d" }, userErrors: [] } });
        case "CroLocation": return data({ locations: { nodes: opts.location === false ? [] : [{ id: "gid://shopify/Location/1" }] } });
        case "CroProcessRefundCredit":
          if (opts.refundError) return data({ returnProcess: { return: null, userErrors: [{ message: opts.refundError }] } });
          return data({ returnProcess: { return: { id: "r", status: "CLOSED" }, userErrors: [] } });
        case "CroProcessNoRefund": return data({ returnProcess: { return: { id: "r", status: "CLOSED" }, userErrors: [] } });
        default: return data({});
      }
    },
  };
  return { admin: admin as unknown as AdminClient, calls };
}
class AdminErr extends Error {}

const base = { customerId: "gid://shopify/Customer/9", orderName: "#1042", amount: 55, currency: "EUR", expiryDays: 0 };

test("store credit first, then a gift card, then a single use discount code", async () => {
  const a = fake();
  assert.deepEqual(await S.issueCredit(a.admin, base), { kind: "store_credit", code: "", amount: 55, currency: "EUR" });
  assert.equal(a.calls.find((c) => c.op === "CroCredit")?.vars.input.creditAmount.amount, "55.00");
  assert.equal(a.calls.find((c) => c.op === "CroCredit")?.vars.id, "gid://shopify/Customer/9");

  const noCredit = fake({ credit: "errors" });
  const g = await S.issueCredit(noCredit.admin, { ...base, expiryDays: 30 });
  assert.equal(g.kind, "gift_card");
  assert.equal(g.code, "ABCD1234EFGH5678");
  const gi = noCredit.calls.find((c) => c.op === "CroGift")!.vars.input;
  assert.equal(gi.initialValue, "55.00");
  assert.equal(gi.customerId, "gid://shopify/Customer/9");
  assert.ok(gi.expiresOn, "an expiry date");

  const thrown = fake({ credit: "throws", gift: "throws" });
  const c = await S.issueCredit(thrown.admin, { ...base, expiryDays: 90 });
  assert.equal(c.kind, "discount_code");
  assert.match(c.code, /^RETURN-[0-9A-F]{10}$/);
  const di = thrown.calls.find((x) => x.op === "CroCode")!.vars.d;
  assert.equal(di.usageLimit, 1);
  assert.equal(di.customerGets.value.discountAmount.amount, "55.00");
  assert.deepEqual(di.customerSelection, { customers: { add: ["gid://shopify/Customer/9"] } });
  assert.equal(di.code, c.code);
  assert.ok(Date.parse(di.endsAt) > Date.now() + 80 * 864e5, "a real expiry");
});

test("a guest order skips store credit, and a zero amount is refused", async () => {
  const a = fake({ gift: "errors" });
  const c = await S.issueCredit(a.admin, { ...base, customerId: null });
  assert.equal(c.kind, "discount_code");
  assert.ok(!a.calls.some((x) => x.op === "CroCredit"));
  assert.deepEqual(a.calls.find((x) => x.op === "CroCode")!.vars.d.customerSelection, { all: true });
  assert.equal(a.calls.find((x) => x.op === "CroCode")!.vars.d.endsAt.slice(0, 4) >= String(new Date().getFullYear()), true);
  await assert.rejects(S.issueCredit(a.admin, { ...base, amount: 0 }), /nothing to give/);
});

const rules = withReturnRulesDefaults({ saving: { credit: { on: true, bonus: 10, expiryDays: 0 }, restock: true } });
async function row(resolution: string, status = "requested") {
  const r = await prisma.returnRequest.create({ data: { shop: "s.myshopify.com", orderId: "gid://shopify/Order/1", orderName: "#1042", email: "a@b.com", items: "[]", reason: "Wrong size", status, returnId: "gid://shopify/Return/1", returnName: "#1042-R1", resolution, quote: 50, currency: "EUR" } });
  return r.id;
}

test("approving a store credit return: the items are refunded to store credit through the order, the bonus is added on top, restock", async () => {
  const a = fake();
  const id = await row("credit");
  const out = await S.approveAndSettle(a.admin, "s.myshopify.com", id, rules, true);
  assert.equal(out.status, "credited");
  assert.equal(out.credit?.amount, 55, "50.00 suggested plus the 10% bonus");
  const ops = a.calls.map((c) => c.op);
  assert.deepEqual(ops.filter((o) => ["CroReturnApprove", "CroProcessRefundCredit", "CroCredit", "CroProcessNoRefund"].includes(o)), ["CroReturnApprove", "CroProcessRefundCredit", "CroCredit"]);
  const input = a.calls.find((c) => c.op === "CroProcessRefundCredit")!.vars.input;
  // The order's own money is right: a refund whose method is store credit, for what the items cost.
  assert.deepEqual(input.financialTransfer, { issueRefund: { orderTransactions: [], refundMethods: [{ storeCreditRefund: { amount: { amount: "50.00", currencyCode: "EUR" } } }] } });
  assert.equal(input.returnLineItems[0].dispositions[0].dispositionType, "RESTOCKED");
  assert.equal(input.returnLineItems[0].dispositions[0].locationId, "gid://shopify/Location/1");
  // Only the bonus is a plain credit outside the order.
  assert.equal(a.calls.find((c) => c.op === "CroCredit")!.vars.input.creditAmount.amount, "5.00");
  const saved = await prisma.returnRequest.findUnique({ where: { id } });
  assert.deepEqual({ status: saved?.status, kind: saved?.creditKind, amount: saved?.creditAmount, code: saved?.creditCode }, { status: "credited", kind: "store_credit", amount: 55, code: "done" });
});

test("a failure never gives the refund or the bonus twice", async () => {
  const id = await row("credit");
  const bad = fake();
  const orig = bad.admin.graphql.bind(bad.admin) as (q: string, o?: unknown) => Promise<{ json: () => Promise<unknown> }>;
  let failRefund = true, failBonus = true;
  (bad.admin as unknown as { graphql: unknown }).graphql = async (q: string, o?: unknown) => {
    if (/mutation CroProcessRefundCredit/.test(q) && failRefund) {
      failRefund = false;
      return { json: async () => ({ data: { returnProcess: { return: null, userErrors: [{ message: "Shopify is busy" }] } } }) };
    }
    if (/mutation CroCredit/.test(q) && failBonus) {
      failBonus = false;
      return { json: async () => ({ data: { storeCreditAccountCredit: { storeCreditAccountTransaction: null, userErrors: [{ message: "Busy" }] } } }) };
    }
    return orig(q, o);
  };
  await assert.rejects(S.approveAndSettle(bad.admin, "s.myshopify.com", id, rules, true), /busy/);
  assert.match((await prisma.returnRequest.findUnique({ where: { id } }))?.creditCode ?? "", /^pending:/, "recorded before the refund");
  // The refund goes through on the second try; the bonus fails (store credit then falls back to a gift card), so the whole credit still completes once.
  const again = await S.approveAndSettle(bad.admin, "s.myshopify.com", id, rules, true);
  assert.equal(again.status, "credited");
  assert.equal(bad.calls.filter((c) => c.op === "CroProcessRefundCredit").length, 1, "the busy first try never reached the fake, the second worked");
  assert.equal(bad.calls.filter((c) => c.op === "CroProcessNoRefund").length, 0);
  const third = await S.approveAndSettle(bad.admin, "s.myshopify.com", id, rules, true);
  assert.equal(third.status, "credited");
  assert.equal(bad.calls.filter((c) => c.op === "CroProcessRefundCredit").length, 1, "not refunded again");
});

test("when Shopify refuses a refund to store credit, the credit is given the older way, once", async () => {
  const a = fake({ refundError: "Store credit refunds are not enabled" });
  const id = await row("credit");
  const out = await S.approveAndSettle(a.admin, "s.myshopify.com", id, rules, true);
  assert.equal(out.status, "credited");
  assert.equal(out.credit?.amount, 55);
  assert.equal(a.calls.find((c) => c.op === "CroCredit")!.vars.input.creditAmount.amount, "55.00");
  assert.equal(a.calls.filter((c) => c.op === "CroProcessNoRefund").length, 1);
  const saved = await prisma.returnRequest.findUnique({ where: { id } });
  assert.deepEqual({ kind: saved?.creditKind, code: saved?.creditCode, amount: saved?.creditAmount }, { kind: "store_credit", code: "", amount: 55 });
});

test("an error that is not about store credit is not worked around: the credit is not given outside the order", async () => {
  const a = fake({ refundError: "Shopify is busy" });
  const id = await row("credit");
  await assert.rejects(S.approveAndSettle(a.admin, "s.myshopify.com", id, rules, true), /busy/);
  assert.ok(!a.calls.some((c) => c.op === "CroCredit" || c.op === "CroGift" || c.op === "CroCode"));
});

test("a guest order (no customer) is credited the older way with a gift card", async () => {
  const a = fake({ customer: false });
  const id = await row("credit");
  const out = await S.approveAndSettle(a.admin, "s.myshopify.com", id, rules, true);
  assert.equal(out.credit?.kind, "gift_card");
  assert.ok(!a.calls.some((c) => c.op === "CroProcessRefundCredit"));
  assert.equal(a.calls.filter((c) => c.op === "CroProcessNoRefund").length, 1);
});

test("a refund return is only approved, and credit needs Pro and the merchant's switch", async () => {
  const a = fake();
  const refund = await row("refund");
  assert.equal((await S.approveAndSettle(a.admin, "s.myshopify.com", refund, rules, true)).status, "approved");
  assert.ok(!a.calls.some((c) => c.op === "CroCredit"));
  const b = fake();
  const wantsCredit = await row("credit");
  assert.equal((await S.approveAndSettle(b.admin, "s.myshopify.com", wantsCredit, rules, false)).status, "approved", "not Pro: no credit");
  const c = fake();
  const off = await row("credit");
  assert.equal((await S.approveAndSettle(c.admin, "s.myshopify.com", off, DEFAULT_RETURN_RULES, true)).status, "approved", "credit switched off");
  assert.ok(![...b.calls, ...c.calls].some((x) => x.op === "CroCredit" || x.op === "CroGift" || x.op === "CroCode"));
});

test("when Shopify cannot suggest a refund, the credit comes from the items' price", async () => {
  const a = fake({ suggested: [] });
  const id = await row("credit");
  const out = await S.approveAndSettle(a.admin, "s.myshopify.com", id, rules, true);
  assert.equal(out.credit?.amount, 55, "the quoted 50 plus 10%");
});

test("the savings report counts credit and refunds in the window", async () => {
  const { returnSavings } = await import("../../app/lib/orders-lookup.server");
  await prisma.returnRequest.create({ data: { shop: "r.myshopify.com", orderId: "o", orderName: "#1", email: "x@y.z", items: "[]", reason: "x", status: "refunded", resolution: "refund", quote: 40, currency: "USD", refundedAt: new Date() } });
  await prisma.returnRequest.create({ data: { shop: "r.myshopify.com", orderId: "o2", orderName: "#2", email: "x@y.z", items: "[]", reason: "x", status: "credited", resolution: "credit", quote: 50, currency: "USD", creditKind: "store_credit", creditAmount: 55, creditBonus: 10, creditedAt: new Date() } });
  await prisma.returnRequest.create({ data: { shop: "r.myshopify.com", orderId: "o3", orderName: "#3", email: "x@y.z", items: "[]", reason: "x", status: "refunded", resolution: "refund", quote: 99, currency: "USD", refundedAt: new Date(Date.now() - 40 * 864e5) } });
  const r = await returnSavings("r.myshopify.com");
  assert.deepEqual(r.refunds, { count: 1, value: 40 });
  assert.deepEqual(r.credit, { count: 1, value: 55, bonus: 5, waiting: { count: 0, value: 0 } });
});

test("when credit is given: new stores wait for the items, stores that saved rules before keep approving at once", () => {
  assert.equal(withSaving({}).creditWhen, "received", "nothing saved yet: items received");
  assert.equal(withSaving({ credit: { on: true } }).creditWhen, "approved", "rules saved before this setting existed");
  assert.equal(withSaving({ credit: { on: true }, creditWhen: "received" }).creditWhen, "received");
  assert.equal(withSaving({ creditWhen: "nonsense" }).creditWhen, "approved");
});

test("items received: approving gives no credit, receiving it gives it once", async () => {
  const waiting = withReturnRulesDefaults({ saving: { creditWhen: "received", credit: { on: true, bonus: 10, expiryDays: 0 }, restock: true } });
  const a = fake();
  const id = await row("credit");
  const out = await S.approveAndSettle(a.admin, "s.myshopify.com", id, waiting, true);
  assert.deepEqual({ status: out.status, credit: out.credit, later: out.creditLater }, { status: "approved", credit: null, later: true });
  assert.ok(!a.calls.some((c) => c.op === "CroCredit" || c.op === "CroProcessNoRefund" || c.op === "CroProcessRefundCredit"), "no credit, no processing yet");
  const given = await S.giveCreditOnReceipt(a.admin, "s.myshopify.com", id, waiting, true);
  assert.deepEqual({ status: given.status, amount: given.credit?.amount }, { status: "credited", amount: 55 });
  const again = await S.giveCreditOnReceipt(a.admin, "s.myshopify.com", id, waiting, true);
  assert.equal(again.status, "credited");
  assert.equal(a.calls.filter((c) => c.op === "CroCredit").length, 1, "never issued twice");
  const other = await row("refund", "approved");
  await assert.rejects(S.giveCreditOnReceipt(a.admin, "s.myshopify.com", other, waiting, true), /store credit/);
  const free = await row("credit", "approved");
  await assert.rejects(S.giveCreditOnReceipt(a.admin, "s.myshopify.com", free, waiting, false), /Pro/);
});
