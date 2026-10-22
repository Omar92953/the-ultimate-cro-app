/**
 * Gift note, delivery date and discount code in the cart (Cart & Checkout → Gift note & delivery date): "This is a gift",
 * a gift message (the order note), a delivery date (+ time slot) the shopper picks and a discount code box (applied to the cart with cart/update.js). Saved on the cart
 * as attributes, so they arrive on the order. On the cart page (block) and, optionally, inside the
 * theme's cart drawer (through the Conversion boosters embed). Stored in $app:cro_design "cart_extras".
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";
import { defaultSizes, sizeVars, withSizes, type SizeSpec, type Sizes } from "./sizes";

export const CART_EXTRAS_SIZES: SizeSpec[] = [
  { key: "heading", label: "Heading", cssVar: "--ucs-ce-h", min: 12, max: 26, def: 15 },
  { key: "text", label: "Labels", cssVar: "--ucs-ce-t", min: 10, max: 20, def: 14 },
  { key: "input", label: "Field height", cssVar: "--ucs-ce-in", min: 30, max: 56, def: 40 },
];

export type CartExtrasDesign = {
  scheme: string;
  heading: string;
  gift: { on: boolean; label: string; attr: string };
  note: { on: boolean; label: string; placeholder: string; max: number; onlyGift: boolean };
  code: {
    on: boolean; label: string; placeholder: string; button: string; applied: string; invalid: string; remove: string;
    /** Next to an applied code: what it took off ({amount}), or "later" when the cart can't say (free shipping, applied at checkout). */
    saved: string; later: string;
    /** Clearer reasons: an empty box, a code already on the cart, two codes that don't combine ({code}, {other}), a failed check. */
    empty: string; already: string; combine: string; error: string;
  };
  date: { on: boolean; label: string; attr: string; minDays: number; maxDays: number; daysOff: number[]; required: boolean; requiredText: string; slots: string; slotLabel: string; slotAttr: string };
  where: { page: boolean; drawer: boolean };
  look: { style: "box" | "plain"; bg: string; accent: string; radius: number; codeLayout: "inline" | "stacked" };
  sizes: Sizes;
};

export const DEFAULT_CART_EXTRAS: CartExtrasDesign = {
  scheme: "",
  heading: "Gift and delivery",
  gift: { on: true, label: "This is a gift", attr: "Gift" },
  note: { on: true, label: "Gift message", placeholder: "Write a message and we'll add it to a card", max: 250, onlyGift: true },
  code: { on: false, label: "Discount code", placeholder: "Enter your code", button: "Apply", applied: "{code} applied", invalid: "This code can't be used on your cart", remove: "Remove", saved: "{amount} off", later: "Shown at checkout", empty: "Type a code first", already: "{code} is already applied", combine: "{code} can't be used together with {other}. Remove {other} to use it.", error: "The code couldn't be checked. Please try again." },
  date: { on: true, label: "Delivery date", attr: "Delivery date", minDays: 2, maxDays: 30, daysOff: [5], required: false, requiredText: "Please choose a delivery date", slots: "", slotLabel: "Time", slotAttr: "Delivery time" },
  where: { page: true, drawer: true },
  look: { style: "box", bg: "#f6f6f6", accent: "#121212", radius: 10, codeLayout: "inline" },
  sizes: defaultSizes(CART_EXTRAS_SIZES),
};

type Patch = { look?: Partial<CartExtrasDesign["look"]> };
export const CART_EXTRAS_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "box", title: "Soft box", patch: { look: { style: "box", bg: "#f6f6f6", accent: "#121212", radius: 10 } } },
  { key: "plain", title: "Plain", patch: { look: { style: "plain", accent: "#121212", radius: 6 } } },
  { key: "rose", title: "Gift pink", patch: { look: { style: "box", bg: "#fdf0f3", accent: "#be185d", radius: 14 } } },
  { key: "mint", title: "Mint", patch: { look: { style: "box", bg: "#effaf5", accent: "#047857", radius: 12 } } },
];

export function applyCartExtrasPreset(c: CartExtrasDesign, key: string): CartExtrasDesign {
  const p = CART_EXTRAS_PRESETS.find((x) => x.key === key);
  return p ? { ...c, scheme: "", look: { ...c.look, ...p.patch.look } } : c;
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withCartExtrasDefaults(raw: unknown): CartExtrasDesign {
  const r = obj(raw);
  const d = DEFAULT_CART_EXTRAS;
  const g = obj(r.gift), n = obj(r.note), cd = obj(r.code), dt = obj(r.date), w = obj(r.where), k = obj(r.look);
  const minDays = num(dt.minDays, 0, 60, d.date.minDays);
  return {
    scheme: schemeId(r.scheme),
    heading: str(r.heading, d.heading, 80),
    gift: { on: bool(g.on, d.gift.on), label: str(g.label, d.gift.label, 60), attr: str(g.attr, d.gift.attr, 40) || d.gift.attr },
    note: { on: bool(n.on, d.note.on), label: str(n.label, d.note.label, 60), placeholder: str(n.placeholder, d.note.placeholder, 120), max: num(n.max, 20, 1000, d.note.max), onlyGift: bool(n.onlyGift, d.note.onlyGift) },
    code: {
      on: bool(cd.on, d.code.on),
      label: str(cd.label, d.code.label, 60),
      placeholder: str(cd.placeholder, d.code.placeholder, 60),
      button: str(cd.button, d.code.button, 30),
      applied: str(cd.applied, d.code.applied, 60),
      invalid: str(cd.invalid, d.code.invalid, 120),
      remove: str(cd.remove, d.code.remove, 30),
      saved: str(cd.saved, d.code.saved, 60),
      later: str(cd.later, d.code.later, 60),
      empty: str(cd.empty, d.code.empty, 120),
      already: str(cd.already, d.code.already, 120),
      combine: str(cd.combine, d.code.combine, 160),
      error: str(cd.error, d.code.error, 120),
    },
    date: {
      on: bool(dt.on, d.date.on),
      label: str(dt.label, d.date.label, 60),
      attr: str(dt.attr, d.date.attr, 40) || d.date.attr,
      minDays,
      maxDays: Math.max(minDays + 1, num(dt.maxDays, 1, 365, d.date.maxDays)),
      daysOff: Array.isArray(dt.daysOff) ? [...new Set((dt.daysOff as unknown[]).map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].slice(0, 6) : d.date.daysOff,
      required: bool(dt.required, d.date.required),
      requiredText: str(dt.requiredText, d.date.requiredText, 120),
      slots: str(dt.slots, d.date.slots, 400),
      slotLabel: str(dt.slotLabel, d.date.slotLabel, 40),
      slotAttr: str(dt.slotAttr, d.date.slotAttr, 40) || d.date.slotAttr,
    },
    where: { page: bool(w.page, d.where.page), drawer: bool(w.drawer, d.where.drawer) },
    look: { style: pick(k.style, ["box", "plain"] as const, d.look.style), bg: color(k.bg, d.look.bg), accent: color(k.accent, d.look.accent), radius: num(k.radius, 0, 30, d.look.radius), codeLayout: pick(k.codeLayout, ["inline", "stacked"] as const, d.look.codeLayout) },
    sizes: withSizes(r.sizes, CART_EXTRAS_SIZES),
  };
}

export function cartExtrasVars(c: CartExtrasDesign): Record<string, string> {
  const v: Record<string, string> = { "--ucs-ce-bg": c.look.bg, "--ucs-ce-accent": c.look.accent, "--ucs-ce-r": `${c.look.radius}px` };
  Object.assign(v, sizeVars(c.sizes, CART_EXTRAS_SIZES));
  return v;
}

export const cartExtrasClass = (c: CartExtrasDesign) => `ucs ucs-ce ucs-ce--${c.look.style}${c.look.codeLayout === "stacked" ? " ucs-ce--stack" : ""}`;

/** The storefront copy, read by ucs-cart-extras.js (cart page block and cart drawer). */
export function toStorefrontCartExtras(c: CartExtrasDesign) {
  return {
    cls: cartExtrasClass(c),
    css: Object.entries(cartExtrasVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
    h: c.heading,
    g: c.gift.on ? c.gift : null,
    n: c.note.on ? c.note : null,
    c: c.code.on ? c.code : null,
    d: c.date.on ? { ...c.date, slots: c.date.slots.split(/\n|,/).map((s) => s.trim()).filter(Boolean) } : null,
    page: c.where.page,
    drawer: c.where.drawer,
  };
}
