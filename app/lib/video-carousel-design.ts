/**
 * Video carousel, designed in the app (moved out of the theme editor). The videos, their order and
 * linked products are still set on the Video carousel page; this is how the section shows them.
 * Stored in $app:cro_design "videos" (storefront) and "videos_editor". Shared by client and server.
 */
import { num, pick, str } from "./designs";
import { schemeId } from "./theme-style";

export const VC_PAGES = ["home", "product", "collection", "cart", "page", "blog", "search"] as const;
export type VcPage = (typeof VC_PAGES)[number];
export const VC_PAGE_LABELS: Record<VcPage, string> = {
  home: "Home page",
  product: "All product pages",
  collection: "All collection pages",
  cart: "Cart page",
  page: "All pages (About, Contact…)",
  blog: "Blog and articles",
  search: "Search results",
};
// request.page_type values for each choice.
const PAGE_TYPES: Record<VcPage, string[]> = {
  home: ["index"],
  product: ["product"],
  collection: ["collection", "list-collections"],
  cart: ["cart"],
  page: ["page"],
  blog: ["blog", "article"],
  search: ["search"],
};

export type VideoCarouselDesign = {
  text: { heading: string; sub: string; size: "small" | "medium" | "large"; align: "left" | "center" | "right" };
  videos: { autoplay: boolean; product: boolean; add: boolean; addLabel: string };
  layout: { ratio: "9 / 16" | "3 / 4" | "4 / 5" | "1 / 1"; desktop: number; mobile: "1.2" | "2" | "2.2"; arrows: boolean; corners: "theme" | "square" | "round"; gap: number; scheme: string };
  display: { top: number; bottom: number; devices: "all" | "desktop" | "mobile"; showOn: "everywhere" | "only" | "except"; pages: VcPage[]; handles: string };
};

export const DEFAULT_VIDEO_CAROUSEL: VideoCarouselDesign = {
  text: { heading: "See it in action", sub: "", size: "large", align: "left" },
  videos: { autoplay: true, product: true, add: true, addLabel: "Add to cart" },
  layout: { ratio: "9 / 16", desktop: 4, mobile: "2.2", arrows: true, corners: "theme", gap: 12, scheme: "" },
  display: { top: 36, bottom: 36, devices: "all", showOn: "everywhere", pages: [], handles: "" },
};

type Patch = { text?: Partial<VideoCarouselDesign["text"]>; videos?: Partial<VideoCarouselDesign["videos"]>; layout?: Partial<VideoCarouselDesign["layout"]> };
/** Ready-made looks; everything stays editable. */
export const VIDEO_CAROUSEL_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "reels", title: "Reels", patch: { layout: { ratio: "9 / 16", desktop: 4, mobile: "2.2", corners: "theme", gap: 12, arrows: true } } },
  { key: "stories", title: "Rounded stories", patch: { layout: { ratio: "9 / 16", desktop: 5, mobile: "2.2", corners: "round", gap: 10, arrows: false } } },
  { key: "big", title: "Big videos", patch: { layout: { ratio: "9 / 16", desktop: 3, mobile: "1.2", corners: "theme", gap: 16, arrows: true } } },
  { key: "portrait", title: "Portrait cards", patch: { layout: { ratio: "4 / 5", desktop: 4, mobile: "2", corners: "square", gap: 8, arrows: true } } },
  { key: "square", title: "Square tiles", patch: { layout: { ratio: "1 / 1", desktop: 5, mobile: "2", corners: "theme", gap: 12, arrows: true } } },
  { key: "clean", title: "Videos only", patch: { videos: { product: false }, layout: { ratio: "9 / 16", desktop: 4, mobile: "2.2", corners: "round", gap: 12, arrows: false } } },
];

export function applyVideoCarouselPreset(c: VideoCarouselDesign, key: string): VideoCarouselDesign {
  const p = VIDEO_CAROUSEL_PRESETS.find((x) => x.key === key);
  if (!p) return c;
  return { ...c, text: { ...c.text, ...p.patch.text }, videos: { ...c.videos, ...p.patch.videos }, layout: { ...c.layout, ...p.patch.layout } };
}

/** "Match my theme style": the theme's corners and, when picked, one of its colour schemes. */
export function matchVideoCarouselTheme(c: VideoCarouselDesign, scheme: string): VideoCarouselDesign {
  return { ...c, layout: { ...c.layout, corners: "theme", scheme } };
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withVideoCarouselDefaults(raw: unknown): VideoCarouselDesign {
  const r = obj(raw);
  const d = DEFAULT_VIDEO_CAROUSEL;
  const t = obj(r.text), v = obj(r.videos), l = obj(r.layout), s = obj(r.display);
  return {
    text: {
      heading: str(t.heading, d.text.heading, 120),
      sub: str(t.sub, d.text.sub, 240),
      size: pick(t.size, ["small", "medium", "large"] as const, d.text.size),
      align: pick(t.align, ["left", "center", "right"] as const, d.text.align),
    },
    videos: {
      autoplay: bool(v.autoplay, d.videos.autoplay),
      product: bool(v.product, d.videos.product),
      add: bool(v.add, d.videos.add),
      addLabel: str(v.addLabel, d.videos.addLabel, 40) || d.videos.addLabel,
    },
    layout: {
      ratio: pick(l.ratio, ["9 / 16", "3 / 4", "4 / 5", "1 / 1"] as const, d.layout.ratio),
      desktop: num(l.desktop, 2, 6, d.layout.desktop),
      mobile: pick(l.mobile, ["1.2", "2", "2.2"] as const, d.layout.mobile),
      arrows: bool(l.arrows, d.layout.arrows),
      corners: pick(l.corners, ["theme", "square", "round"] as const, d.layout.corners),
      gap: num(l.gap, 0, 40, d.layout.gap),
      scheme: schemeId(l.scheme),
    },
    display: {
      top: num(s.top, 0, 120, d.display.top),
      bottom: num(s.bottom, 0, 120, d.display.bottom),
      devices: pick(s.devices, ["all", "desktop", "mobile"] as const, d.display.devices),
      showOn: pick(s.showOn, ["everywhere", "only", "except"] as const, d.display.showOn),
      pages: Array.isArray(s.pages) ? VC_PAGES.filter((p) => (s.pages as unknown[]).includes(p)) : [],
      handles: str(s.handles, "", 500),
    },
  };
}

const RADIUS = { theme: "var(--product-card-corner-radius, var(--media-radius, 12px))", square: "0px", round: "28px" };

export function videoCarouselVars(c: VideoCarouselDesign): Record<string, string> {
  return {
    "--ucro-align": c.text.align,
    "--ucro-pt": `${c.display.top}px`,
    "--ucro-pb": `${c.display.bottom}px`,
    "--ucro-vc-gap": `${c.layout.gap}px`,
    "--ucro-vc-desktop": String(c.layout.desktop),
    "--ucro-vc-mobile": c.layout.mobile,
    "--ucro-vc-ratio": c.layout.ratio,
    "--ucro-vc-radius": RADIUS[c.layout.corners],
  };
}

export const handleList = (s: string) =>
  s
    .toLowerCase()
    .split(",")
    .map((h) => h.trim().replace(/\s+/g, ""))
    .filter(Boolean);

/** The storefront copy: short keys, read by ucro-video-carousel.liquid. */
export function toStorefrontVideoCarousel(c: VideoCarouselDesign) {
  return {
    h: c.text.heading,
    sub: c.text.sub,
    hc: `ucro__heading--${c.text.size}`,
    ap: c.videos.autoplay,
    sp: c.videos.product,
    sa: c.videos.add,
    al: c.videos.addLabel,
    ar: c.layout.arrows,
    cls: (c.display.devices === "mobile" ? " ucro-hide-desktop" : c.display.devices === "desktop" ? " ucro-hide-mobile" : "") + (c.layout.scheme ? ` ucro-scheme color-${c.layout.scheme}` : ""),
    so: c.display.showOn,
    pt: c.display.pages.flatMap((p) => PAGE_TYPES[p]),
    hs: handleList(c.display.handles),
    css: Object.entries(videoCarouselVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
  };
}
