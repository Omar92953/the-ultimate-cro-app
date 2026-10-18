/**
 * Paying a return back with store credit (lib/return-saving.server.ts) against a fake Shopify admin and a throwaway database:
 * the refund to store credit through the order, the bonus on top, no gift card or discount code, credit never given twice, and the plan gate.
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


test("the bonus is a plain store credit on the customer, and a zero amount is refused", async () => {
  const a = fake();
  await S.issueBonus(a.admin, { customerId: "gid://shopify/Customer/9", amount: 5, currency: "EUR", expiryDays: 30 });
  const input = a.calls.find((x) => x.op === "CroCredit")!.vars.input;
  assert.equal(input.creditAmount.amount, "5.00");
  assert.ok(input.expiresAt);
  assert.ok(!a.calls.some((x) => x.op === "CroGift" || x.op === "CroCode"));
  await assert.rejects(S.issueBonus(a.admin, { customerId: "gid://shopify/Customer/9", amount: 0, currency: "EUR", expiryDays: 0 }), /nothing to give/);
  await assert.rejects(S.issueBonus(fake({ credit: "errors" }).admin, { customerId: "gid://shopify/Customer/9", amount: 5, currency: "EUR", expiryDays: 0 }), /No store credit/);
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
  // The refund goes through on the second try; the bonus fails (no gift card instead), so the third try gives only the bonus.
  await assert.rejects(S.approveAndSettle(bad.admin, "s.myshopify.com", id, rules, true), /Busy/);
  assert.match((await prisma.returnRequest.findUnique({ where: { id } }))?.creditCode ?? "", /^bonus:/);
  const again = await S.approveAndSettle(bad.admin, "s.myshopify.com", id, rules, true);
  assert.equal(again.status, "credited");
  assert.equal(bad.calls.filter((c) => c.op === "CroProcessRefundCredit").length, 1, "the busy first try never reached the fake, the second worked");
  assert.equal(bad.calls.filter((c) => c.op === "CroProcessNoRefund").length, 0);
  const third = await S.approveAndSettle(bad.admin, "s.myshopify.com", id, rules, true);
  assert.equal(third.status, "credited");
  assert.equal(bad.calls.filter((c) => c.op === "CroProcessRefundCredit").length, 1, "not refunded again");
});

test("when Shopify refuses a refund to store credit, nothing else is tried: the request stays approved for a normal refund", async () => {
  const a = fake({ refundError: "Store credit refunds are not enabled" });
  const id = await row("credit");
  await assert.rejects(S.approveAndSettle(a.admin, "s.myshopify.com", id, rules, true), /Refund it to the original payment instead/);
  assert.ok(!a.calls.some((c) => c.op === "CroCredit" || c.op === "CroGift" || c.op === "CroCode" || c.op === "CroProcessNoRefund"));
  const saved = await prisma.returnRequest.findUnique({ where: { id } });
  assert.deepEqual({ status: saved?.status, kind: saved?.creditKind, code: saved?.creditCode, amount: saved?.creditAmount }, { status: "approved", kind: "", code: "", amount: 0 });
});

test("an error that is not about store credit is not worked around: the credit is not given outside the order", async () => {
  const a = fake({ refundError: "Shopify is busy" });
  const id = await row("credit");
  await assert.rejects(S.approveAndSettle(a.admin, "s.myshopify.com", id, rules, true), /busy/);
  assert.ok(!a.calls.some((c) => c.op === "CroCredit" || c.op === "CroGift" || c.op === "CroCode"));
});

test("a guest order (no customer) gets no store credit, no gift card, no code: the merchant refunds it", async () => {
  const a = fake({ customer: false });
  const id = await row("credit");
  await assert.rejects(S.approveAndSettle(a.admin, "s.myshopify.com", id, rules, true), /no customer/);
  assert.ok(!a.calls.some((c) => ["CroProcessRefundCredit", "CroCredit", "CroGift", "CroCode", "CroProcessNoRefund"].includes(c.op)));
  assert.equal((await prisma.returnRequest.findUnique({ where: { id } }))?.status, "approved");
});

test("a credit started the older way (gift card, code) is not finished with a new one", async () => {
  const a = fake();
  const r = await prisma.returnRequest.create({ data: { shop: "s.myshopify.com", orderId: "gid://shopify/Order/1", orderName: "#1042", email: "a@b.com", items: "[]", reason: "x", status: "approved", returnId: "gid://shopify/Return/1", returnName: "#R", resolution: "credit", quote: 50, currency: "EUR", creditKind: "gift_card", creditCode: "ABCD", creditAmount: 55 } });
  await assert.rejects(S.giveCreditOnReceipt(a.admin, "s.myshopify.com", r.id, rules, true), /older way/);
  assert.equal(a.calls.filter((c) => c.op !== "CroReturnDetail2").length, 0);
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

test("what the shopper reads once the money or credit was given", async () => {
  const { settledSay } = await import("../../app/lib/return-rules");
  assert.equal(settledSay("credited", "store_credit"), "Store credit given");
  assert.equal(settledSay("credited", "gift_card"), "Credit given");
  assert.equal(settledSay("refunded", ""), "Refunded");
});

test("closing the return in Shopify's admin gives the waiting credit, once", async () => {
  const waiting = withReturnRulesDefaults({ saving: { creditWhen: "received", credit: { on: true, bonus: 10, expiryDays: 0 }, restock: true } });
  const make = async (over: Record<string, unknown> = {}) => (await prisma.returnRequest.create({ data: { shop: "s.myshopify.com", orderId: "gid://shopify/Order/1", orderName: "#1042", email: "a@b.com", items: "[]", reason: "x", status: "approved", returnId: `gid://shopify/Return/c${Math.random()}`, returnName: "#1042-R1", resolution: "credit", quote: 50, currency: "EUR", ...over } }));
  const a = fake();
  const r = await make();
  assert.equal(await S.giveCreditWhenClosed(a.admin, "s.myshopify.com", r.returnId, waiting, true), "given");
  const saved = await prisma.returnRequest.findUnique({ where: { id: r.id } });
  assert.deepEqual({ status: saved?.status, kind: saved?.creditKind, amount: saved?.creditAmount }, { status: "credited", kind: "store_credit", amount: 55 });
  // The webhook can arrive twice (and our own processing closes the return too): nothing is given again.
  assert.equal(await S.giveCreditWhenClosed(a.admin, "s.myshopify.com", r.returnId, waiting, true), "skipped");
  assert.equal(a.calls.filter((c) => c.op === "CroProcessRefundCredit").length, 1);
  assert.equal(a.calls.filter((c) => c.op === "CroCredit").length, 1, "the bonus, once");
});

test("a return closed in Shopify gives no credit when it is not a credit waiting for its items", async () => {
  const waiting = withReturnRulesDefaults({ saving: { creditWhen: "received", credit: { on: true, bonus: 10, expiryDays: 0 }, restock: true } });
  const make = async (over: Record<string, unknown>) => (await prisma.returnRequest.create({ data: { shop: "s.myshopify.com", orderId: "gid://shopify/Order/1", orderName: "#1042", email: "a@b.com", items: "[]", reason: "x", status: "approved", returnId: `gid://shopify/Return/s${Math.random()}`, returnName: "#R", resolution: "credit", quote: 50, currency: "EUR", ...over } })).returnId;
  const a = fake();
  const cases: [string, string, boolean?][] = [
    [await make({ resolution: "refund" }), "a refund return"],
    [await make({ resolution: "exchange" }), "an exchange"],
    [await make({ status: "refunded" }), "already refunded by the app"],
    [await make({ status: "closed" }), "closed by the merchant in the app"],
    [await make({ status: "credited", creditKind: "store_credit" }), "already credited"],
    [await make({ creditKind: "store_credit", creditCode: "pending:50.00:5.00" }), "credit already started"],
  ];
  for (const [id, why] of cases) assert.equal(await S.giveCreditWhenClosed(a.admin, "s.myshopify.com", id, waiting, true), "skipped", why);
  const plain = await make({});
  assert.equal(await S.giveCreditWhenClosed(a.admin, "s.myshopify.com", plain, waiting, false), "skipped", "not Pro");
  assert.equal(await S.giveCreditWhenClosed(a.admin, "s.myshopify.com", plain, withReturnRulesDefaults({ saving: { creditWhen: "approved", credit: { on: true } } }), true), "skipped", "credit is given at approval in this store");
  assert.equal(await S.giveCreditWhenClosed(a.admin, "s.myshopify.com", plain, withReturnRulesDefaults({ saving: { creditWhen: "received", credit: { on: false } } }), true), "skipped", "store credit is off");
  assert.equal(await S.giveCreditWhenClosed(a.admin, "s.myshopify.com", "gid://shopify/Return/unknown", waiting, true), "skipped", "not ours");
  assert.equal(a.calls.length, 0, "Shopify was never called");
});
