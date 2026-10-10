/**
 * Returns page on the store posts here through the app proxy (/apps/ucro/returns):
 *  - intent "find": order number + email → the order's items (if it's within the return window);
 *  - intent "send": the same + chosen items, reason and note → a return request in the app (Returns).
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { addReturn, findOrder, readLookup } from "../lib/orders-lookup.server";
import { getOrderPage } from "../lib/designs.server";
import { json, readJson, tooMany } from "../lib/proxy-guard.server";

const clean = (v: unknown, max: number) =>
  Array.from(String(v ?? ""))
    .filter((ch) => ch === "\n" || ch.charCodeAt(0) >= 32)
    .join("")
    .trim()
    .slice(0, max);

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
    const { config } = await getOrderPage(admin, "returns");
    const days = config.rules.days;
    if (days > 0 && Date.now() - Date.parse(order.createdAt) > days * 86_400_000) return json({ ok: false, tooLate: true });
    if (body.intent !== "send") return json({ ok: true, order: { name: order.name, items: order.items.map(({ id, ...rest }) => ({ key: id.split("/").pop(), ...rest })) } });

    const wanted = Array.isArray(body.items) ? (body.items as { key?: unknown; qty?: unknown }[]) : [];
    const items = wanted
      .map((w) => {
        const line = order.items.find((l) => l.id.split("/").pop() === String(w.key));
        const qty = Math.min(Math.max(1, Math.round(Number(w.qty) || 1)), line?.quantity ?? 0);
        return line && qty > 0 ? { id: line.id, title: line.title, variant: line.variant, quantity: qty } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    if (!items.length) return json({ ok: false, error: "Please choose at least one item." }, 400);
    const reason = clean(body.reason, 80);
    if (!reason) return json({ ok: false, error: "Please choose a reason." }, 400);
    const r = await addReturn(session.shop, { orderId: order.id, orderName: order.name, email: q.email, items, reason, note: clean(body.note, 1000) });
    return json(r.duplicate ? { ok: false, already: true } : { ok: true });
  } catch {
    return json({ ok: false, error: "Returns aren't available right now." }, 500);
  }
};
