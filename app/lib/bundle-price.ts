/**
 * Mix & match bundle price for previews in the app, the same math as checkout (cro-bundles Cart
 * Transform) and the storefront (ucro-core.js bundlePrice). Cents in the store currency; option
 * extras are left out of previews.
 */
import type { BundlePricing, BundleTier } from "./types";

export type PreviewPricing = { kind: BundlePricing; percent: number; tiers?: BundleTier[] };
export type BundlePriceResult = {
  /** What the picked items cost on their own. */
  value: number;
  /** The bundle price, or null when the item count doesn't match a "price by number of items" tier. */
  price: number | null;
  /** Growing discounts: items still to add for the next tier, and that tier's % or amount (cents). */
  more: { count: number; pct: number | null; cents: number | null } | null;
};

export function bundlePrice(pricing: PreviewPricing | undefined, bundlePriceCents: number, picks: number[]): BundlePriceResult {
  const value = picks.reduce((n, c) => n + c, 0);
  const n = picks.length;
  const kind = pricing?.kind ?? "fixed";
  const tiers = [...(pricing?.tiers ?? [])].sort((a, b) => a.qty - b.qty);
  if (kind === "percent") return { value, price: Math.round(value * (1 - (pricing?.percent ?? 0) / 100)), more: null };
  if (kind === "tiers") {
    const hit = tiers.find((t) => t.qty === n);
    return { value, price: hit ? Math.min(Math.round(hit.price * 100), value || Infinity) : null, more: null };
  }
  if (kind === "percent_tiers" || kind === "amount_tiers") {
    const pct = kind === "percent_tiers";
    const reached = tiers.filter((t) => t.qty <= n).pop();
    const up = tiers.find((t) => t.qty > n);
    const off = reached ? (pct ? Math.round((value * reached.price) / 100) : Math.round(reached.price * 100)) : 0;
    return {
      value,
      price: Math.max(0, value - Math.min(off, value)),
      more: up ? { count: up.qty - n, pct: pct ? up.price : null, cents: pct ? null : Math.round(up.price * 100) } : null,
    };
  }
  return { value, price: value ? Math.min(bundlePriceCents, value) : bundlePriceCents, more: null };
}
