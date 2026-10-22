/** Pure helpers for the checkout and POS loyalty endpoints (lib/loyalty/counter.server.ts), shared with the tests. */
import type { LoyaltyConfig } from "./config";

/** "https://shop.myshopify.com" (the session token's `dest`) → "shop.myshopify.com". */
export const shopOf = (dest: unknown) => {
  const host = String(dest ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host) ? host : null;
};
/** "gid://shopify/Customer/123" or "123" → "123". */
export const customerIdOf = (v: unknown) => {
  const id = String(v ?? "").split("/").pop() ?? "";
  return /^\d{1,20}$/.test(id) ? id : null;
};

/** The rewards this member can see: on, and for their tier. `codeOnly`: checkout can only use rewards that are codes. */
export function rewardsFor(c: LoyaltyConfig, m: { points: number; tier: string }, codeOnly: boolean) {
  return c.rewards
    .filter((r) => r.on && (!codeOnly || r.kind !== "credit") && (!r.tiers.length || !c.tiers.on || r.tiers.includes(m.tier)))
    .map((r) => ({ id: r.id, title: r.title, points: r.points, kind: r.kind, enough: m.points >= r.points }));
}

/** A member's summary for the extensions. */
export function summaryOf(c: LoyaltyConfig, m: { points: number; pending: number; tier: string; blocked: boolean }) {
  const tier = c.tiers.on ? c.tiers.list.find((t) => t.id === m.tier) : undefined;
  return { points: m.points, pending: m.pending, tier: tier?.name ?? "", blocked: m.blocked, unit: c.unit };
}
