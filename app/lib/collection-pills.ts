/**
 * Collection pills: a row of buttons, one per collection the merchant picks ("All", "Anime",
 * "Football"…), usually on collection pages; the collection being viewed is highlighted.
 * Designed in the app, stored in $app:cro_design "collection_pills" (storefront) and
 * "collection_pills_editor" (this form). Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";

export type PillItem = { id: string; handle: string; title: string; label: string; image: string | null };

export type CollectionPillsConfig = {
  /** The theme colour scheme its colours were matched to ("" = its own colours). */
  scheme: string;
  heading: string;
  items: PillItem[];
  layout: { mode: "scroll" | "wrap"; align: "left" | "center"; arrows: boolean; images: boolean; paddingTop: number; paddingBottom: number };
  look: {
    style: "outline" | "filled" | "soft";
    radius: number;
    size: number;
    weight: number;
    upper: boolean;
    padX: number;
    padY: number;
    gap: number;
    text: string;
    bg: string;
    border: string;
    activeText: string;
    activeBg: string;
  };
};

export const DEFAULT_PILLS: CollectionPillsConfig = {
  scheme: "",
  heading: "",
  items: [],
  layout: { mode: "scroll", align: "left", arrows: false, images: false, paddingTop: 16, paddingBottom: 16 },
  look: { style: "outline", radius: 999, size: 14, weight: 500, upper: true, padX: 26, padY: 12, gap: 8, text: "#1a1a1a", bg: "#ffffff", border: "#dddddd", activeText: "#ffffff", activeBg: "#1a1a1a" },
};

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withPillsDefaults(raw: unknown): CollectionPillsConfig {
  const r = obj(raw);
  const d = DEFAULT_PILLS;
  const l = obj(r.layout), k = obj(r.look);
  return {
    scheme: schemeId((r as { scheme?: unknown }).scheme),
    heading: str(r.heading, d.heading, 120),
    items: (Array.isArray(r.items) ? r.items : []).slice(0, 80).flatMap((x) => {
      const i = obj(x);
      if (typeof i.handle !== "string" || !i.handle) return [];
      return [{ id: str(i.id, "", 100), handle: i.handle, title: str(i.title, i.handle, 200), label: str(i.label, "", 60), image: typeof i.image === "string" ? i.image : null }];
    }),
    layout: {
      mode: pick(l.mode, ["scroll", "wrap"] as const, d.layout.mode),
      align: pick(l.align, ["left", "center"] as const, d.layout.align),
      arrows: bool(l.arrows, d.layout.arrows),
      images: bool(l.images, d.layout.images),
      paddingTop: num(l.paddingTop, 0, 80, d.layout.paddingTop),
      paddingBottom: num(l.paddingBottom, 0, 80, d.layout.paddingBottom),
    },
    look: {
      style: pick(k.style, ["outline", "filled", "soft"] as const, d.look.style),
      radius: num(k.radius, 0, 999, d.look.radius),
      size: num(k.size, 10, 24, d.look.size),
      weight: num(k.weight, 300, 800, d.look.weight),
      upper: bool(k.upper, d.look.upper),
      padX: num(k.padX, 6, 48, d.look.padX),
      padY: num(k.padY, 4, 24, d.look.padY),
      gap: num(k.gap, 0, 32, d.look.gap),
      text: color(k.text, d.look.text),
      bg: color(k.bg, d.look.bg),
      border: color(k.border, d.look.border),
      activeText: color(k.activeText, d.look.activeText),
      activeBg: color(k.activeBg, d.look.activeBg),
    },
  };
}

export function pillsVars(c: CollectionPillsConfig): Record<string, string> {
  const k = c.look;
  return {
    "--ucs-pt": `${c.layout.paddingTop}px`,
    "--ucs-pb": `${c.layout.paddingBottom}px`,
    "--cp-r": `${k.radius}px`,
    "--cp-fs": `${k.size}px`,
    "--cp-fw": String(k.weight),
    "--cp-px": `${k.padX}px`,
    "--cp-py": `${k.padY}px`,
    "--cp-gap": `${k.gap}px`,
    "--cp-fg": k.text,
    "--cp-bg": k.bg,
    "--cp-line": k.border,
    "--cp-on-fg": k.activeText,
    "--cp-on-bg": k.activeBg,
  };
}

export function pillsClass(c: CollectionPillsConfig) {
  return ["ucs", "ucs-cp", `ucs-cp--${c.layout.mode}`, `ucs-cp--${c.look.style}`, `ucs-cp--${c.layout.align}`, c.look.upper ? "ucs-cp--upper" : "", c.layout.arrows ? "ucs-cp--arrows" : ""].filter(Boolean).join(" ");
}

export function toStorefrontPills(c: CollectionPillsConfig) {
  return {
    h: c.heading,
    i: c.items.map((x) => ({ h: x.handle, t: x.label || x.title, im: c.layout.images ? x.image : null })),
    cls: pillsClass(c),
    css: Object.entries(pillsVars(c))
      .map(([key, v]) => `${key}: ${v}`)
      .join("; "),
  };
}
