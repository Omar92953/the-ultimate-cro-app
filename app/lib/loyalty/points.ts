/**
 * Loyalty points maths, pure (no Shopify or database): what an order is worth, and the order facts the
 * engine works from, whichever way the order arrived (Admin API read or webhook).
 */
import type { LoyaltyConfig } from "./config";

/** One order as the loyalty engine needs it. Money is in the store's currency, already net of refunds and edits. */
export type OrderFacts = {
  id: string;
  name: string;
  createdAt: string;
  customer: { id: string; email: string; firstName: string; locale: string; tags: string[] } | null;
  /** Paid (or paid and then refunded): points count. Pending payment (cash on delivery): not yet. */
  paid: boolean;
  cancelled: boolean;
  subtotal: number;
  shipping: number;
  taxes: number;
};

/** Money that earns points for this order (0 when it isn't paid or was cancelled). */
export function orderBase(c: LoyaltyConfig, o: OrderFacts): number {
  if (!o.paid || o.cancelled) return 0;
  const base = o.subtotal + (c.earn.order.shipping ? o.shipping : 0) + (c.earn.order.taxes ? o.taxes : 0);
  return Math.max(0, Math.round(base * 100) / 100);
}

/** Points this order is worth now (whole points, rounded down). */
export function orderPoints(c: LoyaltyConfig, o: OrderFacts): number {
  if (!c.earn.order.on) return 0;
  return Math.floor(orderBase(c, o) * c.earn.order.perUnit + 1e-9);
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
