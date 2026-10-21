/**
 * Tracking & Returns → Shipments: every shipment of the last 30 days, what Shopify knows about it and what the
 * Track page shows now (the cached answer from the store's tracking source), so the merchant can see that
 * tracking works and check one order on demand. Reading the list never asks a tracking service (no cost);
 * "Check now" resolves one order the same way the Track page does.
 */
import db from "../../db.server";
import { gql, type AdminClient } from "../admin.server";
import { atLeast, type PlanKey } from "../plans";
import { carrierUrl, sourcesToTry, type CarrierLink, type TrackSource, type TrackStatus, type Tracking } from "../tracking";
import { shopifyTracking } from "../orders-lookup.server";
import { carrierLinksFor, resolveTracking } from "./tracking.server";

export type ShipmentRow = {
  orderId: string;
  orderName: string;
  createdAt: string;
  company: string;
  number: string;
  /** The carrier's tracking page: Shopify's, or the store's own link for that carrier. */
  url: string;
  /** What Shopify knows. */
  shopify: { status: TrackStatus | null; events: number; delivered: string | null; estimated: string | null };
  /** What the Track page shows now, from the store's tracking source (null when it hasn't been looked up yet). */
  page: { status: TrackStatus; place: string; via: string; events: number; checkedAt: string } | null;
};

type Node = {
  id: string;
  name: string;
  createdAt: string;
  fulfillments: {
    displayStatus: string | null;
    deliveredAt: string | null;
    inTransitAt: string | null;
    estimatedDeliveryAt: string | null;
    trackingInfo: { company: string | null; number: string | null; url: string | null }[];
    events: { nodes: { status: string | null; city: string | null; province: string | null; country: string | null; message: string | null; happenedAt: string }[] };
  }[];
};

const FULFILLMENTS = `fulfillments(first: 5) { displayStatus deliveredAt inTransitAt estimatedDeliveryAt trackingInfo(first: 3) { company number url } events(first: 10, sortKey: HAPPENED_AT, reverse: true) { nodes { status city province country message happenedAt } } }`;

function rows(o: Node, links: CarrierLink[]) {
  return o.fulfillments.flatMap((f) =>
    (f.trackingInfo.length ? f.trackingInfo : [{ company: null, number: null, url: null }]).map((t) => {
      const shopify = shopifyTracking(f);
      return {
        orderId: o.id,
        orderName: o.name,
        createdAt: o.createdAt,
        company: t.company ?? "",
        number: t.number ?? "",
        url: t.url || carrierUrl(links, t.company, t.number),
        shopify: { status: shopify?.status ?? null, events: shopify?.events.length ?? 0, delivered: f.deliveredAt, estimated: f.estimatedDeliveryAt },
        tracking: shopify,
      };
    }),
  );
}

/** Shipments of orders placed in the last `days` days (newest first, up to 30 orders). */
/** `source` and `plan`: only answers the Track page would really use are shown (typed updates, then the chosen source and those after it). */
export async function recentShipments(admin: AdminClient, shop: string, source: TrackSource, plan: PlanKey, days = 30): Promise<ShipmentRow[]> {
  const used = new Set<string>([...(atLeast(plan, "pro") ? ["manual"] : []), ...sourcesToTry(source)]);
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const data = await gql(admin, `#graphql
    query CroRecentShipments($q: String!) { orders(first: 30, query: $q, sortKey: CREATED_AT, reverse: true) { nodes { id name createdAt ${FULFILLMENTS} } } }`, { q: `created_at:>=${since} (fulfillment_status:shipped OR fulfillment_status:partial)` });
  const links = await carrierLinksFor(shop).catch(() => []);
  const list = ((data.orders?.nodes ?? []) as Node[]).flatMap((o) => rows(o, links));
  const numbers = list.map((r) => r.number).filter(Boolean);
  const cached = numbers.length ? await db.trackingCache.findMany({ where: { shop, number: { in: numbers } } }) : [];
  return list.map(({ tracking: _t, ...r }) => {
    void _t;
    const c = cached.find((x) => x.number === r.number && used.has(x.via));
    let page: ShipmentRow["page"] = null;
    if (c) {
      try {
        const t = JSON.parse(c.data) as Tracking;
        page = { status: c.status as TrackStatus, place: t.place ?? "", via: c.via, events: t.events?.length ?? 0, checkedAt: c.checkedAt.toISOString() };
      } catch {
        page = null;
      }
    }
    return { ...r, page };
  });
}

/** Looks one order up the way the Track page does (may use a live tracking check for a number seen the first time). */
export async function checkOrderTracking(admin: AdminClient, shop: string, plan: PlanKey, orderId: string) {
  const data = await gql(admin, `#graphql
    query CroCheckShipment($id: ID!) { order(id: $id) { id name createdAt ${FULFILLMENTS} } }`, { id: orderId });
  if (!data.order) return [];
  const list = rows(data.order as Node, []);
  return Promise.all(
    list.filter((r) => r.number).map(async (r) => {
      const got = await resolveTracking(shop, plan, { number: r.number, carrier: r.company, country: "" }, r.tracking);
      return { number: r.number, via: got.via, status: got.tracking?.status ?? null, place: got.tracking?.place ?? "", events: got.tracking?.events.length ?? 0 };
    }),
  );
}
