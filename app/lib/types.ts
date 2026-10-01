/** Types shared by the dashboard UI and the server (no server code here). */
export type Ref = { id: string; title: string; image?: string | null };
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

export type Bundle = {
  id?: string;
  handle?: string;
  name: string;
  active: boolean;
  product: Ref | null;
  steps: BundleStep[];
  allowDuplicates: boolean;
  hideSoldOut: boolean;
};

export const FEATURE_KEYS = [
  "cross_sell_enabled",
  "upsell_enabled",
  "videos_enabled",
  "bundles_enabled",
] as const;

