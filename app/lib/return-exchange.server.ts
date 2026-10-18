/**
 * Exchanges (Pro, return saving rules): the shopper asks for another size or colour of the same product instead of money.
 * The Shopify return is made when the merchant approves (returnCreate with exchange line items), then returnProcess creates the
 * exchange's fulfillment orders. We hold them until the merchant says the items arrived, then release them. If the new item costs
 * more, nothing is ever refunded for the returned item, Shopify holds the order for payment, the merchant sends the invoice in the
 * Shopify admin and "ship the exchange" is refused until the order's outstanding balance is 0; if it costs less, only the difference is refunded. Scopes: write_returns, write_merchant_managed_fulfillment_orders.
 */
import { reasonCode } from "./return-rules";
import { AdminError, gql, type AdminClient } from "./admin.server";
import { getReturn, updateReturn } from "./orders-lookup.server";
import { parseExchange } from "./return-exchange";

export { priceDifference, parseExchange, type ExchangeLine, type ExchangePlan } from "./return-exchange";

const messages = (errors: { message: string }[] | undefined) => (errors ?? []).map((e) => e.message).join(" ");

async function fulfillmentOrderIds(admin: AdminClient, orderId: string): Promise<string[]> {
  const d = await gql(admin, `#graphql
    query CroOrderFos($id: ID!) { order(id: $id) { fulfillmentOrders(first: 30) { nodes { id status } } } }`, { id: orderId });
  return (d.order?.fulfillmentOrders?.nodes ?? []).filter((n: { status: string }) => n.status !== "CLOSED" && n.status !== "CANCELLED").map((n: { id: string }) => n.id);
}

/** What the order still owes Shopify (its outstanding balance, shop currency). Throws when Shopify cannot say: never guess when money may be owed. */
export async function amountOwed(admin: AdminClient, orderId: string): Promise<{ amount: number; currency: string }> {
  const d = await gql(admin, `#graphql
    query CroOrderOwed($id: ID!) { order(id: $id) { totalOutstandingSet { shopMoney { amount currencyCode } } } }`, { id: orderId });
  const m = d.order?.totalOutstandingSet?.shopMoney;
  if (!m) throw new AdminError("Shopify did not say what this order still owes.");
  return { amount: Math.max(0, Number(m.amount) || 0), currency: String(m.currencyCode ?? "") };
}

export type ExchangeResult = { holds: { fo: string; hold: string }[]; owes: number; warning: string };

/** Creates the Shopify return with the exchange, processes it (refunding a cheaper difference) and holds the new shipment until the items arrive. */
export async function approveExchange(admin: AdminClient, shop: string, rowId: number): Promise<ExchangeResult> {
  const row = await getReturn(shop, rowId);
  if (!row) throw new AdminError("This request no longer exists. Reload the page.");
  const plan = parseExchange(row.exchange);
  if (!plan) throw new AdminError("This request has no exchange details.");

  let returnId = row.returnId;
  if (!returnId) {
    const made = await gql(admin, `#graphql
      mutation CroReturnCreateExchange($input: ReturnInput!) { returnCreate(returnInput: $input) { return { id name status } userErrors { field message } } }`, {
      input: {
        orderId: row.orderId,
        // returnCreate's line items take returnReasonNote (customerNote is only on returnRequest; Shopify refused it here).
        returnLineItems: plan.lines.map((l) => ({ fulfillmentLineItemId: l.fli, quantity: l.qty, returnReason: reasonCode(row.reason), returnReasonNote: [row.reason, row.note].filter(Boolean).join(": ").slice(0, 300) })),
        exchangeLineItems: plan.lines.map((l) => ({ variantId: l.variantId, quantity: l.qty })),
      },
    });
    const err = messages(made.returnCreate.userErrors);
    if (err) throw new AdminError(err);
    returnId = made.returnCreate.return.id as string;
    // Saved at once: a failure below is retried without making a second return.
    await updateReturn(shop, rowId, { returnId, returnName: made.returnCreate.return.name as string });
  }

  const d = await gql(admin, `#graphql
    query CroExchangeDetail($id: ID!) { return(id: $id) { id order { id } returnLineItems(first: 50) { nodes { ... on ReturnLineItem { id quantity processedQuantity } } } exchangeLineItems(first: 50) { nodes { id quantity processedQuantity } } } }`, { id: returnId });
  if (!d.return) throw new AdminError("This return no longer exists in Shopify.");
  const rl = (d.return.returnLineItems.nodes as { id: string; quantity: number; processedQuantity: number }[]).map((l) => ({ id: l.id, quantity: l.quantity - l.processedQuantity })).filter((l) => l.quantity > 0);
  const ex = (d.return.exchangeLineItems.nodes as { id: string; quantity: number; processedQuantity: number }[]).map((l) => ({ id: l.id, quantity: l.quantity - l.processedQuantity })).filter((l) => l.quantity > 0);
  const orderId = d.return.order.id as string;

  let holds: { fo: string; hold: string }[] = [];
  let warning = "";
  if (rl.length || ex.length) {
    const before = new Set(await fulfillmentOrderIds(admin, orderId).catch(() => [] as string[]));
    // Only a cheaper exchange moves money here, and never more than the difference. A dearer or even one refunds nothing: the returned
    // item is not paid back, the shopper pays the difference (or nothing) and the shipment waits until the order owes nothing.
    let transfer: unknown = undefined;
    if (plan.diff < 0) {
      try {
        const out = await gql(admin, `#graphql
          query CroSuggestEx($id: ID!, $r: [SuggestedOutcomeReturnLineItemInput!]!, $e: [SuggestedOutcomeExchangeLineItemInput!]!) { return(id: $id) { suggestedFinancialOutcome(returnLineItems: $r, exchangeLineItems: $e, refundMethodAllocation: ORIGINAL_PAYMENT_METHODS) { financialTransfer { ... on RefundReturnOutcome { suggestedTransactions { amountSet { shopMoney { amount currencyCode } } parentTransaction { id } } } } } } }`, { id: returnId, r: rl, e: ex });
        const tx: { amountSet: { shopMoney: { amount: string; currencyCode: string } }; parentTransaction: { id: string } | null }[] = out.return?.suggestedFinancialOutcome?.financialTransfer?.suggestedTransactions ?? [];
        let left = Math.round(-plan.diff * 100) / 100;
        const orderTransactions: { parentId: string; transactionAmount: { amount: string; currencyCode: string } }[] = [];
        for (const t of tx) {
          const amount = Math.min(Number(t.amountSet.shopMoney.amount) || 0, left);
          if (!t.parentTransaction?.id || !(amount > 0)) continue;
          orderTransactions.push({ parentId: t.parentTransaction.id, transactionAmount: { amount: amount.toFixed(2), currencyCode: t.amountSet.shopMoney.currencyCode } });
          left = Math.round((left - amount) * 100) / 100;
        }
        if (orderTransactions.length) transfer = { issueRefund: { orderTransactions } };
      } catch {
        transfer = undefined;
      }
    }
    const p = await gql(admin, `#graphql
      mutation CroProcessExchange($input: ReturnProcessInput!) { returnProcess(input: $input) { return { id status } userErrors { field message } } }`, {
      input: { returnId, notifyCustomer: true, returnLineItems: rl, exchangeLineItems: ex, ...(transfer ? { financialTransfer: transfer } : {}) },
    });
    const err = messages(p.returnProcess.userErrors);
    if (err) throw new AdminError(err);

    // The new shipment waits until the merchant says the items arrived.
    try {
      for (const fo of (await fulfillmentOrderIds(admin, orderId)).filter((id) => !before.has(id))) {
        const h = await gql(admin, `#graphql
          mutation CroHold($id: ID!, $hold: FulfillmentOrderHoldInput!) { fulfillmentOrderHold(id: $id, fulfillmentHold: $hold) { fulfillmentHold { id } userErrors { field message } } }`, { id: fo, hold: { reason: "OTHER", reasonNotes: `Waiting for the return ${row.returnName || row.orderName}` } });
        const he = messages(h.fulfillmentOrderHold.userErrors);
        if (he) throw new AdminError(he);
        holds.push({ fo, hold: h.fulfillmentOrderHold.fulfillmentHold.id as string });
      }
    } catch (e) {
      warning = `The exchange was created but its shipment could not be put on hold (${e instanceof Error ? e.message : "unknown"}). Do not ship it until the items arrive.`;
    }
    await updateReturn(shop, rowId, { holds: JSON.stringify(holds) });
  } else {
    holds = (() => { try { return JSON.parse(row.holds || "[]"); } catch { return []; } })();
  }
  // Shopify's own balance is the truth: the shopper owes what the order says, never less than the price difference of the exchange.
  let owes = Math.max(0, plan.diff);
  try {
    const owed = await amountOwed(admin, orderId);
    owes = Math.max(owes, owed.amount);
    if (plan.diff > 0 && owed.amount <= 0.005) {
      warning = `${warning ? `${warning} ` : ""}The exchange costs ${plan.diff.toFixed(2)} more, but Shopify shows nothing owed on this order (credit given outside the order counts as paid). Collect the difference before you ship.`;
    }
  } catch {
    // The check is repeated before the exchange ships.
  }
  await updateReturn(shop, rowId, { status: "approved" });
  return { holds, owes, warning };
}

/** The items arrived: let the exchange ship. */
export async function releaseExchange(admin: AdminClient, shop: string, rowId: number) {
  const row = await getReturn(shop, rowId);
  if (!row) throw new AdminError("This request no longer exists. Reload the page.");
  let holds: { fo: string; hold: string }[] = [];
  try {
    holds = JSON.parse(row.holds || "[]");
  } catch {
    holds = [];
  }
  // Never ship an exchange while the shopper owes money for it: the order's outstanding balance must be 0 (the invoice paid).
  let owed: { amount: number; currency: string };
  try {
    owed = await amountOwed(admin, row.orderId);
  } catch {
    throw new AdminError("Could not check what the shopper still owes for this exchange, so it stays on hold. Open the order in Shopify, check it is paid, and try again.");
  }
  if (owed.amount > 0.005) {
    throw new AdminError(`The shopper still owes ${owed.amount.toFixed(2)} ${owed.currency} for this exchange, so it stays on hold. Send the invoice from the order in Shopify (Collect payment) and ship the exchange once it is paid.`);
  }
  for (const h of holds) {
    const r = await gql(admin, `#graphql
      mutation CroRelease($id: ID!, $holdIds: [ID!]) { fulfillmentOrderReleaseHold(id: $id, holdIds: $holdIds) { fulfillmentOrder { id status } userErrors { field message } } }`, { id: h.fo, holdIds: [h.hold] });
    const err = messages(r.fulfillmentOrderReleaseHold.userErrors);
    // A shipment that is no longer held (released by hand, already sent) is fine.
    if (err && !/not (on )?hold|no hold|already/i.test(err)) throw new AdminError(err);
  }
  await updateReturn(shop, rowId, { status: "exchanged", holds: "[]" });
}
