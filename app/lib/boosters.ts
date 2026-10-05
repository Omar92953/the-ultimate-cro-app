/**
 * Conversion boosters: sticky add to cart, stock urgency, trust badges and sales pop-ups.
 * One settings object, stored as JSON in $app:cro_boosters "main" and read by the
 * "Conversion boosters" app embed. Shared by client and server.
 */

export type StickyConfig = {
  enabled: boolean;
  devices: "all" | "mobile" | "desktop";
  position: "bottom" | "top";
  showImage: boolean;
  showOptions: boolean;
  buttonText: string;
  soldOutText: string;
  bg: string;
  fg: string;
  buttonBg: string; // "" = the theme's button colour
  buttonFg: string;
};

export type UrgencyConfig = {
  enabled: boolean;
  threshold: number; // show when stock is at or below this
  text: string; // {count}
  lastOneText: string;
  showBar: boolean;
  color: string;
};

export const TRUST_BADGES = [
  { key: "secure", label: "Secure checkout" },
  { key: "shipping", label: "Fast delivery" },
  { key: "returns", label: "Free returns" },
  { key: "cod", label: "Cash on delivery" },
  { key: "support", label: "24/7 support" },
  { key: "warranty", label: "1-year warranty" },
  { key: "quality", label: "Quality guaranteed" },
  { key: "gift", label: "Gift wrapping" },
] as const;
export type TrustBadgeKey = (typeof TRUST_BADGES)[number]["key"];

export type TrustConfig = {
  enabled: boolean;
  heading: string;
  badges: { key: TrustBadgeKey; label: string }[];
  showPayments: boolean;
  style: "row" | "grid";
  color: string;
};

export type SalesPopConfig = {
  enabled: boolean;
  position: "bottom-left" | "bottom-right";
  firstDelay: number; // seconds before the first one
  gap: number; // seconds between pop-ups
  perVisit: number;
  showCity: boolean;
  text: string; // {city} {product}
  maxAgeDays: number;
  devices: "all" | "mobile" | "desktop";
};

export type BoostersConfig = {
  sticky: StickyConfig;
  urgency: UrgencyConfig;
  trust: TrustConfig;
  salesPop: SalesPopConfig;
};

export const DEFAULT_BOOSTERS: BoostersConfig = {
  sticky: {
    enabled: true,
    devices: "all",
    position: "bottom",
    showImage: true,
    showOptions: true,
    buttonText: "Add to cart",
    soldOutText: "Sold out",
    bg: "#ffffff",
    fg: "#121212",
    buttonBg: "",
    buttonFg: "",
  },
  urgency: {
    enabled: true,
    threshold: 10,
    text: "Hurry! Only {count} left in stock",
    lastOneText: "Last one in stock!",
    showBar: true,
    color: "#b42318",
  },
  trust: {
    enabled: true,
    heading: "",
    badges: [
      { key: "secure", label: "Secure checkout" },
      { key: "shipping", label: "Fast delivery" },
      { key: "returns", label: "Free returns" },
      { key: "cod", label: "Cash on delivery" },
    ],
    showPayments: true,
    style: "row",
    color: "#303030",
  },
  salesPop: {
    enabled: true,
    position: "bottom-left",
    firstDelay: 8,
    gap: 20,
    perVisit: 5,
    showCity: false,
    text: "Someone{city} bought {product}",
    maxAgeDays: 7,
    devices: "all",
  },
};

/** Fills anything missing (older saves, new options) from the defaults. */
export function withDefaults(raw: unknown): BoostersConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof BoostersConfig, object>>;
  return {
    sticky: { ...DEFAULT_BOOSTERS.sticky, ...(r.sticky ?? {}) },
    urgency: { ...DEFAULT_BOOSTERS.urgency, ...(r.urgency ?? {}) },
    trust: { ...DEFAULT_BOOSTERS.trust, ...(r.trust ?? {}) },
    salesPop: { ...DEFAULT_BOOSTERS.salesPop, ...(r.salesPop ?? {}) },
  };
}

/** One purchase shown by sales pop-ups. No customer names are ever stored. */
export type RecentPurchase = {
  product: string;
  handle: string;
  image: string | null;
  city: string | null;
  at: string; // ISO time
};
