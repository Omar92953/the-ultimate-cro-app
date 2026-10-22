/**
 * "Write a review" on the store: the form posts here through the app proxy (/apps/ucro/review).
 * Shopify signs the request; the review is saved hidden and "waiting for approval", so it only
 * appears on the store after the merchant approves it in Sections → Customer reviews.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { saveItem } from "../lib/sections.server";
import { forgetShop } from "../lib/short-cache.server";
import type { SectionItem } from "../lib/sections";
import db from "../db.server";
import { setReviewerEmail } from "../lib/reviewer-email.server";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// A few reviews per visitor per 10 minutes (per server process), against spam.
const recent = new Map<string, number[]>();
function tooMany(key: string) {
  const now = Date.now();
  const list = (recent.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  if (list.length >= 3) return true;
  recent.set(key, [...list, now]);
  if (recent.size > 5000) recent.clear();
  return false;
}

// Drops invisible control characters (keeps line breaks and tabs).
const clean = (v: unknown, max: number) =>
  Array.from(String(v ?? ""))
    .filter((ch) => ch === "\n" || ch === "\t" || ch.charCodeAt(0) >= 32)
    .join("")
    .trim()
    .slice(0, max);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);
  return json({ ok: true });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.public.appProxy(request);
  if (!admin || !session) return json({ ok: false, error: "This store can't take reviews right now." }, 503);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Something went wrong. Please try again." }, 400);
  }
  // The hidden "company" field is only filled in by bots.
  if (clean(body.company, 50)) return json({ ok: true });
  const name = clean(body.name, 60);
  const text = clean(body.text, 2000);
  const rating = Math.round(Number(body.rating));
  const productId = /^\d{1,20}$/.test(String(body.product ?? "")) ? `gid://shopify/Product/${body.product}` : null;
  if (!name) return json({ ok: false, error: "Please add your name." }, 400);
  if (!(rating >= 1 && rating <= 5)) return json({ ok: false, error: "Please choose 1 to 5 stars." }, 400);
  if (text.length < 3) return json({ ok: false, error: "Please write a few words." }, 400);
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (tooMany(`${session.shop}|${ip}`)) return json({ ok: false, error: "Thanks! Please wait a few minutes before sending another review." }, 429);

  const today = new Date().toISOString().slice(0, 10);
  const item: SectionItem = {
    id: null,
    handle: null,
    position: 0,
    values: {
      name,
      text,
      rating,
      media: null,
      photo_fit: "",
      source: "",
      source_url: "",
      product: productId ? { id: productId, title: "", image: null } : null,
      products: [],
      location: clean(body.location, 60),
      date: today,
      verified: false,
      featured: false,
      active: false,
      pending: true,
    },
  };
  try {
    const saved = await saveItem(admin, "reviews", item);
    // A signed in loyalty member: the review keeps their email, so approving it gives their review points.
    const customerId = new URL(request.url).searchParams.get("logged_in_customer_id") ?? "";
    if (saved?.id && /^\d+$/.test(customerId)) {
      const m = await db.loyaltyMember.findUnique({ where: { shop_customerId: { shop: session.shop, customerId } }, select: { email: true } }).catch(() => null);
      if (m?.email) await setReviewerEmail(session.shop, saved.id, m.email).catch(() => null);
    }
    forgetShop(session.shop);
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "Your review could not be sent. Please try again." }, 500);
  }
};
