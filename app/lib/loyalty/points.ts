/**
 * Loyalty points maths, pure (no Shopify or database): what an order is worth, and the order facts the
 * engine works from, whichever way the order arrived (Admin API read or webhook).
 */
import type { LoyaltyConfig, ProductRule, Tier } from "./config";

/** One order as the loyalty engine needs it. Money is in the store's currency, already net of refunds and edits. */
export type OrderFacts = {
  id: string;
  name: string;
  createdAt: string;
  customer: { id: string; email: string; firstName: string; locale: string; tags: string[]; /** Subscribed to email marketing (absent: not known). */ marketing?: boolean; /** Has a customer account (false: a guest checkout; absent: not known). */ account?: boolean } | null;
  /** Paid (or paid and then refunded): points count. Pending payment (cash on delivery): not yet. */
  paid: boolean;
  cancelled: boolean;
  subtotal: number;
  shipping: number;
  taxes: number;
  /** The order's lines now (after refunds and every discount), for product and collection rules. Absent: the subtotal counts at the main rate. */
  lines?: { productId: string; collectionIds: string[]; amount: number }[];
  /** The discount codes used (referral and affiliate codes are matched to their member or affiliate). */
  codes?: string[];
};

/** Money that earns points for this order (0 when it isn't paid or was cancelled). */
export function orderBase(c: LoyaltyConfig, o: OrderFacts): number {
  if (!o.paid || o.cancelled) return 0;
  const base = o.subtotal + (c.earn.order.shipping ? o.shipping : 0) + (c.earn.order.taxes ? o.taxes : 0);
  return Math.max(0, Math.round(base * 100) / 100);
}

/** The rate for one line: the first product or collection rule that matches it, else the main rate. */
export function lineRate(c: LoyaltyConfig, line: { productId: string; collectionIds: string[] }): number {
  const hit = c.productRules.find((r: ProductRule) => r.items.some((it) => (r.kind === "products" ? it.id === line.productId : line.collectionIds.includes(it.id))));
  return hit ? hit.perUnit : c.earn.order.perUnit;
}

/** Points this order is worth now (whole points, rounded down), times the tier and campaign multiplier it was earned with. */
export function orderPoints(c: LoyaltyConfig, o: OrderFacts, multiplier = 1): number {
  if (!c.earn.order.on || !o.paid || o.cancelled) return 0;
  const rate = c.earn.order.perUnit;
  const extras = (c.earn.order.shipping ? o.shipping : 0) + (c.earn.order.taxes ? o.taxes : 0);
  const items = c.productRules.length && o.lines?.length ? o.lines.reduce((n, l) => n + l.amount * lineRate(c, l), 0) : o.subtotal * rate;
  return Math.floor(Math.max(0, items + extras * rate) * multiplier + 1e-9);
}

/** Cashback mode: the store credit this order earns (2 decimals). */
export function orderCredit(c: LoyaltyConfig, o: OrderFacts): number {
  if (!c.cashback.on) return 0;
  return Math.round(orderBase(c, o) * c.cashback.percent) / 100;
}

/** The multiplier for an order: the member's tier times a campaign running on the order's day. */
export function multiplierFor(c: LoyaltyConfig, tierId: string, orderDate: string): number {
  const tier = c.tiers.on ? c.tiers.list.find((t) => t.id === tierId) : undefined;
  const dayOf = orderDate.slice(0, 10);
  const camp = c.campaigns.filter((x) => x.from <= dayOf && dayOf <= x.to).reduce((m, x) => Math.max(m, x.multiplier), 1);
  return Math.round((tier?.multiplier ?? 1) * camp * 100) / 100;
}

/** The tier a member is in for this value (points earned or money spent): the highest one they reached. */
export function tierFor(c: LoyaltyConfig, value: number): Tier | null {
  if (!c.tiers.on || !c.tiers.list.length) return null;
  return [...c.tiers.list].sort((a, b) => b.min - a.min).find((t) => value >= t.min) ?? null;
}

/** The next tier up and how far away it is, for the widget ("250 points to Gold"). */
export function nextTier(c: LoyaltyConfig, value: number): { tier: Tier; need: number } | null {
  if (!c.tiers.on) return null;
  const up = [...c.tiers.list].sort((a, b) => a.min - b.min).find((t) => t.min > value);
  return up ? { tier: up, need: Math.ceil(up.min - value) } : null;
}

/** Is this customer kept out of the program by one of its tags? */
export function isExcluded(tags: string[], excluded: string[]): boolean {
  if (!excluded.length) return false;
  const have = tags.map((t) => t.trim().toLowerCase());
  return excluded.some((t) => have.includes(t));
}

/** A short referral code: letters and digits that can't be mistaken for each other. */
export function newReferralCode(random: () => number = Math.random): string {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 7 }, () => abc[Math.floor(random() * abc.length)]).join("");
}
