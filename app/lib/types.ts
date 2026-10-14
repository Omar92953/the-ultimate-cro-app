/** Types shared by the dashboard UI and the server (no server code here). */
export type Ref = { id: string; title: string; image?: string | null; handle?: string };
export type TriggerType = "all" | "products" | "collections";
/** A quantity tier (qty) or, for "variant" upsells, an option-value tier (value, e.g. "100 ml"). */
export type Tier = { qty: number; pct: number; label?: string; badge?: string; value?: string };
export type UpsellType = "quantity" | "variant";
export type RuleKind = "cross_sell" | "upsell";
export type Placement = "product" | "cart" | "drawer";

export type Rule = {
  id?: string;
  handle?: string;
  kind: RuleKind;
  name: string;
  active: boolean;
  priority: number;
  triggerType: TriggerType;
  triggerProducts: Ref[];
  triggerCollections: Ref[];
  offeredProducts: Ref[];
  tiers: Tier[];
  upsellType: UpsellType;
  optionName: string;
  placements: Placement[];
  headline: string;
  subheadline: string;
  buttonLabel: string;
  discountPercent: number;
  discountLabel: string;
};

export type Settings = {
  cross_sell_enabled: boolean;
  upsell_enabled: boolean;
  videos_enabled: boolean;
  bundles_enabled: boolean;
};

/** Which engine applies offer discounts at checkout. */
export type DiscountMode = "auto" | "function" | "native";
/** What "auto" resolved to for this shop. */
export type DiscountEngine = "function" | "native";

export type Slide = {
  video: (Ref & { kind: "video" | "image" }) | null;
  product: Ref | null;
  caption: string;
};

export type BundleStep = {
  label: string;
  required: boolean;
  min: number;
  max: number;
  products: Ref[];
  collection: Ref | null;
};

/**
 * One tier row. `qty` = number of items; `price` = the tier's value, read by the pricing kind:
 * "tiers" the bundle price, "percent_tiers" the percent off, "amount_tiers" the amount off.
 */
export const BUNDLE_PRICINGS = ["fixed", "percent", "tiers", "percent_tiers", "amount_tiers"] as const;
export type BundlePricing = (typeof BUNDLE_PRICINGS)[number];
export const bundlePricing = (v: unknown): BundlePricing => (BUNDLE_PRICINGS as readonly string[]).includes(String(v)) ? (v as BundlePricing) : "fixed";
/** Growing discounts: % or amount off that grows with the number of items. */
export const growingPricing = (p: BundlePricing) => p === "percent_tiers" || p === "amount_tiers";

export type BundleTier = { qty: number; price: number };
export type BundleExtra = { value: string; amount: number };

export type Bundle = {
  id?: string;
  handle?: string;
  name: string;
  active: boolean;
  product: Ref | null;
  steps: BundleStep[];
  allowDuplicates: boolean;
  hideSoldOut: boolean;
  /**
   * "fixed": shoppers pay the bundle product's price; "percent": percentOff off the picked items;
   * "tiers": the price depends on how many items they pick (tiers, e.g. 3 for $30, 6 for $55);
   * "percent_tiers" / "amount_tiers": a discount that grows with the number of items
   * (e.g. 2 items 10% off, 3 items 15%; or 2 items $5 off, 3 items $10 off).
   */
  pricing: BundlePricing;
  percentOff: number;
  /** "tiers" pricing: box sizes and their prices (store currency). */
  tiers: BundleTier[];
  /** Extra charge when a picked item has this option value (e.g. "XL" +5), for fixed and tier prices. */
  extras: BundleExtra[];
  /** Shoppers can also build it from product and collection pages (Add to bundle + bundle tray). */
  storeWide: boolean;
  /** Optional store page (/pages/…) that shows the builder too; the bundle product stays the checkout parent. */
  page?: { id: string; title: string; handle: string } | null;
};

export const FEATURE_KEYS = [
  "cross_sell_enabled",
  "upsell_enabled",
  "videos_enabled",
  "bundles_enabled",
] as const;

