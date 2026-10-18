/**
 * Wishlist (Boosters → Wishlist): a heart on product pages and product cards, a floating button with the
 * count, and a wishlist page (the "Track order & returns" block set to Wishlist) with add to cart, a
 * "price dropped" badge (the price when saved vs now) and a share link. Saved in the shopper's browser;
 * a shared link (?wl=…) opens the same list on any device.
 * Stored in $app:cro_design "wishlist" (+ "_editor"). Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";
import { defaultSizes, sizeVars, withSizes, type SizeSpec, type Sizes } from "./sizes";

export const WISHLIST_SIZES: SizeSpec[] = [
  { key: "heart", label: "Heart button", cssVar: "--ucs-wl-size", min: 24, max: 56, def: 36 },
  { key: "heading", label: "Page heading", cssVar: "--ucs-wl-h", min: 16, max: 48, def: 28 },
  { key: "text", label: "Product names", cssVar: "--ucs-wl-t", min: 11, max: 22, def: 15 },
];

export type WishlistDesign = {
  scheme: string;
  /** Off: nothing shows on the store (the settings are kept). */
  on: boolean;
  where: { product: boolean; cards: boolean; floating: boolean; floatPos: "bl" | "br"; /** Distance of the floating button from the bottom of the screen (px); 0 = automatic, above the theme's fixed bars. */ floatBottom: number };
  page: { url: string; heading: string; empty: string; add: string; remove: string; priceDrop: string; /** Price when no variant is known: "From {amount}". */ from: string; choose: string; share: string; copied: string; added: string; failed: string; soldOut: string };
  text: { add: string; saved: string };
  look: { icon: "heart" | "star" | "bookmark"; color: string; bg: string; radius: number };
  sizes: Sizes;
};

export const DEFAULT_WISHLIST: WishlistDesign = {
  scheme: "",
  on: true,
  where: { product: true, cards: true, floating: true, floatPos: "br", floatBottom: 0 },
  page: { url: "/pages/wishlist", heading: "Your wishlist", empty: "Nothing saved yet. Tap the heart on any product.", add: "Add to cart", remove: "Remove", priceDrop: "Price dropped {amount}", from: "From {amount}", choose: "Choose options", share: "Share my wishlist", copied: "Link copied", added: "Added to cart", failed: "Could not add. Try again.", soldOut: "Sold out" },
  text: { add: "Add to wishlist", saved: "Saved to wishlist" },
  look: { icon: "heart", color: "#e11d48", bg: "#ffffff", radius: 999 },
  sizes: defaultSizes(WISHLIST_SIZES),
};

type Patch = { look?: Partial<WishlistDesign["look"]> };
export const WISHLIST_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "heart", title: "Red heart", patch: { look: { icon: "heart", color: "#e11d48", bg: "#ffffff", radius: 999 } } },
  { key: "black", title: "Black heart", patch: { look: { icon: "heart", color: "#121212", bg: "#ffffff", radius: 999 } } },
  { key: "star", title: "Gold star", patch: { look: { icon: "star", color: "#d4a017", bg: "#ffffff", radius: 999 } } },
  { key: "bookmark", title: "Bookmark", patch: { look: { icon: "bookmark", color: "#1d4ed8", bg: "#f1f5ff", radius: 8 } } },
];

export function applyWishlistPreset(c: WishlistDesign, key: string): WishlistDesign {
  const p = WISHLIST_PRESETS.find((x) => x.key === key);
  return p ? { ...c, scheme: "", look: { ...c.look, ...p.patch.look } } : c;
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withWishlistDefaults(raw: unknown): WishlistDesign {
  const r = obj(raw);
  const d = DEFAULT_WISHLIST;
  const w = obj(r.where), p = obj(r.page), t = obj(r.text), k = obj(r.look);
  const url = String(p.url ?? d.page.url).trim();
  return {
    scheme: schemeId(r.scheme),
    on: bool(r.on, d.on),
    where: { product: bool(w.product, d.where.product), cards: bool(w.cards, d.where.cards), floating: bool(w.floating, d.where.floating), floatPos: pick(w.floatPos, ["bl", "br"] as const, d.where.floatPos), floatBottom: num(w.floatBottom, 0, 400, d.where.floatBottom) },
    page: {
      url: /^\/[a-z0-9/_-]*$/i.test(url) ? url : d.page.url,
      heading: str(p.heading, d.page.heading, 80),
      empty: str(p.empty, d.page.empty, 160),
      add: str(p.add, d.page.add, 30),
      remove: str(p.remove, d.page.remove, 30),
      priceDrop: str(p.priceDrop, d.page.priceDrop, 60),
      from: str(p.from, d.page.from, 40),
      choose: str(p.choose, d.page.choose, 30),
      share: str(p.share, d.page.share, 40),
      copied: str(p.copied, d.page.copied, 60),
      added: str(p.added, d.page.added, 40),
      failed: str(p.failed, d.page.failed, 60),
      soldOut: str(p.soldOut, d.page.soldOut, 30),
    },
    text: { add: str(t.add, d.text.add, 40), saved: str(t.saved, d.text.saved, 40) },
    look: { icon: pick(k.icon, ["heart", "star", "bookmark"] as const, d.look.icon), color: color(k.color, d.look.color), bg: color(k.bg, d.look.bg), radius: num(k.radius, 0, 999, d.look.radius) },
    sizes: withSizes(r.sizes, WISHLIST_SIZES),
  };
}

export function wishlistVars(c: WishlistDesign): Record<string, string> {
  const v: Record<string, string> = { "--ucs-wl-c": c.look.color, "--ucs-wl-bg": c.look.bg, "--ucs-wl-r": `${c.look.radius}px` };
  Object.assign(v, sizeVars(c.sizes, WISHLIST_SIZES));
  return v;
}

/** The storefront copy, read by ucs-wishlist.js (through the Conversion boosters embed and the page block). */
export function toStorefrontWishlist(c: WishlistDesign) {
  return {
    css: Object.entries(wishlistVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
    on: c.on,
    w: c.where,
    p: c.page,
    t: c.text,
    ic: c.look.icon,
  };
}
