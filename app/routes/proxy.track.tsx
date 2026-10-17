/**
 * Track order page on the store posts here through the app proxy (/apps/ucro/track) with the order
 * number and email. Answers the order's status, items and tracking (see orders-lookup.server.ts).
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { findOrder, readLookup } from "../lib/orders-lookup.server";
import { json, readJson, tooMany } from "../lib/proxy-guard.server";
import { getPlan } from "../lib/billing.server";
import { resolveTracking } from "../lib/tracking/tracking.server";

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
    // Where each shipment's tracking comes from is the store's choice (lib/tracking/tracking.server.ts); Shopify's own data is the fallback.
    const { plan } = await getPlan(admin, session.shop);
    const shipments = await Promise.all(
      order.shipments.slice(0, 5).map(async (s) => {
        const r = await resolveTracking(session.shop, plan, { number: s.number ?? "", carrier: s.company ?? "", country: "" }, s.tracking).catch(() => ({ tracking: s.tracking }));
        const { tracking: _own, ...rest } = s;
        void _own;
        return { ...rest, tracking: r.tracking };
      }),
    );
    // Everything except the internal order id.
    return json({ ok: true, order: { name: order.name, createdAt: order.createdAt, cancelled: order.cancelled, payment: order.payment, fulfillment: order.fulfillment, items: order.items.map((i) => ({ title: i.title, variant: i.variant, quantity: i.quantity, image: i.image })), shipments } });
  } catch (e) {
    console.error(`[proxy/track] ${session.shop}:`, e instanceof Error ? e.message : e);
    return json({ ok: false, error: "Order lookup isn't available right now." }, 500);
  }
};
