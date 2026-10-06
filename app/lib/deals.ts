/**
 * Bundle deals beyond mix & match: fixed bundles, buy X get Y, volume tiers and gift with
 * purchase. Stored as $app:cro_deal metaobjects (settings as JSON); turned into
 *  - the discount Function's "deals" config (what checkout charges), and
 *  - a compact storefront copy in $app:cro_offers (what the product page shows).
 * Shared by client and server.
 */

export type DealKind = "fixed" | "bogo" | "volume" | "gift";
export const DEAL_KINDS: DealKind[] = ["fixed", "bogo", "volume", "gift"];

export type ProductPick = { id: string; title: string; image: string | null; handle: string };
export type CollectionPick = { id: string; title: string; handle: string };
export type Target = { type: "all" | "products" | "collections"; products: ProductPick[]; collections: CollectionPick[] };

export type FixedConfig = { items: { product: ProductPick; qty: number }[]; pct: number };
export type BogoConfig = { buy: Target; x: number; sameItems: boolean; get: Target; y: number; pct: number };
export type VolumeConfig = { target: Target; tiers: { qty: number; pct: number }[] };
export type GiftConfig = {
  gift: { variantId: string; title: string; image: string | null; handle: string } | null;
  min: number; // in the store's currency
  onlyWith: Target | null; // optionally: only when the cart has one of these
};
export type DealConfig = FixedConfig | BogoConfig | VolumeConfig | GiftConfig;

export type Deal = {
  id: string | null;
  handle: string | null;
  kind: DealKind;
  name: string; // shown to shoppers and at checkout
  active: boolean;
  position: number;
  config: DealConfig;
};

const ALL: Target = { type: "all", products: [], collections: [] };

export const DEAL_TYPES: Record<
  DealKind,
  { title: string; singular: string; addLabel: string; what: string; how: string; example: string; defaultName: string; config: DealConfig }
> = {
  fixed: {
    title: "Fixed bundles",
    singular: "fixed bundle",
    addLabel: "Create fixed bundle",
    what: "A set of specific products sold together with a discount, added to the cart with one button.",
    how: "Shoppers see the set on each of its products' pages with the total and the saving. The discount applies at checkout whenever the whole set is in the cart.",
    example: "“Camera kit”: instant camera + case + film, 15% off when bought together.",
    defaultName: "Bundle & save",
    config: { items: [], pct: 15 } as FixedConfig,
  },
  bogo: {
    title: "Buy X get Y",
    singular: "buy X get Y deal",
    addLabel: "Create buy X get Y",
    what: "Buy a number of items, get others free or discounted — the classic BOGO.",
    how: "When the cart has enough “buy” items, the cheapest “get” items are discounted automatically at checkout. Qualifying product pages show the deal.",
    example: "“Buy 2 T-shirts, get 1 free”, or “Buy a camera, get the case 50% off”.",
    defaultName: "Buy 2, get 1 free",
    config: { buy: ALL, x: 2, sameItems: true, get: ALL, y: 1, pct: 100 } as BogoConfig,
  },
  volume: {
    title: "Volume discounts",
    singular: "volume discount",
    addLabel: "Create volume discount",
    what: "The more they buy from a group of products, the bigger the discount — counted across different products.",
    how: "Choose the products or collections and the tiers. Product pages show the tier table; checkout applies the best tier reached.",
    example: "Any 2 posters 10% off, any 3 posters 15% off.",
    defaultName: "Buy more, save more",
    config: { target: ALL, tiers: [{ qty: 2, pct: 10 }, { qty: 3, pct: 15 }] } as VolumeConfig,
  },
  gift: {
    title: "Gift with purchase",
    singular: "gift",
    addLabel: "Create gift",
    what: "A free gift once the cart reaches an amount (or has a certain product).",
    how: "Shoppers see how far they are from the gift. When they qualify, the gift is added to the cart for free; if they drop below, it's removed.",
    example: "Free tote bag on orders over $50 — “You're $12 away from your free tote”.",
    defaultName: "Free gift",
    config: { gift: null, min: 50, onlyWith: null } as GiftConfig,
  },
};

/** Words the storefront widgets use (sent with the deals; {placeholders} are filled in there). */
export const DEAL_TEXT = {
  add_bundle: "Add bundle to cart",
  bundle_total: "Bundle price",
  save: "Save {amount}",
  tier: "Buy {qty}+",
  off: "{pct}% off",
  each: "{price} each",
  free: "free",
  bogo_same: "Add {n} to your cart: {y} of them {reward}",
  bogo: "Buy {x}, get {y} {reward}",
  gift_left: "Spend {amount} more to get {gift} free",
  gift_ok: "You've unlocked a free {gift}!",
  error: "Couldn't add the bundle. Please try again.",
};

export function isDealKind(v: string | undefined): v is DealKind {
  return !!v && (DEAL_KINDS as string[]).includes(v);
}

export function blankDeal(kind: DealKind): Deal {
  const t = DEAL_TYPES[kind];
  return { id: null, handle: null, kind, name: t.defaultName, active: true, position: 0, config: structuredClone(t.config) };
}

/** Plain-language summary for lists. */
export function describeDeal(d: Deal): string {
  const target = (t: Target | null) =>
    !t || t.type === "all" ? "any product" : t.type === "products" ? t.products.map((p) => p.title).join(", ") || "no products yet" : t.collections.map((c) => c.title).join(", ") || "no collections yet";
  switch (d.kind) {
    case "fixed": {
      const c = d.config as FixedConfig;
      return c.items.length ? `${c.items.map((i) => (i.qty > 1 ? `${i.qty}× ` : "") + i.product.title).join(" + ")} · ${c.pct}% off` : "No products yet";
    }
    case "bogo": {
      const c = d.config as BogoConfig;
      const reward = c.pct >= 100 ? "free" : `${c.pct}% off`;
      return `Buy ${c.x} of ${target(c.buy)}, get ${c.y} ${c.sameItems ? "" : `of ${target(c.get)} `}${reward}`;
    }
    case "volume": {
      const c = d.config as VolumeConfig;
      return `${target(c.target)}: ${c.tiers.map((t) => `${t.qty}+ = ${t.pct}% off`).join(", ")}`;
    }
    case "gift": {
      const c = d.config as GiftConfig;
      return c.gift ? `${c.gift.title} free over ${c.min}${c.onlyWith ? ` with ${target(c.onlyWith)}` : ""}` : "No gift chosen yet";
    }
  }
}

/** Problems that stop a save (shown in the editor). */
export function validateDeal(d: Deal): string[] {
  const p: string[] = [];
  if (!d.name.trim()) p.push("Give the deal a name — shoppers see it.");
  const pct = (n: number, label: string) => (!(n > 0 && n <= 100) ? p.push(`${label} must be between 1 and 100%.`) : 0);
  const target = (t: Target | null, label: string) => {
    if (t && t.type === "products" && !t.products.length) p.push(`${label}: choose at least one product.`);
    if (t && t.type === "collections" && !t.collections.length) p.push(`${label}: choose at least one collection.`);
  };
  if (d.kind === "fixed") {
    const c = d.config as FixedConfig;
    if (c.items.length < 2) p.push("A fixed bundle needs at least 2 products.");
    pct(c.pct, "The discount");
  }
  if (d.kind === "bogo") {
    const c = d.config as BogoConfig;
    if (!(c.x >= 1) || !(c.y >= 1)) p.push("Buy and get quantities must be at least 1.");
    pct(c.pct, "The discount on the “get” items");
    target(c.buy, "Buy");
    if (!c.sameItems) target(c.get, "Get");
  }
  if (d.kind === "volume") {
    const c = d.config as VolumeConfig;
    if (!c.tiers.length) p.push("Add at least one tier.");
    c.tiers.forEach((t, i) => {
      if (!(t.qty >= 2)) p.push(`Tier ${i + 1}: the quantity must be 2 or more.`);
      pct(t.pct, `Tier ${i + 1}`);
    });
    target(c.target, "Products");
  }
  if (d.kind === "gift") {
    const c = d.config as GiftConfig;
    if (!c.gift) p.push("Choose the gift product.");
    if (!(c.min >= 0)) p.push("The minimum amount can't be negative.");
    target(c.onlyWith, "Only with");
    // The storefront adds the gift itself, so it must be able to check the condition exactly.
    if (c.onlyWith?.type === "collections") p.push("Only with: choose specific products (collections aren't supported for gifts).");
  }
  return p;
}

const numeric = (gid: string) => Number(String(gid).split("/").pop());
const fnTarget = (t: Target | null) =>
  t ? { type: t.type, products: t.products.map((x) => x.id), collections: t.collections.map((x) => x.id) } : null;
const shopTarget = (t: Target | null) =>
  t ? { type: t.type, p: t.products.map((x) => numeric(x.id)), c: t.collections.map((x) => numeric(x.id)) } : null;

/** The discount Function's "deals" entries (product/collection GIDs). */
export function toFunctionDeal(d: Deal) {
  const label = d.name;
  switch (d.kind) {
    case "fixed": {
      const c = d.config as FixedConfig;
      return { t: "fixed", items: c.items.map((i) => ({ p: i.product.id, q: i.qty })), pct: c.pct, label };
    }
    case "bogo": {
      const c = d.config as BogoConfig;
      return { t: "bogo", buy: fnTarget(c.buy), x: c.x, get: fnTarget(c.sameItems ? c.buy : c.get), y: c.y, pct: c.pct, label };
    }
    case "volume": {
      const c = d.config as VolumeConfig;
      return { t: "volume", trigger: fnTarget(c.target), tiers: c.tiers, label };
    }
    case "gift": {
      const c = d.config as GiftConfig;
      return { t: "gift", id: d.handle, variant: c.gift?.variantId, min: c.min, trigger: fnTarget(c.onlyWith), label };
    }
  }
}

/** The storefront copy (numeric ids, handles) read by the boosters script. */
export function toStorefrontDeal(d: Deal) {
  const base = { id: d.handle, t: d.kind, name: d.name };
  switch (d.kind) {
    case "fixed": {
      const c = d.config as FixedConfig;
      return { ...base, items: c.items.map((i) => ({ h: i.product.handle, id: numeric(i.product.id), q: i.qty })), pct: c.pct };
    }
    case "bogo": {
      const c = d.config as BogoConfig;
      return { ...base, buy: shopTarget(c.buy), x: c.x, get: shopTarget(c.sameItems ? c.buy : c.get), y: c.y, pct: c.pct };
    }
    case "volume": {
      const c = d.config as VolumeConfig;
      return { ...base, target: shopTarget(c.target), tiers: c.tiers };
    }
    case "gift": {
      const c = d.config as GiftConfig;
      return { ...base, gift: c.gift ? { v: numeric(c.gift.variantId), h: c.gift.handle, title: c.gift.title, img: c.gift.image } : null, min: c.min, only: shopTarget(c.onlyWith) };
    }
  }
}
