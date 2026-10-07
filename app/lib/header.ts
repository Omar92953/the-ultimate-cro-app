/**
 * The header, designed in the app: an app embed that draws our header from the theme's menu and
 * hides the theme's own header bar (its cart drawer keeps working). Presets fill every setting;
 * everything stays editable. Stored in $app:cro_design "header". Shared by client and server.
 */
import { color, num, pick, safeLink, str } from "./designs";
import type { MediaRef } from "./sections";

export type HeaderConfig = {
  on: boolean;
  preset: PresetKey;
  logo: { image: MediaRef | null; url: string | null; width: number; mobileWidth: number; text: string };
  layout: {
    logo: "left" | "center";
    menu: "left" | "center" | "right" | "below";
    width: "full" | "contained";
    height: number;
    float: boolean; // detached bar with space around it
    margin: number;
    radius: number;
    sticky: "always" | "up" | "none";
    overlay: "none" | "home" | "all"; // sits over the first section
  };
  menu: { handle: string; dropdown: "dropdown" | "mega"; images: boolean; size: number; weight: number; upper: boolean; gap: number; pill: boolean };
  icons: { search: boolean; account: boolean; cart: boolean; cartStyle: "icon" | "count" | "text"; size: number; labels: boolean };
  button: { show: boolean; text: string; link: string };
  look: {
    bg: string;
    opacity: number; // 0–100
    blur: number;
    text: string;
    border: string;
    borderOpacity: number;
    shadow: boolean;
    accent: string; // active pill / button
    accentText: string;
    panelBg: string;
    panelOpacity: number;
    panelText: string;
  };
  mobile: { menu: "drawer" | "full" | "pills"; logo: "left" | "center"; height: number };
  hideTheme: string; // extra CSS selector for the theme's header (advanced)
};

export type PresetKey = "glass_pill" | "glass_bar" | "rounded_center" | "classic" | "minimal" | "bold";

export const DEFAULT_HEADER: HeaderConfig = {
  on: true,
  preset: "glass_pill",
  logo: { image: null, url: null, width: 120, mobileWidth: 96, text: "" },
  layout: { logo: "left", menu: "center", width: "contained", height: 64, float: true, margin: 14, radius: 999, sticky: "always", overlay: "home" },
  menu: { handle: "main-menu", dropdown: "mega", images: true, size: 14, weight: 500, upper: false, gap: 26, pill: true },
  icons: { search: true, account: true, cart: true, cartStyle: "count", size: 20, labels: false },
  button: { show: false, text: "Shop now", link: "/collections/all" },
  look: {
    bg: "#ffffff",
    opacity: 55,
    blur: 18,
    text: "#121212",
    border: "#ffffff",
    borderOpacity: 60,
    shadow: true,
    accent: "#121212",
    accentText: "#ffffff",
    panelBg: "#ffffff",
    panelOpacity: 70,
    panelText: "#121212",
  },
  mobile: { menu: "drawer", logo: "left", height: 56 },
  hideTheme: "",
};

type Patch = { [K in keyof HeaderConfig]?: Partial<HeaderConfig[K]> };
const lookOf = (l: Partial<HeaderConfig["look"]>) => ({ ...DEFAULT_HEADER.look, ...l });

/** Ready-made looks, like the references: each one sets layout, menu and colours together. */
export const PRESETS: { key: PresetKey; title: string; text: string; patch: Patch }[] = [
  {
    key: "glass_pill",
    title: "Glass pill",
    text: "A floating, frosted pill over your hero image. Menu in the middle, a button on the right.",
    patch: {
      layout: { logo: "left", menu: "center", width: "contained", height: 60, float: true, margin: 14, radius: 999, sticky: "always", overlay: "home" },
      menu: { dropdown: "mega", pill: true, upper: false, size: 14, weight: 500, gap: 22 },
      button: { show: true },
      look: lookOf({ bg: "#ffffff", opacity: 45, blur: 18, border: "#ffffff", borderOpacity: 60, shadow: true }),
    },
  },
  {
    key: "glass_bar",
    title: "Glass bar",
    text: "A full-width frosted bar that lets the page show through.",
    patch: {
      layout: { logo: "left", menu: "left", width: "full", height: 64, float: false, margin: 0, radius: 0, sticky: "always", overlay: "home" },
      menu: { dropdown: "mega", pill: true, upper: false, size: 14, weight: 500, gap: 20 },
      button: { show: false },
      look: lookOf({ bg: "#1a1a1a", opacity: 35, blur: 20, text: "#ffffff", border: "#ffffff", borderOpacity: 18, shadow: false, accent: "#ffffff", accentText: "#121212", panelBg: "#1a1a1a", panelOpacity: 65, panelText: "#ffffff" }),
    },
  },
  {
    key: "rounded_center",
    title: "Rounded, logo centred",
    text: "A soft rounded bar: links on the left, logo in the middle, search and cart on the right.",
    patch: {
      layout: { logo: "center", menu: "left", width: "contained", height: 64, float: true, margin: 14, radius: 20, sticky: "always", overlay: "home" },
      menu: { dropdown: "dropdown", pill: false, upper: true, size: 12, weight: 600, gap: 24 },
      icons: { labels: true },
      button: { show: false },
      look: lookOf({ bg: "#f6f2ec", opacity: 92, blur: 10, text: "#2b2b2b", border: "#ffffff", borderOpacity: 0, shadow: true }),
    },
  },
  {
    key: "classic",
    title: "Classic",
    text: "A solid bar like most themes: logo left, menu next to it, icons right.",
    patch: {
      layout: { logo: "left", menu: "left", width: "full", height: 72, float: false, margin: 0, radius: 0, sticky: "up", overlay: "none" },
      menu: { dropdown: "dropdown", pill: false, upper: false, size: 15, weight: 500, gap: 28 },
      icons: { labels: false },
      button: { show: false },
      look: lookOf({ bg: "#ffffff", opacity: 100, blur: 0, border: "#e6e6e6", borderOpacity: 100, shadow: false }),
    },
  },
  {
    key: "minimal",
    title: "Minimal centred",
    text: "Logo on top in the middle, the menu in a line underneath.",
    patch: {
      layout: { logo: "center", menu: "below", width: "full", height: 64, float: false, margin: 0, radius: 0, sticky: "up", overlay: "none" },
      menu: { dropdown: "mega", pill: false, upper: true, size: 12, weight: 500, gap: 30 },
      icons: { labels: false },
      button: { show: false },
      look: lookOf({ bg: "#ffffff", opacity: 100, blur: 0, border: "#ececec", borderOpacity: 100, shadow: false }),
    },
  },
  {
    key: "bold",
    title: "Bold dark",
    text: "A dark bar with a bright button — strong and simple.",
    patch: {
      layout: { logo: "left", menu: "center", width: "full", height: 68, float: false, margin: 0, radius: 0, sticky: "always", overlay: "none" },
      menu: { dropdown: "mega", pill: false, upper: false, size: 15, weight: 600, gap: 26 },
      button: { show: true },
      look: lookOf({ bg: "#111111", opacity: 100, blur: 0, text: "#ffffff", border: "#111111", borderOpacity: 0, shadow: false, accent: "#d7f25c", accentText: "#111111", panelBg: "#161616", panelOpacity: 98, panelText: "#ffffff" }),
    },
  },
];

export function applyPreset(c: HeaderConfig, key: PresetKey): HeaderConfig {
  const p = PRESETS.find((x) => x.key === key);
  if (!p) return c;
  const next = { ...c, preset: key } as HeaderConfig;
  for (const [k, v] of Object.entries(p.patch)) {
    (next as Record<string, unknown>)[k] = { ...(c[k as keyof HeaderConfig] as object), ...(v as object) };
  }
  return next;
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withHeaderDefaults(raw: unknown): HeaderConfig {
  const r = obj(raw);
  const d = DEFAULT_HEADER;
  const g = obj(r.logo), l = obj(r.layout), m = obj(r.menu), i = obj(r.icons), b = obj(r.button), k = obj(r.look), mo = obj(r.mobile);
  const img = obj(g.image);
  return {
    on: bool(r.on, d.on),
    preset: pick(r.preset, PRESETS.map((p) => p.key), d.preset),
    logo: {
      image: typeof img.id === "string" ? { id: img.id, url: typeof img.url === "string" ? img.url : null, kind: "image", title: str(img.title, "Logo", 200) } : null,
      url: typeof g.url === "string" ? g.url : null,
      width: num(g.width, 40, 320, d.logo.width),
      mobileWidth: num(g.mobileWidth, 30, 220, d.logo.mobileWidth),
      text: str(g.text, "", 60),
    },
    layout: {
      logo: pick(l.logo, ["left", "center"] as const, d.layout.logo),
      menu: pick(l.menu, ["left", "center", "right", "below"] as const, d.layout.menu),
      width: pick(l.width, ["full", "contained"] as const, d.layout.width),
      height: num(l.height, 44, 120, d.layout.height),
      float: bool(l.float, d.layout.float),
      margin: num(l.margin, 0, 40, d.layout.margin),
      radius: num(l.radius, 0, 999, d.layout.radius),
      sticky: pick(l.sticky, ["always", "up", "none"] as const, d.layout.sticky),
      overlay: pick(l.overlay, ["none", "home", "all"] as const, d.layout.overlay),
    },
    menu: {
      handle: str(m.handle, d.menu.handle, 60).toLowerCase().replace(/[^a-z0-9-]/g, "") || d.menu.handle,
      dropdown: pick(m.dropdown, ["dropdown", "mega"] as const, d.menu.dropdown),
      images: bool(m.images, d.menu.images),
      size: num(m.size, 11, 22, d.menu.size),
      weight: num(m.weight, 300, 800, d.menu.weight),
      upper: bool(m.upper, d.menu.upper),
      gap: num(m.gap, 8, 60, d.menu.gap),
      pill: bool(m.pill, d.menu.pill),
    },
    icons: {
      search: bool(i.search, d.icons.search),
      account: bool(i.account, d.icons.account),
      cart: bool(i.cart, d.icons.cart),
      cartStyle: pick(i.cartStyle, ["icon", "count", "text"] as const, d.icons.cartStyle),
      size: num(i.size, 14, 32, d.icons.size),
      labels: bool(i.labels, d.icons.labels),
    },
    button: { show: bool(b.show, d.button.show), text: str(b.text, d.button.text, 40), link: str(b.link, d.button.link, 300) },
    look: {
      bg: color(k.bg, d.look.bg),
      opacity: num(k.opacity, 0, 100, d.look.opacity),
      blur: num(k.blur, 0, 40, d.look.blur),
      text: color(k.text, d.look.text),
      border: color(k.border, d.look.border),
      borderOpacity: num(k.borderOpacity, 0, 100, d.look.borderOpacity),
      shadow: bool(k.shadow, d.look.shadow),
      accent: color(k.accent, d.look.accent),
      accentText: color(k.accentText, d.look.accentText),
      panelBg: color(k.panelBg, d.look.panelBg),
      panelOpacity: num(k.panelOpacity, 0, 100, d.look.panelOpacity),
      panelText: color(k.panelText, d.look.panelText),
    },
    mobile: {
      menu: pick(mo.menu, ["drawer", "full", "pills"] as const, d.mobile.menu),
      logo: pick(mo.logo, ["left", "center"] as const, d.mobile.logo),
      height: num(mo.height, 44, 90, d.mobile.height),
    },
    hideTheme: str(r.hideTheme, "", 300).replace(/[{}<>]/g, ""),
  };
}

/** A colour with opacity, as CSS (works for 3- and 6-digit hex). */
export function rgba(hex: string, pct: number) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(pct) / 100})`;
}

export function headerVars(c: HeaderConfig): Record<string, string> {
  const k = c.look;
  return {
    "--uh-h": `${c.layout.height}px`,
    "--uh-hm": `${c.mobile.height}px`,
    "--uh-m": c.layout.float ? `${c.layout.margin}px` : "0px",
    "--uh-r": c.layout.float || c.layout.width === "contained" ? `${c.layout.radius}px` : "0px",
    "--uh-bg": rgba(k.bg, k.opacity),
    "--uh-blur": `${k.blur}px`,
    "--uh-fg": k.text,
    "--uh-line": rgba(k.border, k.borderOpacity),
    "--uh-shadow": k.shadow ? "0 8px 30px rgba(0, 0, 0, 0.12)" : "none",
    "--uh-accent": k.accent,
    "--uh-on-accent": k.accentText,
    "--uh-panel": rgba(k.panelBg, k.panelOpacity),
    "--uh-panel-fg": k.panelText,
    "--uh-logo-w": `${c.logo.width}px`,
    "--uh-logo-wm": `${c.logo.mobileWidth}px`,
    "--uh-fs": `${c.menu.size}px`,
    "--uh-fw": String(c.menu.weight),
    "--uh-gap": `${c.menu.gap}px`,
    "--uh-icon": `${c.icons.size}px`,
  };
}

export function headerClass(c: HeaderConfig) {
  return [
    "uh",
    `uh--logo-${c.layout.logo}`,
    `uh--menu-${c.layout.menu}`,
    `uh--${c.layout.width}`,
    c.layout.float ? "uh--float" : "",
    c.menu.upper ? "uh--upper" : "",
    c.menu.pill ? "uh--pill" : "",
    c.icons.labels ? "uh--labels" : "",
    `uh--m-${c.mobile.menu}`,
    `uh--mlogo-${c.mobile.logo}`,
  ]
    .filter(Boolean)
    .join(" ");
}

/** The storefront copy: settings the script needs, plus the class list and CSS variables. */
export function toStorefrontHeader(c: HeaderConfig, logoUrl: string | null) {
  return {
    on: c.on,
    menu: c.menu.handle,
    cls: headerClass(c),
    css: Object.entries(headerVars(c))
      .map(([key, v]) => `${key}: ${v}`)
      .join("; "),
    logo: logoUrl ? { u: logoUrl, w: c.logo.width } : null,
    text: c.logo.text,
    mega: c.menu.dropdown === "mega",
    imgs: c.menu.images,
    icons: { s: c.icons.search, a: c.icons.account, c: c.icons.cart, cs: c.icons.cartStyle },
    btn: c.button.show && c.button.text ? { t: c.button.text, l: safeLink(c.button.link) || "/" } : null,
    sticky: c.layout.sticky,
    overlay: c.layout.overlay,
    hide: c.hideTheme,
  };
}
