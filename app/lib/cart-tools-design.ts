/**
 * Cart drawer & checkout (Boosters → Cart drawer & checkout), one app embed:
 *  - the app's own slide-out cart drawer (opens on add to cart and from the cart icon), with
 *    quantity buttons, the subtotal, a note and the checkout button;
 *  - express checkout buttons (Shop Pay, Apple Pay, Google Pay…) inside it;
 *  - best discount: tries the codes you list on the cart and keeps the one that saves the most;
 *  - saved and shareable carts: a link that rebuilds the cart on any device, and "your cart is
 *    saved" on this device.
 * Stored in $app:cro_design "cart_tools" (+ "_editor"). Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";
import { BUTTON_HEIGHT, BUTTON_TEXT, defaultSizes, sizeVars, withSizes, type SizeSpec, type Sizes } from "./sizes";

export const CART_TOOLS_SIZES: SizeSpec[] = [
  { key: "title", label: "Title", cssVar: "--ucs-cd-h", min: 14, max: 32, def: 20 },
  { key: "text", label: "Item text", cssVar: "--ucs-cd-t", min: 11, max: 20, def: 14 },
  { key: "image", label: "Item pictures", cssVar: "--ucs-cd-img", min: 40, max: 120, def: 72 },
  BUTTON_TEXT,
  BUTTON_HEIGHT,
];

export type CartToolsDesign = {
  scheme: string;
  drawer: { on: boolean; side: "right" | "left"; width: number; title: string; empty: string; continueText: string; checkout: string; subtotal: string; taxes: string; openOnAdd: boolean };
  express: { on: boolean };
  discount: { on: boolean; codes: string; applied: string };
  share: { on: boolean; button: string; copied: string; restore: string };
  look: { bg: string; fg: string; accent: string; onAccent: string; radius: number; overlay: number };
  sizes: Sizes;
};

export const DEFAULT_CART_TOOLS: CartToolsDesign = {
  scheme: "",
  drawer: { on: true, side: "right", width: 420, title: "Your cart", empty: "Your cart is empty", continueText: "Continue shopping", checkout: "Check out", subtotal: "Subtotal", taxes: "Taxes and shipping at checkout", openOnAdd: true },
  express: { on: true },
  discount: { on: false, codes: "", applied: "Best discount applied: {code}" },
  share: { on: true, button: "Share cart", copied: "Link copied — open it on any device to get this cart", restore: "Welcome back — your saved cart is ready" },
  look: { bg: "#ffffff", fg: "#121212", accent: "#121212", onAccent: "#ffffff", radius: 10, overlay: 40 },
  sizes: defaultSizes(CART_TOOLS_SIZES),
};

type Patch = { look?: Partial<CartToolsDesign["look"]>; drawer?: Partial<CartToolsDesign["drawer"]> };
export const CART_TOOLS_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "clean", title: "Clean white", patch: { look: { bg: "#ffffff", fg: "#121212", accent: "#121212", onAccent: "#ffffff", radius: 10 } } },
  { key: "dark", title: "Dark", patch: { look: { bg: "#111111", fg: "#ffffff", accent: "#ffffff", onAccent: "#111111", radius: 10 } } },
  { key: "soft", title: "Soft rounded", patch: { look: { bg: "#faf7f2", fg: "#2b2118", accent: "#c2410c", onAccent: "#ffffff", radius: 18 } } },
  { key: "left", title: "From the left", patch: { drawer: { side: "left" }, look: { bg: "#ffffff", fg: "#121212", accent: "#1d4ed8", onAccent: "#ffffff", radius: 8 } } },
];

export function applyCartToolsPreset(c: CartToolsDesign, key: string): CartToolsDesign {
  const p = CART_TOOLS_PRESETS.find((x) => x.key === key);
  return p ? { ...c, scheme: "", look: { ...c.look, ...p.patch.look }, drawer: { ...c.drawer, ...p.patch.drawer } } : c;
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withCartToolsDefaults(raw: unknown): CartToolsDesign {
  const r = obj(raw);
  const d = DEFAULT_CART_TOOLS;
  const dr = obj(r.drawer), ex = obj(r.express), di = obj(r.discount), sh = obj(r.share), k = obj(r.look);
  return {
    scheme: schemeId(r.scheme),
    drawer: {
      on: bool(dr.on, d.drawer.on),
      side: pick(dr.side, ["right", "left"] as const, d.drawer.side),
      width: num(dr.width, 320, 640, d.drawer.width),
      title: str(dr.title, d.drawer.title, 60),
      empty: str(dr.empty, d.drawer.empty, 120),
      continueText: str(dr.continueText, d.drawer.continueText, 40),
      checkout: str(dr.checkout, d.drawer.checkout, 40),
      subtotal: str(dr.subtotal, d.drawer.subtotal, 40),
      taxes: str(dr.taxes, d.drawer.taxes, 120),
      openOnAdd: bool(dr.openOnAdd, d.drawer.openOnAdd),
    },
    express: { on: bool(ex.on, d.express.on) },
    discount: {
      on: bool(di.on, d.discount.on),
      codes: String(di.codes ?? "")
        .toUpperCase()
        .split(/[\s,]+/)
        .filter((c) => /^[A-Z0-9_-]{2,40}$/.test(c))
        .slice(0, 6)
        .join(", "),
      applied: str(di.applied, d.discount.applied, 120),
    },
    share: { on: bool(sh.on, d.share.on), button: str(sh.button, d.share.button, 40), copied: str(sh.copied, d.share.copied, 160), restore: str(sh.restore, d.share.restore, 160) },
    look: { bg: color(k.bg, d.look.bg), fg: color(k.fg, d.look.fg), accent: color(k.accent, d.look.accent), onAccent: color(k.onAccent, d.look.onAccent), radius: num(k.radius, 0, 30, d.look.radius), overlay: num(k.overlay, 0, 90, d.look.overlay) },
    sizes: withSizes(r.sizes, CART_TOOLS_SIZES),
  };
}

export function cartToolsVars(c: CartToolsDesign): Record<string, string> {
  const v: Record<string, string> = {
    "--ucs-cd-bg": c.look.bg,
    "--ucs-cd-fg": c.look.fg,
    "--ucs-accent": c.look.accent,
    "--ucs-on-accent": c.look.onAccent,
    "--ucs-btn-radius": `${c.look.radius}px`,
    "--ucs-cd-r": `${c.look.radius}px`,
    "--ucs-cd-w": `${c.drawer.width}px`,
    "--ucs-cd-ov": String(c.look.overlay / 100),
  };
  Object.assign(v, sizeVars(c.sizes, CART_TOOLS_SIZES));
  return v;
}

/** The storefront copy, read by ucs-cart.liquid / ucs-cart.js. */
export function toStorefrontCartTools(c: CartToolsDesign) {
  return {
    css: Object.entries(cartToolsVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
    dr: c.drawer.on ? c.drawer : null,
    ex: c.express.on,
    dc: c.discount.on && c.discount.codes ? { codes: c.discount.codes.split(/,\s*/), t: c.discount.applied } : null,
    sh: c.share.on ? c.share : null,
  };
}
