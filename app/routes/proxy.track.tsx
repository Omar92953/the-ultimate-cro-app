/**
 * Track order page on the store posts here through the app proxy (/apps/ucro/track) with the order
 * number and email. Answers the order's status, items and tracking (see orders-lookup.server.ts).
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { findOrder, readLookup } from "../lib/orders-lookup.server";
import { buyAgainFor, isLate } from "../lib/track-sell";
import { getOrderPages } from "../lib/order-page-setup.server";
import { countLookup, getTrackSell, givenCode, nextOrderCode } from "../lib/track-sell.server";
import { json, readJson, tooMany } from "../lib/proxy-guard.server";
import { getPlan } from "../lib/billing.server";
import { EXTRA_PLAN, atLeast } from "../lib/plans";
import { trackOffersFor } from "../lib/track-offers.server";
import { readRecRequest, trackRecs } from "../lib/track-recs.server";
import { carrierLinksFor, resolveTracking } from "../lib/tracking/tracking.server";
import { carrierUrl } from "../lib/tracking";
import { getReturnRules } from "../lib/shopify-returns.server";
import { storeCreditBonus } from "../lib/return-rules";

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
    // A carrier Shopify has no link for (a local courier) gets the store's own link pattern.
    const links = order.shipments.some((s) => s.number && !s.url) ? await carrierLinksFor(session.shop).catch(() => []) : [];
    const shipments = await Promise.all(
      order.shipments.slice(0, 5).map(async (s) => {
        const r = await resolveTracking(session.shop, plan, { number: s.number ?? "", carrier: s.company ?? "", country: "" }, s.tracking).catch(() => ({ tracking: s.tracking }));
        const { tracking: _own, ...rest } = s;
        void _own;
        return { ...rest, url: s.url || carrierUrl(links, s.company, s.number) || null, tracking: r.tracking };
      }),
    );
    // "You may also like" / "Complete your order": only when the page asks for them (its own settings), and a failure never hides the order.
    const recReq = readRecRequest(body.recs);
    const recs = recReq ? await trackRecs(admin, order.items.flatMap((i) => (i.productId ? [i.productId] : [])), recReq).catch((e) => { console.error(`[proxy/track] recommendations ${session.shop}:`, e instanceof Error ? e.message : e); return null; }) : null;
    // Next order discount: a real code, only for an order that is paid and not cancelled.
    const sell = (await getTrackSell(admin).catch(() => null))?.sell;
    const next = sell && !order.cancelled && /^(PAID|PARTIALLY_REFUNDED)$/.test(order.payment) ? await nextOrderCode(admin, session.shop, order.id, sell.nextOrder).catch((e) => { console.error(`[proxy/track] next order code ${session.shop}:`, e instanceof Error ? e.message : e); return null; }) : null;
    const buyAgain = sell?.buyAgain.on && !order.cancelled ? buyAgainFor(order.items.map((i) => ({ variantId: i.variantId, title: i.title, variant: i.variant, quantity: i.quantity, available: i.available, productType: i.productType, tags: i.tags })), sell.buyAgain) : null;
    void countLookup(session.shop);
    // Track page offers (Pro): above and below the tracking. They start a new cart; the paid order is never edited.
    const offers = atLeast(plan, EXTRA_PLAN.trackOffers) && !order.cancelled && /^(PAID|PARTIALLY_REFUNDED)$/.test(order.payment) ? await trackOffersFor(admin, session.shop, order.id, order.currency).catch(() => ({})) : {};
    // Late (past its expected date, or a problem): the merchant's apology and, when chosen, a real code.
    const lateNow = sell?.delay.on && !order.cancelled && shipments.some((s) => isLate({ delivered: s.tracking?.delivered ?? s.delivered, estimated: s.tracking?.estimated ?? s.estimated, status: s.tracking?.status ?? "" }));
    let late: Record<string, unknown> | null = null;
    if (lateNow && sell) {
      const g = sell.delay.gift;
      const code = g === "none" ? null : await givenCode(admin, session.shop, order.id, "delay", "SORRY", { percent: sell.delay.percent, minimum: 0, days: sell.delay.days, shipping: g === "shipping" }, "delay").catch((e) => { console.error(`[proxy/track] delay code ${session.shop}:`, e instanceof Error ? e.message : e); return null; });
      late = { gift: g, ...(code ? { code: { ...code, currency: order.currency } } : {}) };
    }
    // After delivery: "How was your order?": review links, the Returns page, and a real code to share with a friend.
    const delivered = shipments.length > 0 && shipments.every((s) => !!(s.tracking?.delivered || s.delivered));
    const ad = sell?.afterDelivery;
    let after: Record<string, unknown> | null = null;
    if (ad?.on && delivered && !order.cancelled) {
      const pages = ad.returnsLink ? await getOrderPages(admin).catch(() => null) : null;
      const friend = ad.friend.on ? await givenCode(admin, session.shop, order.id, "friend", "FRIEND", ad.friend, "friend").catch((e) => { console.error(`[proxy/track] friend code ${session.shop}:`, e instanceof Error ? e.message : e); return null; }) : null;
      after = {
        reviewUrl: ad.review === "url" ? ad.reviewUrl : "",
        reviews: ad.review === "product" ? order.items.filter((i) => i.handle).slice(0, 5).map((i) => ({ title: i.title, handle: i.handle })) : [],
        returnsHandle: pages?.returns?.handle ?? "",
        // Store credit with a bonus on the Returns page (Pro): said next to the link, so a return can stay a sale.
        creditBonus: pages?.returns?.handle && atLeast(plan, "pro") ? await getReturnRules(admin).then(({ rules }) => storeCreditBonus(rules.saving)).catch(() => 0) : 0,
        ...(friend ? { friend: { ...friend, currency: order.currency } } : {}),
      };
    }
    // Everything except the internal order id.
    return json({ ok: true, order: { name: order.name, createdAt: order.createdAt, cancelled: order.cancelled, payment: order.payment, fulfillment: order.fulfillment, items: order.items.map((i) => ({ title: i.title, variant: i.variant, quantity: i.quantity, image: i.image, price: i.unitPrice })), prices: order.prices, shipments, ...(recs ? { recs } : {}), ...(Object.keys(offers).length ? { offers } : {}), ...(late ? { delay: late } : {}), ...(after ? { afterDelivery: after } : {}), ...(buyAgain && (buyAgain.items.length || buyAgain.soldOut.length) ? { buyAgain } : {}), ...(next ? { nextOrder: { ...next, currency: order.currency } } : {}) } });
  } catch (e) {
    console.error(`[proxy/track] ${session.shop}:`, e instanceof Error ? e.message : e);
    return json({ ok: false, error: "Order lookup isn't available right now." }, 500);
  }
};
