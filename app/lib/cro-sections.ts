/**
 * CRO sections: nine conversion sections that share ONE theme block ("CRO section", ucs-section) and,
 * for the email pop up, the Conversion boosters embed. Each is designed in the app (Section library →
 * its card), stored in $app:cro_design "<kind>" (storefront), "<kind>_draft" (theme editor preview)
 * and "<kind>_editor" (this form). The block prints the storefront JSON and loads only that kind's
 * files: ucs-sec.js (shared) + ucs-sec-<kind>.js and .css, which build the markup. The app previews
 * run the same scripts. Plan: docs/plans/cro-sections.md. Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";
import type { MediaRef } from "./sections";
import { iconSvg, isSecIcon, type SecIcon } from "./sec-icons";
import { defaultSizes, sizeVars, withSizes, SUB, type SizeSpec, type Sizes } from "./sizes";

export const SEC_KINDS = ["compare_table", "benefits", "product_tabs", "guarantee", "before_after", "shoppable", "recently_viewed", "how_it_works", "email_popup"] as const;
export type SecKind = (typeof SEC_KINDS)[number];
export const isSecKind = (v: unknown): v is SecKind => SEC_KINDS.includes(v as SecKind);
/** The kinds placed with the "CRO section" block (the pop up lives in the Conversion boosters embed). */
export const BLOCK_KINDS = SEC_KINDS.filter((k) => k !== "email_popup");

/** Where each kind is added (a key of sectionLinks): inside the product's own section, below it, or as a home page section. */
export const SEC_ADD: Record<SecKind, "cro_section" | "cro_section_product" | "cro_section_main" | "boosters"> = {
  compare_table: "cro_section_product",
  benefits: "cro_section",
  product_tabs: "cro_section_main",
  guarantee: "cro_section_main",
  before_after: "cro_section",
  shoppable: "cro_section",
  recently_viewed: "cro_section_product",
  how_it_works: "cro_section",
  email_popup: "boosters",
};

/** Address part of each kind's page: /app/designs/cro/<slug>. */
export const secSlug = (k: SecKind) => k.replace(/_/g, "-");
export const kindOfSlug = (slug: string): SecKind | null => {
  const k = slug.replace(/-/g, "_");
  return isSecKind(k) ? k : null;
};

export const SEC_META: Record<SecKind, { title: string; page: "Product page" | "Home page"; hint: string }> = {
  compare_table: { title: "Comparison table", page: "Product page", hint: "Shows why your product beats the others, row by row." },
  benefits: { title: "Benefits row", page: "Home page", hint: "Short reasons to buy, each with an icon." },
  product_tabs: { title: "Product details tabs", page: "Product page", hint: "Details, shipping and returns in tabs or an accordion, so the page stays short." },
  guarantee: { title: "Guarantee", page: "Product page", hint: "A money back or free returns promise next to Add to cart." },
  before_after: { title: "Before and after", page: "Home page", hint: "Two pictures with a handle to drag between them." },
  shoppable: { title: "Shoppable image", page: "Home page", hint: "A picture with dots on the products; a tap shows the product with Add to cart." },
  recently_viewed: { title: "Recently viewed", page: "Product page", hint: "The products this shopper looked at last, kept in their own browser." },
  how_it_works: { title: "How it works", page: "Home page", hint: "Three to five numbered steps." },
  email_popup: { title: "Email pop up", page: "Home page", hint: "Collects emails with a discount code and adds the shopper to your customers with email consent." },
};

/* ------------------------------------------------------------------ shared look -- */

export type SecLook = {
  /** Own background colour (off = the page's own). */
  ownBg: boolean;
  bg: string;
  text: string;
  accent: string;
  accentText: string;
  /** Boxes, cards and the highlighted column. */
  card: string;
  line: string;
  radius: number;
  align: "left" | "center";
  width: number;
  paddingTop: number;
  paddingBottom: number;
};

const DEFAULT_LOOK: SecLook = { ownBg: false, bg: "#ffffff", text: "#1a1a1a", accent: "#1a1a1a", accentText: "#ffffff", card: "#f5f5f3", line: "#e3e3e3", radius: 12, align: "center", width: 1200, paddingTop: 40, paddingBottom: 40 };

export const SEC_SIZES: SizeSpec[] = [
  { key: "heading", label: "Heading", cssVar: "--usec-h", min: 14, max: 56, def: 28 },
  SUB,
  { key: "title", label: "Item titles", cssVar: "--usec-t", min: 11, max: 32, def: 17 },
  { key: "text", label: "Item text", cssVar: "--usec-p", min: 10, max: 24, def: 15 },
];

/* ------------------------------------------------------------- per kind content -- */

/** A comparison cell: "y" tick, "n" cross, anything else is shown as text. */
export type CompareRow = { label: string; us: string; them: string[] };
export type SecImage = MediaRef | null;
export type Spot = { x: number; y: number; id: string; handle: string; title: string; image: string | null; price: number; variant: string; variants: number };

export type SecContent = {
  compare_table: { us: string; them: string[]; rows: CompareRow[] };
  benefits: { items: { icon: SecIcon | ""; image: SecImage; title: string; text: string }[] };
  product_tabs: { desc: boolean; descTitle: string; tabs: { title: string; text: string; mf: string }[] };
  guarantee: { seal: "money" | "returns" | "shipping" | "secure" | "quality" | "image" | "none"; days: number; image: SecImage; title: string; text: string; link: string; linkText: string };
  before_after: { before: SecImage; after: SecImage; beforeLabel: string; afterLabel: string; caption: string };
  shoppable: { image: SecImage; spots: Spot[]; button: string; viewText: string };
  recently_viewed: { count: number; button: string; chooseText: string; soldOut: string };
  how_it_works: { steps: { icon: SecIcon | ""; title: string; text: string }[]; button: string; link: string };
  email_popup: {
    on: boolean;
    image: SecImage;
    placeholder: string;
    button: string;
    consent: string;
    /** The shopper ticks a box before signing up (some countries require it). */
    tick: boolean;
    success: string;
    copy: string;
    no: string;
    discount: { type: "percent" | "amount"; value: number; minimum: number; days: number };
    show: { delay: number; scroll: number; exit: boolean; pages: "all" | "home" | "product" | "collection"; every: number };
  };
};

export type SecLayout = {
  compare_table: { style: "table" | "cards"; highlight: boolean; stripes: boolean };
  benefits: { style: "top" | "left" | "boxed" | "strip"; mobile: "stack" | "two" | "scroll" };
  product_tabs: { style: "tabs" | "accordion" | "lines"; firstOpen: boolean };
  guarantee: { style: "left" | "center" | "banner" | "inline" };
  before_after: { dir: "h" | "v"; start: number; handle: "circle" | "line" | "arrows"; ratio: "auto" | "1" | "0.8" | "1.5" };
  shoppable: { marker: "dot" | "number" | "plus"; pulse: boolean; ratio: "auto" | "1" | "0.8" | "1.5" };
  recently_viewed: { style: "grid" | "row" | "carousel"; price: boolean; add: boolean; hideCurrent: boolean };
  how_it_works: { style: "circles" | "timeline" | "cards"; marker: "number" | "icon" };
  email_popup: { style: "center" | "side" | "bar" | "full" };
};

export type SecConfig<K extends SecKind = SecKind> = {
  kind: K;
  scheme: string;
  heading: string;
  sub: string;
  look: SecLook;
  layout: SecLayout[K];
  content: SecContent[K];
  sizes: Sizes;
};

/* ---------------------------------------------------------------- defaults -- */

const DEFAULT_TEXT: Record<SecKind, { heading: string; sub: string }> = {
  compare_table: { heading: "Why shoppers choose us", sub: "" },
  benefits: { heading: "", sub: "" },
  product_tabs: { heading: "", sub: "" },
  guarantee: { heading: "", sub: "" },
  before_after: { heading: "See the difference", sub: "" },
  shoppable: { heading: "Shop the look", sub: "" },
  recently_viewed: { heading: "Recently viewed", sub: "" },
  how_it_works: { heading: "How it works", sub: "" },
  email_popup: { heading: "Get 10% off your first order", sub: "Join our list for new arrivals and offers." },
};

export const DEFAULT_CONTENT: SecContent = {
  compare_table: {
    us: "Us",
    them: ["Others"],
    rows: [
      { label: "Free shipping", us: "y", them: ["n"] },
      { label: "30 day returns", us: "y", them: ["n"] },
      { label: "Natural ingredients", us: "y", them: ["Some"] },
      { label: "Price", us: "$29", them: ["$45"] },
    ],
  },
  benefits: {
    items: [
      { icon: "truck", image: null, title: "Free shipping", text: "On orders over $50" },
      { icon: "returns", image: null, title: "Easy returns", text: "30 days to change your mind" },
      { icon: "lock", image: null, title: "Secure checkout", text: "Protected payments" },
      { icon: "chat", image: null, title: "Real support", text: "We answer within a day" },
    ],
  },
  product_tabs: {
    desc: true,
    descTitle: "Details",
    tabs: [
      { title: "Shipping", text: "Orders ship within 1 to 2 working days.\nFree shipping on orders over $50.", mf: "" },
      { title: "Returns", text: "Not happy? Send it back within 30 days for a full refund.", mf: "" },
    ],
  },
  guarantee: { seal: "money", days: 30, image: null, title: "30 day money back guarantee", text: "Try it risk free. If you don't love it, we refund you in full.", link: "", linkText: "" },
  before_after: { before: null, after: null, beforeLabel: "Before", afterLabel: "After", caption: "" },
  shoppable: { image: null, spots: [], button: "Add to cart", viewText: "View product" },
  recently_viewed: { count: 4, button: "Add to cart", chooseText: "Choose options", soldOut: "Sold out" },
  how_it_works: {
    steps: [
      { icon: "bag", title: "Choose", text: "Pick the products you love." },
      { icon: "truck", title: "Get it fast", text: "Delivered to your door in days." },
      { icon: "smile", title: "Enjoy", text: "Love it or send it back free." },
    ],
    button: "",
    link: "",
  },
  email_popup: {
    on: false,
    image: null,
    placeholder: "Your email",
    button: "Get my code",
    consent: "By signing up you agree to receive emails. You can unsubscribe at any time.",
    tick: false,
    success: "Here is your code. It is also added to your cart.",
    copy: "Copy",
    no: "No thanks",
    discount: { type: "percent", value: 10, minimum: 0, days: 14 },
    show: { delay: 6, scroll: 0, exit: true, pages: "all", every: 7 },
  },
};

export const DEFAULT_LAYOUT: SecLayout = {
  compare_table: { style: "table", highlight: true, stripes: false },
  benefits: { style: "top", mobile: "two" },
  product_tabs: { style: "accordion", firstOpen: true },
  guarantee: { style: "left" },
  before_after: { dir: "h", start: 50, handle: "circle", ratio: "auto" },
  shoppable: { marker: "dot", pulse: true, ratio: "auto" },
  recently_viewed: { style: "grid", price: true, add: true, hideCurrent: true },
  how_it_works: { style: "circles", marker: "number" },
  email_popup: { style: "center" },
};

/** Narrower or wider defaults per kind (a guarantee sits in the product column). */
const LOOK_OVERRIDES: Partial<Record<SecKind, Partial<SecLook>>> = {
  product_tabs: { align: "left", paddingTop: 12, paddingBottom: 12, width: 900 },
  guarantee: { align: "left", paddingTop: 12, paddingBottom: 12, ownBg: true, card: "#f5f5f3" },
  compare_table: { width: 900 },
  email_popup: { ownBg: true, align: "center", radius: 16 },
};

export function defaultSec<K extends SecKind>(kind: K): SecConfig<K> {
  return {
    kind,
    scheme: "",
    ...DEFAULT_TEXT[kind],
    look: { ...DEFAULT_LOOK, ...LOOK_OVERRIDES[kind] },
    layout: structuredClone(DEFAULT_LAYOUT[kind]),
    content: structuredClone(DEFAULT_CONTENT[kind]),
    sizes: defaultSizes(SEC_SIZES),
  } as SecConfig<K>;
}

/* ---------------------------------------------------------------- cleaning -- */

const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const icon = (v: unknown): SecIcon | "" => (isSecIcon(v) ? v : "");
const media = (v: unknown): SecImage => {
  const m = obj(v);
  return typeof m.id === "string" && m.id ? { id: m.id, url: typeof m.url === "string" ? m.url : null, kind: "image", title: str(m.title, "Image", 200) } : null;
};
const RATIOS = ["auto", "1", "0.8", "1.5"] as const;

function cleanContent(kind: SecKind, raw: unknown): SecContent[SecKind] {
  const r = obj(raw);
  switch (kind) {
    case "compare_table": {
      const d = DEFAULT_CONTENT.compare_table;
      const them = (Array.isArray(r.them) ? r.them : d.them).slice(0, 3).map((x) => str(x, "", 40));
      const n = Math.max(1, them.length);
      return {
        us: str(r.us, d.us, 40),
        them: them.length ? them : ["Others"],
        rows: (Array.isArray(r.rows) ? r.rows : d.rows).slice(0, 12).map((x) => {
          const o = obj(x);
          const cells = arr(o.them, 3).map((c) => str(c, "", 40));
          return { label: str(o.label, "", 80), us: str(o.us, "y", 40), them: Array.from({ length: n }, (_, i) => cells[i] ?? "n") };
        }),
      };
    }
    case "benefits": {
      const items = Array.isArray(r.items) ? r.items : DEFAULT_CONTENT.benefits.items;
      return { items: items.slice(0, 6).map((x) => { const o = obj(x); return { icon: icon(o.icon), image: media(o.image), title: str(o.title, "", 60), text: str(o.text, "", 140) }; }) };
    }
    case "product_tabs": {
      const d = DEFAULT_CONTENT.product_tabs;
      return {
        desc: bool(r.desc, d.desc),
        descTitle: str(r.descTitle, d.descTitle, 40),
        tabs: (Array.isArray(r.tabs) ? r.tabs : d.tabs).slice(0, 5).map((x) => {
          const o = obj(x);
          const mf = str(o.mf, "", 80).trim();
          return { title: str(o.title, "", 40), text: str(o.text, "", 2000), mf: /^[\w-]+\.[\w-]+$/.test(mf) ? mf : "" };
        }),
      };
    }
    case "guarantee": {
      const d = DEFAULT_CONTENT.guarantee;
      return {
        seal: pick(r.seal, ["money", "returns", "shipping", "secure", "quality", "image", "none"] as const, d.seal),
        days: num(r.days, 1, 365, d.days),
        image: media(r.image),
        title: str(r.title, d.title, 80),
        text: str(r.text, d.text, 300),
        link: str(r.link, "", 300),
        linkText: str(r.linkText, "", 40),
      };
    }
    case "before_after": {
      const d = DEFAULT_CONTENT.before_after;
      return { before: media(r.before), after: media(r.after), beforeLabel: str(r.beforeLabel, d.beforeLabel, 30), afterLabel: str(r.afterLabel, d.afterLabel, 30), caption: str(r.caption, "", 200) };
    }
    case "shoppable": {
      const d = DEFAULT_CONTENT.shoppable;
      return {
        image: media(r.image),
        spots: arr(r.spots, 8).flatMap((x) => {
          const o = obj(x);
          if (typeof o.handle !== "string" || !o.handle) return [];
          return [{ x: num(o.x, 0, 100, 50), y: num(o.y, 0, 100, 50), id: str(o.id, "", 100), handle: o.handle.slice(0, 255), title: str(o.title, o.handle, 200), image: typeof o.image === "string" ? o.image : null, price: num(o.price, 0, 1e9, 0), variant: str(o.variant, "", 100), variants: num(o.variants, 1, 2000, 1) }];
        }),
        button: str(r.button, d.button, 30),
        viewText: str(r.viewText, d.viewText, 30),
      };
    }
    case "recently_viewed": {
      const d = DEFAULT_CONTENT.recently_viewed;
      return { count: num(r.count, 2, 12, d.count), button: str(r.button, d.button, 30), chooseText: str(r.chooseText, d.chooseText, 30), soldOut: str(r.soldOut, d.soldOut, 30) };
    }
    case "how_it_works": {
      const d = DEFAULT_CONTENT.how_it_works;
      const steps = Array.isArray(r.steps) ? r.steps : d.steps;
      return { steps: steps.slice(0, 5).map((x) => { const o = obj(x); return { icon: icon(o.icon), title: str(o.title, "", 60), text: str(o.text, "", 200) }; }), button: str(r.button, "", 30), link: str(r.link, "", 300) };
    }
    case "email_popup": {
      const d = DEFAULT_CONTENT.email_popup;
      const ds = obj(r.discount), sh = obj(r.show);
      const type = pick(ds.type, ["percent", "amount"] as const, d.discount.type);
      return {
        on: bool(r.on, d.on),
        image: media(r.image),
        placeholder: str(r.placeholder, d.placeholder, 40),
        button: str(r.button, d.button, 30),
        consent: str(r.consent, d.consent, 300),
        tick: bool(r.tick, d.tick),
        success: str(r.success, d.success, 200),
        copy: str(r.copy, d.copy, 20),
        no: str(r.no, d.no, 30),
        discount: { type, value: num(ds.value, 1, type === "percent" ? 90 : 100000, d.discount.value), minimum: num(ds.minimum, 0, 100000, 0), days: num(ds.days, 1, 365, d.discount.days) },
        show: {
          delay: num(sh.delay, 0, 120, d.show.delay),
          scroll: num(sh.scroll, 0, 100, d.show.scroll),
          exit: bool(sh.exit, d.show.exit),
          pages: pick(sh.pages, ["all", "home", "product", "collection"] as const, d.show.pages),
          every: num(sh.every, 1, 365, d.show.every),
        },
      };
    }
  }
}

function cleanLayout(kind: SecKind, raw: unknown): SecLayout[SecKind] {
  const r = obj(raw);
  switch (kind) {
    case "compare_table": { const d = DEFAULT_LAYOUT.compare_table; return { style: pick(r.style, ["table", "cards"] as const, d.style), highlight: bool(r.highlight, d.highlight), stripes: bool(r.stripes, d.stripes) }; }
    case "benefits": { const d = DEFAULT_LAYOUT.benefits; return { style: pick(r.style, ["top", "left", "boxed", "strip"] as const, d.style), mobile: pick(r.mobile, ["stack", "two", "scroll"] as const, d.mobile) }; }
    case "product_tabs": { const d = DEFAULT_LAYOUT.product_tabs; return { style: pick(r.style, ["tabs", "accordion", "lines"] as const, d.style), firstOpen: bool(r.firstOpen, d.firstOpen) }; }
    case "guarantee": return { style: pick(r.style, ["left", "center", "banner", "inline"] as const, DEFAULT_LAYOUT.guarantee.style) };
    case "before_after": { const d = DEFAULT_LAYOUT.before_after; return { dir: pick(r.dir, ["h", "v"] as const, d.dir), start: num(r.start, 5, 95, d.start), handle: pick(r.handle, ["circle", "line", "arrows"] as const, d.handle), ratio: pick(r.ratio, RATIOS, d.ratio) }; }
    case "shoppable": { const d = DEFAULT_LAYOUT.shoppable; return { marker: pick(r.marker, ["dot", "number", "plus"] as const, d.marker), pulse: bool(r.pulse, d.pulse), ratio: pick(r.ratio, RATIOS, d.ratio) }; }
    case "recently_viewed": { const d = DEFAULT_LAYOUT.recently_viewed; return { style: pick(r.style, ["grid", "row", "carousel"] as const, d.style), price: bool(r.price, d.price), add: bool(r.add, d.add), hideCurrent: bool(r.hideCurrent, d.hideCurrent) }; }
    case "how_it_works": { const d = DEFAULT_LAYOUT.how_it_works; return { style: pick(r.style, ["circles", "timeline", "cards"] as const, d.style), marker: pick(r.marker, ["number", "icon"] as const, d.marker) }; }
    case "email_popup": return { style: pick(r.style, ["center", "side", "bar", "full"] as const, DEFAULT_LAYOUT.email_popup.style) };
  }
}

export function withSecDefaults<K extends SecKind>(kind: K, raw: unknown): SecConfig<K> {
  const r = obj(raw);
  const d = defaultSec(kind);
  const k = obj(r.look);
  const L = d.look;
  return {
    kind,
    scheme: schemeId(r.scheme),
    heading: str(r.heading, d.heading, 120),
    sub: str(r.sub, d.sub, 300),
    look: {
      ownBg: bool(k.ownBg, L.ownBg),
      bg: color(k.bg, L.bg),
      text: color(k.text, L.text),
      accent: color(k.accent, L.accent),
      accentText: color(k.accentText, L.accentText),
      card: color(k.card, L.card),
      line: color(k.line, L.line),
      radius: num(k.radius, 0, 40, L.radius),
      align: pick(k.align, ["left", "center"] as const, L.align),
      width: num(k.width, 320, 1600, L.width),
      paddingTop: num(k.paddingTop, 0, 120, L.paddingTop),
      paddingBottom: num(k.paddingBottom, 0, 120, L.paddingBottom),
    },
    layout: (r.layout ? cleanLayout(kind, r.layout) : d.layout) as SecLayout[K],
    content: (r.content ? cleanContent(kind, r.content) : d.content) as SecContent[K],
    sizes: withSizes(r.sizes, SEC_SIZES),
  };
}

/* ----------------------------------------------------------------- presets -- */

type Patch<K extends SecKind> = { look?: Partial<SecLook>; layout?: Partial<SecLayout[K]> };
const DARK: Partial<SecLook> = { ownBg: true, bg: "#111111", text: "#ffffff", card: "#1f1f1f", line: "#333333", accent: "#d7f25c", accentText: "#111111" };
const SOFT: Partial<SecLook> = { ownBg: true, bg: "#f6f5f1", text: "#1a1a1a", card: "#ffffff", line: "#e6e3da", accent: "#2f5d50", accentText: "#ffffff" };
const PLAIN: Partial<SecLook> = { ownBg: false, text: "#1a1a1a", card: "#f5f5f3", line: "#e3e3e3", accent: "#1a1a1a", accentText: "#ffffff" };

export const SEC_PRESETS: { [K in SecKind]: { key: string; title: string; patch: Patch<K> }[] } = {
  compare_table: [
    { key: "clean", title: "Clean", patch: { look: { ...PLAIN, radius: 12 }, layout: { style: "table", highlight: false, stripes: true } } },
    { key: "column", title: "Highlighted column", patch: { look: { ...PLAIN, accent: "#2f5d50", card: "#eef5f1", radius: 14 }, layout: { style: "table", highlight: true, stripes: false } } },
    { key: "dark", title: "Dark", patch: { look: { ...DARK, radius: 14 }, layout: { style: "table", highlight: true, stripes: false } } },
    { key: "cards", title: "Cards", patch: { look: { ...SOFT, radius: 16 }, layout: { style: "cards", highlight: true, stripes: false } } },
  ],
  benefits: [
    { key: "top", title: "Icons on top", patch: { look: { ...PLAIN, align: "center", radius: 12 }, layout: { style: "top" } } },
    { key: "left", title: "Icons left", patch: { look: { ...PLAIN, align: "left", radius: 12 }, layout: { style: "left" } } },
    { key: "boxed", title: "Boxed", patch: { look: { ...SOFT, align: "center", radius: 16 }, layout: { style: "boxed" } } },
    { key: "strip", title: "Strip", patch: { look: { ...DARK, align: "center", radius: 0, paddingTop: 14, paddingBottom: 14 }, layout: { style: "strip" } } },
  ],
  product_tabs: [
    { key: "accordion", title: "Accordion", patch: { look: { ...PLAIN, radius: 0 }, layout: { style: "accordion" } } },
    { key: "tabs", title: "Tabs", patch: { look: { ...PLAIN, radius: 10 }, layout: { style: "tabs" } } },
    { key: "lines", title: "Minimal lines", patch: { look: { ...PLAIN, line: "#d4d4d4", radius: 0 }, layout: { style: "lines" } } },
    { key: "boxed", title: "Soft boxes", patch: { look: { ...PLAIN, card: "#f4f4f0", radius: 12 }, layout: { style: "accordion" } } },
  ],
  guarantee: [
    { key: "left", title: "Badge left", patch: { look: { ownBg: true, bg: "#f5f5f3", text: "#1a1a1a", accent: "#2f5d50", accentText: "#ffffff", radius: 12, align: "left" }, layout: { style: "left" } } },
    { key: "center", title: "Centered seal", patch: { look: { ownBg: false, text: "#1a1a1a", accent: "#b8862b", accentText: "#ffffff", radius: 12, align: "center" }, layout: { style: "center" } } },
    { key: "banner", title: "Banner", patch: { look: { ...DARK, radius: 14, align: "left" }, layout: { style: "banner" } } },
    { key: "inline", title: "Small line", patch: { look: { ownBg: false, text: "#1a1a1a", accent: "#2f5d50", accentText: "#ffffff", radius: 8, align: "left" }, layout: { style: "inline" } } },
  ],
  before_after: [
    { key: "classic", title: "Classic", patch: { look: { ...PLAIN, radius: 0, accent: "#ffffff", accentText: "#1a1a1a" }, layout: { handle: "circle" } } },
    { key: "rounded", title: "Rounded", patch: { look: { ...SOFT, radius: 24, accent: "#ffffff", accentText: "#1a1a1a" }, layout: { handle: "arrows" } } },
    { key: "line", title: "Thin line", patch: { look: { ...PLAIN, radius: 8, accent: "#ffffff", accentText: "#1a1a1a" }, layout: { handle: "line" } } },
  ],
  shoppable: [
    { key: "dots", title: "Dots", patch: { look: { ...PLAIN, radius: 12, accent: "#ffffff", accentText: "#1a1a1a" }, layout: { marker: "dot", pulse: true } } },
    { key: "numbers", title: "Numbers", patch: { look: { ...PLAIN, radius: 12, accent: "#1a1a1a", accentText: "#ffffff" }, layout: { marker: "number", pulse: false } } },
    { key: "plus", title: "Plus signs", patch: { look: { ...SOFT, radius: 20, accent: "#ffffff", accentText: "#1a1a1a" }, layout: { marker: "plus", pulse: true } } },
  ],
  recently_viewed: [
    { key: "cards", title: "Cards", patch: { look: { ...PLAIN, radius: 12, align: "left" }, layout: { style: "grid" } } },
    { key: "row", title: "Compact row", patch: { look: { ...PLAIN, radius: 8, align: "left" }, layout: { style: "row" } } },
    { key: "carousel", title: "Carousel", patch: { look: { ...SOFT, radius: 16, align: "center" }, layout: { style: "carousel" } } },
  ],
  how_it_works: [
    { key: "circles", title: "Numbered circles", patch: { look: { ...PLAIN, align: "center", radius: 12 }, layout: { style: "circles", marker: "number" } } },
    { key: "timeline", title: "Timeline", patch: { look: { ...PLAIN, accent: "#2f5d50", align: "left", radius: 12 }, layout: { style: "timeline", marker: "number" } } },
    { key: "cards", title: "Cards with icons", patch: { look: { ...SOFT, align: "center", radius: 16 }, layout: { style: "cards", marker: "icon" } } },
    { key: "dark", title: "Dark", patch: { look: { ...DARK, align: "center", radius: 16 }, layout: { style: "cards", marker: "number" } } },
  ],
  email_popup: [
    { key: "center", title: "Centered", patch: { look: { ownBg: true, bg: "#ffffff", text: "#1a1a1a", accent: "#1a1a1a", accentText: "#ffffff", card: "#f5f5f3", line: "#d4d4d4", radius: 16 }, layout: { style: "center" } } },
    { key: "side", title: "Side image", patch: { look: { ownBg: true, bg: "#f6f5f1", text: "#1a1a1a", accent: "#2f5d50", accentText: "#ffffff", card: "#ffffff", line: "#d8d4c8", radius: 20 }, layout: { style: "side" } } },
    { key: "bar", title: "Bottom bar", patch: { look: { ...DARK, radius: 12 }, layout: { style: "bar" } } },
    { key: "full", title: "Full screen on phones", patch: { look: { ownBg: true, bg: "#fff4ec", text: "#2b1a12", accent: "#e2582c", accentText: "#ffffff", card: "#ffffff", line: "#f0d6c6", radius: 18 }, layout: { style: "full" } } },
  ],
};

export function applySecPreset<K extends SecKind>(c: SecConfig<K>, key: string): SecConfig<K> {
  const p = (SEC_PRESETS[c.kind] as { key: string; patch: Patch<K> }[]).find((x) => x.key === key);
  if (!p) return c;
  return { ...c, scheme: "", look: { ...c.look, ...p.patch.look }, layout: { ...c.layout, ...p.patch.layout } };
}

/* -------------------------------------------------------------- storefront -- */

export type SecImages = Map<string, { url: string; width: number; height: number }>;
const img = (m: SecImage, images: SecImages) => {
  if (!m) return null;
  const f = images.get(m.id);
  if (f) return { u: f.url, w: f.width, h: f.height };
  return m.url ? { u: m.url, w: 1000, h: 1000 } : null;
};

export function secVars(c: SecConfig): Record<string, string> {
  const k = c.look;
  return {
    ...(k.ownBg ? { "--usec-bg": k.bg } : {}),
    "--usec-fg": k.text,
    "--usec-ac": k.accent,
    "--usec-act": k.accentText,
    "--usec-card": k.card,
    "--usec-line": k.line,
    "--usec-r": `${k.radius}px`,
    "--usec-w": `${k.width}px`,
    "--usec-pt": `${k.paddingTop}px`,
    "--usec-pb": `${k.paddingBottom}px`,
    ...sizeVars(c.sizes, SEC_SIZES),
  };
}

export function secClass(c: SecConfig) {
  const l = c.layout as Record<string, unknown>;
  const flags = Object.entries(l).map(([key, v]) => (typeof v === "boolean" ? (v ? `usec--${key}` : "") : typeof v === "string" ? `usec--${key}-${v.replace(/\./g, "_")}` : ""));
  return ["usec", `usec-${c.kind}`, `usec--${c.look.align}`, c.look.ownBg ? "usec--bg" : "", ...flags].filter(Boolean).join(" ");
}

/** The guarantee seal's words around the ring. */
const SEALS: Record<string, (days: number) => [string, string, SecIcon]> = {
  money: (d) => [`${d} DAY`, "MONEY BACK", "shield"],
  returns: (d) => [`${d} DAY`, "FREE RETURNS", "returns"],
  shipping: () => ["FREE", "SHIPPING", "truck"],
  secure: () => ["100%", "SECURE CHECKOUT", "lock"],
  quality: () => ["PREMIUM", "QUALITY", "award"],
};

/** Money as the storefront's money format expects it (cents). Discount text shown before sign up. */
export function popupOffer(c: SecContent["email_popup"]["discount"]) {
  return c.type === "percent" ? `${c.value}%` : `${c.value}`;
}

/** What the storefront gets: only what the section draws, with resolved image addresses. */
export function toStorefrontSec(c: SecConfig, images: SecImages = new Map()) {
  const base = { k: c.kind, cls: secClass(c), css: Object.entries(secVars(c)).map(([key, v]) => `${key}: ${v}`).join("; "), h: c.heading, s: c.sub, l: c.layout };
  switch (c.kind) {
    case "compare_table": {
      const x = c.content as SecContent["compare_table"];
      return { ...base, d: { us: x.us, them: x.them, rows: x.rows.filter((r) => r.label) } };
    }
    case "benefits": {
      const x = c.content as SecContent["benefits"];
      return { ...base, d: { items: x.items.filter((i) => i.title || i.text).map((i) => ({ i: iconSvg(i.icon), im: img(i.image, images), t: i.title, p: i.text })) } };
    }
    case "product_tabs": {
      const x = c.content as SecContent["product_tabs"];
      return { ...base, d: { desc: x.desc, dt: x.descTitle, tabs: x.tabs.filter((t) => t.title).map((t) => ({ t: t.title, p: t.text, mf: t.mf })) } };
    }
    case "guarantee": {
      const x = c.content as SecContent["guarantee"];
      const seal = SEALS[x.seal];
      const s = seal ? seal(x.days) : null;
      return { ...base, d: { seal: s ? { a: s[0], b: s[1], i: iconSvg(s[2]) } : null, im: x.seal === "image" ? img(x.image, images) : null, t: x.title, p: x.text, u: x.link, ut: x.linkText } };
    }
    case "before_after": {
      const x = c.content as SecContent["before_after"];
      return { ...base, d: { a: img(x.before, images), b: img(x.after, images), al: x.beforeLabel, bl: x.afterLabel, cap: x.caption } };
    }
    case "shoppable": {
      const x = c.content as SecContent["shoppable"];
      return { ...base, d: { im: img(x.image, images), spots: x.spots.map((s) => ({ x: s.x, y: s.y, h: s.handle, t: s.title, im: s.image, pr: s.price, v: s.variant.replace(/\D/g, ""), n: s.variants })), btn: x.button, view: x.viewText } };
    }
    case "recently_viewed": {
      const x = c.content as SecContent["recently_viewed"];
      return { ...base, d: { n: x.count, btn: x.button, choose: x.chooseText, out: x.soldOut } };
    }
    case "how_it_works": {
      const x = c.content as SecContent["how_it_works"];
      return { ...base, d: { steps: x.steps.filter((s) => s.title || s.text).map((s) => ({ i: iconSvg(s.icon), t: s.title, p: s.text })), btn: x.button, u: x.link } };
    }
    case "email_popup": {
      const x = c.content as SecContent["email_popup"];
      return {
        ...base,
        on: x.on,
        d: { im: img(x.image, images), ph: x.placeholder, btn: x.button, consent: x.consent, tick: x.tick, ok: x.success, copy: x.copy, no: x.no, show: x.show },
      };
    }
  }
}

/** Every image a design uses (for resolving their CDN addresses on save). */
export function secImageIds(c: SecConfig): string[] {
  const x = c.content as Record<string, unknown>;
  const all: SecImage[] = [];
  for (const key of ["image", "before", "after"]) all.push(x[key] as SecImage);
  if (Array.isArray(x.items)) for (const i of x.items as { image: SecImage }[]) all.push(i.image);
  return [...new Set(all.flatMap((m) => (m ? [m.id] : [])))];
}

/** Sample products for previews and demos (recently viewed). */
export const SAMPLE_PRODUCTS = [
  { handle: "glow-serum", title: "Glow serum", price: 2900, image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&h=600&fit=crop&q=60" },
  { handle: "linen-shirt", title: "Linen shirt", price: 5400, image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=600&fit=crop&q=60" },
  { handle: "ceramic-mug", title: "Ceramic mug", price: 1800, image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&h=600&fit=crop&q=60" },
  { handle: "soy-candle", title: "Soy candle", price: 2400, image: "https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?w=600&h=600&fit=crop&q=60" },
  { handle: "canvas-tote", title: "Canvas tote", price: 3200, image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop&q=60" },
  { handle: "wool-beanie", title: "Wool beanie", price: 2200, image: "https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=600&h=600&fit=crop&q=60" },
];
/** Sample pictures for the image sections before the merchant picks their own. */
export const SAMPLE_IMAGES = {
  before: "https://images.unsplash.com/photo-1616627561950-9f746e330187?w=1200&h=800&fit=crop&q=60&sat=-100",
  after: "https://images.unsplash.com/photo-1616627561950-9f746e330187?w=1200&h=800&fit=crop&q=60",
  look: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1400&h=900&fit=crop&q=60",
  popup: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800&h=900&fit=crop&q=60",
};
