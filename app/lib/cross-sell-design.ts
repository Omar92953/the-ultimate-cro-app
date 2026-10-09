/**
 * Cross-sell offers, designed in the app (moved out of the theme editor). The offers themselves
 * (which products, headline, discount) are still the Cross-sell rules; this is how the block shows
 * them. Products are never ticked in advance (App Store rule: shoppers choose extras themselves).
 * Stored in $app:cro_design "cross_sell" (storefront) and "cross_sell_editor". Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";

export type CrossSellDesign = {
  scheme: string;
  products: { fallback: "none" | "recommendations"; recHeading: string; recLimit: number; button: string };
  heading: { size: "small" | "medium" | "large"; align: "left" | "center" | "right" };
  look: { themeColors: boolean; accent: string; border: string; panel: boolean; panelColor: string; themeRadius: boolean; radius: number; edge: boolean };
  space: { top: number; bottom: number; devices: "all" | "desktop" | "mobile" };
  /** The "Cart drawer offers" embed (rules with "Cart drawer" ticked). */
  drawer: { heading: string; max: number; add: string; matchLook: boolean };
};

export const DEFAULT_CROSS_SELL: CrossSellDesign = {
  scheme: "",
  products: { fallback: "none", recHeading: "Pairs well with", recLimit: 4, button: "Add selected to cart" },
  heading: { size: "medium", align: "left" },
  look: { themeColors: true, accent: "#111111", border: "#dddddd", panel: true, panelColor: "#f5f5f5", themeRadius: true, radius: 12, edge: false },
  space: { top: 16, bottom: 16, devices: "all" },
  drawer: { heading: "You may also like", max: 2, add: "Add", matchLook: true },
};

type Patch = { look?: Partial<CrossSellDesign["look"]>; heading?: Partial<CrossSellDesign["heading"]> };
export const CROSS_SELL_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "theme", title: "My theme", patch: { look: { themeColors: true, themeRadius: true, panel: true } } },
  { key: "plain", title: "No panel", patch: { look: { themeColors: true, themeRadius: true, panel: false } } },
  { key: "black", title: "Black and white", patch: { look: { themeColors: false, accent: "#111111", border: "#d9d9d9", panel: true, panelColor: "#f4f4f4", themeRadius: false, radius: 10 } } },
  { key: "green", title: "Fresh green", patch: { look: { themeColors: false, accent: "#16a34a", border: "#cfe9d7", panel: true, panelColor: "#f1faf4", themeRadius: false, radius: 14 } } },
  { key: "blue", title: "Blue", patch: { look: { themeColors: false, accent: "#2563eb", border: "#dbe3f0", panel: true, panelColor: "#f3f6fd", themeRadius: false, radius: 12 } } },
  { key: "warm", title: "Warm", patch: { look: { themeColors: false, accent: "#c2410c", border: "#eadfce", panel: true, panelColor: "#fbf6ef", themeRadius: false, radius: 18 } } },
];

export function applyCrossSellPreset(c: CrossSellDesign, key: string): CrossSellDesign {
  const p = CROSS_SELL_PRESETS.find((x) => x.key === key);
  if (!p) return c;
  return { ...c, look: { ...c.look, ...p.patch.look }, heading: { ...c.heading, ...p.patch.heading } };
}

/** "Match my theme style": the theme's colours and corners; a picked scheme colours the panel. */
export function matchCrossSellTheme(c: CrossSellDesign, scheme: string): CrossSellDesign {
  return { ...c, scheme, look: { ...c.look, themeColors: true, themeRadius: true, panel: true } };
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withCrossSellDefaults(raw: unknown): CrossSellDesign {
  const r = obj(raw);
  const d = DEFAULT_CROSS_SELL;
  const p = obj(r.products), h = obj(r.heading), k = obj(r.look), s = obj(r.space), w = obj(r.drawer);
  return {
    scheme: schemeId(r.scheme),
    products: {
      fallback: pick(p.fallback, ["none", "recommendations"] as const, d.products.fallback),
      recHeading: str(p.recHeading, d.products.recHeading, 80),
      recLimit: num(p.recLimit, 2, 10, d.products.recLimit),
      button: str(p.button, d.products.button, 40) || d.products.button,
    },
    heading: {
      size: pick(h.size, ["small", "medium", "large"] as const, d.heading.size),
      align: pick(h.align, ["left", "center", "right"] as const, d.heading.align),
    },
    look: {
      themeColors: bool(k.themeColors, d.look.themeColors),
      accent: color(k.accent, d.look.accent),
      border: color(k.border, d.look.border),
      panel: bool(k.panel, d.look.panel),
      panelColor: color(k.panelColor, d.look.panelColor),
      themeRadius: bool(k.themeRadius, d.look.themeRadius),
      radius: num(k.radius, 0, 40, d.look.radius),
      edge: bool(k.edge, d.look.edge),
    },
    space: {
      top: num(s.top, 0, 80, d.space.top),
      bottom: num(s.bottom, 0, 80, d.space.bottom),
      devices: pick(s.devices, ["all", "desktop", "mobile"] as const, d.space.devices),
    },
    drawer: {
      heading: str(w.heading, d.drawer.heading, 80),
      max: num(w.max, 1, 4, d.drawer.max),
      add: str(w.add, d.drawer.add, 30) || d.drawer.add,
      matchLook: bool(w.matchLook, d.drawer.matchLook),
    },
  };
}

export function crossSellVars(c: CrossSellDesign): Record<string, string> {
  const v: Record<string, string> = { "--ucro-align": c.heading.align, "--ucro-pt": `${c.space.top}px`, "--ucro-pb": `${c.space.bottom}px` };
  if (!c.look.themeColors) Object.assign(v, { "--ucro-accent": c.look.accent, "--ucro-border": c.look.border, "--ucro-panel": c.look.panelColor });
  if (!c.look.themeRadius) v["--ucro-radius"] = `${c.look.radius}px`;
  return v;
}

/** The cart drawer box's colours and corners: the same as the block's, or the theme's. */
export function drawerVars(c: CrossSellDesign): Record<string, string> {
  if (!c.drawer.matchLook) return {};
  const v: Record<string, string> = {};
  if (!c.look.themeColors) Object.assign(v, { "--ucro-accent": c.look.accent, "--ucro-border": c.look.border, "--ucro-soft": c.look.panelColor });
  if (!c.look.themeRadius) v["--ucro-radius"] = `${c.look.radius}px`;
  return v;
}

export function crossSellClass(c: CrossSellDesign) {
  return [
    c.look.panel ? "ucro-cross--panel" : "",
    c.look.panel && c.look.edge ? "ucro-cross--bleed" : "",
    c.space.devices === "mobile" ? "ucro-hide-desktop" : c.space.devices === "desktop" ? "ucro-hide-mobile" : "",
    c.scheme ? `ucro-scheme color-${c.scheme}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The storefront copy: short keys, read by ucro-cross-sell.liquid. */
export function toStorefrontCrossSell(c: CrossSellDesign) {
  const cls = crossSellClass(c);
  return {
    fb: c.products.fallback,
    rh: c.products.recHeading,
    rl: c.products.recLimit,
    btn: c.products.button,
    hc: `ucro__heading--${c.heading.size}`,
    cls: cls ? ` ${cls}` : "",
    rad: c.look.themeRadius ? "theme" : "custom",
    css: Object.entries(crossSellVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
    dh: c.drawer.heading,
    dm: c.drawer.max,
    da: c.drawer.add,
    dcss: Object.entries(drawerVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
    dcls: c.drawer.matchLook && c.scheme ? ` ucro-scheme color-${c.scheme}` : "",
  };
}
