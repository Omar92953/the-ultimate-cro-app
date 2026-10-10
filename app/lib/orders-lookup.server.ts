/**
 * Track order & Returns pages: find a shopper's order by its number and the email it was placed with.
 * Both must match, so nobody can look up someone else's order by guessing numbers. Only what the
 * shopper needs is returned (status, items, tracking) — never addresses or payment details.
 */
import db from "../db.server";
import { gql, type AdminClient } from "./admin.server";

export type OrderSummary = {
  id: string;
  name: string;
  createdAt: string;
  cancelled: boolean;
  payment: string;
  fulfillment: string;
  items: { id: string; title: string; variant: string; quantity: number; image: string | null }[];
  shipments: { status: string; company: string | null; number: string | null; url: string | null; delivered: string | null; estimated: string | null }[];
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

export async function findOrder(admin: AdminClient, number: string, email: string): Promise<OrderSummary | null> {
  const data = await gql(
    admin,
    `#graphql
    query CroFindOrder($q: String!) {
      orders(first: 5, query: $q) {
        nodes {
          id name email createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus
          lineItems(first: 50) { nodes { id title variantTitle currentQuantity image { url } } }
          fulfillments(first: 10) { displayStatus deliveredAt estimatedDeliveryAt trackingInfo(first: 3) { company number url } }
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
    shipments: order.fulfillments.flatMap((f: { displayStatus: string | null; deliveredAt: string | null; estimatedDeliveryAt: string | null; trackingInfo: { company: string | null; number: string | null; url: string | null }[] }) =>
      (f.trackingInfo.length ? f.trackingInfo : [{ company: null, number: null, url: null }]).map((t) => ({ status: f.displayStatus ?? "", company: t.company, number: t.number, url: t.url, delivered: f.deliveredAt, estimated: f.estimatedDeliveryAt })),
    ),
  };
}

/* ------------------------------------------------------------------ returns -- */
export type ReturnItem = { id: string; title: string; variant: string; quantity: number };

export async function addReturn(shop: string, r: { orderId: string; orderName: string; email: string; items: ReturnItem[]; reason: string; note: string }) {
  const open = await db.returnRequest.findFirst({ where: { shop, orderId: r.orderId, status: "pending" } });
  if (open) return { duplicate: true } as const;
  await db.returnRequest.create({ data: { shop, orderId: r.orderId, orderName: r.orderName, email: r.email, items: JSON.stringify(r.items), reason: r.reason, note: r.note } });
  return { duplicate: false } as const;
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
    return { id: r.id, orderId: r.orderId, orderName: r.orderName, email: r.email, items, reason: r.reason, note: r.note, status: r.status, createdAt: r.createdAt.toISOString() };
  });
}

export async function setReturnStatus(shop: string, id: number, status: "pending" | "approved" | "declined" | "done") {
  await db.returnRequest.updateMany({ where: { shop, id }, data: { status } });
}

/* Privacy webhooks */
export const returnsForEmail = (shop: string, email: string) => db.returnRequest.findMany({ where: { shop, email: email.toLowerCase() } });
export const redactReturnsEmail = (shop: string, email: string) => db.returnRequest.deleteMany({ where: { shop, email: email.toLowerCase() } });
export const redactReturnsShop = (shop: string) => db.returnRequest.deleteMany({ where: { shop } });
