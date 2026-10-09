/**
 * Customer reviews section, designed in the app (moved out of the theme editor). The reviews
 * themselves are still managed in Store sections → Reviews; this is how the section shows them.
 * Stored in $app:cro_design "reviews" (storefront) and "reviews_editor". Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import type { MediaRef } from "./sections";

export type ReviewsDesign = {
  text: { heading: string; sub: string; headingSize: number; basedOn: string; readMore: string; readLess: string; verified: string };
  summary: { show: boolean; average: boolean; stars: boolean; count: boolean };
  which: { filter: "all" | "featured" | "product"; fallback: boolean; limit: number };
  layout: { mode: "carousel" | "grid" | "masonry"; perDesktop: number; perMobile: 1 | 2; autoplay: number; nav: "arrows" | "dots" | "both" | "swipe"; arrowSize: number };
  card: {
    style: "classic" | "chat" | "minimal";
    text: boolean;
    media: boolean;
    stars: boolean;
    source: boolean;
    verified: boolean;
    location: boolean;
    date: boolean;
    product: boolean;
    clamp: number; // lines before "Read more" (0 = never cut)
    videoAutoplay: boolean;
  };
  fill: { kind: "color" | "pattern" | "image"; color: string; pattern: "chat" | "dots" | "grid" | "lines"; image: MediaRef | null; imageUrl: string | null };
  look: { star: string; cardBg: string; cardText: string; bg: string; radius: number; transparentBg: boolean; defaultCard: boolean };
  space: { top: number; bottom: number; devices: "all" | "desktop" | "mobile"; schema: boolean };
};

export const DEFAULT_REVIEWS: ReviewsDesign = {
  text: {
    heading: "What our customers say",
    sub: "Real feedback from real customers.",
    headingSize: 30,
    basedOn: "Based on {count} reviews",
    readMore: "Read more",
    readLess: "Show less",
    verified: "Verified buyer",
  },
  summary: { show: true, average: true, stars: true, count: true },
  which: { filter: "all", fallback: true, limit: 12 },
  layout: { mode: "carousel", perDesktop: 3, perMobile: 1, autoplay: 0, nav: "arrows", arrowSize: 40 },
  card: { style: "classic", text: true, media: true, stars: true, source: true, verified: true, location: true, date: true, product: true, clamp: 5, videoAutoplay: true },
  fill: { kind: "color", color: "#111111", pattern: "chat", image: null, imageUrl: null },
  look: { star: "#f5a623", cardBg: "#ffffff", cardText: "#121212", bg: "#ffffff", radius: 14, transparentBg: true, defaultCard: true },
  space: { top: 40, bottom: 40, devices: "all", schema: true },
};

type Patch = { card?: Partial<ReviewsDesign["card"]>; look?: Partial<ReviewsDesign["look"]>; layout?: Partial<ReviewsDesign["layout"]>; fill?: Partial<ReviewsDesign["fill"]> };
/** Ready-made looks; everything stays editable. */
export const REVIEW_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "classic", title: "Classic cards", patch: { card: { style: "classic" }, look: { star: "#f5a623", radius: 14, defaultCard: true, transparentBg: true }, fill: { kind: "color", color: "#111111" } } },
  { key: "chat", title: "Chat screenshots", patch: { card: { style: "chat" }, look: { star: "#f5a623", radius: 18, defaultCard: true, transparentBg: true }, fill: { kind: "pattern", pattern: "chat", color: "#e9e2d7" } } },
  { key: "minimal", title: "Minimal", patch: { card: { style: "minimal" }, look: { star: "#111111", radius: 6, defaultCard: true, transparentBg: true }, fill: { kind: "color", color: "#f4f4f4" } } },
  { key: "dark", title: "Dark", patch: { card: { style: "classic" }, look: { star: "#ffd166", cardBg: "#1c1c1e", cardText: "#ffffff", bg: "#111111", radius: 16, defaultCard: false, transparentBg: false }, fill: { kind: "color", color: "#2a2a2c" } } },
  { key: "warm", title: "Warm", patch: { card: { style: "classic" }, look: { star: "#c2410c", cardBg: "#fffaf3", cardText: "#3b2a1a", bg: "#f6efe6", radius: 20, defaultCard: false, transparentBg: false }, fill: { kind: "pattern", pattern: "dots", color: "#eadfce" } } },
];

export function applyReviewPreset(c: ReviewsDesign, key: string): ReviewsDesign {
  const p = REVIEW_PRESETS.find((x) => x.key === key);
  if (!p) return c;
  return { ...c, card: { ...c.card, ...p.patch.card }, look: { ...c.look, ...p.patch.look }, layout: { ...c.layout, ...p.patch.layout }, fill: { ...c.fill, ...p.patch.fill } };
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withReviewsDefaults(raw: unknown): ReviewsDesign {
  const r = obj(raw);
  const d = DEFAULT_REVIEWS;
  const t = obj(r.text), sm = obj(r.summary), w = obj(r.which), l = obj(r.layout), c = obj(r.card), f = obj(r.fill), k = obj(r.look), sp = obj(r.space);
  const img = obj(f.image);
  return {
    text: {
      heading: str(t.heading, d.text.heading, 120),
      sub: str(t.sub, d.text.sub, 240),
      headingSize: num(t.headingSize, 16, 60, d.text.headingSize),
      basedOn: str(t.basedOn, d.text.basedOn, 80) || d.text.basedOn,
      readMore: str(t.readMore, d.text.readMore, 30) || d.text.readMore,
      readLess: str(t.readLess, d.text.readLess, 30) || d.text.readLess,
      verified: str(t.verified, d.text.verified, 40) || d.text.verified,
    },
    summary: { show: bool(sm.show, d.summary.show), average: bool(sm.average, d.summary.average), stars: bool(sm.stars, d.summary.stars), count: bool(sm.count, d.summary.count) },
    which: { filter: pick(w.filter, ["all", "featured", "product"] as const, d.which.filter), fallback: bool(w.fallback, d.which.fallback), limit: num(w.limit, 1, 60, d.which.limit) },
    layout: {
      mode: pick(l.mode, ["carousel", "grid", "masonry"] as const, d.layout.mode),
      perDesktop: num(l.perDesktop, 1, 6, d.layout.perDesktop),
      perMobile: Number(l.perMobile) === 2 ? 2 : 1,
      autoplay: num(l.autoplay, 0, 15, d.layout.autoplay),
      nav: pick(l.nav, ["arrows", "dots", "both", "swipe"] as const, d.layout.nav),
      arrowSize: num(l.arrowSize, 24, 64, d.layout.arrowSize),
    },
    card: {
      style: pick(c.style, ["classic", "chat", "minimal"] as const, d.card.style),
      text: bool(c.text, d.card.text),
      media: bool(c.media, d.card.media),
      stars: bool(c.stars, d.card.stars),
      source: bool(c.source, d.card.source),
      verified: bool(c.verified, d.card.verified),
      location: bool(c.location, d.card.location),
      date: bool(c.date, d.card.date),
      product: bool(c.product, d.card.product),
      clamp: num(c.clamp, 0, 12, d.card.clamp),
      videoAutoplay: bool(c.videoAutoplay, d.card.videoAutoplay),
    },
    fill: {
      kind: pick(f.kind, ["color", "pattern", "image"] as const, d.fill.kind),
      color: color(f.color, d.fill.color),
      pattern: pick(f.pattern, ["chat", "dots", "grid", "lines"] as const, d.fill.pattern),
      image: typeof img.id === "string" ? { id: img.id, url: typeof img.url === "string" ? img.url : null, kind: "image", title: str(img.title, "Fill", 200) } : null,
      imageUrl: typeof f.imageUrl === "string" ? f.imageUrl : null,
    },
    look: {
      star: color(k.star, d.look.star),
      cardBg: color(k.cardBg, d.look.cardBg),
      cardText: color(k.cardText, d.look.cardText),
      bg: color(k.bg, d.look.bg),
      radius: num(k.radius, 0, 40, d.look.radius),
      transparentBg: bool(k.transparentBg, d.look.transparentBg),
      defaultCard: bool(k.defaultCard, d.look.defaultCard),
    },
    space: {
      top: num(sp.top, 0, 120, d.space.top),
      bottom: num(sp.bottom, 0, 120, d.space.bottom),
      devices: pick(sp.devices, ["all", "desktop", "mobile"] as const, d.space.devices),
      schema: bool(sp.schema, d.space.schema),
    },
  };
}

export function reviewsVars(c: ReviewsDesign): Record<string, string> {
  const v: Record<string, string> = {
    "--ucs-pt": `${c.space.top}px`,
    "--ucs-pb": `${c.space.bottom}px`,
    "--ucs-h": `${c.text.headingSize}px`,
    "--ucs-rv-cols": String(c.layout.perDesktop),
    "--ucs-rv-cols-m": String(c.layout.perMobile),
    "--ucs-rv-star": c.look.star,
    "--ucs-rv-radius": `${c.look.radius}px`,
    "--ucs-rv-clamp": String(c.card.clamp),
    "--ucs-rv-shot": c.fill.color,
    "--ucs-rv-arrow": `${c.layout.arrowSize}px`,
  };
  if (!c.look.defaultCard) {
    v["--ucs-rv-card"] = c.look.cardBg;
    v["--ucs-rv-fg"] = c.look.cardText;
  }
  if (!c.look.transparentBg) v.background = c.look.bg;
  if (c.fill.kind === "image" && c.fill.imageUrl) v["--ucs-rv-fill-img"] = `url(${c.fill.imageUrl}${c.fill.imageUrl.includes("?") ? "&" : "?"}width=1200)`;
  return v;
}

export function reviewsClass(c: ReviewsDesign) {
  return [
    "ucs",
    "ucs-rv",
    `ucs-rv--${c.layout.mode}`,
    `ucs-rv--fill-${c.fill.kind}`,
    `ucs-rv--pat-${c.fill.pattern}`,
    `ucs-rv--nav-${c.layout.nav}`,
    c.card.clamp === 0 ? "ucs-rv--full" : "",
    c.space.devices === "mobile" ? "ucs-hide-desktop" : c.space.devices === "desktop" ? "ucs-hide-mobile" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The storefront copy (everything the script needs, short keys keep the page light). */
export function toStorefrontReviews(c: ReviewsDesign) {
  return {
    t: c.text,
    sm: c.summary,
    w: c.which,
    l: c.layout,
    c: c.card,
    sch: c.space.schema,
    cls: reviewsClass(c),
    css: Object.entries(reviewsVars(c))
      .map(([k, v]) => `${k}: ${v}`)
      .join("; "),
  };
}
