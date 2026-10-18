/**
 * Track order & Returns pages: find a shopper's order by its number and the email it was placed with.
 * Both must match, so nobody can look up someone else's order by guessing numbers. Only what the
 * shopper needs is returned (status, items, tracking) — never addresses or payment details.
 */
import db from "../db.server";
import { gql, type AdminClient } from "./admin.server";
import { buildTracking, fromShopifyEvent, type Tracking } from "./tracking";

export type OrderSummary = {
  id: string;
  name: string;
  createdAt: string;
  cancelled: boolean;
  payment: string;
  fulfillment: string;
  /** What the order is worth now, in the shop currency (for return rules). */
  total: number;
  currency: string;
  /** What the shopper paid, in the currency of the order (prices only: no payment method, no address). Null when unknown. */
  prices: OrderPrices | null;
  items: { id: string; title: string; variant: string; quantity: number; image: string | null; /** One unit after discounts. */ unitPrice: number; /** Not sent to the page. */ productId: string | null; variantId: number; available: boolean; productType: string; tags: string[]; handle: string }[];
  shipments: { status: string; company: string | null; number: string | null; url: string | null; delivered: string | null; estimated: string | null; /** What Shopify knows: its fulfillment events, dates and status. */ tracking: Tracking | null }[];
};

const clean = (v: unknown, max: number) =>
  Array.from(String(v ?? ""))
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join("")
    .trim()
    .slice(0, max);

export function readLookup(body: Record<string, unknown>) {
  const number = clean(body.order, 30).replace(/^#/, "").replace(/\s+/g, "");
  const email = clean(body.email, 120).toLowerCase();
  if (!/^[A-Za-z0-9-]{1,30}$/.test(number)) return { error: "Please enter your order number (e.g. 1001)." } as const;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter the email you ordered with." } as const;
  return { number, email } as const;
}

type FulfillmentNode = {
  displayStatus: string | null;
  deliveredAt: string | null;
  inTransitAt?: string | null;
  estimatedDeliveryAt: string | null;
  trackingInfo: { company: string | null; number: string | null; url: string | null }[];
  events?: { nodes: { status: string | null; city: string | null; province: string | null; country: string | null; message: string | null; happenedAt: string }[] };
};

/** What Shopify itself knows about a fulfillment: its events (newest first), the dates and the status. Null when it knows nothing yet. */
export function shopifyTracking(f: FulfillmentNode): Tracking | null {
  const events = (f.events?.nodes ?? []).map((e) => ({ status: fromShopifyEvent(e.status), city: e.city ?? "", province: e.province ?? "", country: e.country ?? "", message: e.message ?? "", at: e.happenedAt }));
  // A fulfillment with no events still says when it left (inTransitAt) and its overall status.
  if (!events.length && f.inTransitAt) events.push({ status: "transit", city: "", province: "", country: "", message: "", at: f.inTransitAt });
  if (!events.length && !f.deliveredAt && !f.estimatedDeliveryAt && !f.displayStatus) return null;
  const t = buildTracking({ events, estimated: f.estimatedDeliveryAt, delivered: f.deliveredAt, status: events.length ? undefined : fromShopifyEvent(f.displayStatus) });
  return t;
}

export type OrderPrices = { currency: string; subtotal: number; shipping: number; discounts: number; tax: number; total: number; /** Money already given back (a refund or a partial refund). */ refunded: number };

type PriceSet = { presentmentMoney?: { amount?: string; currencyCode?: string } } | null | undefined;
/** The order's money lines in the currency the shopper paid in (presentment currency). Exported for tests. */
export function orderPrices(o: { subtotalPriceSet?: PriceSet; totalShippingPriceSet?: PriceSet; totalDiscountsSet?: PriceSet; totalTaxSet?: PriceSet; totalPriceSet?: PriceSet; totalRefundedSet?: PriceSet }): OrderPrices | null {
  const n = (s: PriceSet) => Math.round((Number(s?.presentmentMoney?.amount) || 0) * 100) / 100;
  const currency = o.subtotalPriceSet?.presentmentMoney?.currencyCode ?? "";
  if (!currency || !o.totalPriceSet) return null;
  return { currency, subtotal: n(o.subtotalPriceSet), shipping: n(o.totalShippingPriceSet), discounts: n(o.totalDiscountsSet), tax: n(o.totalTaxSet), total: n(o.totalPriceSet), refunded: n(o.totalRefundedSet) };
}

export async function findOrder(admin: AdminClient, number: string, email: string): Promise<OrderSummary | null> {
  const data = await gql(
    admin,
    `#graphql
    query CroFindOrder($q: String!) {
      orders(first: 5, query: $q) {
        nodes {
          id name email createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus currentTotalPriceSet { shopMoney { amount currencyCode } } subtotalPriceSet { presentmentMoney { amount currencyCode } } totalShippingPriceSet { presentmentMoney { amount } } totalDiscountsSet { presentmentMoney { amount } } totalTaxSet { presentmentMoney { amount } } totalPriceSet { presentmentMoney { amount } } totalRefundedSet { presentmentMoney { amount } }
          lineItems(first: 50) { nodes { id title variantTitle currentQuantity image { url } variant { id availableForSale } product { id handle productType tags } discountedUnitPriceSet { presentmentMoney { amount } } } }
          fulfillments(first: 10) { displayStatus deliveredAt inTransitAt estimatedDeliveryAt trackingInfo(first: 3) { company number url } events(first: 30, sortKey: HAPPENED_AT, reverse: true) { nodes { status city province country message happenedAt } } }
        }
      }
    }`,
    { q: `name:#${number}` },
  );
  const order = (data.orders?.nodes ?? []).find((o: { name: string; email: string | null }) => o.name.replace(/^#/, "").toLowerCase() === number.toLowerCase() && (o.email ?? "").toLowerCase() === email);
  if (!order) return null;
  return {
    id: order.id,
    name: order.name,
    createdAt: order.createdAt,
    cancelled: !!order.cancelledAt,
    payment: order.displayFinancialStatus ?? "",
    fulfillment: order.displayFulfillmentStatus ?? "",
    prices: orderPrices(order),
    total: Number(order.currentTotalPriceSet?.shopMoney?.amount) || 0,
    currency: order.currentTotalPriceSet?.shopMoney?.currencyCode ?? "",
    items: order.lineItems.nodes
      .filter((l: { currentQuantity: number }) => l.currentQuantity > 0)
      .map((l: { id: string; title: string; variantTitle: string | null; currentQuantity: number; image: { url: string } | null; product: { id: string; handle?: string; productType?: string; tags?: string[] } | null; discountedUnitPriceSet?: { presentmentMoney: { amount: string } } | null; variant?: { id: string; availableForSale: boolean } | null }) => ({ unitPrice: Number(l.discountedUnitPriceSet?.presentmentMoney.amount) || 0, variantId: Number(l.variant?.id.split("/").pop()) || 0, available: l.variant?.availableForSale ?? false, productType: l.product?.productType ?? "", handle: l.product?.handle ?? "", tags: l.product?.tags ?? [], id: l.id, title: l.title, variant: l.variantTitle && l.variantTitle !== "Default Title" ? l.variantTitle : "", quantity: l.currentQuantity, image: l.image?.url ?? null, productId: l.product?.id ?? null })),
    shipments: order.fulfillments.flatMap((f: FulfillmentNode) =>
      (f.trackingInfo.length ? f.trackingInfo : [{ company: null, number: null, url: null }]).map((t) => ({ status: f.displayStatus ?? "", company: t.company, number: t.number, url: t.url, delivered: f.deliveredAt, estimated: f.estimatedDeliveryAt, tracking: shopifyTracking(f) })),
    ),
  };
}

/* ------------------------------------------------------------------ returns -- */
export type ReturnItem = { id: string; title: string; variant: string; quantity: number };

/** The Shopify returns already on an order (read separately: it needs the returns scope, which a store gets after it approves the update). */
export async function orderReturns(admin: AdminClient, orderId: string): Promise<{ id: string; name: string; status: string }[]> {
  try {
    const data = await gql(admin, `#graphql
      query CroOrderReturns($id: ID!) { order(id: $id) { returns(first: 5) { nodes { id name status } } } }`, { id: orderId });
    return data.order?.returns?.nodes ?? [];
  } catch {
    return [];
  }
}

export type NewReturn = { orderId: string; orderName: string; email: string; items: ReturnItem[]; reason: string; note: string; returnId: string; returnName: string; status: string; resolution?: "refund" | "credit" | "exchange"; exchange?: string; quote?: number; currency?: string; creditBonus?: number };

export async function addReturn(shop: string, r: NewReturn) {
  const open = await db.returnRequest.findFirst({ where: { shop, orderId: r.orderId, status: { in: ["requested", "pending", "approved"] } } });
  if (open) return { duplicate: true, id: open.id } as const;
  const row = await db.returnRequest.create({ data: { shop, orderId: r.orderId, orderName: r.orderName, email: r.email, items: JSON.stringify(r.items), reason: r.reason, note: r.note, returnId: r.returnId, returnName: r.returnName, status: r.status, resolution: r.resolution ?? "refund", exchange: r.exchange ?? "", quote: r.quote ?? 0, currency: r.currency ?? "", creditBonus: r.creditBonus ?? 0 } });
  return { duplicate: false, id: row.id } as const;
}

export async function listReturns(shop: string) {
  const rows = await db.returnRequest.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 200 });
  return rows.map((r) => {
    let items: ReturnItem[] = [];
    try {
      items = JSON.parse(r.items);
    } catch {
      items = [];
    }
    return { id: r.id, orderId: r.orderId, orderName: r.orderName, email: r.email, items, reason: r.reason, note: r.note, status: r.status, createdAt: r.createdAt.toISOString(), returnId: r.returnId, returnName: r.returnName, labelUrl: r.labelUrl, tracking: r.tracking, trackingUrl: r.trackingUrl, declineNote: r.declineNote, refundedAt: r.refundedAt?.toISOString() ?? null, resolution: r.resolution, quote: r.quote, currency: r.currency, creditKind: r.creditKind, creditCode: r.creditCode, creditAmount: r.creditAmount, creditBonus: r.creditBonus, creditedAt: r.creditedAt?.toISOString() ?? null, exchange: r.exchange, holds: r.holds };
  });
}

/**
 * What returns did to the store's money in the last `days` days: value refunded (the items' price when asked) against value
 * kept as credit (what the shopper was given, bonus included), and exchanges later. Real rows only.
 */
export async function returnSavings(shop: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db.returnRequest.findMany({ where: { shop, OR: [{ refundedAt: { gte: since } }, { creditedAt: { gte: since } }, { resolution: "exchange", status: { in: ["approved", "exchanged"] }, createdAt: { gte: since } }] }, select: { quote: true, creditAmount: true, creditBonus: true, refundedAt: true, creditedAt: true, currency: true, resolution: true, exchange: true } });
  const out = { days, currency: rows.find((r) => r.currency)?.currency ?? "", refunds: { count: 0, value: 0 }, credit: { count: 0, value: 0, bonus: 0, waiting: { count: 0, value: 0 } }, exchanges: { count: 0, value: 0 } };
  // Approved credit returns still waiting for the items (credit comes when the merchant has them).
  const waiting = await db.returnRequest.findMany({ where: { shop, resolution: "credit", status: "approved", creditedAt: null, createdAt: { gte: since } }, select: { quote: true, creditBonus: true } });
  out.credit.waiting = { count: waiting.length, value: Math.round(waiting.reduce((n, w) => n + w.quote * (1 + w.creditBonus / 100), 0) * 100) / 100 };
  for (const r of rows) {
    if (r.resolution === "exchange") {
      // What the shopper took instead: the new items' price.
      let value = 0;
      try {
        value = (JSON.parse(r.exchange).lines as { qty: number; newPrice: number }[]).reduce((n, l) => n + l.qty * l.newPrice, 0);
      } catch {
        value = r.quote;
      }
      out.exchanges.count += 1;
      out.exchanges.value += value;
      continue;
    }
    if (r.creditedAt) {
      out.credit.count += 1;
      out.credit.value += r.creditAmount;
      out.credit.bonus += r.creditBonus > 0 ? r.creditAmount - r.creditAmount / (1 + r.creditBonus / 100) : 0;
    } else if (r.refundedAt) {
      out.refunds.count += 1;
      out.refunds.value += r.quote;
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  out.refunds.value = round(out.refunds.value);
  out.credit.value = round(out.credit.value);
  out.credit.bonus = round(out.credit.bonus);
  out.exchanges.value = round(out.exchanges.value);
  return out;
}

/** Exchange requests the shopper made on this order that have no Shopify return yet (it is created when the merchant approves). */
export async function exchangesForOrder(shop: string, orderId: string, email: string) {
  const rows = await db.returnRequest.findMany({ where: { shop, orderId, email: email.toLowerCase(), resolution: "exchange", returnId: "" }, orderBy: { createdAt: "desc" }, take: 5 });
  return rows.map((r) => ({ name: `Exchange ${r.orderName}`, status: r.status === "declined" ? "DECLINED" : "REQUESTED" }));
}

/** The credit given for this order's returns (what the Returns page shows the shopper). */
export async function creditsForOrder(shop: string, orderId: string, email: string) {
  const rows = await db.returnRequest.findMany({ where: { shop, orderId, email: email.toLowerCase(), creditKind: { not: "" } }, orderBy: { createdAt: "desc" }, take: 5 });
  return rows.map((r) => ({ name: r.returnName || `Return ${r.orderName}`, kind: r.creditKind, code: r.creditKind === "store_credit" ? "" : r.creditCode, amount: r.creditAmount, currency: r.currency }));
}

export type ReturnRow = Awaited<ReturnType<typeof listReturns>>[number];

export async function getReturn(shop: string, id: number) {
  return db.returnRequest.findFirst({ where: { shop, id } });
}

export async function updateReturn(shop: string, id: number, data: { status?: string; labelUrl?: string; tracking?: string; trackingUrl?: string; declineNote?: string; refundedAt?: Date | null; creditKind?: string; creditCode?: string; creditAmount?: number; creditedAt?: Date | null; holds?: string; returnId?: string; returnName?: string }) {
  await db.returnRequest.updateMany({ where: { shop, id }, data });
}

/* Privacy webhooks */
export const returnsForEmail = (shop: string, email: string) => db.returnRequest.findMany({ where: { shop, email: email.toLowerCase() } });
export const redactReturnsEmail = (shop: string, email: string) => db.returnRequest.deleteMany({ where: { shop, email: email.toLowerCase() } });
export const redactReturnsShop = (shop: string) => db.returnRequest.deleteMany({ where: { shop } });

/* --------------------------------------------------------- shipments overview -- */
export type ShipmentOverview = { total: number; inTransit: number; delivered: number; delayed: number };

/** The last 30 days of shipped orders, counted by what Shopify knows (no carrier API): in transit, delivered, past the estimated date. */
export async function shipmentOverview(admin: AdminClient): Promise<ShipmentOverview> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const data = await gql(admin, `#graphql
    query CroShipments($q: String!) { orders(first: 100, query: $q, sortKey: CREATED_AT, reverse: true) { nodes { fulfillments(first: 5) { displayStatus deliveredAt estimatedDeliveryAt } } } }`, { q: `created_at:>=${since} fulfillment_status:shipped` });
  const out: ShipmentOverview = { total: 0, inTransit: 0, delivered: 0, delayed: 0 };
  const now = Date.now();
  for (const o of data.orders?.nodes ?? []) {
    for (const f of o.fulfillments as { displayStatus: string | null; deliveredAt: string | null; estimatedDeliveryAt: string | null }[]) {
      out.total++;
      if (f.deliveredAt || f.displayStatus === "DELIVERED") out.delivered++;
      else {
        out.inTransit++;
        if (f.estimatedDeliveryAt && Date.parse(f.estimatedDeliveryAt) < now - 86_400_000) out.delayed++;
      }
    }
  }
  return out;
}
