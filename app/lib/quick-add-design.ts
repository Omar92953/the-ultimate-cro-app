/**
 * Quick add to cart (product-card button + "Added" popup), designed in the app (moved out of the
 * theme editor). Stored in $app:cro_design "quick_add" (storefront: the same shape ucs-quick-add.js
 * reads) and "quick_add_editor". Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";

export type QuickAddDesign = {
  scheme: string;
  button: { icon: "bag" | "plus" | "cart"; shape: "circle" | "square"; size: number; position: "br" | "bl" | "tr" | "tl"; show: "always" | "hover"; bg: string; fg: string; addedState: boolean };
  after: { mode: "toast" | "theme" | "cart"; autohide: number; checkout: boolean; added: string; viewCart: string; checkoutText: string; add: string };
  popup: { vcBg: string; vcText: string; vcBorder: string; coBg: string; coText: string; coBorder: string; border: number; radius: number };
  advanced: { selector: string };
};

export const DEFAULT_QUICK_ADD: QuickAddDesign = {
  scheme: "",
  button: { icon: "bag", shape: "circle", size: 40, position: "br", show: "always", bg: "#ffffff", fg: "#111111", addedState: true },
  after: { mode: "toast", autohide: 3, checkout: true, added: "Added to your cart!", viewCart: "View cart", checkoutText: "Checkout", add: "Add to cart" },
  popup: { vcBg: "#ffffff", vcText: "#121212", vcBorder: "#121212", coBg: "#121212", coText: "#ffffff", coBorder: "#121212", border: 1, radius: 4 },
  advanced: { selector: "" },
};

type Patch = { button?: Partial<QuickAddDesign["button"]>; popup?: Partial<QuickAddDesign["popup"]> };
export const QUICK_ADD_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "classic", title: "White circle", patch: { button: { shape: "circle", bg: "#ffffff", fg: "#111111", icon: "bag" }, popup: { coBg: "#121212", coText: "#ffffff", coBorder: "#121212", radius: 4 } } },
  { key: "black", title: "Black circle", patch: { button: { shape: "circle", bg: "#111111", fg: "#ffffff", icon: "plus" }, popup: { coBg: "#111111", coText: "#ffffff", coBorder: "#111111", radius: 99 } } },
  { key: "square", title: "Square", patch: { button: { shape: "square", bg: "#ffffff", fg: "#111111", icon: "cart" }, popup: { coBg: "#111111", coText: "#ffffff", coBorder: "#111111", radius: 0 } } },
  { key: "green", title: "Fresh green", patch: { button: { shape: "circle", bg: "#16a34a", fg: "#ffffff", icon: "plus" }, popup: { coBg: "#16a34a", coText: "#ffffff", coBorder: "#16a34a", vcBorder: "#16a34a", vcText: "#14532d", radius: 8 } } },
  { key: "blue", title: "Blue", patch: { button: { shape: "square", bg: "#2563eb", fg: "#ffffff", icon: "bag" }, popup: { coBg: "#2563eb", coText: "#ffffff", coBorder: "#2563eb", vcBorder: "#2563eb", vcText: "#1d4ed8", radius: 8 } } },
];

export function applyQuickAddPreset(c: QuickAddDesign, key: string): QuickAddDesign {
  const p = QUICK_ADD_PRESETS.find((x) => x.key === key);
  return p ? { ...c, scheme: "", button: { ...c.button, ...p.patch.button }, popup: { ...c.popup, ...p.patch.popup } } : c;
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withQuickAddDefaults(raw: unknown): QuickAddDesign {
  const r = obj(raw);
  const d = DEFAULT_QUICK_ADD;
  const b = obj(r.button), a = obj(r.after), p = obj(r.popup), x = obj(r.advanced);
  return {
    scheme: schemeId(r.scheme),
    button: {
      icon: pick(b.icon, ["bag", "plus", "cart"] as const, d.button.icon),
      shape: pick(b.shape, ["circle", "square"] as const, d.button.shape),
      size: num(b.size, 28, 60, d.button.size),
      position: pick(b.position, ["br", "bl", "tr", "tl"] as const, d.button.position),
      show: pick(b.show, ["always", "hover"] as const, d.button.show),
      bg: color(b.bg, d.button.bg),
      fg: color(b.fg, d.button.fg),
      addedState: bool(b.addedState, d.button.addedState),
    },
    after: {
      mode: pick(a.mode, ["toast", "theme", "cart"] as const, d.after.mode),
      autohide: num(a.autohide, 0, 10, d.after.autohide),
      checkout: bool(a.checkout, d.after.checkout),
      added: str(a.added, d.after.added, 80) || d.after.added,
      viewCart: str(a.viewCart, d.after.viewCart, 30) || d.after.viewCart,
      checkoutText: str(a.checkoutText, d.after.checkoutText, 30) || d.after.checkoutText,
      add: str(a.add, d.after.add, 30) || d.after.add,
    },
    popup: {
      vcBg: color(p.vcBg, d.popup.vcBg),
      vcText: color(p.vcText, d.popup.vcText),
      vcBorder: color(p.vcBorder, d.popup.vcBorder),
      coBg: color(p.coBg, d.popup.coBg),
      coText: color(p.coText, d.popup.coText),
      coBorder: color(p.coBorder, d.popup.coBorder),
      border: num(p.border, 0, 4, d.popup.border),
      radius: num(p.radius, 0, 99, d.popup.radius),
    },
    advanced: { selector: str(x.selector, "", 300).replace(/[<>{}]/g, "") },
  };
}

/** The storefront copy: the shape ucs-quick-add.js reads (it adds the money format and words). */
export function toStorefrontQuickAdd(c: QuickAddDesign) {
  const p = c.popup;
  return {
    icon: c.button.icon,
    shape: c.button.shape,
    size: c.button.size,
    position: c.button.position,
    show: c.button.show,
    bg: c.button.bg,
    fg: c.button.fg,
    addedState: c.button.addedState,
    after: c.after.mode,
    autohide: c.after.autohide,
    checkout: c.after.checkout,
    pop: [p.vcBg, p.vcText, p.vcBorder, p.coBg, p.coText, p.coBorder, p.border, p.radius],
    selector: c.advanced.selector,
    text: { added: c.after.added, view_cart: c.after.viewCart, checkout: c.after.checkoutText, add: c.after.add },
  };
}
