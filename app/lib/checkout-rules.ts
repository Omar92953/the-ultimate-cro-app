/**
 * Checkout rules, run by three Shopify Functions at checkout (extensions/cro-payment, cro-delivery,
 * cro-validation):
 *  - Payment rules: hide, rename or move payment methods (e.g. hide Cash on Delivery above 5,000).
 *  - Delivery rules: the same for delivery options (e.g. hide Express for heavy products).
 *  - Order limits: block checkout with a message (minimum order, max per product…).
 * Each function's rules live in its own customization's `$app:function-configuration` metafield;
 * the Functions read only that. Shared by client and server.
 */

export type When = { min: number; max: number; countries: string[]; products: string[]; customer: "any" | "guest" | "new" | "returning" };
/** Product names for the products in a rule, shown in the app only (the Functions only need ids). */
export type Picked = { id: string; title: string };

export type ChangeRule = { id: string; on: boolean; match: string; action: "hide" | "rename" | "move"; name: string; index: number; when: When; picked: Picked[] };

export type LimitKind = "minTotal" | "maxTotal" | "minItems" | "maxItems" | "minPerProduct" | "maxPerProduct";
export type LimitRule = { id: string; on: boolean; kind: LimitKind; value: number; message: string; products: string[]; picked: Picked[] };

export type CheckoutKind = "payment" | "delivery" | "validation";
export type RuleSet<R> = { id: string | null; enabled: boolean; rules: R[] };

export const LIMIT_KINDS: { value: LimitKind; label: string; unit: "money" | "items"; perProduct: boolean; message: string }[] = [
  { value: "minTotal", label: "Minimum order total", unit: "money", perProduct: false, message: "The minimum order is {limit}." },
  { value: "maxTotal", label: "Maximum order total", unit: "money", perProduct: false, message: "The maximum order is {limit}." },
  { value: "minItems", label: "Minimum items in the order", unit: "items", perProduct: false, message: "Add at least {limit} items to check out." },
  { value: "maxItems", label: "Maximum items in the order", unit: "items", perProduct: false, message: "You can order up to {limit} items." },
  { value: "minPerProduct", label: "Minimum quantity per product", unit: "items", perProduct: true, message: "{product}: order at least {limit}." },
  { value: "maxPerProduct", label: "Maximum quantity per product", unit: "items", perProduct: true, message: "{product}: you can order up to {limit}." },
];

export const CUSTOMERS: { value: When["customer"]; label: string }[] = [
  { value: "any", label: "Any shopper" },
  { value: "guest", label: "Guests (not logged in)" },
  { value: "new", label: "First order" },
  { value: "returning", label: "Returning customers (ordered before)" },
];

export const emptyWhen = (): When => ({ min: 0, max: 0, countries: [], products: [], customer: "any" });
let seq = 0;
const newId = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;
export const newChangeRule = (kind: "payment" | "delivery"): ChangeRule => ({
  id: newId(),
  on: true,
  match: kind === "payment" ? "Cash on Delivery" : "Express",
  action: "hide",
  name: "",
  index: 0,
  when: kind === "payment" ? { ...emptyWhen(), min: 5000 } : emptyWhen(),
  picked: [],
});
export const newLimitRule = (): LimitRule => ({ id: newId(), on: true, kind: "minTotal", value: 300, message: "", products: [], picked: [] });

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const n = (v: unknown, lo: number, hi: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : 0;
};
const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const gids = (v: unknown, type: string) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.startsWith(`gid://shopify/${type}/`)).slice(0, 50) : []);
const picked = (v: unknown): Picked[] =>
  Array.isArray(v)
    ? v
        .map((x) => obj(x))
        .filter((x) => typeof x.id === "string" && x.id.startsWith("gid://shopify/Product/"))
        .slice(0, 50)
        .map((x) => ({ id: String(x.id), title: s(x.title, 120) }))
    : [];

export function cleanWhen(raw: unknown): When {
  const w = obj(raw);
  return {
    min: n(w.min, 0, 1e9),
    max: n(w.max, 0, 1e9),
    countries: Array.isArray(w.countries) ? w.countries.map((c) => String(c).trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)).slice(0, 50) : [],
    products: gids(w.products, "Product"),
    customer: (["any", "guest", "new", "returning"] as const).find((c) => c === w.customer) ?? "any",
  };
}

export function cleanChangeRules(raw: unknown): ChangeRule[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 25).map((x) => {
    const r = obj(x);
    const p = picked(r.picked);
    const when = cleanWhen(r.when);
    // The product names follow the ids kept in the condition.
    when.products = p.length ? p.map((x) => x.id) : when.products;
    return {
      id: s(r.id, 30) || newId(),
      on: r.on !== false,
      match: s(r.match, 80),
      action: (["hide", "rename", "move"] as const).find((a) => a === r.action) ?? "hide",
      name: s(r.name, 100),
      index: Math.round(n(r.index, 0, 20)),
      when,
      picked: p,
    };
  });
}

export function cleanLimitRules(raw: unknown): LimitRule[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 25).map((x) => {
    const r = obj(x);
    const p = picked(r.picked);
    return {
      id: s(r.id, 30) || newId(),
      on: r.on !== false,
      kind: LIMIT_KINDS.find((k) => k.value === r.kind)?.value ?? "minTotal",
      value: n(r.value, 0, 1e9),
      message: s(r.message, 250),
      products: p.length ? p.map((x) => x.id) : gids(r.products, "Product"),
      picked: p,
    };
  });
}

/** What the Functions read: only switched-on, complete rules, without the app-only fields. */
export function toFunctionConfig(kind: CheckoutKind, rules: (ChangeRule | LimitRule)[]) {
  if (kind === "validation")
    return {
      rules: (rules as LimitRule[])
        .filter((r) => r.on && r.value > 0)
        .map((r) => ({ kind: r.kind, value: r.value, message: r.message, ...(r.products.length ? { products: r.products } : {}) })),
    };
  return {
    rules: (rules as ChangeRule[])
      .filter((r) => r.on && r.match && (r.action !== "rename" || r.name))
      .map((r) => ({ match: r.match, action: r.action, ...(r.action === "rename" ? { name: r.name } : {}), ...(r.action === "move" ? { index: r.index } : {}), when: r.when })),
  };
}

/** One line describing a rule, for lists and cards. */
export function describeChange(r: ChangeRule, what: "payment method" | "delivery option", money: (n: number) => string) {
  const verb = r.action === "hide" ? "Hide" : r.action === "rename" ? `Rename to “${r.name || "…"}”` : `Move to position ${r.index + 1}`;
  const conds: string[] = [];
  if (r.when.min) conds.push(`order ≥ ${money(r.when.min)}`);
  if (r.when.max) conds.push(`order ≤ ${money(r.when.max)}`);
  if (r.when.countries.length) conds.push(`shipping to ${r.when.countries.join(", ")}`);
  if (r.picked.length || r.when.products.length) conds.push(`cart has ${r.picked.length ? r.picked.map((p) => p.title).join(", ") : `${r.when.products.length} products`}`);
  if (r.when.customer !== "any") conds.push(CUSTOMERS.find((c) => c.value === r.when.customer)!.label.toLowerCase());
  return `${verb}: ${what}s containing “${r.match || "…"}”${conds.length ? ` when ${conds.join(" and ")}` : " always"}`;
}
