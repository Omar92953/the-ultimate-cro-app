/**
 * Size guide (Section library → Size guide): size charts shoppers open from the product page, and a
 * size recommendation answered only from the height and weight ranges the merchant typed for each size.
 * Charts are assigned to all products, or to chosen products, collections or tags (the first chart that
 * matches wins). Stored in $app:cro_design "size_guide" (storefront copy) and "size_guide_editor".
 * ucs-size-guide.js shows it; recommendSize() below is mirrored there (a test keeps them equal).
 * Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import type { MediaRef } from "./sections";
import { schemeId } from "./theme-style";
import { defaultSizes, sizeVars, withSizes, type SizeSpec, type Sizes } from "./sizes";

export const SIZE_GUIDE_SIZES: SizeSpec[] = [
  { key: "text", label: "Text", cssVar: "--ucs-sg-t", min: 11, max: 20, def: 14 },
  { key: "heading", label: "Window heading", cssVar: "--ucs-sg-h", min: 14, max: 32, def: 20 },
];

/** A product option whose name contains one of these (lower case) counts as a size. Mirrored in theme/blocks/ucs-size-guide.liquid (a test keeps them equal). */
export const SIZE_OPTION_WORDS = ["size", "taille", "größe", "grosse", "talla", "taglia", "maat", "tamanho", "storlek", "rozmiar", "numero", "tamaño", "размер", "尺码", "サイズ"];
export const hasSizeOption = (options: string[]) => options.some((o) => SIZE_OPTION_WORDS.some((w) => o.toLowerCase().includes(w)));

export const MAX_CHARTS = 8;
export const MAX_ROWS = 20;
export const MAX_COLUMNS = 8;

export const OUTLINES = ["tshirt", "pants", "dress", "shoe", "none"] as const;
export type Outline = (typeof OUTLINES)[number];
export const OUTLINE_LABEL: Record<Outline, string> = { tshirt: "T-shirt", pants: "Pants", dress: "Dress", shoe: "Shoe", none: "No drawing" };
/** Simple garment outlines (viewBox 0 0 100 100), drawn with a thin line. */
export const OUTLINE_PATH: Record<Exclude<Outline, "none">, string> = {
  tshirt: "M35 12 L12 24 L20 42 L30 37 L30 88 L70 88 L70 37 L80 42 L88 24 L65 12 Q50 24 35 12 Z",
  pants: "M28 10 L72 10 L76 90 L55 90 L50 38 L45 90 L24 90 Z",
  dress: "M38 10 L62 10 L60 34 L78 90 L22 90 L40 34 Z",
  shoe: "M10 58 L10 72 L90 72 L90 62 Q70 58 62 46 L48 40 L38 50 Q24 56 10 58 Z",
};

export type SizeRow = {
  size: string;
  /** One text per column ("86", "86 to 91"). */
  values: string[];
  /** The height (cm) and weight (kg) this size is for, used only by the recommendation. Empty = not set. */
  height: [number | null, number | null];
  weight: [number | null, number | null];
};

export type Chart = {
  id: string;
  name: string;
  /** The unit the values are typed in. */
  unit: "cm" | "in";
  /** Let shoppers switch between cm and in (numbers in the table are converted). */
  unitSwitch: boolean;
  outline: Outline;
  /** Your own picture instead of the drawing. */
  image: MediaRef | null;
  columns: string[];
  rows: SizeRow[];
  note: string;
  /** Shown with the recommendation, typed by you: "Runs large, size down". */
  fitNote: string;
  rec: { on: boolean; fit: boolean };
  match: { all: boolean; products: { handle: string; title: string }[]; collections: { handle: string; title: string }[]; tags: string };
};

export type SizeGuideDesign = {
  scheme: string;
  on: boolean;
  text: {
    title: string; chartLink: string; recLink: string; chartTab: string; recTab: string;
    height: string; weight: string; fit: string; snug: string; regular: string; relaxed: string;
    find: string; result: string; noMatch: string; sizeColumn: string; close: string; cm: string; inch: string; fillIn: string;
  };
  look: { link: "underline" | "button"; accent: string; bg: string; radius: number };
  /** Where the links go: right under the size picker when the theme has one, or where the block was placed. */
  place: "picker" | "block";
  charts: Chart[];
  sizes: Sizes;
};

const row = (size: string, values: string[], h: [number | null, number | null] = [null, null], w: [number | null, number | null] = [null, null]): SizeRow => ({ size, values, height: h, weight: w });

export const SAMPLE_CHART: Chart = {
  id: "c1",
  name: "T-shirts",
  unit: "cm",
  unitSwitch: true,
  outline: "tshirt",
  image: null,
  columns: ["Chest", "Waist", "Length"],
  rows: [
    row("S", ["88 to 94", "74 to 80", "68"], [160, 170], [55, 65]),
    row("M", ["94 to 100", "80 to 86", "70"], [168, 178], [64, 76]),
    row("L", ["100 to 106", "86 to 92", "72"], [176, 186], [75, 88]),
    row("XL", ["106 to 112", "92 to 98", "74"], [184, 194], [87, 100]),
  ],
  note: "Measure your chest at the fullest part. Sizes are body measurements.",
  fitNote: "",
  rec: { on: true, fit: true },
  match: { all: true, products: [], collections: [], tags: "" },
};

export const DEFAULT_SIZE_GUIDE: SizeGuideDesign = {
  scheme: "",
  on: true,
  text: {
    title: "Size guide", chartLink: "Size chart", recLink: "Size recommendation", chartTab: "Size chart", recTab: "Find my size",
    height: "Height", weight: "Weight", fit: "How do you like it to fit?", snug: "Snug", regular: "Regular", relaxed: "Relaxed",
    find: "Find my size", result: "We recommend {size}", noMatch: "We could not find a size for these numbers. Please check the size chart.",
    sizeColumn: "Size", close: "Close", cm: "cm", inch: "in", fillIn: "Please fill in your height and weight.",
  },
  look: { link: "underline", accent: "#121212", bg: "#ffffff", radius: 12 },
  place: "picker",
  charts: [SAMPLE_CHART],
  sizes: defaultSizes(SIZE_GUIDE_SIZES),
};

type Patch = { look?: Partial<SizeGuideDesign["look"]> };
export const SIZE_GUIDE_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "links", title: "Underlined links", patch: { look: { link: "underline", accent: "#121212", bg: "#ffffff", radius: 12 } } },
  { key: "buttons", title: "Outline buttons", patch: { look: { link: "button", accent: "#121212", bg: "#ffffff", radius: 999 } } },
  { key: "blue", title: "Blue buttons", patch: { look: { link: "button", accent: "#1d4ed8", bg: "#ffffff", radius: 8 } } },
  { key: "soft", title: "Soft green", patch: { look: { link: "underline", accent: "#047857", bg: "#f4fbf7", radius: 16 } } },
];

export function applySizeGuidePreset(c: SizeGuideDesign, key: string): SizeGuideDesign {
  const p = SIZE_GUIDE_PRESETS.find((x) => x.key === key);
  return p ? { ...c, scheme: "", look: { ...c.look, ...p.patch.look } } : c;
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const list = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);
const range = (v: unknown): [number | null, number | null] => {
  const a = list(v, 2).map((x) => (x === null || x === "" || x === undefined ? null : Number(x)));
  const ok = (n: number | null) => (n !== null && Number.isFinite(n) && n >= 0 && n <= 400 ? Math.round(n * 10) / 10 : null);
  const lo = ok(a[0] ?? null), hi = ok(a[1] ?? null);
  return lo !== null && hi !== null && lo > hi ? [hi, lo] : [lo, hi];
};
const handles = (v: unknown) =>
  list(v, 60).flatMap((x) => {
    const o = obj(x);
    const handle = str(o.handle, "", 120).trim();
    return handle ? [{ handle, title: str(o.title, handle, 120) }] : [];
  });
const media = (v: unknown): MediaRef | null => {
  const m = obj(v);
  return typeof m.id === "string" && m.id.startsWith("gid://") ? { id: m.id, url: typeof m.url === "string" ? m.url : null, kind: "image", title: str(m.title, "", 200) } : null;
};

function cleanChart(raw: unknown, i: number): Chart {
  const r = obj(raw);
  const d = SAMPLE_CHART;
  const columns = list(r.columns, MAX_COLUMNS).map((c) => str(c, "", 30));
  const cols = columns.length ? columns : [];
  const m = obj(r.match), rec = obj(r.rec);
  const rows = list(r.rows, MAX_ROWS).map((x): SizeRow => {
    const o = obj(x);
    const values = list(o.values, MAX_COLUMNS).map((v) => str(v, "", 30));
    while (values.length < cols.length) values.push("");
    return { size: str(o.size, "", 20), values: values.slice(0, cols.length), height: range(o.height), weight: range(o.weight) };
  });
  return {
    id: str(r.id, `c${i + 1}`, 20).replace(/[^a-z0-9_-]/gi, "") || `c${i + 1}`,
    name: str(r.name, d.name, 60) || d.name,
    unit: pick(r.unit, ["cm", "in"] as const, d.unit),
    unitSwitch: bool(r.unitSwitch, d.unitSwitch),
    outline: pick(r.outline, OUTLINES, d.outline),
    image: media(r.image),
    columns: cols,
    rows,
    note: str(r.note, "", 300),
    fitNote: str(r.fitNote, "", 200),
    rec: { on: bool(rec.on, true), fit: bool(rec.fit, true) },
    match: { all: bool(m.all, true), products: handles(m.products), collections: handles(m.collections), tags: str(m.tags, "", 300) },
  };
}

export function withSizeGuideDefaults(raw: unknown): SizeGuideDesign {
  const r = obj(raw);
  const d = DEFAULT_SIZE_GUIDE;
  const t = obj(r.text), k = obj(r.look);
  const text = Object.fromEntries(Object.entries(d.text).map(([key, def]) => [key, str(t[key], def, key === "noMatch" || key === "fillIn" || key === "fit" ? 160 : 50) || def])) as SizeGuideDesign["text"];
  const charts = Array.isArray(r.charts) ? r.charts.slice(0, MAX_CHARTS).map(cleanChart) : d.charts;
  // Every chart needs its own id (they are matched by it in the editor).
  const seen = new Set<string>();
  charts.forEach((c, i) => {
    let id = c.id;
    while (seen.has(id)) id = `${c.id}${i}x`;
    seen.add(id);
    c.id = id;
  });
  return {
    scheme: schemeId(r.scheme),
    on: bool(r.on, d.on),
    text,
    look: { link: pick(k.link, ["underline", "button"] as const, d.look.link), accent: color(k.accent, d.look.accent), bg: color(k.bg, d.look.bg), radius: num(k.radius, 0, 999, d.look.radius) },
    place: pick(r.place, ["picker", "block"] as const, d.place),
    charts,
    sizes: withSizes(r.sizes, SIZE_GUIDE_SIZES),
  };
}

export function sizeGuideVars(c: SizeGuideDesign): Record<string, string> {
  const v: Record<string, string> = { "--ucs-sg-c": c.look.accent, "--ucs-sg-bg": c.look.bg, "--ucs-sg-r": `${c.look.radius}px` };
  Object.assign(v, sizeVars(c.sizes, SIZE_GUIDE_SIZES));
  return v;
}

export const sizeGuideClass = (c: SizeGuideDesign) => `ucs ucs-sg ucs-sg--${c.look.link}`;

/* ------------------------------------------------------------ recommendation -- */
export type Fit = "snug" | "regular" | "relaxed";
const FIT_SHIFT: Record<Fit, number> = { snug: -1, regular: 0, relaxed: 1 };
const inRange = (v: number, r: [number | null, number | null]) => (r[0] === null || v >= r[0]) && (r[1] === null || v <= r[1]);
const used = (r: [number | null, number | null]) => r[0] !== null || r[1] !== null;

/**
 * The size answered from the merchant's ranges only (height in cm, weight in kg):
 * the sizes whose height range fits, the sizes whose weight range fits; a size in both wins (the smaller
 * one if several); when none is in both, the larger of the two best fits. "Snug" goes one size down,
 * "Relaxed" one up (when the chart lets shoppers choose a fit). Null when no range fits.
 */
export function recommendSize(chart: Pick<Chart, "rows" | "rec">, heightCm: number | null, weightKg: number | null, fit: Fit = "regular"): { size: string; index: number } | null {
  const rows = chart.rows;
  const usesH = rows.some((x) => used(x.height)), usesW = rows.some((x) => used(x.weight));
  const idx = (pick: (x: SizeRow) => [number | null, number | null], v: number | null) => (v === null ? [] : rows.flatMap((x, i) => (used(pick(x)) && inRange(v, pick(x)) ? [i] : [])));
  const H = usesH ? idx((x) => x.height, heightCm) : [], W = usesW ? idx((x) => x.weight, weightKg) : [];
  let at = -1;
  const both = H.filter((i) => W.includes(i));
  if (both.length) at = both[0];
  else if (H.length && W.length) at = Math.max(H[0], W[0]);
  else if (H.length) at = H[0];
  else if (W.length) at = W[0];
  if (at < 0) return null;
  const shifted = Math.min(rows.length - 1, Math.max(0, at + (chart.rec.fit ? FIT_SHIFT[fit] : 0)));
  return { size: rows[shifted].size, index: shifted };
}

/** Converts every number in a table cell ("86 to 91") between cm and inches. */
export function convertCell(text: string, from: "cm" | "in", to: "cm" | "in"): string {
  if (from === to) return text;
  return text.replace(/\d+(?:\.\d+)?/g, (n) => {
    const v = Number(n);
    const out = from === "cm" ? Math.round((v / 2.54) * 2) / 2 : Math.round(v * 2.54);
    return String(out);
  });
}

/** The storefront copy, read by ucs-size-guide.js through ucs-size-guide.liquid (which picks the chart for the product). */
export function toStorefrontSizeGuide(c: SizeGuideDesign) {
  return {
    on: c.on,
    cls: sizeGuideClass(c),
    css: Object.entries(sizeGuideVars(c)).map(([k, v]) => `${k}: ${v};`).join(" "),
    place: c.place,
    t: c.text,
    charts: c.charts.map((ch) => ({
      id: ch.id,
      name: ch.name,
      unit: ch.unit,
      sw: ch.unitSwitch,
      o: ch.outline === "none" ? "" : OUTLINE_PATH[ch.outline],
      img: ch.image?.url ?? "",
      cols: ch.columns,
      rows: ch.rows,
      note: ch.note,
      fitNote: ch.fitNote,
      rec: ch.rec,
      // The theme (Liquid) matches the product against these, so the page only carries the chart that applies.
      m: {
        all: ch.match.all,
        products: ch.match.products.map((p) => p.handle),
        collections: ch.match.collections.map((p) => p.handle),
        tags: ch.match.tags.split(/[,\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean),
      },
    })),
  };
}
