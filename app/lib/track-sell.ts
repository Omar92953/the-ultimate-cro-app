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

export type TrackSell = { nextOrder: NextOrder };

export const DEFAULT_TRACK_SELL: TrackSell = { nextOrder: { on: false, mode: "perOrder", percent: 10, minimum: 0, days: 30, sharedCode: "THANKS10" } };

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export function withTrackSellDefaults(raw: unknown): TrackSell {
  const r = obj(raw), n = obj(r.nextOrder);
  const d = DEFAULT_TRACK_SELL.nextOrder;
  const code = str(n.sharedCode, d.sharedCode, 20).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return {
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
