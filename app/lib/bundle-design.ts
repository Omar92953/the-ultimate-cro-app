/**
 * Bundle builder, designed in the app (moved out of the theme editor). The bundles themselves
 * (bundle product, steps, products) are still set on the Bundles page; this is how the builder looks.
 * One design for every bundle. Stored in $app:cro_design "bundles" (storefront) and "bundles_editor".
 * Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";

export type BundleDesign = {
  text: { heading: string; sub: string; size: "small" | "medium" | "large"; align: "left" | "center" | "right" };
  products: { desktop: number; mobile: number; pick: string; picked: string };
  summary: { show: boolean; value: string; save: string; sticky: boolean };
  button: { theme: boolean; label: string; remaining: string };
  /** Building it anywhere: the "Add to bundle" buttons and the bundle tray that follows the shopper. */
  tray: { add: string; cart: string; checkout: string; position: "bottom" | "right" };
  look: { themeAccent: boolean; accent: string; themeRadius: boolean; radius: number; top: number; bottom: number; scheme: string };
};

export const DEFAULT_BUNDLE_DESIGN: BundleDesign = {
  text: { heading: "Build your bundle", sub: "", size: "medium", align: "left" },
  products: { desktop: 4, mobile: 2, pick: "Add", picked: "Added" },
  summary: { show: true, value: "Worth [amount]", save: "You save [amount] ([percent]%)", sticky: false },
  button: { theme: false, label: "Add bundle to cart", remaining: "Choose [remaining] more" },
  tray: { add: "Add to bundle", cart: "Add bundle to cart", checkout: "Checkout", position: "bottom" },
  look: { themeAccent: true, accent: "#111111", themeRadius: true, radius: 12, top: 16, bottom: 16, scheme: "" },
};

type Patch = { products?: Partial<BundleDesign["products"]>; summary?: Partial<BundleDesign["summary"]>; look?: Partial<BundleDesign["look"]> };
/** Ready-made looks; everything stays editable. */
export const BUNDLE_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "theme", title: "My theme", patch: { look: { themeAccent: true, themeRadius: true } } },
  { key: "black", title: "Black and white", patch: { look: { themeAccent: false, accent: "#111111", themeRadius: false, radius: 10 } } },
  { key: "green", title: "Fresh green", patch: { look: { themeAccent: false, accent: "#16a34a", themeRadius: false, radius: 14 } } },
  { key: "blue", title: "Blue", patch: { look: { themeAccent: false, accent: "#2563eb", themeRadius: false, radius: 12 } } },
  { key: "big", title: "Big cards", patch: { products: { desktop: 3, mobile: 2 }, look: { themeAccent: false, accent: "#111111", themeRadius: false, radius: 18 } } },
  { key: "sharp", title: "Sharp and compact", patch: { products: { desktop: 5, mobile: 3 }, look: { themeAccent: false, accent: "#111111", themeRadius: false, radius: 0 } } },
];

export function applyBundlePreset(c: BundleDesign, key: string): BundleDesign {
  const p = BUNDLE_PRESETS.find((x) => x.key === key);
  if (!p) return c;
  return { ...c, products: { ...c.products, ...p.patch.products }, summary: { ...c.summary, ...p.patch.summary }, look: { ...c.look, ...p.patch.look } };
}

/** "Match my theme style": the theme's colours (a scheme, or the theme's button colour) and corners. */
export function matchBundleTheme(c: BundleDesign, scheme: string): BundleDesign {
  return { ...c, look: { ...c.look, themeAccent: true, themeRadius: true, scheme } };
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withBundleDesignDefaults(raw: unknown): BundleDesign {
  const r = obj(raw);
  const d = DEFAULT_BUNDLE_DESIGN;
  const t = obj(r.text), p = obj(r.products), s = obj(r.summary), b = obj(r.button), k = obj(r.look), tr = obj(r.tray);
  return {
    text: {
      heading: str(t.heading, d.text.heading, 120),
      sub: str(t.sub, d.text.sub, 240),
      size: pick(t.size, ["small", "medium", "large"] as const, d.text.size),
      align: pick(t.align, ["left", "center", "right"] as const, d.text.align),
    },
    products: {
      desktop: num(p.desktop, 2, 6, d.products.desktop),
      mobile: num(p.mobile, 1, 3, d.products.mobile),
      pick: str(p.pick, d.products.pick, 30) || d.products.pick,
      picked: str(p.picked, d.products.picked, 30) || d.products.picked,
    },
    summary: {
      show: bool(s.show, d.summary.show),
      value: str(s.value, d.summary.value, 80) || d.summary.value,
      save: str(s.save, d.summary.save, 80) || d.summary.save,
      sticky: bool(s.sticky, d.summary.sticky),
    },
    button: {
      theme: bool(b.theme, d.button.theme),
      label: str(b.label, d.button.label, 40) || d.button.label,
      remaining: str(b.remaining, d.button.remaining, 60) || d.button.remaining,
    },
    tray: {
      add: str(tr.add, d.tray.add, 30) || d.tray.add,
      cart: str(tr.cart, d.tray.cart, 40) || d.tray.cart,
      checkout: str(tr.checkout, d.tray.checkout, 30) || d.tray.checkout,
      position: pick(tr.position, ["bottom", "right"] as const, d.tray.position),
    },
    look: {
      themeAccent: bool(k.themeAccent, d.look.themeAccent),
      accent: color(k.accent, d.look.accent),
      themeRadius: bool(k.themeRadius, d.look.themeRadius),
      radius: num(k.radius, 0, 40, d.look.radius),
      top: num(k.top, 0, 80, d.look.top),
      bottom: num(k.bottom, 0, 80, d.look.bottom),
      scheme: schemeId(k.scheme),
    },
  };
}

export function bundleVars(c: BundleDesign): Record<string, string> {
  const v: Record<string, string> = {
    "--ucro-align": c.text.align,
    "--ucro-pt": `${c.look.top}px`,
    "--ucro-pb": `${c.look.bottom}px`,
    "--ucro-cols-d": String(c.products.desktop),
    "--ucro-cols-m": String(c.products.mobile),
  };
  if (!c.look.themeAccent) v["--ucro-accent"] = c.look.accent;
  if (!c.look.themeRadius) v["--ucro-radius"] = `${c.look.radius}px`;
  return v;
}

/** The storefront copy: short keys, read by ucro-bundle-builder.liquid. */
export function toStorefrontBundle(c: BundleDesign) {
  return {
    h: c.text.heading,
    sub: c.text.sub,
    hc: `ucro__heading--${c.text.size}`,
    pk: c.products.pick,
    pd: c.products.picked,
    sm: c.summary.show,
    val: c.summary.value,
    sv: c.summary.save,
    st: c.summary.sticky,
    tb: c.button.theme,
    btn: c.button.label,
    rem: c.button.remaining,
    ta: c.tray.add,
    tc: c.tray.cart,
    tk: c.tray.checkout,
    tp: c.tray.position,
    cls: c.look.scheme ? ` ucro-scheme color-${c.look.scheme}` : "",
    css: Object.entries(bundleVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
  };
}
