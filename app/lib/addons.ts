/**
 * Product add-ons (gift wrapping, a gift message, an extra warranty…), designed in the app.
 * Shown under the Add to cart button; ticked add-ons go into the cart with the product in the
 * same request. Stored in $app:cro_design "addons" (storefront) and "addons_editor" (this form).
 * Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";

export type AddonItem = {
  productId: string;
  handle: string;
  title: string;
  image: string | null;
  variantId: string; // numeric
  variants: { id: string; title: string; price: string }[];
  label: string; // shown instead of the product title when set
  text: string;
  checked: boolean;
};
type Ref = { handle: string; title: string };

export type AddonsConfig = {
  /** The theme colour scheme its colours were matched to ("" = its own colours). */
  scheme: string;
  heading: string;
  items: AddonItem[];
  message: { on: boolean; label: string; placeholder: string; max: number; name: string };
  style: "list" | "cards";
  where: { mode: "all" | "products" | "collections"; products: Ref[]; collections: Ref[] };
  look: { accent: string; bg: string; border: string; radius: number; titleSize: number; textSize: number };
};

export const DEFAULT_ADDONS: AddonsConfig = {
  scheme: "",
  heading: "Make it extra special",
  items: [],
  message: { on: false, label: "Add a gift message", placeholder: "Write your message (we'll print it on a card)", max: 200, name: "Gift message" },
  style: "list",
  where: { mode: "all", products: [], collections: [] },
  look: { accent: "#121212", bg: "#ffffff", border: "#e3e3e3", radius: 10, titleSize: 15, textSize: 13 },
};

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const refs = (v: unknown): Ref[] =>
  (Array.isArray(v) ? v : []).slice(0, 100).flatMap((x) => {
    const r = obj(x);
    return typeof r.handle === "string" && r.handle ? [{ handle: r.handle, title: str(r.title, r.handle, 200) }] : [];
  });

export function withAddonsDefaults(raw: unknown): AddonsConfig {
  const r = obj(raw);
  const d = DEFAULT_ADDONS;
  const m = obj(r.message), w = obj(r.where), k = obj(r.look);
  return {
    scheme: schemeId((r as { scheme?: unknown }).scheme),
    heading: str(r.heading, d.heading, 120),
    items: (Array.isArray(r.items) ? r.items : []).slice(0, 6).flatMap((x) => {
      const a = obj(x);
      if (typeof a.handle !== "string" || !/^\d+$/.test(String(a.variantId))) return [];
      return [
        {
          productId: str(a.productId, "", 100),
          handle: a.handle,
          title: str(a.title, a.handle, 200),
          image: typeof a.image === "string" ? a.image : null,
          variantId: String(a.variantId),
          variants: (Array.isArray(a.variants) ? a.variants : []).slice(0, 100).map((v) => {
            const o = obj(v);
            return { id: String(o.id), title: str(o.title, "", 120), price: str(o.price, "", 30) };
          }),
          label: str(a.label, "", 80),
          text: str(a.text, "", 200),
          // Never pre-ticked: App Store rule 1.1.9 (explicit buyer consent before adding charges).
          checked: false,
        },
      ];
    }),
    message: {
      on: bool(m.on, d.message.on),
      label: str(m.label, d.message.label, 80),
      placeholder: str(m.placeholder, d.message.placeholder, 120),
      max: num(m.max, 20, 500, d.message.max),
      name: str(m.name, d.message.name, 40).replace(/[[\]]/g, "") || d.message.name,
    },
    style: pick(r.style, ["list", "cards"] as const, d.style),
    where: {
      mode: pick(w.mode, ["all", "products", "collections"] as const, d.where.mode),
      products: refs(w.products),
      collections: refs(w.collections),
    },
    look: {
      accent: color(k.accent, d.look.accent),
      bg: color(k.bg, d.look.bg),
      border: color(k.border, d.look.border),
      radius: num(k.radius, 0, 24, d.look.radius),
      titleSize: num(k.titleSize, 11, 22, d.look.titleSize),
      textSize: num(k.textSize, 10, 18, d.look.textSize),
    },
  };
}

export function addonsVars(c: AddonsConfig): Record<string, string> {
  return {
    "--ucs-ao-accent": c.look.accent,
    "--ucs-ao-bg": c.look.bg,
    "--ucs-ao-border": c.look.border,
    "--ucs-ao-r": `${c.look.radius}px`,
    "--ucs-ao-ts": `${c.look.titleSize}px`,
    "--ucs-ao-xs": `${c.look.textSize}px`,
  };
}

/** The lean copy the storefront script reads. */
export function toStorefrontAddons(c: AddonsConfig) {
  return {
    h: c.heading,
    a: c.items.map((x) => ({ h: x.handle, v: x.variantId, t: x.label || x.title, x: x.text, i: x.image, c: false })),
    m: c.message.on ? { l: c.message.label, p: c.message.placeholder, n: c.message.max, k: c.message.name } : null,
    st: c.style,
    w: { m: c.where.mode, p: c.where.products.map((x) => x.handle), c: c.where.collections.map((x) => x.handle) },
    css: Object.entries(addonsVars(c))
      .map(([key, v]) => `${key}: ${v}`)
      .join("; "),
  };
}
