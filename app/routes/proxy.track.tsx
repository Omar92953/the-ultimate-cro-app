/**
 * Track order page on the store posts here through the app proxy (/apps/ucro/track) with the order
 * number and email. Answers the order's status, items and tracking (see orders-lookup.server.ts).
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { findOrder, readLookup } from "../lib/orders-lookup.server";
import { json, readJson, tooMany } from "../lib/proxy-guard.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.public.appProxy(request);
  if (!admin || !session) return json({ ok: false, error: "Order lookup isn't available right now." }, 503);
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: "Something went wrong. Please try again." }, 400);
  const q = readLookup(body);
  if ("error" in q) return json({ ok: false, error: q.error }, 400);
  if (tooMany(request, session.shop, "track", 12)) return json({ ok: false, error: "Too many tries. Please wait a few minutes." }, 429);
  try {
    const order = await findOrder(admin, q.number, q.email);
    if (!order) return json({ ok: false, notFound: true });
    // Everything except the internal order id.
    return json({ ok: true, order: { name: order.name, createdAt: order.createdAt, cancelled: order.cancelled, payment: order.payment, fulfillment: order.fulfillment, items: order.items.map((i) => ({ title: i.title, variant: i.variant, quantity: i.quantity, image: i.image })), shipments: order.shipments } });
  } catch {
    return json({ ok: false, error: "Order lookup isn't available right now." }, 500);
  }
};
