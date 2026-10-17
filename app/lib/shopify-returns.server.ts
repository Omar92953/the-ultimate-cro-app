/**
 * Returns as real Shopify returns (Admin GraphQL): the shopper's request becomes a Shopify return in
 * REQUESTED, the merchant approves or declines it in the app, attaches a return label or tracking
 * (Shopify emails it), and refunds it with returnProcess. The operations are validated against the
 * 2026-07 schema (scopes: read_returns, write_returns, read_orders). Statuses: REQUESTED, OPEN,
 * DECLINED, CLOSED, CANCELED.
 */
import { AdminError, gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";
import { DEFAULT_RETURN_RULES, reasonCode, withReturnRulesDefaults, type ReturnRules } from "./return-rules";

const fail = (errors: { message: string }[] | undefined) => {
  if (errors?.length) throw new AdminError(errors.map((e) => e.message).join(" "));
};

/* ------------------------------------------------------------------- rules -- */
export async function getReturnRules(admin: AdminClient): Promise<{ rules: ReturnRules; saved: boolean }> {
  const data = await gql(admin, `#graphql
    query CroReturnRules { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "return_rules" }) { field(key: "config") { value } } }`);
  try {
    const raw = JSON.parse(data.metaobjectByHandle?.field?.value ?? "null");
    return { rules: withReturnRulesDefaults(raw), saved: raw !== null };
  } catch {
    return { rules: DEFAULT_RETURN_RULES, saved: false };
  }
}

export async function saveReturnRules(admin: AdminClient, raw: unknown) {
  const rules = withReturnRulesDefaults(raw);
  await upsert(admin, "$app:cro_design", "return_rules", { config: JSON.stringify(rules) });
  return rules;
}

/* ---------------------------------------------------------- what can be returned -- */
export type ReturnableItem = { fulfillmentLineItemId: string; key: string; title: string; variant: string; quantity: number; image: string | null; tags: string[]; /** What one unit was paid, after discounts, in the shop currency. */ price: number };

/** The fulfilled items of an order that can still be returned (Shopify takes out items already returned). */
export async function returnableItems(admin: AdminClient, orderId: string): Promise<ReturnableItem[]> {
  const data = await gql(admin, `#graphql
    query CroReturnable($orderId: ID!) { returnableFulfillments(orderId: $orderId, first: 10) { nodes { id returnableFulfillmentLineItems(first: 50) { nodes { quantity fulfillmentLineItem { id lineItem { id title variantTitle discountedUnitPriceSet { shopMoney { amount } } image { url } product { tags } } } } } } } }`, { orderId });
  type Node = { quantity: number; fulfillmentLineItem: { id: string; lineItem: { id: string; title: string; variantTitle: string | null; discountedUnitPriceSet: { shopMoney: { amount: string } } | null; image: { url: string } | null; product: { tags: string[] } | null } } };
  return (data.returnableFulfillments?.nodes ?? []).flatMap((f: { returnableFulfillmentLineItems: { nodes: Node[] } }) =>
    f.returnableFulfillmentLineItems.nodes.map((n) => ({
      fulfillmentLineItemId: n.fulfillmentLineItem.id,
      key: n.fulfillmentLineItem.id.split("/").pop() ?? "",
      title: n.fulfillmentLineItem.lineItem.title,
      variant: n.fulfillmentLineItem.lineItem.variantTitle && n.fulfillmentLineItem.lineItem.variantTitle !== "Default Title" ? n.fulfillmentLineItem.lineItem.variantTitle : "",
      quantity: n.quantity,
      image: n.fulfillmentLineItem.lineItem.image?.url ?? null,
      tags: (n.fulfillmentLineItem.lineItem.product?.tags ?? []).map((t) => t.toLowerCase()),
      price: Number(n.fulfillmentLineItem.lineItem.discountedUnitPriceSet?.shopMoney.amount) || 0,
    })),
  );
}

/* ----------------------------------------------------------------- the return -- */
/** The shopper's request: a Shopify return in REQUESTED, waiting for the merchant. */
export async function requestReturn(admin: AdminClient, orderId: string, items: { fulfillmentLineItemId: string; quantity: number }[], reason: string, note: string) {
  const data = await gql(admin, `#graphql
    mutation CroReturnRequest($input: ReturnRequestInput!) { returnRequest(input: $input) { return { id name status } userErrors { field message } } }`, {
    input: {
      orderId,
      returnLineItems: items.map((i) => ({ fulfillmentLineItemId: i.fulfillmentLineItemId, quantity: i.quantity, returnReason: reasonCode(reason), customerNote: [reason, note].filter(Boolean).join(": ").slice(0, 255) })),
    },
  });
  fail(data.returnRequest.userErrors);
  return data.returnRequest.return as { id: string; name: string; status: string };
}

export async function approveReturn(admin: AdminClient, returnId: string) {
  const data = await gql(admin, `#graphql
    mutation CroReturnApprove($input: ReturnApproveRequestInput!) { returnApproveRequest(input: $input) { return { id status } userErrors { field message } } }`, { input: { id: returnId, notifyCustomer: true } });
  fail(data.returnApproveRequest.userErrors);
}

export async function declineReturn(admin: AdminClient, returnId: string, note: string, reason: "RETURN_PERIOD_ENDED" | "FINAL_SALE" | "OTHER" = "OTHER") {
  const data = await gql(admin, `#graphql
    mutation CroReturnDecline($input: ReturnDeclineRequestInput!) { returnDeclineRequest(input: $input) { return { id status } userErrors { field message } } }`, { input: { id: returnId, declineReason: reason, declineNote: note.slice(0, 500), notifyCustomer: true } });
  fail(data.returnDeclineRequest.userErrors);
}

type ReturnDetail = {
  id: string;
  status: string;
  order: { id: string; currencyCode: string };
  returnLineItems: { nodes: { id: string; quantity: number; processedQuantity: number }[] };
  reverseFulfillmentOrders: { nodes: { id: string; lineItems: { nodes: { id: string; totalQuantity: number }[] } }[] };
};
async function detail(admin: AdminClient, returnId: string): Promise<ReturnDetail> {
  const data = await gql(admin, `#graphql
    query CroReturnDetail($id: ID!) { return(id: $id) { id name status order { id currencyCode } returnLineItems(first: 50) { nodes { ... on ReturnLineItem { id quantity processedQuantity } } } reverseFulfillmentOrders(first: 5) { nodes { id lineItems(first: 50) { nodes { id totalQuantity } } } } } }`, { id: returnId });
  if (!data.return) throw new AdminError("This return no longer exists in Shopify.");
  return data.return;
}

/** Attaches the merchant's return label (a link to the file) and/or tracking; Shopify emails it to the shopper. */
export async function attachLabel(admin: AdminClient, returnId: string, label: { labelUrl: string; tracking: string; trackingUrl: string }) {
  const d = await detail(admin, returnId);
  const rfo = d.reverseFulfillmentOrders.nodes[0];
  if (!rfo) throw new AdminError("Approve the return first: the label can be added once it is approved.");
  const data = await gql(admin, `#graphql
    mutation CroReverseDelivery($ro: ID!, $items: [ReverseDeliveryLineItemInput!]!, $tracking: ReverseDeliveryTrackingInput, $label: ReverseDeliveryLabelInput) { reverseDeliveryCreateWithShipping(reverseFulfillmentOrderId: $ro, reverseDeliveryLineItems: $items, trackingInput: $tracking, labelInput: $label, notifyCustomer: true) { reverseDelivery { id } userErrors { field message } } }`, {
    ro: rfo.id,
    items: rfo.lineItems.nodes.map((l) => ({ reverseFulfillmentOrderLineItemId: l.id, quantity: l.totalQuantity })),
    tracking: label.tracking || label.trackingUrl ? { number: label.tracking || undefined, url: label.trackingUrl || undefined } : undefined,
    label: label.labelUrl ? { fileUrl: label.labelUrl } : undefined,
  });
  fail(data.reverseDeliveryCreateWithShipping.userErrors);
}

/** Refunds the items still unprocessed, the way Shopify suggests (back to the original payment), and tells the shopper. */
export async function refundReturn(admin: AdminClient, returnId: string, opts: { restock?: boolean } = {}) {
  const d = await detail(admin, returnId);
  const lines = d.returnLineItems.nodes.map((l) => ({ id: l.id, quantity: l.quantity - l.processedQuantity })).filter((l) => l.quantity > 0);
  if (!lines.length) throw new AdminError("Everything in this return was already refunded.");
  const out = await gql(admin, `#graphql
    query CroSuggest($id: ID!, $items: [SuggestedOutcomeReturnLineItemInput!]!) { return(id: $id) { suggestedFinancialOutcome(returnLineItems: $items, exchangeLineItems: [], refundMethodAllocation: ORIGINAL_PAYMENT_METHODS) { financialTransfer { ... on RefundReturnOutcome { suggestedTransactions { amountSet { shopMoney { amount currencyCode } } parentTransaction { id } } } } } } }`, { id: returnId, items: lines });
  const tx: { amountSet: { shopMoney: { amount: string; currencyCode: string } }; parentTransaction: { id: string } | null }[] = out.return?.suggestedFinancialOutcome?.financialTransfer?.suggestedTransactions ?? [];
  const orderTransactions = tx.filter((t) => t.parentTransaction?.id && Number(t.amountSet.shopMoney.amount) > 0).map((t) => ({ parentId: t.parentTransaction!.id, transactionAmount: { amount: t.amountSet.shopMoney.amount, currencyCode: t.amountSet.shopMoney.currencyCode } }));
  if (!orderTransactions.length) throw new AdminError("Shopify could not suggest a refund for this order (for example it was paid with a gift card or in cash). Refund it in the Shopify admin.");
  // Put the items back in stock when the merchant asked for it (Pro, return rules).
  let disp = new Map<string, unknown[]>();
  if (opts.restock) {
    const saving = await import("./return-saving.server");
    disp = await saving.restockDispositions(admin, await saving.detailForCredit(admin, returnId), lines);
  }
  const data = await gql(admin, `#graphql
    mutation CroProcess($input: ReturnProcessInput!) { returnProcess(input: $input) { return { id status } userErrors { field message } } }`, {
    input: { returnId, notifyCustomer: true, returnLineItems: lines.map((l) => ({ ...l, ...(disp.get(l.id) ? { dispositions: disp.get(l.id) } : {}) })), financialTransfer: { issueRefund: { orderTransactions } } },
  });
  fail(data.returnProcess.userErrors);
}

export async function closeReturn(admin: AdminClient, returnId: string) {
  const data = await gql(admin, `#graphql
    mutation CroReturnClose($id: ID!) { returnClose(id: $id) { return { id status } userErrors { field message } } }`, { id: returnId });
  fail(data.returnClose.userErrors);
}

/** The current Shopify status of returns (REQUESTED, OPEN, DECLINED, CLOSED, CANCELED), by return id. */
export async function returnStatuses(admin: AdminClient, ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const data = await gql(admin, `#graphql
    query CroReturnStatuses($ids: [ID!]!) { nodes(ids: $ids) { ... on Return { id status } } }`, { ids });
  return Object.fromEntries((data.nodes ?? []).filter(Boolean).map((n: { id: string; status: string }) => [n.id, n.status]));
}

/** Which access scopes the app has now (the setup checklist shows read_all_orders and the returns scopes). */
export async function grantedScopes(admin: AdminClient): Promise<string[]> {
  const data = await gql(admin, `#graphql
    query CroScopes { currentAppInstallation { accessScopes { handle } } }`);
  return (data.currentAppInstallation?.accessScopes ?? []).map((s: { handle: string }) => s.handle);
}

/** Brings the app's list in line with Shopify (the merchant may approve or close a return in the Shopify admin too). */
export async function syncReturns(admin: AdminClient, shop: string): Promise<void> {
  const { listReturns, updateReturn } = await import("./orders-lookup.server");
  const rows = (await listReturns(shop)).filter((r) => r.returnId && ["requested", "pending", "approved"].includes(r.status));
  if (!rows.length) return;
  const now = await returnStatuses(admin, rows.map((r) => r.returnId)).catch(() => ({}) as Record<string, string>);
  for (const r of rows) {
    const s = now[r.returnId];
    const next = s === "OPEN" ? "approved" : s === "DECLINED" ? "declined" : s === "CLOSED" ? (r.refundedAt ? "refunded" : "closed") : s === "CANCELED" ? "closed" : null;
    if (next && next !== r.status) await updateReturn(shop, r.id, { status: next });
  }
}

/* ------------------------------------------------------------- label files -- */
/** The merchant uploads a return label (a PDF or a picture): staged upload, then a file in Content → Files whose link Shopify emails. */
export async function startLabelUpload(admin: AdminClient, file: { filename: string; mimeType: string; fileSize: number }) {
  const image = file.mimeType.startsWith("image/");
  if (!image && file.mimeType !== "application/pdf") throw new AdminError("Choose a PDF or a picture of the label.");
  if (file.fileSize > 10 * 1024 * 1024) throw new AdminError("The label file can be up to 10 MB.");
  const data = await gql(admin, `#graphql
    mutation CroLabelStage($input: [StagedUploadInput!]!) { stagedUploadsCreate(input: $input) { stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } } }`, {
    input: [{ filename: file.filename, mimeType: file.mimeType, resource: image ? "IMAGE" : "FILE", fileSize: String(file.fileSize), httpMethod: "POST" }],
  });
  fail(data.stagedUploadsCreate.userErrors);
  const t = data.stagedUploadsCreate.stagedTargets[0];
  return { url: t.url as string, resourceUrl: t.resourceUrl as string, parameters: t.parameters as { name: string; value: string }[], image };
}

export async function finishLabelUpload(admin: AdminClient, input: { resourceUrl: string; image: boolean; alt: string }) {
  const data = await gql(admin, `#graphql
    mutation CroLabelFile($files: [FileCreateInput!]!) { fileCreate(files: $files) { files { id fileStatus } userErrors { field message } } }`, {
    files: [{ originalSource: input.resourceUrl, contentType: input.image ? "IMAGE" : "FILE", alt: input.alt.slice(0, 200) }],
  });
  fail(data.fileCreate.userErrors);
  return data.fileCreate.files[0].id as string;
}

/** The public link of an uploaded label once Shopify has processed it (null while it is still processing). */
export async function labelFileUrl(admin: AdminClient, id: string): Promise<string | null> {
  const data = await gql(admin, `#graphql
    query CroLabelStatus($id: ID!) { node(id: $id) { ... on GenericFile { id fileStatus url } ... on MediaImage { id fileStatus image { url } } } }`, { id });
  const n = data.node;
  if (n?.fileStatus === "FAILED") throw new AdminError("Shopify could not process the file. Try another one.");
  return n?.fileStatus === "READY" ? (n.url ?? n.image?.url ?? null) : null;
}
