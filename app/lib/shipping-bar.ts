/**
 * Free shipping bar: "You're $12 away from free shipping" with a progress bar that updates as the cart
 * changes, then a success message. Designed in the app; one theme block that can sit in the Header
 * area, on product pages or on the cart page, and can also show inside the theme's cart drawer.
 * Stored in $app:cro_design "shipping_bar" (storefront) and "shipping_bar_editor". Shared by client and server.
 */
import { color, num, pick, str } from "./designs";

export type ShippingBarConfig = {
  on: boolean;
  goal: number; // in the store's currency (converted for other currencies on the storefront)
  text: { empty: string; progress: string; done: string };
  show: {
    bar: boolean;
    icon: "truck" | "gift" | "none";
    top: boolean; // the bar at the top of the store (where the block is placed)
    drawer: boolean; // inside the theme's cart drawer
    cartPage: boolean; // inside the cart page
    cartPos: "top" | "bottom"; // in the cart: above the items, or above the checkout button
    celebrate: boolean;
    whenEmpty: boolean;
  };
  where: { all: boolean; pages: ("home" | "product" | "collection" | "cart" | "other")[]; devices: "all" | "desktop" | "mobile" };
  look: {
    style: "bar" | "card";
    bg: string;
    text: string;
    track: string;
    fill: string;
    done: string;
    size: number;
    weight: number;
    height: number; // space above and below
    radius: number;
    barHeight: number;
    upper: boolean;
  };
};

export const DEFAULT_SHIPPING_BAR: ShippingBarConfig = {
  on: true,
  goal: 100,
  text: { empty: "Free shipping on orders over {goal}", progress: "You're {left} away from free shipping", done: "You've got free shipping!" },
  show: { bar: true, icon: "truck", top: true, drawer: true, cartPage: true, cartPos: "top", celebrate: true, whenEmpty: true },
  where: { all: true, pages: [], devices: "all" },
  look: { style: "bar", bg: "#111111", text: "#ffffff", track: "#3a3a3a", fill: "#d7f25c", done: "#5ee07d", size: 14, weight: 600, height: 9, radius: 0, barHeight: 4, upper: false },
};

type Look = ShippingBarConfig["look"];
/** Ready-made looks (colours, shape and type together); everything stays editable. */
export const SHIPPING_BAR_PRESETS: { key: string; title: string; look: Partial<Look> }[] = [
  { key: "lime", title: "Black and lime", look: { style: "bar", bg: "#111111", text: "#ffffff", track: "#3a3a3a", fill: "#d7f25c", done: "#5ee07d", radius: 0, upper: false } },
  { key: "soft", title: "Soft green", look: { style: "bar", bg: "#eaf7ee", text: "#14532d", track: "#cfe9d7", fill: "#16a34a", done: "#16a34a", radius: 0, upper: false } },
  { key: "card", title: "Card", look: { style: "card", bg: "#ffffff", text: "#1a1a1a", track: "#ececec", fill: "#1a1a1a", done: "#16a34a", radius: 12, upper: false } },
  { key: "sand", title: "Sand", look: { style: "bar", bg: "#f4ede4", text: "#5b4636", track: "#e4d6c5", fill: "#a0522d", done: "#6b8e23", radius: 0, upper: true } },
  { key: "red", title: "Bold red", look: { style: "bar", bg: "#b42318", text: "#ffffff", track: "#d8584d", fill: "#ffffff", done: "#ffffff", radius: 0, upper: true } },
  { key: "pill", title: "Rounded pill", look: { style: "card", bg: "#111111", text: "#ffffff", track: "#333333", fill: "#ffffff", done: "#5ee07d", radius: 999, upper: false } },
];

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const PAGES = ["home", "product", "collection", "cart", "other"] as const;

export function withShippingBarDefaults(raw: unknown): ShippingBarConfig {
  const r = obj(raw);
  const d = DEFAULT_SHIPPING_BAR;
  const t = obj(r.text), s = obj(r.show), w = obj(r.where), k = obj(r.look);
  const goal = Number(r.goal);
  return {
    on: bool(r.on, d.on),
    goal: Number.isFinite(goal) && goal > 0 ? Math.min(1_000_000, Math.round(goal * 100) / 100) : d.goal,
    text: { empty: str(t.empty, d.text.empty, 160), progress: str(t.progress, d.text.progress, 160), done: str(t.done, d.text.done, 160) },
    show: {
      bar: bool(s.bar, d.show.bar),
      icon: pick(s.icon, ["truck", "gift", "none"] as const, d.show.icon),
      top: bool(s.top, d.show.top),
      drawer: bool(s.drawer, d.show.drawer),
      cartPage: bool(s.cartPage, d.show.cartPage),
      cartPos: pick(s.cartPos, ["top", "bottom"] as const, d.show.cartPos),
      celebrate: bool(s.celebrate, d.show.celebrate),
      whenEmpty: bool(s.whenEmpty, d.show.whenEmpty),
    },
    where: {
      all: bool(w.all, d.where.all),
      pages: Array.isArray(w.pages) ? w.pages.filter((p): p is (typeof PAGES)[number] => (PAGES as readonly string[]).includes(p as string)) : [],
      devices: pick(w.devices, ["all", "desktop", "mobile"] as const, d.where.devices),
    },
    look: {
      style: pick(k.style, ["bar", "card"] as const, d.look.style),
      bg: color(k.bg, d.look.bg),
      text: color(k.text, d.look.text),
      track: color(k.track, d.look.track),
      fill: color(k.fill, d.look.fill),
      done: color(k.done, d.look.done),
      size: num(k.size, 10, 22, d.look.size),
      weight: num(k.weight, 400, 800, d.look.weight),
      height: num(k.height, 2, 30, d.look.height),
      radius: num(k.radius, 0, 999, d.look.radius),
      barHeight: num(k.barHeight, 2, 14, d.look.barHeight),
      upper: bool(k.upper, d.look.upper),
    },
  };
}

export function shippingBarVars(c: ShippingBarConfig): Record<string, string> {
  const k = c.look;
  return {
    "--fsb-bg": k.bg,
    "--fsb-fg": k.text,
    "--fsb-track": k.track,
    "--fsb-fill": k.fill,
    "--fsb-done": k.done,
    "--fsb-fs": `${k.size}px`,
    "--fsb-fw": String(k.weight),
    "--fsb-pad": `${k.height}px`,
    "--fsb-r": `${k.radius}px`,
    "--fsb-bh": `${k.barHeight}px`,
  };
}

export function shippingBarClass(c: ShippingBarConfig) {
  return ["ucs", "ucs-fsb", `ucs-fsb--${c.look.style}`, c.look.upper ? "ucs-fsb--upper" : "", c.where.devices === "mobile" ? "ucs-hide-desktop" : c.where.devices === "desktop" ? "ucs-hide-mobile" : ""].filter(Boolean).join(" ");
}

/** The message for a cart total (both in the same currency units). Shared with the preview. */
export function shippingMessage(c: ShippingBarConfig, total: number, goal: number, fmt: (n: number) => string) {
  if (total <= 0) return c.text.empty.replace(/\{goal\}/g, fmt(goal));
  if (total >= goal) return c.text.done;
  return c.text.progress.replace(/\{left\}/g, fmt(goal - total)).replace(/\{goal\}/g, fmt(goal));
}

export function toStorefrontShippingBar(c: ShippingBarConfig) {
  return {
    on: c.on,
    goal: c.goal,
    t: c.text,
    s: c.show,
    w: { a: c.where.all, p: c.where.pages },
    cls: shippingBarClass(c),
    css: Object.entries(shippingBarVars(c))
      .map(([key, v]) => `${key}: ${v}`)
      .join("; "),
  };
}
