/**
 * Bundle builder, designed in the app (moved out of the theme editor). The bundles themselves
 * (bundle product, steps, products) are still set on the Bundles page; this is how the builder looks.
 * One design for every bundle. Stored in $app:cro_design "bundles" (storefront) and "bundles_editor".
 * Shared by client and server.
 */
import { color, FONTS, num, pick, str, type FontKey } from "./designs";
import { schemeId } from "./theme-style";

export type BundleDesign = {
  text: { heading: string; sub: string; size: "small" | "medium" | "large"; align: "left" | "center" | "right" };
  products: { desktop: number; mobile: number; pick: string; picked: string };
  summary: { show: boolean; value: string; save: string; sticky: boolean };
  button: { theme: boolean; label: string; remaining: string };
  /** Building it anywhere: the "Add to bundle" buttons and the bundle tray that follows the shopper. */
  tray: { add: string; cart: string; checkout: string; position: "bottom" | "right" };
  look: { themeAccent: boolean; accent: string; themeRadius: boolean; radius: number; top: number; bottom: number; scheme: string };
  /** Product cards. Colours "" = from the theme (text colour and its tints). */
  card: { style: "outline" | "filled" | "shadow" | "plain"; bg: string; border: string; borderWidth: number; padding: number; gap: number; align: "left" | "center"; pickedTint: boolean; pickedBorder: string };
  image: { ratio: "1 / 1" | "4 / 5" | "3 / 4" | "16 / 9"; fit: "cover" | "contain"; radius: number /* -1 = from the card corners */ };
  type: { font: FontKey; nameSize: number; nameWeight: number; nameColor: string; priceSize: number; priceWeight: number; priceColor: string; stepSize: number; counter: "text" | "pill" };
  /** The Add / Added button on each card. Picked colours "" = the picked item colour. */
  pickButton: { style: "outline" | "filled" | "text"; radius: number; height: number; size: number; weight: number; upper: boolean; bg: string; text: string; border: string; pickedBg: string; pickedText: string };
  /** The summary box and its Add bundle to cart button (custom colours, or the theme's button). */
  summaryLook: { bg: string; text: string; radius: number /* -1 = card corners */; customButton: boolean; btnBg: string; btnText: string; btnRadius: number };
  layout: { mobile: "grid" | "swipe"; maxWidth: number /* 0 = full width */ };
};

export const DEFAULT_BUNDLE_DESIGN: BundleDesign = {
  text: { heading: "Build your bundle", sub: "", size: "medium", align: "left" },
  products: { desktop: 4, mobile: 2, pick: "Add", picked: "Added" },
  summary: { show: true, value: "Worth [amount]", save: "You save [amount] ([percent]%)", sticky: false },
  button: { theme: false, label: "Add bundle to cart", remaining: "Choose [remaining] more" },
  tray: { add: "Add to bundle", cart: "Add bundle to cart", checkout: "Checkout", position: "bottom" },
  look: { themeAccent: true, accent: "#111111", themeRadius: true, radius: 12, top: 16, bottom: 16, scheme: "" },
  card: { style: "outline", bg: "", border: "", borderWidth: 1, padding: 8, gap: 13, align: "left", pickedTint: false, pickedBorder: "" },
  image: { ratio: "1 / 1", fit: "cover", radius: -1 },
  type: { font: "theme", nameSize: 15, nameWeight: 600, nameColor: "", priceSize: 15, priceWeight: 400, priceColor: "", stepSize: 15, counter: "text" },
  pickButton: { style: "outline", radius: 6, height: 36, size: 14, weight: 400, upper: false, bg: "", text: "", border: "", pickedBg: "", pickedText: "" },
  summaryLook: { bg: "", text: "", radius: -1, customButton: false, btnBg: "#111111", btnText: "#ffffff", btnRadius: 8 },
  layout: { mobile: "grid", maxWidth: 0 },
};

type Patch = {
  products?: Partial<BundleDesign["products"]>;
  summary?: Partial<BundleDesign["summary"]>;
  look?: Partial<BundleDesign["look"]>;
  card?: Partial<BundleDesign["card"]>;
  image?: Partial<BundleDesign["image"]>;
  pickButton?: Partial<BundleDesign["pickButton"]>;
  type?: Partial<BundleDesign["type"]>;
};
/** Ready-made looks; everything stays editable. */
export const BUNDLE_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "theme", title: "My theme", patch: { look: { themeAccent: true, themeRadius: true }, card: { style: "outline", pickedTint: false }, pickButton: { style: "outline", radius: 6 } } },
  { key: "black", title: "Black and white", patch: { look: { themeAccent: false, accent: "#111111", themeRadius: false, radius: 10 }, card: { style: "outline", pickedTint: false }, pickButton: { style: "filled", radius: 6, bg: "#f1f1f1", text: "#111111", border: "" } } },
  { key: "green", title: "Fresh green", patch: { look: { themeAccent: false, accent: "#16a34a", themeRadius: false, radius: 14 }, card: { style: "filled", bg: "#f3faf5", pickedTint: true }, pickButton: { style: "outline", radius: 99 } } },
  { key: "blue", title: "Blue", patch: { look: { themeAccent: false, accent: "#2563eb", themeRadius: false, radius: 12 }, card: { style: "shadow", bg: "#ffffff", pickedTint: true }, pickButton: { style: "filled", radius: 8, bg: "#eef3ff", text: "#1d4ed8" } } },
  { key: "big", title: "Big cards", patch: { products: { desktop: 3, mobile: 2 }, look: { themeAccent: false, accent: "#111111", themeRadius: false, radius: 18 }, card: { style: "shadow", padding: 12 }, image: { ratio: "4 / 5" }, type: { nameSize: 17 } } },
  { key: "sharp", title: "Sharp and compact", patch: { products: { desktop: 5, mobile: 3 }, look: { themeAccent: false, accent: "#111111", themeRadius: false, radius: 0 }, card: { style: "plain", padding: 0 }, pickButton: { style: "outline", radius: 0, upper: true, size: 12 } } },
];

export function applyBundlePreset(c: BundleDesign, key: string): BundleDesign {
  const p = BUNDLE_PRESETS.find((x) => x.key === key);
  if (!p) return c;
  const pt = p.patch;
  return {
    ...c,
    products: { ...c.products, ...pt.products },
    summary: { ...c.summary, ...pt.summary },
    look: { ...c.look, ...pt.look },
    card: { ...DEFAULT_BUNDLE_DESIGN.card, ...pt.card },
    image: { ...DEFAULT_BUNDLE_DESIGN.image, ...pt.image },
    pickButton: { ...DEFAULT_BUNDLE_DESIGN.pickButton, ...pt.pickButton },
    type: { ...c.type, ...DEFAULT_BUNDLE_DESIGN.type, font: c.type.font, ...pt.type },
  };
}

/** "Match my theme style": the theme's colours (a scheme, or the theme's button colour) and corners. */
export function matchBundleTheme(c: BundleDesign, scheme: string): BundleDesign {
  return { ...c, look: { ...c.look, themeAccent: true, themeRadius: true, scheme } };
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withBundleDesignDefaults(raw: unknown): BundleDesign {
  const r = obj(raw);
  const d = DEFAULT_BUNDLE_DESIGN;
  const t = obj(r.text), p = obj(r.products), s = obj(r.summary), b = obj(r.button), k = obj(r.look), tr = obj(r.tray);
  const cd = obj(r.card), im = obj(r.image), ty = obj(r.type), pb = obj(r.pickButton), sl = obj(r.summaryLook), ly = obj(r.layout);
  const opt = (v: unknown) => (v === "" || v == null ? "" : color(v, "")); // "" = from the theme
  return {
    text: {
      heading: str(t.heading, d.text.heading, 120),
      sub: str(t.sub, d.text.sub, 240),
      size: pick(t.size, ["small", "medium", "large"] as const, d.text.size),
      align: pick(t.align, ["left", "center", "right"] as const, d.text.align),
    },
    products: {
      desktop: num(p.desktop, 2, 6, d.products.desktop),
      mobile: num(p.mobile, 1, 3, d.products.mobile),
      pick: str(p.pick, d.products.pick, 30) || d.products.pick,
      picked: str(p.picked, d.products.picked, 30) || d.products.picked,
    },
    summary: {
      show: bool(s.show, d.summary.show),
      value: str(s.value, d.summary.value, 80) || d.summary.value,
      save: str(s.save, d.summary.save, 80) || d.summary.save,
      sticky: bool(s.sticky, d.summary.sticky),
    },
    button: {
      theme: bool(b.theme, d.button.theme),
      label: str(b.label, d.button.label, 40) || d.button.label,
      remaining: str(b.remaining, d.button.remaining, 60) || d.button.remaining,
    },
    tray: {
      add: str(tr.add, d.tray.add, 30) || d.tray.add,
      cart: str(tr.cart, d.tray.cart, 40) || d.tray.cart,
      checkout: str(tr.checkout, d.tray.checkout, 30) || d.tray.checkout,
      position: pick(tr.position, ["bottom", "right"] as const, d.tray.position),
    },
    card: {
      style: pick(cd.style, ["outline", "filled", "shadow", "plain"] as const, d.card.style),
      bg: opt(cd.bg),
      border: opt(cd.border),
      borderWidth: num(cd.borderWidth, 0, 4, d.card.borderWidth),
      padding: num(cd.padding, 0, 24, d.card.padding),
      gap: num(cd.gap, 0, 40, d.card.gap),
      align: pick(cd.align, ["left", "center"] as const, d.card.align),
      pickedTint: bool(cd.pickedTint, d.card.pickedTint),
      pickedBorder: opt(cd.pickedBorder),
    },
    image: {
      ratio: pick(im.ratio, ["1 / 1", "4 / 5", "3 / 4", "16 / 9"] as const, d.image.ratio),
      fit: pick(im.fit, ["cover", "contain"] as const, d.image.fit),
      radius: num(im.radius, -1, 40, d.image.radius),
    },
    type: {
      font: pick(ty.font, FONTS.map((f) => f.value), d.type.font),
      nameSize: num(ty.nameSize, 11, 28, d.type.nameSize),
      nameWeight: num(ty.nameWeight, 300, 800, d.type.nameWeight),
      nameColor: opt(ty.nameColor),
      priceSize: num(ty.priceSize, 11, 28, d.type.priceSize),
      priceWeight: num(ty.priceWeight, 300, 800, d.type.priceWeight),
      priceColor: opt(ty.priceColor),
      stepSize: num(ty.stepSize, 12, 32, d.type.stepSize),
      counter: pick(ty.counter, ["text", "pill"] as const, d.type.counter),
    },
    pickButton: {
      style: pick(pb.style, ["outline", "filled", "text"] as const, d.pickButton.style),
      radius: num(pb.radius, 0, 99, d.pickButton.radius),
      height: num(pb.height, 28, 56, d.pickButton.height),
      size: num(pb.size, 11, 20, d.pickButton.size),
      weight: num(pb.weight, 300, 800, d.pickButton.weight),
      upper: bool(pb.upper, d.pickButton.upper),
      bg: opt(pb.bg),
      text: opt(pb.text),
      border: opt(pb.border),
      pickedBg: opt(pb.pickedBg),
      pickedText: opt(pb.pickedText),
    },
    summaryLook: {
      bg: opt(sl.bg),
      text: opt(sl.text),
      radius: num(sl.radius, -1, 40, d.summaryLook.radius),
      customButton: bool(sl.customButton, d.summaryLook.customButton),
      btnBg: color(sl.btnBg, d.summaryLook.btnBg),
      btnText: color(sl.btnText, d.summaryLook.btnText),
      btnRadius: num(sl.btnRadius, 0, 99, d.summaryLook.btnRadius),
    },
    layout: {
      mobile: pick(ly.mobile, ["grid", "swipe"] as const, d.layout.mobile),
      maxWidth: num(ly.maxWidth, 0, 1600, d.layout.maxWidth),
    },
    look: {
      themeAccent: bool(k.themeAccent, d.look.themeAccent),
      accent: color(k.accent, d.look.accent),
      themeRadius: bool(k.themeRadius, d.look.themeRadius),
      radius: num(k.radius, 0, 40, d.look.radius),
      top: num(k.top, 0, 80, d.look.top),
      bottom: num(k.bottom, 0, 80, d.look.bottom),
      scheme: schemeId(k.scheme),
    },
  };
}

export function bundleVars(c: BundleDesign): Record<string, string> {
  const v: Record<string, string> = {
    "--ucro-align": c.text.align,
    "--ucro-pt": `${c.look.top}px`,
    "--ucro-pb": `${c.look.bottom}px`,
    "--ucro-cols-d": String(c.products.desktop),
    "--ucro-cols-m": String(c.products.mobile),
  };
  if (!c.look.themeAccent) v["--ucro-accent"] = c.look.accent;
  if (!c.look.themeRadius) v["--ucro-radius"] = `${c.look.radius}px`;
  const font = FONTS.find((f) => f.value === c.type.font);
  const set = (key: string, value: string) => {
    if (value) v[key] = value;
  };
  if (font && font.value !== "theme") v["--ucro-b-font"] = font.css;
  Object.assign(v, {
    "--ucro-b-bw": `${c.card.borderWidth}px`,
    "--ucro-b-pad": `${c.card.padding}px`,
    "--ucro-b-gap": `${c.card.gap}px`,
    "--ucro-b-align": c.card.align,
    "--ucro-b-ratio": c.image.ratio,
    "--ucro-b-fit": c.image.fit,
    "--ucro-b-ns": `${c.type.nameSize}px`,
    "--ucro-b-nw": String(c.type.nameWeight),
    "--ucro-b-ps": `${c.type.priceSize}px`,
    "--ucro-b-pw": String(c.type.priceWeight),
    "--ucro-b-ls": `${c.type.stepSize}px`,
    "--ucro-b-br": `${c.pickButton.radius}px`,
    "--ucro-b-bh": `${c.pickButton.height}px`,
    "--ucro-b-bs": `${c.pickButton.size}px`,
    "--ucro-b-bwt": String(c.pickButton.weight),
    "--ucro-b-bt": c.pickButton.upper ? "uppercase" : "none",
  });
  if (c.image.radius >= 0) v["--ucro-b-ir"] = `${c.image.radius}px`;
  if (c.summaryLook.radius >= 0) v["--ucro-b-sr"] = `${c.summaryLook.radius}px`;
  if (c.layout.maxWidth > 0) v["--ucro-b-max"] = `${c.layout.maxWidth}px`;
  set("--ucro-b-bg", c.card.bg);
  set("--ucro-b-line", c.card.border);
  set("--ucro-b-pline", c.card.pickedBorder);
  set("--ucro-b-nc", c.type.nameColor);
  set("--ucro-b-pc", c.type.priceColor);
  set("--ucro-b-bbg", c.pickButton.bg);
  set("--ucro-b-bfg", c.pickButton.text);
  set("--ucro-b-bline", c.pickButton.border);
  set("--ucro-b-pbg", c.pickButton.pickedBg);
  set("--ucro-b-pfg", c.pickButton.pickedText);
  set("--ucro-b-sbg", c.summaryLook.bg);
  set("--ucro-b-sfg", c.summaryLook.text);
  if (c.summaryLook.customButton) {
    v["--ucro-b-mbg"] = c.summaryLook.btnBg;
    v["--ucro-b-mfg"] = c.summaryLook.btnText;
    v["--ucro-b-mr"] = `${c.summaryLook.btnRadius}px`;
  }
  return v;
}

/** Style classes on <ucro-bundle> (card and button styles, mobile layout, counter). */
export function bundleClass(c: BundleDesign) {
  return [
    `ucro-bundle--card-${c.card.style}`,
    `ucro-bundle--btn-${c.pickButton.style}`,
    c.card.pickedTint ? "ucro-bundle--tint" : "",
    c.layout.mobile === "swipe" ? "ucro-bundle--m-swipe" : "",
    c.type.counter === "pill" ? "ucro-bundle--pill" : "",
    c.summaryLook.customButton ? "ucro-bundle--main-custom" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The storefront copy: short keys, read by ucro-bundle-builder.liquid. */
export function toStorefrontBundle(c: BundleDesign) {
  return {
    h: c.text.heading,
    sub: c.text.sub,
    hc: `ucro__heading--${c.text.size}`,
    pk: c.products.pick,
    pd: c.products.picked,
    sm: c.summary.show,
    val: c.summary.value,
    sv: c.summary.save,
    st: c.summary.sticky,
    tb: c.button.theme,
    btn: c.button.label,
    rem: c.button.remaining,
    ta: c.tray.add,
    tc: c.tray.cart,
    tk: c.tray.checkout,
    tp: c.tray.position,
    cls: ` ${bundleClass(c)}` + (c.look.scheme ? ` ucro-scheme color-${c.look.scheme}` : ""),
    css: Object.entries(bundleVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
  };
}
