/**
 * Announcement bar, designed in the app (moved out of the theme editor). The messages themselves are
 * still the list in Boosters → Announcement bar; the free-shipping message uses the Free shipping
 * bar's goal and words, so the store has one goal. Stored in $app:cro_design "announcement"
 * (storefront) and "announcement_editor". Shared by client and server.
 */
import { color, num, pick } from "./designs";
import { schemeId } from "./theme-style";

export type AnnouncementDesign = {
  scheme: string;
  look: { bg: string; fg: string; size: number; padding: number; upper: boolean };
  behaviour: { animation: "fade" | "slide"; interval: number; arrows: boolean; dismissible: boolean; sticky: boolean };
  freeShipping: { on: boolean; bar: boolean };
  display: { pages: "all" | "home"; devices: "all" | "desktop" | "mobile" };
};

export const DEFAULT_ANNOUNCEMENT: AnnouncementDesign = {
  scheme: "",
  look: { bg: "#121212", fg: "#ffffff", size: 13, padding: 9, upper: false },
  behaviour: { animation: "fade", interval: 4, arrows: true, dismissible: false, sticky: false },
  freeShipping: { on: false, bar: true },
  display: { pages: "all", devices: "all" },
};

type Look = AnnouncementDesign["look"];
export const ANNOUNCEMENT_PRESETS: { key: string; title: string; look: Partial<Look> }[] = [
  { key: "black", title: "Black", look: { bg: "#121212", fg: "#ffffff", upper: false } },
  { key: "white", title: "White", look: { bg: "#ffffff", fg: "#121212", upper: false } },
  { key: "sale", title: "Sale red", look: { bg: "#b42318", fg: "#ffffff", upper: true } },
  { key: "green", title: "Fresh green", look: { bg: "#14532d", fg: "#ecfdf3", upper: false } },
  { key: "sand", title: "Sand", look: { bg: "#f4ede4", fg: "#5b4636", upper: true } },
  { key: "lime", title: "Lime", look: { bg: "#d7f25c", fg: "#111111", upper: true } },
];

export function applyAnnouncementPreset(c: AnnouncementDesign, key: string): AnnouncementDesign {
  const p = ANNOUNCEMENT_PRESETS.find((x) => x.key === key);
  return p ? { ...c, scheme: "", look: { ...c.look, ...p.look } } : c;
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withAnnouncementDefaults(raw: unknown): AnnouncementDesign {
  const r = obj(raw);
  const d = DEFAULT_ANNOUNCEMENT;
  const k = obj(r.look), b = obj(r.behaviour), f = obj(r.freeShipping), s = obj(r.display);
  return {
    scheme: schemeId(r.scheme),
    look: {
      bg: color(k.bg, d.look.bg),
      fg: color(k.fg, d.look.fg),
      size: num(k.size, 11, 18, d.look.size),
      padding: num(k.padding, 4, 18, d.look.padding),
      upper: bool(k.upper, d.look.upper),
    },
    behaviour: {
      animation: pick(b.animation, ["fade", "slide"] as const, d.behaviour.animation),
      interval: num(b.interval, 2, 12, d.behaviour.interval),
      arrows: bool(b.arrows, d.behaviour.arrows),
      dismissible: bool(b.dismissible, d.behaviour.dismissible),
      sticky: bool(b.sticky, d.behaviour.sticky),
    },
    freeShipping: { on: bool(f.on, d.freeShipping.on), bar: bool(f.bar, d.freeShipping.bar) },
    display: {
      pages: pick(s.pages, ["all", "home"] as const, d.display.pages),
      devices: pick(s.devices, ["all", "desktop", "mobile"] as const, d.display.devices),
    },
  };
}

export const announcementClass = (c: AnnouncementDesign) =>
  [
    `ucs-ab--${c.behaviour.animation}`,
    c.behaviour.sticky ? "ucs-ab--sticky" : "",
    c.look.upper ? "ucs-ab--upper" : "",
    c.display.devices === "mobile" ? "ucs-hide-desktop" : c.display.devices === "desktop" ? "ucs-hide-mobile" : "",
  ]
    .filter(Boolean)
    .join(" ");

export const announcementVars = (c: AnnouncementDesign): Record<string, string> => ({
  "--ucs-ab-bg": c.look.bg,
  "--ucs-ab-fg": c.look.fg,
  "--ucs-ab-fs": `${c.look.size}px`,
  "--ucs-ab-py": `${c.look.padding}px`,
});

/** The storefront copy: short keys, read by ucs-announcement.liquid. */
export function toStorefrontAnnouncement(c: AnnouncementDesign) {
  return {
    cls: ` ${announcementClass(c)}`,
    css: Object.entries(announcementVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
    iv: c.behaviour.interval,
    ar: c.behaviour.arrows,
    dm: c.behaviour.dismissible,
    fs: c.freeShipping.on,
    fb: c.freeShipping.bar,
    pg: c.display.pages,
  };
}
