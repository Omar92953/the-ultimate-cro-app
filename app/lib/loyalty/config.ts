/**
 * Loyalty program settings (Pro): how members earn points, when points can be used and when they expire.
 * Stored per store in LoyaltyProgram.config (lib/loyalty/program.server.ts). Rewards, tiers, referrals,
 * emails and the storefront look are added to this same object by their own pages.
 * Shared by client and server; no dashes or first person in the texts.
 */
import { num, str } from "../designs";

export type LoyaltyConfig = {
  /** What points are called on the store ("point" / "points"). */
  unit: { one: string; many: string };
  /** Customers join by themselves with their first order or account (on), or only from the widget's Join button (off). */
  autoJoin: boolean;
  /** Customers with one of these tags can't earn or redeem (for example wholesale). Comma separated. */
  excludeTags: string;
  earn: {
    /** Points per 1 unit of the store's currency on paid orders. */
    order: { on: boolean; perUnit: number; shipping: boolean; taxes: boolean };
    /** A customer account is created (or activated). */
    signup: { on: boolean; points: number };
    /** Extra points on the member's first order. */
    firstOrder: { on: boolean; points: number };
  };
  /** Days before order points can be used (returns window). 0 = at once. */
  pendingDays: number;
  /** Points expire after this many days without a new order or redemption. */
  expiry: { on: boolean; days: number };
  /** Earn store credit (a percent of each order) instead of points. */
  cashback: { on: boolean; percent: number };
};

export const DEFAULT_LOYALTY: LoyaltyConfig = {
  unit: { one: "point", many: "points" },
  autoJoin: true,
  excludeTags: "",
  earn: {
    order: { on: true, perUnit: 1, shipping: false, taxes: false },
    signup: { on: true, points: 100 },
    firstOrder: { on: false, points: 50 },
  },
  pendingDays: 14,
  expiry: { on: false, days: 365 },
  cashback: { on: false, percent: 5 },
};

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
/** Points per currency unit can be a fraction (0.5 = 1 point per 2 units). */
const rate = (v: unknown, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n * 100) / 100 : d;
};

export function withLoyaltyDefaults(raw: unknown): LoyaltyConfig {
  const r = obj(raw), d = DEFAULT_LOYALTY;
  const u = obj(r.unit), e = obj(r.earn), o = obj(e.order), s = obj(e.signup), f = obj(e.firstOrder), x = obj(r.expiry), c = obj(r.cashback);
  return {
    unit: { one: str(u.one, d.unit.one, 20) || d.unit.one, many: str(u.many, d.unit.many, 20) || d.unit.many },
    autoJoin: bool(r.autoJoin, d.autoJoin),
    excludeTags: str(r.excludeTags, d.excludeTags, 300),
    earn: {
      order: { on: bool(o.on, d.earn.order.on), perUnit: rate(o.perUnit, d.earn.order.perUnit), shipping: bool(o.shipping, d.earn.order.shipping), taxes: bool(o.taxes, d.earn.order.taxes) },
      signup: { on: bool(s.on, d.earn.signup.on), points: num(s.points, 0, 100000, d.earn.signup.points) },
      firstOrder: { on: bool(f.on, d.earn.firstOrder.on), points: num(f.points, 0, 100000, d.earn.firstOrder.points) },
    },
    pendingDays: num(r.pendingDays, 0, 90, d.pendingDays),
    expiry: { on: bool(x.on, d.expiry.on), days: num(x.days, 30, 3650, d.expiry.days) },
    cashback: { on: bool(c.on, d.cashback.on), percent: num(c.percent, 1, 50, d.cashback.percent) },
  };
}

/** "1 point" / "250 points". */
export const pointsLabel = (c: LoyaltyConfig, n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? c.unit.one : c.unit.many}`;

/** The customer tags that keep a customer out of the program. */
export const excludedTags = (c: LoyaltyConfig) => c.excludeTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
