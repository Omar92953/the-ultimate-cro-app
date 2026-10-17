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
  items: { id: string; title: string; variant: string; quantity: number; image: string | null }[];
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

export async function findOrder(admin: AdminClient, number: string, email: string): Promise<OrderSummary | null> {
  const data = await gql(
    admin,
    `#graphql
    query CroFindOrder($q: String!) {
      orders(first: 5, query: $q) {
        nodes {
          id name email createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus
          lineItems(first: 50) { nodes { id title variantTitle currentQuantity image { url } } }
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
    items: order.lineItems.nodes
      .filter((l: { currentQuantity: number }) => l.currentQuantity > 0)
      .map((l: { id: string; title: string; variantTitle: string | null; currentQuantity: number; image: { url: string } | null }) => ({ id: l.id, title: l.title, variant: l.variantTitle && l.variantTitle !== "Default Title" ? l.variantTitle : "", quantity: l.currentQuantity, image: l.image?.url ?? null })),
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

export type NewReturn = { orderId: string; orderName: string; email: string; items: ReturnItem[]; reason: string; note: string; returnId: string; returnName: string; status: string };

export async function addReturn(shop: string, r: NewReturn) {
  const open = await db.returnRequest.findFirst({ where: { shop, orderId: r.orderId, status: { in: ["requested", "pending", "approved"] } } });
  if (open) return { duplicate: true, id: open.id } as const;
  const row = await db.returnRequest.create({ data: { shop, orderId: r.orderId, orderName: r.orderName, email: r.email, items: JSON.stringify(r.items), reason: r.reason, note: r.note, returnId: r.returnId, returnName: r.returnName, status: r.status } });
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
    return { id: r.id, orderId: r.orderId, orderName: r.orderName, email: r.email, items, reason: r.reason, note: r.note, status: r.status, createdAt: r.createdAt.toISOString(), returnId: r.returnId, returnName: r.returnName, labelUrl: r.labelUrl, tracking: r.tracking, trackingUrl: r.trackingUrl, declineNote: r.declineNote, refundedAt: r.refundedAt?.toISOString() ?? null };
  });
}

export type ReturnRow = Awaited<ReturnType<typeof listReturns>>[number];

export async function getReturn(shop: string, id: number) {
  return db.returnRequest.findFirst({ where: { shop, id } });
}

export async function updateReturn(shop: string, id: number, data: { status?: string; labelUrl?: string; tracking?: string; trackingUrl?: string; declineNote?: string; refundedAt?: Date | null }) {
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
