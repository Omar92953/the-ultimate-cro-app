/**
 * Personalization on the product page (Offers & bundles → Personalization): fields the shopper fills
 * in (a name to engrave, initials, a colour…), saved on the order line as properties, with a live
 * preview of the text on the product picture and an optional paid fee (an add-on product added with
 * the item and removed with it, like Add-ons). Stored in $app:cro_design "personalize" (+ "_editor").
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";
import { defaultSizes, sizeVars, withSizes, type SizeSpec, type Sizes } from "./sizes";

export const PERSONALIZE_SIZES: SizeSpec[] = [
  { key: "heading", label: "Heading", cssVar: "--ucs-pz-h", min: 12, max: 28, def: 16 },
  { key: "label", label: "Field labels", cssVar: "--ucs-pz-l", min: 10, max: 20, def: 14 },
  { key: "input", label: "Field height", cssVar: "--ucs-pz-in", min: 32, max: 60, def: 42 },
];

export type PersonalizeField = { id: string; label: string; type: "text" | "textarea" | "select" | "color"; max: number; required: boolean; options: string; preview: boolean };
type Ref = { handle: string; title: string };

export type PersonalizeDesign = {
  scheme: string;
  heading: string;
  fields: PersonalizeField[];
  preview: { on: boolean; x: number; y: number; size: number; color: string; font: "sans" | "serif" | "script" | "mono"; upper: boolean; label: string };
  fee: { on: boolean; variantId: string; title: string; price: string; note: string };
  where: { mode: "all" | "products" | "collections"; products: Ref[]; collections: Ref[] };
  look: { style: "box" | "plain"; bg: string; radius: number };
  sizes: Sizes;
};

export const DEFAULT_PERSONALIZE: PersonalizeDesign = {
  scheme: "",
  heading: "Make it yours",
  fields: [{ id: "f1", label: "Name to engrave", type: "text", max: 14, required: false, options: "", preview: true }],
  preview: { on: true, x: 50, y: 62, size: 28, color: "#ffffff", font: "serif", upper: true, label: "Preview" },
  fee: { on: false, variantId: "", title: "", price: "", note: "Personalization adds a small fee." },
  where: { mode: "all", products: [], collections: [] },
  look: { style: "box", bg: "#f6f6f6", radius: 10 },
  sizes: defaultSizes(PERSONALIZE_SIZES),
};

type Patch = { look?: Partial<PersonalizeDesign["look"]>; preview?: Partial<PersonalizeDesign["preview"]> };
export const PERSONALIZE_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "engrave", title: "Engraving, white serif", patch: { look: { style: "box", bg: "#f6f6f6", radius: 10 }, preview: { font: "serif", color: "#ffffff", upper: true, size: 28 } } },
  { key: "gold", title: "Gold script", patch: { look: { style: "box", bg: "#fbf6ec", radius: 14 }, preview: { font: "script", color: "#c9a227", upper: false, size: 34 } } },
  { key: "print", title: "Print, black sans", patch: { look: { style: "plain", radius: 6 }, preview: { font: "sans", color: "#111111", upper: true, size: 24 } } },
  { key: "mono", title: "Mono stamp", patch: { look: { style: "box", bg: "#eef2f7", radius: 4 }, preview: { font: "mono", color: "#1e293b", upper: true, size: 22 } } },
];

export function applyPersonalizePreset(c: PersonalizeDesign, key: string): PersonalizeDesign {
  const p = PERSONALIZE_PRESETS.find((x) => x.key === key);
  return p ? { ...c, scheme: "", look: { ...c.look, ...p.patch.look }, preview: { ...c.preview, ...p.patch.preview } } : c;
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const refs = (v: unknown): Ref[] =>
  (Array.isArray(v) ? v : []).slice(0, 100).flatMap((x) => {
    const r = obj(x);
    return typeof r.handle === "string" && r.handle ? [{ handle: r.handle, title: String(r.title ?? r.handle).slice(0, 120) }] : [];
  });

export function withPersonalizeDefaults(raw: unknown): PersonalizeDesign {
  const r = obj(raw);
  const d = DEFAULT_PERSONALIZE;
  const p = obj(r.preview), f = obj(r.fee), w = obj(r.where), k = obj(r.look);
  return {
    scheme: schemeId(r.scheme),
    heading: str(r.heading, d.heading, 80),
    fields: Array.isArray(r.fields)
      ? (r.fields as unknown[]).slice(0, 6).map((x, i) => {
          const o = obj(x);
          return {
            id: str(o.id, `f${i}`, 20) || `f${i}`,
            label: str(o.label, "Your text", 60) || "Your text",
            type: pick(o.type, ["text", "textarea", "select", "color"] as const, "text"),
            max: num(o.max, 1, 500, 20),
            required: bool(o.required, false),
            options: str(o.options, "", 400),
            preview: bool(o.preview, i === 0),
          };
        })
      : d.fields,
    preview: {
      on: bool(p.on, d.preview.on),
      x: num(p.x, 0, 100, d.preview.x),
      y: num(p.y, 0, 100, d.preview.y),
      size: num(p.size, 10, 80, d.preview.size),
      color: color(p.color, d.preview.color),
      font: pick(p.font, ["sans", "serif", "script", "mono"] as const, d.preview.font),
      upper: bool(p.upper, d.preview.upper),
      label: str(p.label, d.preview.label, 30),
    },
    fee: { on: bool(f.on, d.fee.on), variantId: /^\d+$/.test(String(f.variantId ?? "")) ? String(f.variantId) : "", title: str(f.title, "", 120), price: str(f.price, "", 20), note: str(f.note, d.fee.note, 120) },
    where: { mode: pick(w.mode, ["all", "products", "collections"] as const, d.where.mode), products: refs(w.products), collections: refs(w.collections) },
    look: { style: pick(k.style, ["box", "plain"] as const, d.look.style), bg: color(k.bg, d.look.bg), radius: num(k.radius, 0, 30, d.look.radius) },
    sizes: withSizes(r.sizes, PERSONALIZE_SIZES),
  };
}

export const FONTS: Record<PersonalizeDesign["preview"]["font"], string> = {
  sans: "Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  script: "'Brush Script MT', 'Segoe Script', cursive",
  mono: "'Courier New', ui-monospace, monospace",
};

export function personalizeVars(c: PersonalizeDesign): Record<string, string> {
  const v: Record<string, string> = {
    "--ucs-pz-bg": c.look.bg,
    "--ucs-pz-r": `${c.look.radius}px`,
    "--ucs-pz-x": `${c.preview.x}%`,
    "--ucs-pz-y": `${c.preview.y}%`,
    "--ucs-pz-fs": `${c.preview.size}px`,
    "--ucs-pz-c": c.preview.color,
    "--ucs-pz-font": FONTS[c.preview.font],
    "--ucs-pz-tt": c.preview.upper ? "uppercase" : "none",
  };
  Object.assign(v, sizeVars(c.sizes, PERSONALIZE_SIZES));
  return v;
}

export const personalizeClass = (c: PersonalizeDesign) => `ucs ucs-pz ucs-pz--${c.look.style}`;

/** The storefront copy, read by ucs-personalize.liquid / ucs-personalize.js. */
export function toStorefrontPersonalize(c: PersonalizeDesign) {
  return {
    cls: personalizeClass(c),
    css: Object.entries(personalizeVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
    h: c.heading,
    f: c.fields.map((x) => ({ l: x.label, t: x.type, m: x.max, r: x.required, o: x.options.split(/\n|,/).map((s) => s.trim()).filter(Boolean), p: x.preview })),
    pv: c.preview.on ? { l: c.preview.label } : null,
    fee: c.fee.on && c.fee.variantId ? { v: c.fee.variantId, n: c.fee.note } : null,
    wm: c.where.mode,
    wp: c.where.products.map((p) => p.handle),
    wc: c.where.collections.map((p) => p.handle),
  };
}
