/**
 * Hero banners, designed in the app (moved out of the theme editor). Each banner is one
 * $app:cro_hero entry: its images as file references (so the theme can serve sized images), the
 * storefront copy in "config" (short keys, read by ucs-hero.liquid), the theme-editor preview in
 * "draft" and this full form in "editor". Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import type { MediaRef } from "./sections";
import { schemeId } from "./theme-style";

export type HeroHeight = "adapt" | "small" | "medium" | "large" | "full";
export type HeroSpot = "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br";
export type HeroMobileSpot = "tl" | "tc" | "ml" | "mc" | "bl" | "bc";

export type HeroDesign = {
  scheme: string;
  name: string;
  images: { desktop: MediaRef | null; mobile: MediaRef | null; link: string };
  text: { heading: string; text: string; headingSize: number; b1: string; l1: string; b2: string; l2: string };
  layout: { heightDesktop: HeroHeight; heightMobile: HeroHeight; spotDesktop: HeroSpot; spotMobile: HeroMobileSpot; box: boolean; fullWidth: boolean; radius: number; textWidth: number };
  look: { fg: string; buttonBg: string; buttonFg: string; buttonRadius: number; themeButtons: boolean; overlay: string; overlayOpacity: number; boxBg: string; boxOpacity: number; zoom: boolean; animate: boolean };
  space: { top: number; bottom: number; devices: "all" | "desktop" | "mobile" };
};

export const DEFAULT_HERO: HeroDesign = {
  scheme: "",
  name: "Main banner",
  images: { desktop: null, mobile: null, link: "" },
  text: { heading: "New collection", text: "Made to be worn every day.", headingSize: 48, b1: "Shop now", l1: "", b2: "", l2: "" },
  layout: { heightDesktop: "adapt", heightMobile: "adapt", spotDesktop: "ml", spotMobile: "bc", box: false, fullWidth: true, radius: 16, textWidth: 640 },
  look: { fg: "#ffffff", buttonBg: "#ffffff", buttonFg: "#121212", buttonRadius: 999, themeButtons: true, overlay: "#000000", overlayOpacity: 25, boxBg: "#000000", boxOpacity: 45, zoom: false, animate: true },
  space: { top: 0, bottom: 0, devices: "all" },
};

export const HEIGHTS: Record<Exclude<HeroHeight, "adapt">, { desktop: string; mobile: string }> = {
  small: { desktop: "420px", mobile: "360px" },
  medium: { desktop: "560px", mobile: "480px" },
  large: { desktop: "720px", mobile: "600px" },
  full: { desktop: "100svh", mobile: "100svh" },
};

type Patch = { layout?: Partial<HeroDesign["layout"]>; look?: Partial<HeroDesign["look"]> };
export const HERO_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "classic", title: "Classic", patch: { layout: { spotDesktop: "ml", spotMobile: "bc", box: false }, look: { fg: "#ffffff", buttonBg: "#ffffff", buttonFg: "#121212", overlay: "#000000", overlayOpacity: 25 } } },
  { key: "centred", title: "Centred", patch: { layout: { spotDesktop: "mc", spotMobile: "mc", box: false }, look: { fg: "#ffffff", buttonBg: "#ffffff", buttonFg: "#121212", overlay: "#000000", overlayOpacity: 35 } } },
  { key: "box", title: "Text box", patch: { layout: { spotDesktop: "bl", spotMobile: "bc", box: true }, look: { fg: "#ffffff", buttonBg: "#ffffff", buttonFg: "#121212", overlay: "#000000", overlayOpacity: 0, boxBg: "#000000", boxOpacity: 45 } } },
  { key: "light", title: "Light", patch: { layout: { spotDesktop: "ml", spotMobile: "bc", box: true }, look: { fg: "#121212", buttonBg: "#121212", buttonFg: "#ffffff", overlay: "#ffffff", overlayOpacity: 0, boxBg: "#ffffff", boxOpacity: 85 } } },
  { key: "bold", title: "Bold sale", patch: { layout: { spotDesktop: "mc", spotMobile: "mc", box: false }, look: { fg: "#ffffff", buttonBg: "#e11d48", buttonFg: "#ffffff", overlay: "#7f1d1d", overlayOpacity: 45 } } },
];

export function applyHeroPreset(c: HeroDesign, key: string): HeroDesign {
  const p = HERO_PRESETS.find((x) => x.key === key);
  return p ? { ...c, scheme: "", layout: { ...c.layout, ...p.patch.layout }, look: { ...c.look, ...p.patch.look } } : c;
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const SPOTS = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"] as const;
const MOBILE_SPOTS = ["tl", "tc", "ml", "mc", "bl", "bc"] as const;
const HEIGHT_KEYS = ["adapt", "small", "medium", "large", "full"] as const;
/** Store paths (/collections/sale) or full links; nothing that runs script. */
export const cleanLink = (v: unknown) => str(v, "", 300).trim().replace(/^\s*javascript:/i, "");

function media(v: unknown): MediaRef | null {
  const m = obj(v);
  return typeof m.id === "string" && m.id.startsWith("gid://") ? { id: m.id, url: typeof m.url === "string" ? m.url : null, kind: "image", title: str(m.title, "", 200) } : null;
}

export function withHeroDefaults(raw: unknown): HeroDesign {
  const r = obj(raw);
  const d = DEFAULT_HERO;
  const i = obj(r.images), t = obj(r.text), l = obj(r.layout), k = obj(r.look), s = obj(r.space);
  return {
    scheme: schemeId(r.scheme),
    name: str(r.name, d.name, 80).trim() || d.name,
    images: { desktop: media(i.desktop), mobile: media(i.mobile), link: cleanLink(i.link) },
    text: {
      heading: str(t.heading, d.text.heading, 120),
      text: str(t.text, d.text.text, 600),
      headingSize: num(t.headingSize, 20, 88, d.text.headingSize),
      b1: str(t.b1, d.text.b1, 40),
      l1: cleanLink(t.l1),
      b2: str(t.b2, d.text.b2, 40),
      l2: cleanLink(t.l2),
    },
    layout: {
      heightDesktop: pick(l.heightDesktop, HEIGHT_KEYS, d.layout.heightDesktop),
      heightMobile: pick(l.heightMobile, HEIGHT_KEYS, d.layout.heightMobile),
      spotDesktop: pick(l.spotDesktop, SPOTS, d.layout.spotDesktop),
      spotMobile: pick(l.spotMobile, MOBILE_SPOTS, d.layout.spotMobile),
      box: bool(l.box, d.layout.box),
      fullWidth: bool(l.fullWidth, d.layout.fullWidth),
      radius: num(l.radius, 0, 40, d.layout.radius),
      textWidth: num(l.textWidth, 320, 1000, d.layout.textWidth),
    },
    look: {
      fg: color(k.fg, d.look.fg),
      buttonBg: color(k.buttonBg, d.look.buttonBg),
      buttonFg: color(k.buttonFg, d.look.buttonFg),
      buttonRadius: num(k.buttonRadius, 0, 999, d.look.buttonRadius),
      themeButtons: bool(k.themeButtons, d.look.themeButtons),
      overlay: color(k.overlay, d.look.overlay),
      overlayOpacity: num(k.overlayOpacity, 0, 90, d.look.overlayOpacity),
      boxBg: color(k.boxBg, d.look.boxBg),
      boxOpacity: num(k.boxOpacity, 0, 100, d.look.boxOpacity),
      zoom: bool(k.zoom, d.look.zoom),
      animate: bool(k.animate, d.look.animate),
    },
    space: { top: num(s.top, 0, 80, d.space.top), bottom: num(s.bottom, 0, 80, d.space.bottom), devices: pick(s.devices, ["all", "desktop", "mobile"] as const, d.space.devices) },
  };
}

/** #rrggbb + opacity 0–100 → rgba(). */
function rgba(hex: string, pct: number) {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0);
  return `rgba(${r}, ${g}, ${b}, ${pct / 100})`;
}

export const heroClass = (c: HeroDesign, spotDesktop: string = c.layout.spotDesktop, spotMobile: string = c.layout.spotMobile) =>
  [
    `ucs-hero--dv-${spotDesktop[0]}`,
    `ucs-hero--dh-${spotDesktop[1]}`,
    `ucs-hero--mv-${spotMobile[0]}`,
    `ucs-hero--mh-${spotMobile[1]}`,
    c.layout.fullWidth ? "ucs-hero--full" : "",
    c.look.zoom ? "ucs-hero--zoom" : "",
    c.look.animate ? "ucs-hero--animate" : "",
    c.layout.box ? "ucs-hero--box" : "",
    c.space.devices === "mobile" ? "ucs-hide-desktop" : c.space.devices === "desktop" ? "ucs-hide-mobile" : "",
  ]
    .filter(Boolean)
    .join(" ");

/** Everything but the image shape and focal points, which ucs-hero.liquid adds from the images. */
export function heroVars(c: HeroDesign): Record<string, string> {
  const v: Record<string, string> = {
    "--ucs-pt": `${c.space.top}px`,
    "--ucs-pb": `${c.space.bottom}px`,
    "--ucs-hero-hd": c.layout.heightDesktop === "adapt" ? "auto" : HEIGHTS[c.layout.heightDesktop].desktop,
    "--ucs-hero-hm": c.layout.heightMobile === "adapt" ? "auto" : HEIGHTS[c.layout.heightMobile].mobile,
    "--ucs-hero-ov": c.look.overlay,
    "--ucs-hero-op": String(c.look.overlayOpacity / 100),
    "--ucs-hero-fg": c.look.fg,
    "--ucs-hero-hs": `${c.text.headingSize}px`,
    "--ucs-hero-radius": `${c.layout.radius}px`,
    "--ucs-hero-tw": `${c.layout.textWidth}px`,
    "--ucs-hero-box": rgba(c.look.boxBg, c.look.boxOpacity),
    "--ucs-accent": c.look.buttonBg,
    "--ucs-on-accent": c.look.buttonFg,
  };
  if (!c.look.themeButtons) v["--ucs-btn-radius"] = `${c.look.buttonRadius}px`;
  return v;
}

/** The storefront copy: short keys, read by ucs-hero.liquid. */
export function toStorefrontHero(c: HeroDesign) {
  return {
    cls: ` ${heroClass(c)}`,
    css: Object.entries(heroVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
    h: c.text.heading,
    t: c.text.text,
    b1: c.text.b1,
    l1: c.text.l1,
    b2: c.text.b2,
    l2: c.text.l2,
    ln: c.images.link,
    ad: c.layout.heightDesktop === "adapt",
    am: c.layout.heightMobile === "adapt",
  };
}
