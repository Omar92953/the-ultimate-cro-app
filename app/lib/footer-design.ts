/**
 * Footer, designed in the app (Header & pages → Footer). The theme editor only places the "Footer"
 * block in the Footer area. Stored in $app:cro_design "footer" (storefront copy read by ucs-footer.liquid,
 * which draws the menus from Online Store → Navigation) and "footer_editor". Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";
import type { MediaRef } from "./sections";
import { defaultSizes, sizeVars, withSizes, type SizeSpec, type Sizes } from "./sizes";

export type FooterColumnKind = "menu" | "text" | "newsletter" | "social" | "logo";
export type FooterColumn = { id: string; kind: FooterColumnKind; title: string; menu: string; text: string };

export const SOCIALS = ["instagram", "facebook", "tiktok", "x", "youtube", "whatsapp", "snapchat"] as const;
export type Social = (typeof SOCIALS)[number];

export const FOOTER_SIZES: SizeSpec[] = [
  { key: "heading", label: "Column titles", cssVar: "--ucs-ft-h", min: 10, max: 32, def: 15 },
  { key: "links", label: "Links", cssVar: "--ucs-ft-l", min: 10, max: 24, def: 14 },
  { key: "text", label: "Text", cssVar: "--ucs-ft-t", min: 10, max: 24, def: 14 },
  { key: "social", label: "Social icons", cssVar: "--ucs-ft-si", min: 14, max: 48, def: 20 },
  { key: "input", label: "Email box height", cssVar: "--ucs-ft-in", min: 32, max: 64, def: 44 },
  { key: "bottom", label: "Bottom line", cssVar: "--ucs-ft-b", min: 9, max: 18, def: 12 },
  { key: "payments", label: "Payment icons", cssVar: "--ucs-ft-pay", min: 16, max: 40, def: 24 },
];

export type FooterDesign = {
  scheme: string;
  columns: FooterColumn[];
  logo: { image: MediaRef | null; url: string | null; width: number };
  social: Record<Social, string>;
  newsletter: { placeholder: string; button: string; thanks: string };
  bottom: { copyright: string; payments: boolean; policies: boolean };
  layout: { align: "left" | "center"; divider: boolean; hideTheme: boolean; maxWidth: number; gap: number };
  look: { bg: string; fg: string; accent: string; onAccent: string; radius: number };
  space: { top: number; bottom: number; devices: "all" | "desktop" | "mobile" };
  sizes: Sizes;
};

const col = (id: string, kind: FooterColumnKind, title: string, extra: Partial<FooterColumn> = {}): FooterColumn => ({ id, kind, title, menu: "footer", text: "", ...extra });

export const DEFAULT_FOOTER: FooterDesign = {
  scheme: "",
  columns: [
    col("about", "text", "About us", { text: "Quality products, fast delivery and friendly help when you need it." }),
    col("shop", "menu", "Shop", { menu: "main-menu" }),
    col("help", "menu", "Help", { menu: "footer" }),
    col("news", "newsletter", "Stay in touch", { text: "New arrivals and offers, straight to your inbox." }),
  ],
  logo: { image: null, url: null, width: 140 },
  social: { instagram: "", facebook: "", tiktok: "", x: "", youtube: "", whatsapp: "", snapchat: "" },
  newsletter: { placeholder: "Your email", button: "Subscribe", thanks: "Thanks for subscribing!" },
  bottom: { copyright: "© {year} {shop}", payments: true, policies: true },
  layout: { align: "left", divider: true, hideTheme: true, maxWidth: 1200, gap: 32 },
  look: { bg: "#111111", fg: "#ffffff", accent: "#ffffff", onAccent: "#111111", radius: 8 },
  space: { top: 56, bottom: 28, devices: "all" },
  sizes: defaultSizes(FOOTER_SIZES),
};

type Patch = { columns?: FooterColumn[]; layout?: Partial<FooterDesign["layout"]>; look?: Partial<FooterDesign["look"]>; bottom?: Partial<FooterDesign["bottom"]> };
export const FOOTER_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "dark", title: "Dark columns", patch: { layout: { align: "left", divider: true }, look: { bg: "#111111", fg: "#ffffff", accent: "#ffffff", onAccent: "#111111" } } },
  { key: "light", title: "Light columns", patch: { layout: { align: "left", divider: true }, look: { bg: "#f5f5f5", fg: "#121212", accent: "#121212", onAccent: "#ffffff" } } },
  {
    key: "centered",
    title: "Centred and simple",
    patch: {
      columns: [col("logo", "logo", ""), col("menu", "menu", "", { menu: "footer" }), col("social", "social", "")],
      layout: { align: "center", divider: false },
      look: { bg: "#ffffff", fg: "#121212", accent: "#121212", onAccent: "#ffffff" },
    },
  },
  {
    key: "newsletter",
    title: "Newsletter first",
    patch: {
      columns: [col("news", "newsletter", "Join our list", { text: "Be first to hear about new drops and offers." }), col("shop", "menu", "Shop", { menu: "main-menu" }), col("help", "menu", "Help", { menu: "footer" }), col("social", "social", "Follow us")],
      layout: { align: "left", divider: true },
      look: { bg: "#1e1b4b", fg: "#ffffff", accent: "#facc15", onAccent: "#1e1b4b" },
    },
  },
  { key: "warm", title: "Warm", patch: { layout: { align: "left", divider: true }, look: { bg: "#f6efe6", fg: "#3b2a1a", accent: "#c2410c", onAccent: "#ffffff" } } },
];

export function applyFooterPreset(c: FooterDesign, key: string): FooterDesign {
  const p = FOOTER_PRESETS.find((x) => x.key === key);
  if (!p) return c;
  return { ...c, scheme: "", columns: p.patch.columns ?? c.columns, layout: { ...c.layout, ...p.patch.layout }, look: { ...c.look, ...p.patch.look }, bottom: { ...c.bottom, ...p.patch.bottom } };
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const handle = (v: unknown, fallback: string) => {
  const s = String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  return s || fallback;
};
const url = (v: unknown) => {
  const s = String(v ?? "").trim().slice(0, 300);
  return /^(https?:\/\/|mailto:|tel:)/i.test(s) ? s : s && !/^javascript:/i.test(s) ? `https://${s.replace(/^\/+/, "")}` : "";
};

function media(v: unknown): MediaRef | null {
  const m = obj(v);
  return typeof m.id === "string" && m.id ? (m as unknown as MediaRef) : null;
}

export function withFooterDefaults(raw: unknown): FooterDesign {
  const r = obj(raw);
  const d = DEFAULT_FOOTER;
  const lg = obj(r.logo), so = obj(r.social), nl = obj(r.newsletter), b = obj(r.bottom), l = obj(r.layout), k = obj(r.look), s = obj(r.space);
  const columns = Array.isArray(r.columns)
    ? (r.columns as unknown[]).slice(0, 6).map((x, i) => {
        const c = obj(x);
        return {
          id: str(c.id, `c${i}`, 20) || `c${i}`,
          kind: pick(c.kind, ["menu", "text", "newsletter", "social", "logo"] as const, "text"),
          title: str(c.title, "", 60),
          menu: handle(c.menu, "footer"),
          text: str(c.text, "", 400),
        };
      })
    : d.columns;
  return {
    scheme: schemeId(r.scheme),
    columns,
    logo: { image: media(lg.image), url: typeof lg.url === "string" ? lg.url : null, width: num(lg.width, 40, 320, d.logo.width) },
    social: Object.fromEntries(SOCIALS.map((key) => [key, url(so[key])])) as Record<Social, string>,
    newsletter: { placeholder: str(nl.placeholder, d.newsletter.placeholder, 40), button: str(nl.button, d.newsletter.button, 30), thanks: str(nl.thanks, d.newsletter.thanks, 120) },
    bottom: { copyright: str(b.copyright, d.bottom.copyright, 160), payments: bool(b.payments, d.bottom.payments), policies: bool(b.policies, d.bottom.policies) },
    layout: {
      align: pick(l.align, ["left", "center"] as const, d.layout.align),
      divider: bool(l.divider, d.layout.divider),
      hideTheme: bool(l.hideTheme, d.layout.hideTheme),
      maxWidth: num(l.maxWidth, 600, 1800, d.layout.maxWidth),
      gap: num(l.gap, 8, 80, d.layout.gap),
    },
    look: { bg: color(k.bg, d.look.bg), fg: color(k.fg, d.look.fg), accent: color(k.accent, d.look.accent), onAccent: color(k.onAccent, d.look.onAccent), radius: num(k.radius, 0, 40, d.look.radius) },
    space: { top: num(s.top, 0, 120, d.space.top), bottom: num(s.bottom, 0, 120, d.space.bottom), devices: pick(s.devices, ["all", "desktop", "mobile"] as const, d.space.devices) },
    sizes: withSizes(r.sizes, FOOTER_SIZES),
  };
}

export const footerClass = (c: FooterDesign) =>
  ["ucs", "ucs-ft", `ucs-ft--${c.layout.align}`, c.layout.divider ? "ucs-ft--divider" : "", c.space.devices === "mobile" ? "ucs-hide-desktop" : c.space.devices === "desktop" ? "ucs-hide-mobile" : ""].filter(Boolean).join(" ");

export function footerVars(c: FooterDesign): Record<string, string> {
  const v: Record<string, string> = {
    "--ucs-pt": `${c.space.top}px`,
    "--ucs-pb": `${c.space.bottom}px`,
    "--ucs-ft-bg": c.look.bg,
    "--ucs-ft-fg": c.look.fg,
    "--ucs-accent": c.look.accent,
    "--ucs-on-accent": c.look.onAccent,
    "--ucs-btn-radius": `${c.look.radius}px`,
    "--ucs-ft-max": `${c.layout.maxWidth}px`,
    "--ucs-ft-gap": `${c.layout.gap}px`,
    "--ucs-ft-cols": String(Math.max(1, c.columns.length)),
    "--ucs-ft-logo": `${c.logo.width}px`,
  };
  Object.assign(v, sizeVars(c.sizes, FOOTER_SIZES));
  return v;
}

/** "© {year} {shop}" → the text shown. */
export const copyrightText = (c: FooterDesign, shop: string, year = new Date().getFullYear()) => c.bottom.copyright.replace(/\{year\}/g, String(year)).replace(/\{shop\}/g, shop);

/** The storefront copy: short keys, read by ucs-footer.liquid. */
export function toStorefrontFooter(c: FooterDesign) {
  return {
    cls: footerClass(c),
    css: Object.entries(footerVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
    cols: c.columns.map((x) => ({ k: x.kind, t: x.title, m: x.menu, x: x.text })),
    logo: c.logo.url,
    so: SOCIALS.filter((s) => c.social[s]).map((s) => ({ k: s, u: c.social[s] })),
    nl: c.newsletter,
    cr: c.bottom.copyright,
    pay: c.bottom.payments,
    pol: c.bottom.policies,
    hide: c.layout.hideTheme,
  };
}
