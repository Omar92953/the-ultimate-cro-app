/**
 * What the Track page sells after checkout (G11): the settings every Track page style shares, stored in
 * $app:cro_design "track_sell". The server reads these (never the page), so a shopper can only get what the
 * merchant set. Only real discounts: every code is a Shopify discount code with a real expiry.
 * Shared by client and server.
 */
import { num, str } from "./designs";

export type NextOrder = {
  on: boolean;
  /** One code per order, or one code for everybody (renewed when the merchant saves again). */
  mode: "perOrder" | "shared";
  percent: number;
  /** Minimum order subtotal (shop currency, 0 = none). */
  minimum: number;
  /** Days the code works. */
  days: number;
  /** The shared code (letters and digits). */
  sharedCode: string;
};

/** "Buy again": a button that puts the order's items back in a new cart. `only` limits it by product type or tag. */
export type BuyAgain = { on: boolean; only: "all" | "types" | "tags"; list: string };

export type TrackSell = { nextOrder: NextOrder; buyAgain: BuyAgain };

export const DEFAULT_TRACK_SELL: TrackSell = { nextOrder: { on: false, mode: "perOrder", percent: 10, minimum: 0, days: 30, sharedCode: "THANKS10" }, buyAgain: { on: false, only: "all", list: "" } };

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export function withTrackSellDefaults(raw: unknown): TrackSell {
  const r = obj(raw), n = obj(r.nextOrder), b = obj(r.buyAgain);
  const d = DEFAULT_TRACK_SELL.nextOrder;
  const code = str(n.sharedCode, d.sharedCode, 20).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return {
    buyAgain: { on: b.on === true, only: b.only === "types" || b.only === "tags" ? b.only : "all", list: str(b.list, "", 300).split(",").map((x) => x.trim()).filter(Boolean).join(", ") },
    nextOrder: {
      on: n.on === true,
      mode: n.mode === "shared" ? "shared" : "perOrder",
      percent: num(n.percent, 1, 90, d.percent),
      minimum: Math.min(100000, Math.max(0, Math.round(Number(n.minimum) * 100) / 100 || 0)),
      days: num(n.days, 1, 365, d.days),
      sharedCode: code.length >= 3 ? code : d.sharedCode,
    },
  };
}

export type BuyAgainLine = { variantId: number; title: string; variant: string; quantity: number; available: boolean; productType: string; tags: string[] };

/** What "Buy again" puts in the cart: the order's items the merchant allows, those in stock, and which are sold out. */
export function buyAgainFor(lines: BuyAgainLine[], b: BuyAgain): { items: { variantId: number; quantity: number; title: string }[]; soldOut: string[] } {
  const list = b.list.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const allowed = (l: BuyAgainLine) => b.only === "all" || !list.length ? true : b.only === "types" ? list.includes(l.productType.toLowerCase()) : l.tags.some((t) => list.includes(t.toLowerCase()));
  const kept = lines.filter(allowed);
  const name = (l: BuyAgainLine) => (l.variant ? `${l.title} (${l.variant})` : l.title);
  return { items: kept.filter((l) => l.available && l.variantId > 0).map((l) => ({ variantId: l.variantId, quantity: l.quantity, title: name(l) })), soldOut: kept.filter((l) => !l.available).map(name) };
}
