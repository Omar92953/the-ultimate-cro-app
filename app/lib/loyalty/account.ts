/**
 * What the loyalty extensions read without calling the app (no network access needed):
 *   customer metafield $app:loyalty: one member's points, pending points, tier, referral code, reward codes not used
 *     yet and the points of their latest orders (customer account pages, thank you page, checkout);
 *   shop metafield $app:loyalty: the program's rules the extensions need (units, earn rate, rewards, store address).
 * Written by lib/loyalty/account.server.ts. Kept small: Shopify reads them on every checkout. Pure (shared with tests).
 */
import type { LoyaltyConfig } from "./config";

export const ACCOUNT_KEY = "loyalty";
/** Reward codes and orders kept in a member's metafield. */
const MAX_CODES = 10;
const MAX_ORDERS = 10;

export type AccountMember = {
  points: number;
  pending: number;
  tier: string;
  referralCode: string;
  blocked: boolean;
  /** "MM-DD", typed by the shopper in the widget. In the metafield so the store sees it in Shopify (App Store 5.1.5). */
  birthday?: string;
};
export type AccountReward = { title: string; code: string; expiresAt: Date | null; createdAt: Date };
export type AccountOrderPoints = { orderId: string; points: number; pending: boolean };

/** The member's metafield. `rw`: codes not expired yet, newest first; `o`: order id → points it earned (pending or ready). */
export function memberPayload(c: LoyaltyConfig, m: AccountMember, rewards: AccountReward[], orders: AccountOrderPoints[], storeUrl = "", now = new Date()) {
  const tier = c.tiers.on ? c.tiers.list.find((t) => t.id === m.tier) : undefined;
  const codes = rewards
    .filter((r) => r.code && (!r.expiresAt || r.expiresAt.getTime() > now.getTime()))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, MAX_CODES)
    .map((r) => ({ t: r.title, c: r.code, e: r.expiresAt ? r.expiresAt.toISOString().slice(0, 10) : null }));
  const byOrder = new Map<string, { p: number; pe: boolean }>();
  for (const o of orders) {
    if (!o.orderId) continue;
    const cur = byOrder.get(o.orderId) ?? { p: 0, pe: false };
    byOrder.set(o.orderId, { p: cur.p + o.points, pe: cur.pe || o.pending });
  }
  return {
    v: 1,
    p: m.points,
    pe: m.pending,
    t: tier?.name ?? "",
    /** The tier's points multiplier, for "this order earns" before the order is read. */
    x: tier?.multiplier ?? 1,
    r: m.blocked ? "" : m.referralCode,
    /** The member's referral link (the store with ?ref=CODE), when referrals are on. */
    l: !m.blocked && c.referral.on && storeUrl && m.referralCode ? `${storeUrl.replace(/\/+$/, "")}/?ref=${encodeURIComponent(m.referralCode)}` : "",
    u: [c.unit.one, c.unit.many],
    b: m.blocked,
    bd: m.birthday ?? "",
    rw: m.blocked ? [] : codes,
    o: Object.fromEntries([...byOrder].filter(([, x]) => x.p > 0).slice(0, MAX_ORDERS)),
  };
}
export type MemberPayload = ReturnType<typeof memberPayload>;

/** The shop's metafield: what the extensions show for everyone (the rate for "this order earns", the rewards to spend). */
export function shopPayload(c: LoyaltyConfig, on: boolean, storeUrl: string) {
  return {
    v: 1,
    on,
    u: c.unit,
    per: c.earn.order.on ? c.earn.order.perUnit : 0,
    sh: c.earn.order.shipping,
    tx: c.earn.order.taxes,
    cb: c.cashback.on ? c.cashback.percent : 0,
    /** A guest checkout: "now" earns right away, "account" once they make an account, "off" earns nothing. */
    gu: c.autoJoin ? c.guests : "off",
    ti: c.tiers.on ? c.tiers.list.map((t) => ({ n: t.name, x: t.multiplier })) : [],
    rw: c.rewards.filter((r) => r.on).map((r) => ({ id: r.id, t: r.title, p: r.points, k: r.kind })),
    ref: c.referral.on && storeUrl ? storeUrl.replace(/\/+$/, "") : "",
  };
}
export type ShopPayload = ReturnType<typeof shopPayload>;
