/**
 * Loyalty program settings (Pro): how members earn points, when points can be used and when they expire.
 * Stored per store in LoyaltyProgram.config (lib/loyalty/program.server.ts). Rewards, tiers, referrals,
 * emails and the storefront look are added to this same object by their own pages.
 * Shared by client and server; no dashes or first person in the texts.
 */
import { color, num, pick, str } from "../designs";

export const REWARD_KINDS = ["amount", "percent", "shipping", "product", "credit"] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];
export const REWARD_KIND_LABEL: Record<RewardKind, string> = { amount: "Amount off the order", percent: "Percent off the order", shipping: "Free shipping", product: "A free product", credit: "Store credit" };
/**
 * A reward members spend points on. Codes are one use Shopify discount codes for that customer only, valid
 * `days` days; store credit goes straight to the customer's store credit (used at checkout by itself).
 */
export type Reward = { id: string; on: boolean; kind: RewardKind; title: string; points: number; value: number; minimum: number; days: number; product: { id: string; title: string; price: number } | null };
export const MAX_REWARDS = 12;

/** Every word of the storefront widget (the look editor and languages come later on the same object). */
export const WIDGET_TEXTS = {
  launcher: "Rewards",
  title: "Rewards",
  guestTitle: "Join and earn rewards",
  guestText: "Earn points on every order and spend them on rewards.",
  join: "Create an account",
  signIn: "Sign in",
  joinNow: "Join the program",
  have: "You have",
  pending: "{n} more on the way",
  earn: "Ways to earn",
  rewards: "Rewards",
  history: "Your history",
  get: "Get it",
  more: "{n} more to go",
  code: "Your code",
  copy: "Copy",
  copied: "Copied",
  apply: "Use it now",
  applied: "Added to your cart",
  credit: "Added to your store credit. It is used at checkout.",
  product: "Earn {n} with this",
  cart: "Earn {n} with this order",
  earned: "You earned {n}",
  orderWay: "Every order",
  signupWay: "Create an account",
  firstWay: "Your first order",
  error: "Something went wrong. Please try again.",
} as const;
export type WidgetTexts = Record<keyof typeof WIDGET_TEXTS, string>;

export type LoyaltyConfig = {
  /** What points are called on the store ("point" / "points"). */
  unit: { one: string; many: string };
  /** Customers join by themselves with their first order or account (on), or only from the widget's Join button (off). */
  autoJoin: boolean;
  /** Customers with one of these tags can't earn or redeem (for example wholesale). Comma separated. */
  excludeTags: string;
  earn: {
    /** Points per 1 unit of the store's currency on paid orders. */
    order: { on: boolean; perUnit: number; shipping: boolean; taxes: boolean };
    /** A customer account is created (or activated). */
    signup: { on: boolean; points: number };
    /** Extra points on the member's first order. */
    firstOrder: { on: boolean; points: number };
  };
  /** Days before order points can be used (returns window). 0 = at once. */
  pendingDays: number;
  /** Points expire after this many days without a new order or redemption. */
  expiry: { on: boolean; days: number };
  /** Earn store credit (a percent of each order) instead of points. */
  cashback: { on: boolean; percent: number };
  rewards: Reward[];
  /** The storefront widget: launcher, panel, points on product pages and in the cart. */
  widget: { position: "left" | "right"; accent: string; onAccent: string; radius: number; launcher: "text" | "icon"; productPoints: boolean; cartPoints: boolean; texts: WidgetTexts };
  /** The Rewards page (made by the app, shown by the Order & wishlist pages block). */
  page: { title: string; sub: string; how: { t: string; x: string }[]; faq: { q: string; a: string }[] };
};

export const MAX_FAQ = 8;
export const DEFAULT_PAGE: LoyaltyConfig["page"] = {
  title: "Rewards",
  sub: "Earn points on every order and turn them into rewards.",
  how: [
    { t: "Join", x: "Create an account to start earning." },
    { t: "Earn", x: "Get points on every order and more." },
    { t: "Spend", x: "Turn your points into rewards at checkout." },
  ],
  faq: [
    { q: "How do I earn points?", a: "You earn points on every paid order, and more for the things listed under Ways to earn." },
    { q: "When can I use my points?", a: "Points from an order can be used once the order can no longer be returned." },
    { q: "How do I use a reward?", a: "Open Rewards, choose a reward and use the code at checkout. Store credit is used at checkout by itself." },
  ],
};

type Patch = Partial<Pick<LoyaltyConfig["widget"], "accent" | "onAccent" | "radius" | "launcher">>;
/** Templates for the widget's look (Loyalty → Look). */
export const LOYALTY_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "classic", title: "Classic black", patch: { accent: "#111111", onAccent: "#ffffff", radius: 18, launcher: "text" } },
  { key: "soft", title: "Soft sand", patch: { accent: "#efe6da", onAccent: "#3b2a1a", radius: 22, launcher: "text" } },
  { key: "bold", title: "Bold blue", patch: { accent: "#2563eb", onAccent: "#ffffff", radius: 14, launcher: "text" } },
  { key: "gold", title: "Gold", patch: { accent: "#9a6b12", onAccent: "#ffffff", radius: 10, launcher: "text" } },
  { key: "icon", title: "Icon only", patch: { accent: "#111111", onAccent: "#ffffff", radius: 18, launcher: "icon" } },
];
export const applyLoyaltyPreset = (c: LoyaltyConfig, key: string): LoyaltyConfig => {
  const p = LOYALTY_PRESETS.find((x) => x.key === key);
  return p ? { ...c, widget: { ...c.widget, ...p.patch } } : c;
};

export const DEFAULT_LOYALTY: LoyaltyConfig = {
  unit: { one: "point", many: "points" },
  autoJoin: true,
  excludeTags: "",
  earn: {
    order: { on: true, perUnit: 1, shipping: false, taxes: false },
    signup: { on: true, points: 100 },
    firstOrder: { on: false, points: 50 },
  },
  pendingDays: 14,
  expiry: { on: false, days: 365 },
  cashback: { on: false, percent: 5 },
  rewards: [
    { id: "r1", on: true, kind: "percent", title: "10% off your order", points: 500, value: 10, minimum: 0, days: 30, product: null },
    { id: "r2", on: true, kind: "shipping", title: "Free shipping", points: 300, value: 0, minimum: 0, days: 30, product: null },
  ],
  widget: { position: "right", accent: "#111111", onAccent: "#ffffff", radius: 18, launcher: "text", productPoints: true, cartPoints: true, texts: { ...WIDGET_TEXTS } },
  page: DEFAULT_PAGE,
};

function cleanReward(raw: unknown, i: number): Reward | null {
  const r = obj(raw);
  const kind = pick(r.kind, REWARD_KINDS, "amount");
  const p = obj(r.product);
  const product = kind === "product" && typeof p.id === "string" && /^gid:\/\/shopify\/Product\/\d+$/.test(p.id) ? { id: p.id, title: str(p.title, "Product", 120), price: Math.max(0, Math.round((Number(p.price) || 0) * 100) / 100) } : null;
  if (kind === "product" && !product) return null;
  const value = kind === "percent" ? num(r.value, 1, 100, 10) : kind === "shipping" || kind === "product" ? 0 : Math.max(0.01, Math.min(100000, Math.round((Number(r.value) || 0) * 100) / 100));
  return {
    id: /^[a-z0-9]{1,12}$/i.test(String(r.id)) ? String(r.id) : `r${i + 1}`,
    on: bool(r.on, true),
    kind,
    title: str(r.title, "", 60).trim() || REWARD_KIND_LABEL[kind],
    points: num(r.points, 1, 1_000_000, 500),
    value,
    minimum: Math.max(0, Math.min(100000, Math.round((Number(r.minimum) || 0) * 100) / 100)),
    days: num(r.days, 1, 365, 30),
    product,
  };
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
/** Points per currency unit can be a fraction (0.5 = 1 point per 2 units). */
const rate = (v: unknown, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n * 100) / 100 : d;
};

export function withLoyaltyDefaults(raw: unknown): LoyaltyConfig {
  const r = obj(raw), d = DEFAULT_LOYALTY;
  const u = obj(r.unit), e = obj(r.earn), o = obj(e.order), s = obj(e.signup), f = obj(e.firstOrder), x = obj(r.expiry), c = obj(r.cashback);
  return {
    unit: { one: str(u.one, d.unit.one, 20) || d.unit.one, many: str(u.many, d.unit.many, 20) || d.unit.many },
    autoJoin: bool(r.autoJoin, d.autoJoin),
    excludeTags: str(r.excludeTags, d.excludeTags, 300),
    earn: {
      order: { on: bool(o.on, d.earn.order.on), perUnit: rate(o.perUnit, d.earn.order.perUnit), shipping: bool(o.shipping, d.earn.order.shipping), taxes: bool(o.taxes, d.earn.order.taxes) },
      signup: { on: bool(s.on, d.earn.signup.on), points: num(s.points, 0, 100000, d.earn.signup.points) },
      firstOrder: { on: bool(f.on, d.earn.firstOrder.on), points: num(f.points, 0, 100000, d.earn.firstOrder.points) },
    },
    pendingDays: num(r.pendingDays, 0, 90, d.pendingDays),
    expiry: { on: bool(x.on, d.expiry.on), days: num(x.days, 30, 3650, d.expiry.days) },
    cashback: { on: bool(c.on, d.cashback.on), percent: num(c.percent, 1, 50, d.cashback.percent) },
    rewards: Array.isArray(r.rewards)
      ? r.rewards.slice(0, MAX_REWARDS).map(cleanReward).filter((x): x is Reward => !!x).filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i)
      : d.rewards,
    widget: (() => {
      const w = obj(r.widget), t = obj(w.texts);
      return {
        position: pick(w.position, ["left", "right"] as const, d.widget.position),
        accent: color(w.accent, d.widget.accent),
        onAccent: color(w.onAccent, d.widget.onAccent),
        radius: num(w.radius, 0, 28, d.widget.radius),
        launcher: pick(w.launcher, ["text", "icon"] as const, d.widget.launcher),
        productPoints: bool(w.productPoints, d.widget.productPoints),
        cartPoints: bool(w.cartPoints, d.widget.cartPoints),
        texts: Object.fromEntries((Object.keys(WIDGET_TEXTS) as (keyof typeof WIDGET_TEXTS)[]).map((k) => [k, str(t[k], WIDGET_TEXTS[k], 200).trim() || WIDGET_TEXTS[k]])) as WidgetTexts,
      };
    })(),
    page: (() => {
      const g = obj(r.page);
      const how = Array.isArray(g.how) ? g.how.slice(0, 4).map((x) => ({ t: str(obj(x).t, "", 40).trim(), x: str(obj(x).x, "", 160).trim() })).filter((x) => x.t) : DEFAULT_PAGE.how;
      const faq = Array.isArray(g.faq) ? g.faq.slice(0, MAX_FAQ).map((x) => ({ q: str(obj(x).q, "", 160).trim(), a: str(obj(x).a, "", 600).trim() })).filter((x) => x.q && x.a) : DEFAULT_PAGE.faq;
      return { title: str(g.title, DEFAULT_PAGE.title, 60).trim() || DEFAULT_PAGE.title, sub: str(g.sub, DEFAULT_PAGE.sub, 200), how, faq };
    })(),
  };
}

/** What the storefront widget gets (theme embed JSON, $app:cro_design "loyalty"): no member data, only the program. */
export function toStorefrontLoyalty(c: LoyaltyConfig, on: boolean) {
  return {
    on,
    u: c.unit,
    per: c.earn.order.on ? c.earn.order.perUnit : 0,
    sh: c.earn.order.shipping,
    tx: c.earn.order.taxes,
    su: c.earn.signup.on ? c.earn.signup.points : 0,
    fo: c.earn.firstOrder.on ? c.earn.firstOrder.points : 0,
    rw: c.rewards.filter((r) => r.on).map((r) => ({ id: r.id, t: r.title, p: r.points, k: r.kind })),
    w: { pos: c.widget.position, a: c.widget.accent, oa: c.widget.onAccent, r: c.widget.radius, l: c.widget.launcher, pp: c.widget.productPoints, cp: c.widget.cartPoints },
    t: c.widget.texts,
    pg: c.page,
  };
}

/** "1 point" / "250 points". */
export const pointsLabel = (c: LoyaltyConfig, n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? c.unit.one : c.unit.many}`;

/** The customer tags that keep a customer out of the program. */
export const excludedTags = (c: LoyaltyConfig) => c.excludeTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
