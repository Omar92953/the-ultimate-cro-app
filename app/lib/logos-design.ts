/**
 * "Scrolling logos and text" section, designed in the app (moved out of the theme editor). The logos
 * themselves are still the list in Sections → Scrolling logos and text. Stored in $app:cro_design "logos"
 * (storefront: short keys read by ucs-logos.liquid) and "logos_editor". Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";

export type LogosDesign = {
  scheme: string;
  text: { heading: string; headingSize: number };
  layout: { mode: "marquee" | "grid"; lines: 1 | 2; opposite: boolean; speed: number; direction: "left" | "right"; pause: boolean; fade: boolean; fullWidth: boolean; colsDesktop: number; colsMobile: number };
  logos: { height: number; gap: number; grayscale: boolean; tint: "none" | "white" | "black"; opacity: number; textWeight: 400 | 600 | 800; textUpper: boolean };
  look: { ownBg: boolean; bg: string; ownText: boolean; fg: string };
  space: { top: number; bottom: number; devices: "all" | "desktop" | "mobile" };
};

export const DEFAULT_LOGOS: LogosDesign = {
  scheme: "",
  text: { heading: "Trusted by", headingSize: 22 },
  layout: { mode: "marquee", lines: 1, opposite: true, speed: 5, direction: "left", pause: true, fade: true, fullWidth: true, colsDesktop: 5, colsMobile: 3 },
  logos: { height: 40, gap: 56, grayscale: true, tint: "none", opacity: 80, textWeight: 600, textUpper: false },
  look: { ownBg: false, bg: "#f5f5f5", ownText: false, fg: "#121212" },
  space: { top: 32, bottom: 32, devices: "all" },
};

type Patch = { layout?: Partial<LogosDesign["layout"]>; logos?: Partial<LogosDesign["logos"]>; look?: Partial<LogosDesign["look"]> };
export const LOGOS_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "grey", title: "Grey strip", patch: { layout: { mode: "marquee", lines: 1, fade: true }, logos: { grayscale: true, tint: "none", opacity: 80 }, look: { ownBg: false, ownText: false } } },
  { key: "colour", title: "Full colour", patch: { layout: { mode: "marquee", lines: 1, fade: true }, logos: { grayscale: false, tint: "none", opacity: 100 }, look: { ownBg: false, ownText: false } } },
  { key: "band", title: "Light band", patch: { layout: { mode: "marquee", lines: 1, fade: true }, logos: { grayscale: true, tint: "none", opacity: 70 }, look: { ownBg: true, bg: "#f3f3f3", ownText: true, fg: "#3a3a3a" } } },
  { key: "dark", title: "Dark band", patch: { layout: { mode: "marquee", lines: 1, fade: true }, logos: { tint: "white", opacity: 90, textUpper: true }, look: { ownBg: true, bg: "#111111", ownText: true, fg: "#ffffff" } } },
  { key: "two", title: "Two lines", patch: { layout: { mode: "marquee", lines: 2, opposite: true, fade: true }, logos: { grayscale: true, opacity: 80 } } },
  { key: "grid", title: "Grid", patch: { layout: { mode: "grid" }, logos: { grayscale: true, opacity: 80 }, look: { ownBg: false, ownText: false } } },
];

export function applyLogosPreset(c: LogosDesign, key: string): LogosDesign {
  const p = LOGOS_PRESETS.find((x) => x.key === key);
  return p ? { ...c, scheme: "", layout: { ...c.layout, ...p.patch.layout }, logos: { ...c.logos, ...p.patch.logos }, look: { ...c.look, ...p.patch.look } } : c;
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withLogosDefaults(raw: unknown): LogosDesign {
  const r = obj(raw);
  const d = DEFAULT_LOGOS;
  const t = obj(r.text), l = obj(r.layout), g = obj(r.logos), k = obj(r.look), s = obj(r.space);
  const weight = Number(g.textWeight);
  return {
    scheme: schemeId(r.scheme),
    text: { heading: str(t.heading, d.text.heading, 120), headingSize: num(t.headingSize, 14, 48, d.text.headingSize) },
    layout: {
      mode: pick(l.mode, ["marquee", "grid"] as const, d.layout.mode),
      lines: Number(l.lines) === 2 ? 2 : 1,
      opposite: bool(l.opposite, d.layout.opposite),
      speed: num(l.speed, 1, 10, d.layout.speed),
      direction: pick(l.direction, ["left", "right"] as const, d.layout.direction),
      pause: bool(l.pause, d.layout.pause),
      fade: bool(l.fade, d.layout.fade),
      fullWidth: bool(l.fullWidth, d.layout.fullWidth),
      colsDesktop: num(l.colsDesktop, 2, 8, d.layout.colsDesktop),
      colsMobile: num(l.colsMobile, 2, 4, d.layout.colsMobile),
    },
    logos: {
      height: num(g.height, 16, 120, d.logos.height),
      gap: num(g.gap, 16, 120, d.logos.gap),
      grayscale: bool(g.grayscale, d.logos.grayscale),
      tint: pick(g.tint, ["none", "white", "black"] as const, d.logos.tint),
      opacity: num(g.opacity, 30, 100, d.logos.opacity),
      textWeight: weight === 400 || weight === 800 ? weight : 600,
      textUpper: bool(g.textUpper, d.logos.textUpper),
    },
    look: { ownBg: bool(k.ownBg, d.look.ownBg), bg: color(k.bg, d.look.bg), ownText: bool(k.ownText, d.look.ownText), fg: color(k.fg, d.look.fg) },
    space: { top: num(s.top, 0, 100, d.space.top), bottom: num(s.bottom, 0, 100, d.space.bottom), devices: pick(s.devices, ["all", "desktop", "mobile"] as const, d.space.devices) },
  };
}

/** Perceived brightness 0–255 of a #rgb/#rrggbb colour (same formula as Liquid's color_brightness). */
function brightness(hex: string) {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

export const logosClass = (c: LogosDesign) =>
  [
    `ucs-logos--${c.layout.mode}`,
    c.logos.tint !== "none" ? `ucs-logos--${c.logos.tint}` : c.logos.grayscale ? "ucs-logos--gray" : "",
    c.layout.fade ? "ucs-logos--fade" : "",
    c.layout.pause ? "ucs-logos--pause" : "",
    // Light background: blend logo pictures into it, so white boxes around them disappear.
    !c.look.ownBg || brightness(c.look.bg) >= 128 ? "ucs-logos--blend" : "",
    c.layout.direction === "right" ? "ucs-logos--right" : "",
    c.logos.textUpper ? "ucs-logos--upper" : "",
    c.space.devices === "mobile" ? "ucs-hide-desktop" : c.space.devices === "desktop" ? "ucs-hide-mobile" : "",
  ]
    .filter(Boolean)
    .join(" ");

export function logosVars(c: LogosDesign): Record<string, string> {
  const v: Record<string, string> = {
    "--ucs-pt": `${c.space.top}px`,
    "--ucs-pb": `${c.space.bottom}px`,
    "--ucs-h": `${c.text.headingSize}px`,
    "--ucs-logo-h": `${c.logos.height}px`,
    "--ucs-logo-gap": `${c.logos.gap}px`,
    "--ucs-logo-op": String(c.logos.opacity / 100),
    "--ucs-logo-fw": String(c.logos.textWeight),
    "--ucs-logo-cols": String(c.layout.colsDesktop),
    "--ucs-logo-cols-m": String(c.layout.colsMobile),
  };
  if (c.look.ownBg) Object.assign(v, { background: c.look.bg, "--ucs-logo-bg": c.look.bg });
  if (c.look.ownText) v.color = c.look.fg;
  return v;
}

/** How many times the list repeats so one half of the strip is wider than the screen, and how long a loop takes (same maths as ucs-logos.liquid). */
export function marqueeTiming(c: LogosDesign, count: number) {
  const reps = c.layout.mode === "marquee" && count > 0 ? Math.max(1, Math.ceil(16 / count)) : 1;
  const duration = Math.max(8, count * reps * (12 - c.layout.speed) * 0.35);
  return { reps, duration };
}

/** The storefront copy: short keys, read by ucs-logos.liquid (it adds the loop duration, which depends on the number of logos). */
export function toStorefrontLogos(c: LogosDesign) {
  return {
    cls: ` ${logosClass(c)}`,
    css: Object.entries(logosVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
    h: c.text.heading,
    m: c.layout.mode,
    ln: c.layout.lines,
    op: c.layout.opposite,
    sp: c.layout.speed,
    fw: c.layout.fullWidth,
    lh: c.logos.height,
  };
}
