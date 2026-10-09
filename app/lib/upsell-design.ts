/**
 * Upsell offers, designed in the app (moved out of the theme editor). The offers themselves (tiers,
 * discounts, which products) are still the Upsell rules; this is how the block shows them.
 * Stored in $app:cro_design "upsell" (storefront) and "upsell_editor". Shared by client and server.
 */
import { color, num, pick, str } from "./designs";

export type UpsellDesign = {
  offers: { style: "cards" | "list"; label: string; showSaving: boolean; saving: string; perItem: boolean; itemLabel: string; ownButton: boolean; button: string };
  heading: { style: "heading" | "label"; size: "small" | "medium" | "large"; align: "left" | "center" | "right" };
  look: { themeColors: boolean; accent: string; border: string; badgeBg: string; badgeText: string; saveBg: string; saveText: string; themeRadius: boolean; radius: number };
  space: { gap: number; top: number; bottom: number; devices: "all" | "desktop" | "mobile" };
};

export const DEFAULT_UPSELL: UpsellDesign = {
  offers: { style: "cards", label: "Buy [quantity]", showSaving: true, saving: "Save [percent]%", perItem: true, itemLabel: "#[n]", ownButton: false, button: "Add to cart" },
  heading: { style: "heading", size: "medium", align: "left" },
  look: { themeColors: true, accent: "#111111", border: "#d4d4d4", badgeBg: "#111111", badgeText: "#ffffff", saveBg: "#ffffff", saveText: "#111111", themeRadius: true, radius: 12 },
  space: { gap: 12, top: 12, bottom: 12, devices: "all" },
};

type Patch = { offers?: Partial<UpsellDesign["offers"]>; heading?: Partial<UpsellDesign["heading"]>; look?: Partial<UpsellDesign["look"]>; space?: Partial<UpsellDesign["space"]> };
/** Ready-made looks; everything stays editable. */
export const UPSELL_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "theme", title: "My theme", patch: { offers: { style: "cards" }, heading: { style: "heading" }, look: { themeColors: true, themeRadius: true } } },
  { key: "black", title: "Black and white", patch: { offers: { style: "cards" }, heading: { style: "heading" }, look: { themeColors: false, accent: "#111111", border: "#d9d9d9", badgeBg: "#111111", badgeText: "#ffffff", saveBg: "#ffffff", saveText: "#111111", themeRadius: false, radius: 10 } } },
  { key: "green", title: "Fresh green", patch: { offers: { style: "cards" }, heading: { style: "label" }, look: { themeColors: false, accent: "#16a34a", border: "#d6eadb", badgeBg: "#16a34a", badgeText: "#ffffff", saveBg: "#eaf7ee", saveText: "#166534", themeRadius: false, radius: 14 } } },
  { key: "list", title: "Grouped list", patch: { offers: { style: "list" }, heading: { style: "label" }, look: { themeColors: false, accent: "#2563eb", border: "#dbe3f0", badgeBg: "#2563eb", badgeText: "#ffffff", saveBg: "#ffffff", saveText: "#1d4ed8", themeRadius: false, radius: 12 } } },
  { key: "warm", title: "Warm", patch: { offers: { style: "cards" }, heading: { style: "heading" }, look: { themeColors: false, accent: "#c2410c", border: "#eadfce", badgeBg: "#c2410c", badgeText: "#ffffff", saveBg: "#fff4e6", saveText: "#9a3412", themeRadius: false, radius: 18 } } },
  { key: "square", title: "Sharp corners", patch: { offers: { style: "list" }, heading: { style: "heading" }, look: { themeColors: false, accent: "#111111", border: "#cfcfcf", badgeBg: "#d7f25c", badgeText: "#111111", saveBg: "#ffffff", saveText: "#111111", themeRadius: false, radius: 0 } } },
];

export function applyUpsellPreset(c: UpsellDesign, key: string): UpsellDesign {
  const p = UPSELL_PRESETS.find((x) => x.key === key);
  if (!p) return c;
  return { offers: { ...c.offers, ...p.patch.offers }, heading: { ...c.heading, ...p.patch.heading }, look: { ...c.look, ...p.patch.look }, space: { ...c.space, ...p.patch.space } };
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withUpsellDefaults(raw: unknown): UpsellDesign {
  const r = obj(raw);
  const d = DEFAULT_UPSELL;
  const o = obj(r.offers), h = obj(r.heading), k = obj(r.look), s = obj(r.space);
  return {
    offers: {
      style: pick(o.style, ["cards", "list"] as const, d.offers.style),
      label: str(o.label, d.offers.label, 60) || d.offers.label,
      showSaving: bool(o.showSaving, d.offers.showSaving),
      saving: str(o.saving, d.offers.saving, 60) || d.offers.saving,
      perItem: bool(o.perItem, d.offers.perItem),
      itemLabel: str(o.itemLabel, d.offers.itemLabel, 30) || d.offers.itemLabel,
      ownButton: bool(o.ownButton, d.offers.ownButton),
      button: str(o.button, d.offers.button, 40) || d.offers.button,
    },
    heading: {
      style: pick(h.style, ["heading", "label"] as const, d.heading.style),
      size: pick(h.size, ["small", "medium", "large"] as const, d.heading.size),
      align: pick(h.align, ["left", "center", "right"] as const, d.heading.align),
    },
    look: {
      themeColors: bool(k.themeColors, d.look.themeColors),
      accent: color(k.accent, d.look.accent),
      border: color(k.border, d.look.border),
      badgeBg: color(k.badgeBg, d.look.badgeBg),
      badgeText: color(k.badgeText, d.look.badgeText),
      saveBg: color(k.saveBg, d.look.saveBg),
      saveText: color(k.saveText, d.look.saveText),
      themeRadius: bool(k.themeRadius, d.look.themeRadius),
      radius: num(k.radius, 0, 40, d.look.radius),
    },
    space: {
      gap: num(s.gap, 0, 40, d.space.gap),
      top: num(s.top, 0, 80, d.space.top),
      bottom: num(s.bottom, 0, 80, d.space.bottom),
      devices: pick(s.devices, ["all", "desktop", "mobile"] as const, d.space.devices),
    },
  };
}

/** CSS variables for <ucro-upsell> (ucro.css reads them; empty colours fall back to the theme). */
export function upsellVars(c: UpsellDesign): Record<string, string> {
  const v: Record<string, string> = {
    "--ucro-align": c.heading.align,
    "--ucro-gap": `${c.space.gap}px`,
    "--ucro-pt": `${c.space.top}px`,
    "--ucro-pb": `${c.space.bottom}px`,
  };
  if (!c.look.themeColors) {
    Object.assign(v, {
      "--ucro-accent": c.look.accent,
      "--ucro-border": c.look.border,
      "--ucro-badge-bg": c.look.badgeBg,
      "--ucro-badge-fg": c.look.badgeText,
      "--ucro-save-bg": c.look.saveBg,
      "--ucro-save-fg": c.look.saveText,
    });
  }
  if (!c.look.themeRadius) v["--ucro-radius"] = `${c.look.radius}px`;
  return v;
}

export const upsellHeadingClass = (c: UpsellDesign) => `ucro__heading--${c.heading.size}${c.heading.style === "label" ? " ucro__heading--label" : ""}`;

/** The storefront copy: short keys, read by ucro-upsell.liquid (it keeps the Liquid small). */
export function toStorefrontUpsell(c: UpsellDesign) {
  return {
    list: c.offers.style === "list",
    label: c.offers.label,
    ss: c.offers.showSaving,
    save: c.offers.saving,
    pi: c.offers.perItem,
    il: c.offers.itemLabel,
    own: c.offers.ownButton,
    btn: c.offers.button,
    hc: upsellHeadingClass(c),
    cls: c.space.devices === "mobile" ? " ucro-hide-desktop" : c.space.devices === "desktop" ? " ucro-hide-mobile" : "",
    rad: c.look.themeRadius ? "theme" : "custom",
    css: Object.entries(upsellVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
  };
}
