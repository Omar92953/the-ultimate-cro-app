/**
 * "Notify me when available" on the store posts here through the app proxy (/apps/ucro/notify).
 * Shopify signs the request. Saves the email for the variant (Boosters → Back in stock & pre-order).
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { addAlert } from "../lib/stock.server";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const clean = (v: unknown, max: number) =>
  Array.from(String(v ?? ""))
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join("")
    .trim()
    .slice(0, max);

// A few requests per visitor per 10 minutes (per server process), against spam.
const recent = new Map<string, number[]>();
function tooMany(key: string) {
  const now = Date.now();
  const list = (recent.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  if (list.length >= 6) return true;
  recent.set(key, [...list, now]);
  if (recent.size > 5000) recent.clear();
  return false;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) return json({ ok: false, error: "This store can't take requests right now." }, 503);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Something went wrong. Please try again." }, 400);
  }
  if (clean(body.company, 50)) return json({ ok: true });
  const email = clean(body.email, 120).toLowerCase();
  const productId = String(body.product ?? "");
  const variantId = String(body.variant ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "Please enter a valid email." }, 400);
  if (!/^\d{1,20}$/.test(productId) || !/^\d{1,20}$/.test(variantId)) return json({ ok: false, error: "Something went wrong. Please try again." }, 400);
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (tooMany(`${session.shop}|${ip}`)) return json({ ok: false, error: "Please wait a few minutes and try again." }, 429);
  try {
    await addAlert(session.shop, { productId, variantId, email, productTitle: clean(body.title, 200), variantTitle: clean(body.variantTitle, 120) });
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "Could not be sent. Please try again." }, 500);
  }
};
