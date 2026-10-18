/**
 * Return saving rules (Pro): paying a return back with store credit instead of a refund. Credit is given when the return is
 * approved, in this order of preference (docs: tracking-returns §6):
 *   1. Shopify store credit on the order's customer (storeCreditAccountCredit);
 *   2. otherwise a Shopify gift card for the amount (giftCardCreate);
 *   3. otherwise a single use discount code for the exact amount (discountCodeBasicCreate), limited to the customer.
 * Then the return is processed with no money refund, and optionally restocked. Scopes: read_customers,
 * write_store_credit_account_transactions, write_gift_cards, write_discounts, write_returns, read_locations.
 */
import { randomBytes } from "node:crypto";
import { AdminError, gql, type AdminClient } from "./admin.server";
import { creditFor, type ReturnRules } from "./return-rules";
import { approveReturn } from "./shopify-returns.server";
import { getReturn, updateReturn } from "./orders-lookup.server";
import { approveExchange } from "./return-exchange.server";

export type CreditKind = "store_credit" | "gift_card" | "discount_code";
export type Credit = { kind: CreditKind; code: string; amount: number; currency: string };

const messages = (errors: { message: string }[] | undefined) => (errors ?? []).map((e) => e.message).join(" ");
const money = (n: number) => n.toFixed(2);

/** One try at each way of giving credit; the first that works wins. Exported for tests. */
export async function issueCredit(admin: AdminClient, o: { customerId: string | null; orderName: string; amount: number; currency: string; expiryDays: number }): Promise<Credit> {
  if (!(o.amount > 0)) throw new AdminError("There is nothing to give as credit for this return.");
  const expires = o.expiryDays > 0 ? new Date(Date.now() + o.expiryDays * 86_400_000) : null;
  const day = (d: Date) => d.toISOString().slice(0, 10);

  if (o.customerId) {
    try {
      const d = await gql(admin, `#graphql
        mutation CroCredit($id: ID!, $input: StoreCreditAccountCreditInput!) { storeCreditAccountCredit(id: $id, creditInput: $input) { storeCreditAccountTransaction { amount { amount currencyCode } } userErrors { message } } }`, {
        id: o.customerId,
        input: { creditAmount: { amount: money(o.amount), currencyCode: o.currency }, ...(expires ? { expiresAt: day(expires) } : {}) },
      });
      if (!messages(d.storeCreditAccountCredit?.userErrors)) return { kind: "store_credit", code: "", amount: o.amount, currency: o.currency };
    } catch {
      // Store credit is not switched on for this store, or the scope is missing: try the next way.
    }
  }

  try {
    const d = await gql(admin, `#graphql
      mutation CroGift($input: GiftCardCreateInput!) { giftCardCreate(input: $input) { giftCard { id } giftCardCode userErrors { message } } }`, {
      input: { initialValue: money(o.amount), note: `Return ${o.orderName}`, ...(o.customerId ? { customerId: o.customerId, recipientAttributes: { id: o.customerId, message: `Your credit for return ${o.orderName}` } } : {}), ...(expires ? { expiresOn: day(expires) } : {}) },
    });
    const code = d.giftCardCreate?.giftCardCode;
    if (code && !messages(d.giftCardCreate?.userErrors)) return { kind: "gift_card", code: String(code), amount: o.amount, currency: o.currency };
  } catch {
    // Gift cards are not available on this store's plan: the discount code is the last way.
  }

  const code = `RETURN-${randomBytes(5).toString("hex").toUpperCase()}`;
  const ends = expires ?? new Date(Date.now() + 365 * 86_400_000);
  const d = await gql(admin, `#graphql
    mutation CroCode($d: DiscountCodeBasicInput!) { discountCodeBasicCreate(basicCodeDiscount: $d) { codeDiscountNode { id } userErrors { message } } }`, {
    d: {
      title: `Return credit ${o.orderName}`,
      code,
      startsAt: new Date().toISOString(),
      endsAt: ends.toISOString(),
      usageLimit: 1,
      appliesOncePerCustomer: true,
      customerSelection: o.customerId ? { customers: { add: [o.customerId] } } : { all: true },
      customerGets: { value: { discountAmount: { amount: money(o.amount), appliesOnEachItem: false } }, items: { all: true } },
      combinesWith: { productDiscounts: true, orderDiscounts: false, shippingDiscounts: true },
    },
  });
  const err = messages(d.discountCodeBasicCreate?.userErrors);
  if (err) throw new AdminError(`Credit could not be given: ${err}`);
  return { kind: "discount_code", code, amount: o.amount, currency: o.currency };
}

type Detail = {
  id: string;
  status: string;
  order: { id: string; currencyCode: string; customer: { id: string } | null };
  returnLineItems: { nodes: { id: string; quantity: number; processedQuantity: number; fulfillmentLineItem: { id: string } }[] };
  reverseFulfillmentOrders: { nodes: { id: string; lineItems: { nodes: { id: string; totalQuantity: number; fulfillmentLineItem: { id: string } }[] } }[] };
};

export async function detailForCredit(admin: AdminClient, returnId: string): Promise<Detail> {
  const d = await gql(admin, `#graphql
    query CroReturnDetail2($id: ID!) { return(id: $id) { id status order { id currencyCode customer { id } } returnLineItems(first: 50) { nodes { ... on ReturnLineItem { id quantity processedQuantity fulfillmentLineItem { id } } } } reverseFulfillmentOrders(first: 5) { nodes { id lineItems(first: 50) { nodes { id totalQuantity fulfillmentLineItem { id } } } } } } }`, { id: returnId });
  if (!d.return) throw new AdminError("This return no longer exists in Shopify.");
  return d.return;
}

/** What Shopify would refund for the unprocessed items, to the original payment: the base of the credit. 0 when it cannot say. */
async function suggestedAmount(admin: AdminClient, returnId: string, lines: { id: string; quantity: number }[]): Promise<number> {
  try {
    const out = await gql(admin, `#graphql
      query CroSuggestCredit($id: ID!, $items: [SuggestedOutcomeReturnLineItemInput!]!) { return(id: $id) { suggestedFinancialOutcome(returnLineItems: $items, exchangeLineItems: [], refundMethodAllocation: ORIGINAL_PAYMENT_METHODS) { financialTransfer { ... on RefundReturnOutcome { suggestedTransactions { amountSet { shopMoney { amount } } } } } } } }`, { id: returnId, items: lines.map((l) => ({ id: l.id, quantity: l.quantity })) });
    const tx: { amountSet: { shopMoney: { amount: string } } }[] = out.return?.suggestedFinancialOutcome?.financialTransfer?.suggestedTransactions ?? [];
    return tx.reduce((n, t) => n + (Number(t.amountSet.shopMoney.amount) || 0), 0);
  } catch {
    return 0;
  }
}

async function firstLocation(admin: AdminClient): Promise<string | null> {
  try {
    const d = await gql(admin, `#graphql
      query CroLocation { locations(first: 1, query: "active:true") { nodes { id } } }`);
    return d.locations?.nodes?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Dispositions that put the returned items back in stock at the shop's first active location (empty when it cannot). */
export async function restockDispositions(admin: AdminClient, d: Detail, lines: { id: string; quantity: number }[]) {
  const location = await firstLocation(admin);
  if (!location) return new Map<string, unknown[]>();
  const byFulfillmentLine = new Map(d.returnLineItems.nodes.map((l) => [l.id, l.fulfillmentLineItem.id]));
  const rfoLines = d.reverseFulfillmentOrders.nodes.flatMap((r) => r.lineItems.nodes);
  const out = new Map<string, unknown[]>();
  for (const l of lines) {
    const rfo = rfoLines.find((x) => x.fulfillmentLineItem.id === byFulfillmentLine.get(l.id));
    if (rfo) out.set(l.id, [{ reverseFulfillmentOrderLineItemId: rfo.id, quantity: Math.min(l.quantity, rfo.totalQuantity), locationId: location, dispositionType: "RESTOCKED" }]);
  }
  return out;
}

/** Processes the return with no money refund (the shopper got credit), restocking when the merchant asked for it. */
async function processWithoutRefund(admin: AdminClient, d: Detail, restock: boolean) {
  const lines = d.returnLineItems.nodes.map((l) => ({ id: l.id, quantity: l.quantity - l.processedQuantity })).filter((l) => l.quantity > 0);
  if (!lines.length) return;
  const disp = restock ? await restockDispositions(admin, d, lines) : new Map<string, unknown[]>();
  const data = await gql(admin, `#graphql
    mutation CroProcessNoRefund($input: ReturnProcessInput!) { returnProcess(input: $input) { return { id status } userErrors { field message } } }`, {
    input: { returnId: d.id, notifyCustomer: true, returnLineItems: lines.map((l) => ({ ...l, ...(disp.get(l.id) ? { dispositions: disp.get(l.id) } : {}) })) },
  });
  const err = messages(data.returnProcess.userErrors);
  if (err) throw new AdminError(err);
}

/**
 * Approves a return (if it still waits) and, when the shopper chose store credit and the merchant allows it, gives the credit and
 * processes the return. Safe to run again after a failure: credit that was already given is never given twice.
 * `allowCredit` is false when the plan is not Pro.
 */
export async function approveAndSettle(admin: AdminClient, shop: string, rowId: number, rules: ReturnRules, allowCredit: boolean): Promise<{ status: string; credit: Credit | null; creditLater?: boolean }> {
  const row = await getReturn(shop, rowId);
  if (!row) throw new AdminError("This request no longer exists. Reload the page.");
  // An exchange has no Shopify return until it is approved: it is created, processed and its shipment held in one go.
  if (row.resolution === "exchange") {
    if (!allowCredit || !rules.saving.exchange.on) throw new AdminError("Exchanges are on the Pro plan and need to be switched on in Return saving rules.");
    await approveExchange(admin, shop, rowId);
    return { status: "approved", credit: null };
  }
  if (row.returnId && (row.status === "requested" || row.status === "pending")) {
    await approveReturn(admin, row.returnId);
    await updateReturn(shop, rowId, { status: "approved" });
  } else if (!row.returnId) {
    await updateReturn(shop, rowId, { status: "approved" });
  }
  const wantsCredit = row.resolution === "credit" && allowCredit && rules.saving.credit.on && !!row.returnId;
  if (!wantsCredit) return { status: "approved", credit: null };
  // "Give credit when: items received": the credit waits for the merchant to mark the items received (giveCreditOnReceipt).
  if (rules.saving.creditWhen === "received" && !row.creditKind) return { status: "approved", credit: null, creditLater: true };
  return settleCredit(admin, shop, rowId, rules);
}

/** The merchant has the items: gives the credit now. Same safety as approving: credit already given is never given twice. */
export async function giveCreditOnReceipt(admin: AdminClient, shop: string, rowId: number, rules: ReturnRules, allowCredit: boolean): Promise<{ status: string; credit: Credit | null }> {
  const row = await getReturn(shop, rowId);
  if (!row) throw new AdminError("This request no longer exists. Reload the page.");
  if (row.status === "credited") return { status: "credited", credit: row.creditKind ? { kind: row.creditKind as CreditKind, code: row.creditCode, amount: row.creditAmount, currency: row.currency } : null };
  if (row.resolution !== "credit" || !row.returnId || row.status !== "approved") throw new AdminError("Only an approved return paid back with store credit can be given its credit.");
  if (!allowCredit || !rules.saving.credit.on) throw new AdminError("Store credit is on the Pro plan and needs to be switched on in Return saving rules.");
  return settleCredit(admin, shop, rowId, rules);
}

async function settleCredit(admin: AdminClient, shop: string, rowId: number, rules: ReturnRules): Promise<{ status: string; credit: Credit | null }> {
  const row = await getReturn(shop, rowId);
  if (!row || !row.returnId) throw new AdminError("This request no longer exists. Reload the page.");
  const d = await detailForCredit(admin, row.returnId);
  const lines = d.returnLineItems.nodes.map((l) => ({ id: l.id, quantity: l.quantity - l.processedQuantity })).filter((l) => l.quantity > 0);
  let credit: Credit | null = row.creditKind ? { kind: row.creditKind as CreditKind, code: row.creditCode, amount: row.creditAmount, currency: row.currency || d.order.currencyCode } : null;
  if (!credit) {
    const suggested = await suggestedAmount(admin, row.returnId, lines);
    const base = suggested > 0 ? suggested : row.quote;
    credit = await issueCredit(admin, { customerId: d.order.customer?.id ?? null, orderName: row.orderName, amount: creditFor(base, rules.saving.credit.bonus), currency: d.order.currencyCode, expiryDays: rules.saving.credit.expiryDays });
    // Saved before the return is processed, so a failure below can be retried without giving the credit twice.
    await updateReturn(shop, rowId, { creditKind: credit.kind, creditCode: credit.code, creditAmount: credit.amount, creditedAt: new Date() });
  }
  await processWithoutRefund(admin, d, rules.saving.restock);
  await updateReturn(shop, rowId, { status: "credited" });
  return { status: "credited", credit };
}
