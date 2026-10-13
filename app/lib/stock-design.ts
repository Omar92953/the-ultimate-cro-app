/**
 * "Back in stock & pre-order" on the product page (Boosters → Back in stock & pre-order). One block next
 * to Add to cart that follows the chosen variant:
 *  - sold out → "Notify me when available": the shopper leaves an email (saved by the app, see
 *    proxy.notify.tsx and the StockAlert table), and the merchant sees who is waiting in the app;
 *  - out of stock but still sellable ("Continue selling when out of stock" in Shopify) → pre-order:
 *    the Add to cart button says "Pre-order", a note says when it ships, and the order line gets a
 *    "Pre-order" property so the merchant sees it on the order.
 * Stored in $app:cro_design "stock" (+ "stock_editor"). Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";
import { BUTTON_HEIGHT, BUTTON_TEXT, defaultSizes, sizeVars, withSizes, type SizeSpec, type Sizes } from "./sizes";

export const STOCK_SIZES: SizeSpec[] = [
  { key: "heading", label: "Heading", cssVar: "--ucs-st-h", min: 12, max: 32, def: 16 },
  { key: "text", label: "Text", cssVar: "--ucs-st-t", min: 10, max: 22, def: 14 },
  { key: "input", label: "Email box height", cssVar: "--ucs-st-in", min: 32, max: 64, def: 44 },
  BUTTON_TEXT,
  BUTTON_HEIGHT,
];

export type StockDesign = {
  scheme: string;
  notify: { on: boolean; heading: string; text: string; placeholder: string; button: string; thanks: string; privacy: string };
  preorder: { on: boolean; button: string; note: string; label: string; value: string };
  look: { style: "box" | "plain"; accent: string; onAccent: string; bg: string; radius: number };
  sizes: Sizes;
};

export const DEFAULT_STOCK: StockDesign = {
  scheme: "",
  notify: {
    on: true,
    heading: "Sold out? Get an email when it's back",
    text: "Leave your email and we'll let you know as soon as it's in stock.",
    placeholder: "Your email",
    button: "Notify me",
    thanks: "Thanks! We'll email you when it's back in stock.",
    privacy: "We only use your email for this message.",
  },
  preorder: { on: true, button: "Pre-order", note: "Pre-order now. Ships in 2 to 3 weeks.", label: "Pre-order", value: "Ships in 2 to 3 weeks" },
  look: { style: "box", accent: "#121212", onAccent: "#ffffff", bg: "#f6f6f6", radius: 12 },
  sizes: defaultSizes(STOCK_SIZES),
};

type Patch = { look?: Partial<StockDesign["look"]> };
export const STOCK_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "box", title: "Soft box", patch: { look: { style: "box", bg: "#f6f6f6", accent: "#121212", onAccent: "#ffffff", radius: 12 } } },
  { key: "plain", title: "Plain", patch: { look: { style: "plain", accent: "#121212", onAccent: "#ffffff", radius: 6 } } },
  { key: "warm", title: "Warm", patch: { look: { style: "box", bg: "#fff6ea", accent: "#c2410c", onAccent: "#ffffff", radius: 16 } } },
  { key: "dark", title: "Dark button", patch: { look: { style: "box", bg: "#f1f1f1", accent: "#111111", onAccent: "#facc15", radius: 999 } } },
];

export function applyStockPreset(c: StockDesign, key: string): StockDesign {
  const p = STOCK_PRESETS.find((x) => x.key === key);
  return p ? { ...c, scheme: "", look: { ...c.look, ...p.patch.look } } : c;
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withStockDefaults(raw: unknown): StockDesign {
  const r = obj(raw);
  const d = DEFAULT_STOCK;
  const n = obj(r.notify), p = obj(r.preorder), k = obj(r.look);
  return {
    scheme: schemeId(r.scheme),
    notify: {
      on: bool(n.on, d.notify.on),
      heading: str(n.heading, d.notify.heading, 120),
      text: str(n.text, d.notify.text, 240),
      placeholder: str(n.placeholder, d.notify.placeholder, 40),
      button: str(n.button, d.notify.button, 30),
      thanks: str(n.thanks, d.notify.thanks, 160),
      privacy: str(n.privacy, d.notify.privacy, 160),
    },
    preorder: { on: bool(p.on, d.preorder.on), button: str(p.button, d.preorder.button, 30), note: str(p.note, d.preorder.note, 160), label: str(p.label, d.preorder.label, 30), value: str(p.value, d.preorder.value, 80) },
    look: { style: pick(k.style, ["box", "plain"] as const, d.look.style), accent: color(k.accent, d.look.accent), onAccent: color(k.onAccent, d.look.onAccent), bg: color(k.bg, d.look.bg), radius: num(k.radius, 0, 999, d.look.radius) },
    sizes: withSizes(r.sizes, STOCK_SIZES),
  };
}

export function stockVars(c: StockDesign): Record<string, string> {
  const v: Record<string, string> = { "--ucs-accent": c.look.accent, "--ucs-on-accent": c.look.onAccent, "--ucs-st-bg": c.look.bg, "--ucs-btn-radius": `${c.look.radius}px`, "--ucs-st-r": `${Math.min(c.look.radius, 24)}px` };
  Object.assign(v, sizeVars(c.sizes, STOCK_SIZES));
  return v;
}

export const stockClass = (c: StockDesign) => `ucs ucs-st ucs-st--${c.look.style}`;

/** The storefront copy, read by ucs-stock.liquid / ucs-stock.js. */
export function toStorefrontStock(c: StockDesign) {
  return {
    cls: stockClass(c),
    css: Object.entries(stockVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
    n: c.notify,
    p: c.preorder,
  };
}
