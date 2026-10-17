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
import { addReturn, findOrder, orderReturns, readLookup, updateReturn } from "../lib/orders-lookup.server";
import { getReturnRules, approveReturn, requestReturn, returnableItems } from "../lib/shopify-returns.server";
import { excludedTags } from "../lib/return-rules";
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
    const choices = legacy ? order.items.map((i) => ({ key: i.id.split("/").pop() ?? "", title: i.title, variant: i.variant, quantity: i.quantity, image: i.image })) : returnable.map((i) => ({ key: i.key, title: i.title, variant: i.variant, quantity: i.quantity, image: i.image }));
    const existing = legacy ? [] : (await orderReturns(admin, order.id)).map((r) => ({ name: r.name, status: r.status, say: SAY[r.status] ?? r.status }));
    const approvedHere = existing.some((r) => r.status === "OPEN");
    const after = { address: rules.address, instructions: rules.instructions, shipping: rules.shipping };
    if (body.intent !== "send") return json({ ok: true, order: { name: order.name, items: choices }, returns: existing, ...(approvedHere ? { after } : {}) });

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

    let returnId = "", returnName = "";
    const status = "requested";
    if (!legacy) {
      const gids = new Map(returnable.map((i) => [i.key, i.fulfillmentLineItemId]));
      const made = await requestReturn(admin, order.id, picked.map((p) => ({ fulfillmentLineItemId: gids.get(p.key)!, quantity: p.quantity })), reason, note);
      returnId = made.id;
      returnName = made.name;
    }
    const r = await addReturn(session.shop, { orderId: order.id, orderName: order.name, email: q.email, items: picked.map((p) => ({ id: p.key, title: p.title, variant: p.variant, quantity: p.quantity })), reason, note, returnId, returnName, status });
    if (r.duplicate) return json({ ok: false, already: true });
    // Approved at once for the reasons the merchant chose.
    let approved = false;
    if (returnId && rules.autoApprove.on && rules.autoApprove.reasons.some((x) => x.toLowerCase() === reason.toLowerCase())) {
      try {
        await approveReturn(admin, returnId);
        await updateReturn(session.shop, r.id, { status: "approved" });
        approved = true;
      } catch {
        approved = false; // stays New; the merchant approves it in the app
      }
    }
    return json({ ok: true, approved, ...(approved ? { after } : {}) });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error && /^[A-Z]/.test(e.message) && e.message.length < 140 && !/gid:|graphql|userErrors/i.test(e.message) ? e.message : "Returns aren't available right now." }, 500);
  }
};
