/**
 * Track page offers (Pro): offers shown above or below the tracking on the Track page, made in Offers like every other offer.
 * The order is already paid, so an offer never edits it: it starts a new cart (add to cart) and/or gives a real Shopify discount
 * code with a real expiry. One offer per slot (above, below). Shared by the admin and the server.
 */
import type { Ref } from "./types";

export type TrackOfferKind = "cross_sell" | "shipping" | "gift" | "discount";
export type TrackSlot = "above" | "below";

export const TRACK_OFFER_KINDS: Record<TrackOfferKind, { title: string; about: string; example: string }> = {
  cross_sell: { title: "Cross sell", about: "Products that go with the order, added to a new cart, with an optional discount code.", example: "Pairs well with your order: 10% off for 48 hours" },
  shipping: { title: "Add anything, get free shipping", about: "A real free shipping code for the shopper's next cart, valid for a few hours or days.", example: "Add anything in the next 48 hours and get free shipping" },
  gift: { title: "Free gift", about: "A product the shopper adds to a new cart for free, with a real code that makes it free.", example: "Add our sample kit to your next order, it's free" },
  discount: { title: "Discount on the next order", about: "A real percentage code for the next cart, valid for a few hours or days.", example: "Take 15% off anything else in the next 48 hours" },
};

export type TrackOffer = {
  id: string;
  name: string;
  active: boolean;
  slot: TrackSlot;
  kind: TrackOfferKind;
  headline: string;
  text: string;
  button: string;
  /** Cross sell: up to 4 products. Free gift: the gift (1). */
  products: Ref[];
  /** Cross sell: optional discount on those products (0 = none). Discount: the percentage. */
  percent: number;
  /** Hours the code lasts. */
  hours: number;
  /** Discount: minimum order for the code (0 = none). */
  minimum: number;
};

export type TrackOffers = { offers: TrackOffer[] };
export const MAX_TRACK_OFFERS = 10;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max: number, fallback = "") => (typeof v === "string" ? Array.from(v).filter((c) => c === "\n" || c.charCodeAt(0) >= 32).join("").trim().slice(0, max) : fallback);
const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export const DEFAULT_TRACK_OFFER: Omit<TrackOffer, "id"> = { name: "", active: false, slot: "below", kind: "cross_sell", headline: "Pairs well with your order", text: "", button: "Add to cart", products: [], percent: 0, hours: 48, minimum: 0 };

export function withTrackOfferDefaults(raw: unknown): TrackOffer {
  const r = obj(raw);
  const kind: TrackOfferKind = r.kind === "shipping" || r.kind === "gift" || r.kind === "discount" ? r.kind : "cross_sell";
  const products = (Array.isArray(r.products) ? r.products : [])
    .map(obj)
    .filter((p) => typeof p.id === "string" && /^gid:\/\/shopify\/Product\/\d+$/.test(p.id as string))
    .slice(0, kind === "gift" ? 1 : 4)
    .map((p): Ref => ({ id: p.id as string, title: str(p.title, 200), image: typeof p.image === "string" ? p.image : null, handle: str(p.handle, 255) }));
  const d = DEFAULT_TRACK_OFFER;
  return {
    id: str(r.id, 40).replace(/[^a-zA-Z0-9_-]/g, ""),
    name: str(r.name, 80),
    active: r.active === true,
    slot: r.slot === "above" ? "above" : "below",
    kind,
    headline: str(r.headline, 100, d.headline),
    text: str(r.text, 300),
    button: str(r.button, 40, d.button) || d.button,
    products,
    percent: kind === "cross_sell" ? num(r.percent, 0, 90, 0) : kind === "discount" ? num(r.percent, 1, 90, 10) : 0,
    hours: num(r.hours, 1, 720, 48),
    minimum: kind === "discount" ? Math.min(100000, Math.max(0, Math.round(Number(r.minimum) * 100) / 100 || 0)) : 0,
  };
}

export function withTrackOffersDefaults(raw: unknown): TrackOffers {
  const list = Array.isArray(obj(raw).offers) ? (obj(raw).offers as unknown[]) : [];
  return { offers: list.slice(0, MAX_TRACK_OFFERS).map(withTrackOfferDefaults).filter((o) => o.id) };
}

/** What stops this offer from going live, or null: it needs what its type needs, and its slot must be free. */
export function trackOfferProblem(o: TrackOffer, others: TrackOffer[]): string | null {
  if (!o.name) return "Give the offer a name.";
  if (o.kind === "cross_sell" && !o.products.length) return "Choose at least one product to offer.";
  if (o.kind === "gift" && !o.products.length) return "Choose the product that is the gift.";
  if (o.active) {
    const taken = others.find((x) => x.active && x.slot === o.slot && x.id !== o.id);
    if (taken) return `The ${o.slot} slot already shows “${taken.name}”. Turn that offer off first, or use the other slot.`;
  }
  return null;
}
