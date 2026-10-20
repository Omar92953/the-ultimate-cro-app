/**
 * Image carousel, designed in the app (the theme editor only places the block). Two sections share this
 * code: "Image carousel" ($app:cro_design "image_carousel", pictures side by side) and "Image carousel 2"
 * ("coverflow", one large picture in the centre and the others behind it), each with its own block, so a
 * store can use both. ucs-image-carousel.js builds the same markup as the preview. Shared by client and server.
 */
import { color, num, pick, safeLink, str } from "./designs";
import type { MediaRef } from "./sections";
import { schemeId } from "./theme-style";

export type ImageSlide = { image: MediaRef | null; alt: string; title: string; text: string; link: string; button: string };

export type ImageCarouselConfig = {
  /** The theme colour scheme its colours were matched to ("" = its own colours). */
  scheme: string;
  heading: { show: boolean; text: string; sub: string; align: "left" | "center"; size: number };
  slides: ImageSlide[];
  layout: {
    /** "row": pictures side by side; "coverflow": the centre picture large in front, the others smaller behind it. */
    effect: "row" | "coverflow";
    perDesktop: number;
    perMobile: number;
    ratio: "1/1" | "4/5" | "3/4" | "2/3" | "16/9" | "auto";
    gap: number;
    radius: number;
    captions: "below" | "overlay" | "none";
    fullWidth: boolean;
    paddingTop: number;
    paddingBottom: number;
  };
  nav: { mode: "arrows" | "dots" | "both" | "swipe"; arrowSize: number; autoplay: number };
  look: { text: string; overlay: string; titleSize: number; textSize: number; buttonBg: string; buttonText: string };
};

export const RATIOS: { value: ImageCarouselConfig["layout"]["ratio"]; label: string }[] = [
  { value: "1/1", label: "Square (1:1)" },
  { value: "4/5", label: "Portrait (4:5)" },
  { value: "3/4", label: "Portrait (3:4)" },
  { value: "2/3", label: "Tall (2:3)" },
  { value: "16/9", label: "Wide (16:9)" },
  { value: "auto", label: "Each image's own shape" },
];

/** The two carousel sections: their stored design key (and feature key), page and theme block. */
export type CarouselKind = "image_carousel" | "coverflow";
export const CAROUSELS: Record<CarouselKind, { title: string; page: string; block: string }> = {
  image_carousel: { title: "Image carousel", page: "/app/designs/image-carousel", block: "Image carousel" },
  coverflow: { title: "Image carousel 2", page: "/app/designs/image-carousel-2", block: "Image carousel 2" },
};

export const DEFAULT_IMAGE_CAROUSEL: ImageCarouselConfig = {
  scheme: "",
  heading: { show: true, text: "Shop the look", sub: "", align: "center", size: 28 },
  slides: [],
  layout: { effect: "row", perDesktop: 4, perMobile: 1, ratio: "4/5", gap: 16, radius: 12, captions: "below", fullWidth: false, paddingTop: 36, paddingBottom: 36 },
  nav: { mode: "both", arrowSize: 40, autoplay: 0 },
  look: { text: "#121212", overlay: "#000000", titleSize: 16, textSize: 14, buttonBg: "#121212", buttonText: "#ffffff" },
};

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

function media(v: unknown): MediaRef | null {
  const m = obj(v);
  if (typeof m.id !== "string" || !m.id) return null;
  return { id: m.id, url: typeof m.url === "string" ? m.url : null, kind: "image", title: str(m.title, "Image", 200) };
}

/** Image carousel 2 starts as a coverflow: one large picture in front with its text on it. */
export const DEFAULT_COVERFLOW: ImageCarouselConfig = {
  ...DEFAULT_IMAGE_CAROUSEL,
  heading: { ...DEFAULT_IMAGE_CAROUSEL.heading, text: "Seen on our customers" },
  layout: { ...DEFAULT_IMAGE_CAROUSEL.layout, effect: "coverflow", ratio: "4/5", captions: "overlay", radius: 16 },
};

export function withImageCarouselDefaults(raw: unknown, kind: CarouselKind = "image_carousel"): ImageCarouselConfig {
  const r = obj(raw);
  const d = kind === "coverflow" ? DEFAULT_COVERFLOW : DEFAULT_IMAGE_CAROUSEL;
  const h = obj(r.heading), l = obj(r.layout), n = obj(r.nav), k = obj(r.look);
  return {
    scheme: schemeId((r as { scheme?: unknown }).scheme),
    heading: {
      show: bool(h.show, d.heading.show),
      text: str(h.text, d.heading.text, 120),
      sub: str(h.sub, d.heading.sub, 240),
      align: pick(h.align, ["left", "center"] as const, d.heading.align),
      size: num(h.size, 14, 56, d.heading.size),
    },
    slides: (Array.isArray(r.slides) ? r.slides : []).slice(0, 30).map((x) => {
      const s = obj(x);
      return { image: media(s.image), alt: str(s.alt, "", 200), title: str(s.title, "", 120), text: str(s.text, "", 300), link: str(s.link, "", 500), button: str(s.button, "", 40) };
    }),
    layout: {
      effect: kind === "coverflow" ? "coverflow" : pick(l.effect, ["row", "coverflow"] as const, d.layout.effect),
      perDesktop: num(l.perDesktop, 1, 6, d.layout.perDesktop),
      perMobile: num(l.perMobile, 1, 3, d.layout.perMobile),
      ratio: pick(l.ratio, RATIOS.map((x) => x.value), d.layout.ratio),
      gap: num(l.gap, 0, 48, d.layout.gap),
      radius: num(l.radius, 0, 40, d.layout.radius),
      captions: pick(l.captions, ["below", "overlay", "none"] as const, d.layout.captions),
      fullWidth: bool(l.fullWidth, d.layout.fullWidth),
      paddingTop: num(l.paddingTop, 0, 120, d.layout.paddingTop),
      paddingBottom: num(l.paddingBottom, 0, 120, d.layout.paddingBottom),
    },
    nav: {
      mode: pick(n.mode, ["arrows", "dots", "both", "swipe"] as const, d.nav.mode),
      arrowSize: num(n.arrowSize, 24, 64, d.nav.arrowSize),
      autoplay: num(n.autoplay, 0, 15, d.nav.autoplay),
    },
    look: {
      text: color(k.text, d.look.text),
      overlay: color(k.overlay, d.look.overlay),
      titleSize: num(k.titleSize, 11, 40, d.look.titleSize),
      textSize: num(k.textSize, 10, 24, d.look.textSize),
      buttonBg: color(k.buttonBg, d.look.buttonBg),
      buttonText: color(k.buttonText, d.look.buttonText),
    },
  };
}

/** CSS variables for the section root (storefront and preview). */
export function imageCarouselVars(c: ImageCarouselConfig): Record<string, string> {
  return {
    "--ucs-pt": `${c.layout.paddingTop}px`,
    "--ucs-pb": `${c.layout.paddingBottom}px`,
    "--ucs-h": `${c.heading.size}px`,
    "--ucs-align": c.heading.align,
    "--ucs-ic-n": String(c.layout.perDesktop),
    "--ucs-ic-nm": String(c.layout.perMobile),
    "--ucs-ic-gap": `${c.layout.gap}px`,
    "--ucs-ic-r": `${c.layout.radius}px`,
    "--ucs-ic-ratio": c.layout.ratio === "auto" ? "auto" : c.layout.ratio,
    "--ucs-ic-arrow": `${c.nav.arrowSize}px`,
    "--ucs-ic-fg": c.look.text,
    "--ucs-ic-ov": c.look.overlay,
    "--ucs-ic-ts": `${c.look.titleSize}px`,
    "--ucs-ic-xs": `${c.look.textSize}px`,
    "--ucs-ic-btn-bg": c.look.buttonBg,
    "--ucs-ic-btn-fg": c.look.buttonText,
  };
}

/** Root classes shared by the storefront script and the preview. */
export function imageCarouselClass(c: ImageCarouselConfig) {
  return [
    "ucs",
    "ucs-ic",
    `ucs-ic--cap-${c.layout.captions}`,
    c.layout.effect === "coverflow" ? "ucs-ic--flow" : "",
    `ucs-ic--nav-${c.nav.mode}`,
    c.layout.ratio === "auto" ? "ucs-ic--auto" : "",
    c.layout.fullWidth ? "ucs-ic--full" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Coverflow: how a slide `d` steps away from the centre is drawn (d < 0 left, d > 0 right). It moves toward the
 * centre so it tucks behind its neighbour, gets smaller and sits further back. Same maths in ucs-image-carousel.js.
 */
export function flowStyle(d: number) {
  const a = Math.min(Math.abs(d), 3.5);
  return { transform: `translateX(${(-d * 16).toFixed(1)}%) scale(${(1 - a * 0.12).toFixed(3)})`, zIndex: String(10 - Math.round(a * 2)), opacity: a > 3.2 ? "0" : "1" };
}

/** A Shopify CDN image at a given width (keeps the file's own query string). */
export function sized(url: string, width: number) {
  return `${url}${url.includes("?") ? "&" : "?"}width=${width}`;
}

/**
 * What the storefront gets: only slides with an image, with their resolved CDN address and size,
 * plus the class list and CSS-variable string.
 */
export function toStorefrontImageCarousel(c: ImageCarouselConfig, images: Map<string, { url: string; width: number; height: number }>) {
  return {
    h: c.heading.show ? { t: c.heading.text, s: c.heading.sub } : null,
    s: c.slides.flatMap((x) => {
      const img = x.image ? images.get(x.image.id) : undefined;
      if (!img) return [];
      return [{ u: img.url, w: img.width, h: img.height, a: x.alt || x.title || "", t: x.title, x: x.text, l: x.link ? safeLink(x.link) : "", b: x.button }];
    }),
    cls: imageCarouselClass(c),
    css: Object.entries(imageCarouselVars(c))
      .map(([k, v]) => `${k}: ${v}`)
      .join("; "),
    nav: c.nav.mode,
    auto: c.nav.autoplay,
  };
}
