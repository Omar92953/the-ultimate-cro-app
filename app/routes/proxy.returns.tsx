/**
 * Returns page on the store posts here through the app proxy (/apps/ucro/returns):
 *  - intent "find": order number + email → the order's items that can still be returned (inside the
 *    merchant's return rules) and the order's existing returns with their status;
 *  - intent "send": the same + chosen items, reason and note → a Shopify return in REQUESTED (approved
 *    at once when the merchant's rules say so for that reason). Stores that have not yet approved the
 *    returns scopes keep the old behaviour: the request is saved in the app only.
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { addReturn, creditsForOrder, exchangesForOrder, findOrder, orderReturns, readLookup } from "../lib/orders-lookup.server";
import { getPlan } from "../lib/billing.server";
import { approveAndSettle } from "../lib/return-saving.server";
import { priceDifference, type ExchangeLine } from "../lib/return-exchange";
import { atLeast } from "../lib/plans";
import { getReturnRules, requestReturn, returnableItems } from "../lib/shopify-returns.server";
import { DEFAULT_SAVING, excludedTags, matchesAutoRule, withSaving } from "../lib/return-rules";
import { json, readJson, tooMany } from "../lib/proxy-guard.server";

const clean = (v: unknown, max: number) =>
  Array.from(String(v ?? ""))
    .filter((ch) => ch === "\n" || ch.charCodeAt(0) >= 32)
    .join("")
    .trim()
    .slice(0, max);

const noAccess = (e: unknown) => /access|scope|permission|not approved/i.test(e instanceof Error ? e.message : String(e));
const SAY: Record<string, string> = { REQUESTED: "We received your request", OPEN: "Approved", DECLINED: "Declined", CLOSED: "Done", CANCELED: "Cancelled" };

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.public.appProxy(request);
  if (!admin || !session) return json({ ok: false, error: "Returns aren't available right now." }, 503);
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: "Something went wrong. Please try again." }, 400);
  const q = readLookup(body);
  if ("error" in q) return json({ ok: false, error: q.error }, 400);
  if (tooMany(request, session.shop, "returns", 12)) return json({ ok: false, error: "Too many tries. Please wait a few minutes." }, 429);
  try {
    const order = await findOrder(admin, q.number, q.email);
    if (!order) return json({ ok: false, notFound: true });
    const { rules } = await getReturnRules(admin);
    // Return saving rules (store credit, rules that approve) are Pro: below Pro the shopper is refunded as before.
    const pro = atLeast((await getPlan(admin, session.shop)).plan, "pro");
    const saving = pro ? withSaving(rules.saving) : DEFAULT_SAVING;
    if (rules.days > 0 && Date.now() - Date.parse(order.createdAt) > rules.days * 86_400_000) return json({ ok: false, tooLate: true });

    // What can still be returned: Shopify's returnable items, minus products the merchant excluded by tag.
    const blocked = excludedTags(rules);
    let returnable: Awaited<ReturnType<typeof returnableItems>> = [];
    let legacy = false;
    try {
      returnable = (await returnableItems(admin, order.id)).filter((i) => !i.tags.some((t) => blocked.includes(t)));
    } catch (e) {
      if (!noAccess(e)) throw e;
      legacy = true; // returns scopes not approved yet: the old list of items and an app-only request
    }
    const choices = legacy ? order.items.map((i) => ({ key: i.id.split("/").pop() ?? "", title: i.title, variant: i.variant, quantity: i.quantity, image: i.image })) : returnable.map((i) => ({ key: i.key, title: i.title, variant: i.variant, quantity: i.quantity, image: i.image, price: i.price, swaps: i.swaps.filter((v) => v.available && v.id !== i.variantId).map((v) => ({ id: v.id.split("/").pop() ?? "", title: v.title, price: v.price })) }));
    const existing = legacy ? [] : [...(await orderReturns(admin, order.id)), ...(await exchangesForOrder(session.shop, order.id, q.email))].map((r) => ({ name: r.name, status: r.status, say: SAY[r.status] ?? r.status }));
    const approvedHere = existing.some((r) => r.status === "OPEN");
    const after = { address: rules.address, instructions: rules.instructions, shipping: rules.shipping };
    const priceOf = new Map(choices.map((c) => [c.key, "price" in c ? Number((c as { price: number }).price) || 0 : 0]));
    // How the shopper can be paid back: a refund always; store credit when the merchant (Pro) switched it on.
    const options = { credit: saving.credit.on && !legacy ? { bonus: saving.credit.bonus } : null, exchange: saving.exchange.on && !legacy ? { extra: saving.exchange.extra } : null };
    if (body.intent !== "send") {
      const credits = legacy ? [] : await creditsForOrder(session.shop, order.id, q.email);
      return json({ ok: true, order: { name: order.name, currency: order.currency, items: choices }, options, credits, returns: existing, ...(approvedHere ? { after } : {}) });
    }

    const wanted = Array.isArray(body.items) ? (body.items as { key?: unknown; qty?: unknown }[]) : [];
    const picked = wanted
      .map((w) => {
        const line = choices.find((l) => l.key === String(w.key));
        const qty = Math.min(Math.max(1, Math.round(Number(w.qty) || 1)), line?.quantity ?? 0);
        return line && qty > 0 ? { key: line.key, title: line.title, variant: line.variant, quantity: qty } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    if (!picked.length) return json({ ok: false, error: "Please choose at least one item." }, 400);
    const reason = clean(body.reason, 80);
    if (!reason) return json({ ok: false, error: "Please choose a reason." }, 400);
    const note = clean(body.note, 1000);

    const resolution = body.resolution === "exchange" && options.exchange ? ("exchange" as const) : body.resolution === "credit" && options.credit ? ("credit" as const) : ("refund" as const);
    // Exchange: each item changes to another variant of the same product, in stock; one that costs more only when the merchant allows it.
    let exchange: { lines: ExchangeLine[]; diff: number } | null = null;
    if (resolution === "exchange") {
      const asked = Array.isArray(body.exchange) ? (body.exchange as { key?: unknown; variantId?: unknown }[]) : [];
      const lines: ExchangeLine[] = [];
      for (const p of picked) {
        const item = returnable.find((i) => i.key === p.key);
        const want = asked.find((a) => String(a.key) === p.key);
        const swap = item?.swaps.find((v) => v.available && v.id !== item.variantId && v.id.split("/").pop() === String(want?.variantId));
        if (!item || !swap) return json({ ok: false, error: "Please choose what you would like instead for each item." }, 400);
        lines.push({ key: p.key, fli: item.fulfillmentLineItemId, qty: p.quantity, title: item.title, from: item.variant, to: swap.title, variantId: swap.id, oldPrice: item.price, newPrice: swap.price });
      }
      const diff = priceDifference(lines);
      if (diff > 0 && !options.exchange?.extra) return json({ ok: false, error: "That costs more than what you are returning. Please choose one at the same price or less." }, 400);
      exchange = { lines, diff };
    }
    const quote = Math.round(picked.reduce((n, p) => n + (priceOf.get(p.key) ?? 0) * p.quantity, 0) * 100) / 100;
    let returnId = "", returnName = "";
    const status = "requested";
    if (!legacy && !exchange) {
      const gids = new Map(returnable.map((i) => [i.key, i.fulfillmentLineItemId]));
      const made = await requestReturn(admin, order.id, picked.map((p) => ({ fulfillmentLineItemId: gids.get(p.key)!, quantity: p.quantity })), reason, note);
      returnId = made.id;
      returnName = made.name;
    }
    const r = await addReturn(session.shop, { orderId: order.id, orderName: order.name, email: q.email, items: picked.map((p) => ({ id: p.key, title: p.title, variant: p.variant, quantity: p.quantity })), reason, note, returnId, returnName, status, resolution, quote, currency: order.currency, creditBonus: resolution === "credit" ? saving.credit.bonus : 0, exchange: exchange ? JSON.stringify(exchange) : "" });
    if (r.duplicate) return json({ ok: false, already: true });
    // Approved at once: the reasons the merchant ticked (Growth), or a Pro rule (reason, product tag, order value, days since delivery).
    const delivered = order.shipments.map((s) => s.delivered).filter((d): d is string => !!d).sort().pop();
    const matchesRule = matchesAutoRule(saving.rules, {
      reason,
      tags: picked.flatMap((p) => returnable.find((i) => i.key === p.key)?.tags ?? []),
      orderValue: order.total,
      daysSinceDelivery: delivered ? Math.floor((Date.now() - Date.parse(delivered)) / 86_400_000) : null,
    });
    const reasonOk = rules.autoApprove.on && rules.autoApprove.reasons.some((x) => x.toLowerCase() === reason.toLowerCase());
    let approved = false;
    let credit: Awaited<ReturnType<typeof approveAndSettle>>["credit"] = null;
    if ((returnId || exchange) && (reasonOk || matchesRule)) {
      try {
        const out = await approveAndSettle(admin, session.shop, r.id, rules, pro);
        approved = true;
        credit = out.credit;
      } catch (e) {
        console.error(`[proxy/returns] auto approve ${session.shop}:`, e instanceof Error ? e.message : e);
        approved = false; // stays New (or approved without the credit); the merchant finishes it in the app
      }
    }
    return json({ ok: true, approved, ...(credit ? { credit: { kind: credit.kind, code: credit.code, amount: credit.amount, currency: credit.currency } } : {}), ...(approved ? { after } : {}) });
  } catch (e) {
    console.error(`[proxy/returns] ${session.shop}:`, e instanceof Error ? e.message : e);
    return json({ ok: false, error: e instanceof Error && /^[A-Z]/.test(e.message) && e.message.length < 140 && !/gid:|graphql|userErrors/i.test(e.message) ? e.message : "Returns aren't available right now." }, 500);
  }
};
