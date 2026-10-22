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
export type Reward = { id: string; on: boolean; kind: RewardKind; title: string; points: number; value: number; minimum: number; days: number; product: { id: string; title: string; price: number } | null; /** Only these VIP tiers can get it (empty = everyone). */ tiers: string[] };

/** A VIP tier: reached at `min` points earned (or money spent); earns `multiplier` times the points; `bonus` points once on reaching it. */
export type Tier = { id: string; name: string; min: number; multiplier: number; bonus: number };
export const MAX_TIERS = 8;
/** A limited time campaign: orders placed between `from` and `to` (dates, inclusive) earn `multiplier` times the points. */
export type Campaign = { id: string; name: string; multiplier: number; from: string; to: string };
export const MAX_CAMPAIGNS = 10;
/** Products or collections with their own rate (points per 1 of the currency; 0 = earn nothing). The first rule that matches wins. */
export type ProductRule = { id: string; kind: "products" | "collections"; items: { id: string; title: string }[]; perUnit: number };
export const MAX_RULES = 10;
export const SOCIAL_NETWORKS = ["instagram", "tiktok", "facebook", "x", "youtube"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];
export const SOCIAL_LABEL: Record<SocialNetwork, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", x: "X", youtube: "YouTube" };
export const MAX_REWARDS = 12;

/** Every word of the storefront widget (the look editor and languages come later on the same object). */
export const WIDGET_TEXTS = {
  launcher: "Rewards",
  title: "Rewards",
  guestTitle: "Join and earn rewards",
  guestText: "Earn points on every order and spend them on rewards.",
  join: "Create an account",
  tier: "{tier} member",
  nextTier: "{n} to {tier}",
  birthdayWay: "Your birthday",
  birthdayAsk: "Add your birthday",
  birthdaySave: "Save",
  birthdayDone: "Birthday saved",
  followWay: "Follow us on {network}",
  follow: "Follow",
  campaign: "{x} points until {date}",
  tierOnly: "For {tiers} members",
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
    /** Points on the member's birthday (they add it once in the widget). */
    birthday: { on: boolean; points: number };
    /** Points for following the store, once per network (the shopper's word: networks can't confirm a follow). */
    social: { on: boolean; points: number; links: { network: SocialNetwork; url: string }[] };
  };
  /** VIP tiers by points earned or money spent, over the member's lifetime or the last 12 months. */
  tiers: { on: boolean; basis: "points" | "spent"; period: "lifetime" | "year"; tag: boolean; list: Tier[] };
  campaigns: Campaign[];
  productRules: ProductRule[];
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
    birthday: { on: false, points: 200 },
    social: { on: false, points: 50, links: [] },
  },
  tiers: {
    on: false,
    basis: "points",
    period: "lifetime",
    tag: true,
    list: [
      { id: "t1", name: "Bronze", min: 0, multiplier: 1, bonus: 0 },
      { id: "t2", name: "Silver", min: 500, multiplier: 1.25, bonus: 50 },
      { id: "t3", name: "Gold", min: 1500, multiplier: 1.5, bonus: 150 },
    ],
  },
  campaigns: [],
  productRules: [],
  pendingDays: 14,
  expiry: { on: false, days: 365 },
  cashback: { on: false, percent: 5 },
  rewards: [
    { id: "r1", on: true, kind: "percent", title: "10% off your order", points: 500, value: 10, minimum: 0, days: 30, product: null, tiers: [] },
    { id: "r2", on: true, kind: "shipping", title: "Free shipping", points: 300, value: 0, minimum: 0, days: 30, product: null, tiers: [] },
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
    tiers: Array.isArray(r.tiers) ? r.tiers.map(String).filter((x) => /^[a-z0-9]{1,12}$/i.test(x)).slice(0, MAX_TIERS) : [],
  };
}

const idOk = (v: unknown, i: number, prefix: string) => (/^[a-z0-9]{1,12}$/i.test(String(v)) ? String(v) : `${prefix}${i + 1}`);
const day = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : "");
const mult = (v: unknown, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 10 ? Math.round(n * 100) / 100 : d;
};
const gidList = (v: unknown, type: "Product" | "Collection") =>
  (Array.isArray(v) ? v : []).slice(0, 50).flatMap((x) => {
    const o = obj(x);
    return typeof o.id === "string" && new RegExp(`^gid://shopify/${type}/\\d+$`).test(o.id) ? [{ id: o.id, title: str(o.title, type, 120) }] : [];
  });

function cleanTiers(raw: unknown, d: LoyaltyConfig["tiers"]): LoyaltyConfig["tiers"] {
  const t = obj(raw);
  const list = Array.isArray(t.list)
    ? t.list.slice(0, MAX_TIERS).map((x, i) => {
        const o = obj(x);
        return { id: idOk(o.id, i, "t"), name: str(o.name, "", 30).trim() || `Tier ${i + 1}`, min: Math.max(0, Math.min(10_000_000, Math.round(Number(o.min) || 0))), multiplier: mult(o.multiplier, 1), bonus: num(o.bonus, 0, 100000, 0) };
      })
    : d.list;
  // Sorted by what they need, ids unique, the first always open to everyone.
  const sorted = list.filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).sort((a, b) => a.min - b.min);
  if (sorted.length) sorted[0] = { ...sorted[0], min: 0 };
  return { on: bool(t.on, d.on), basis: pick(t.basis, ["points", "spent"] as const, d.basis), period: pick(t.period, ["lifetime", "year"] as const, d.period), tag: bool(t.tag, d.tag), list: sorted };
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
      birthday: { on: bool(obj(e.birthday).on, d.earn.birthday.on), points: num(obj(e.birthday).points, 0, 100000, d.earn.birthday.points) },
      social: {
        on: bool(obj(e.social).on, d.earn.social.on),
        points: num(obj(e.social).points, 0, 100000, d.earn.social.points),
        links: (Array.isArray(obj(e.social).links) ? (obj(e.social).links as unknown[]) : []).slice(0, SOCIAL_NETWORKS.length).flatMap((x) => {
          const o = obj(x);
          const network = pick(o.network, SOCIAL_NETWORKS, "instagram");
          const url = str(o.url, "", 300).trim();
          return /^https:\/\/\S+$/.test(url) ? [{ network, url }] : [];
        }).filter((x, i, a) => a.findIndex((y) => y.network === x.network) === i),
      },
    },
    tiers: cleanTiers(r.tiers, d.tiers),
    campaigns: (Array.isArray(r.campaigns) ? r.campaigns : []).slice(0, MAX_CAMPAIGNS).flatMap((x, i) => {
      const o = obj(x);
      const from = day(o.from), to = day(o.to);
      return from && to && from <= to ? [{ id: idOk(o.id, i, "c"), name: str(o.name, "", 40).trim() || "Bonus points", multiplier: mult(o.multiplier, 2), from, to }] : [];
    }),
    productRules: (Array.isArray(r.productRules) ? r.productRules : []).slice(0, MAX_RULES).flatMap((x, i) => {
      const o = obj(x);
      const kind = pick(o.kind, ["products", "collections"] as const, "products");
      const items = gidList(o.items, kind === "products" ? "Product" : "Collection");
      return items.length ? [{ id: idOk(o.id, i, "p"), kind, items, perUnit: rate(o.perUnit, 0) }] : [];
    }),
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
    rw: c.rewards.filter((r) => r.on).map((r) => ({ id: r.id, t: r.title, p: r.points, k: r.kind, tr: r.tiers })),
    bd: c.earn.birthday.on ? c.earn.birthday.points : 0,
    so: c.earn.social.on ? { p: c.earn.social.points, l: c.earn.social.links } : null,
    ti: c.tiers.on ? { b: c.tiers.basis, l: c.tiers.list.map((x) => ({ id: x.id, n: x.name, m: x.min, x: x.multiplier })) } : null,
    ca: c.campaigns.map((x) => ({ n: x.name, x: x.multiplier, f: x.from, t: x.to })),
    w: { pos: c.widget.position, a: c.widget.accent, oa: c.widget.onAccent, r: c.widget.radius, l: c.widget.launcher, pp: c.widget.productPoints, cp: c.widget.cartPoints },
    t: c.widget.texts,
    pg: c.page,
  };
}

/** "1 point" / "250 points". */
export const pointsLabel = (c: LoyaltyConfig, n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? c.unit.one : c.unit.many}`;

/** The customer tags that keep a customer out of the program. */
export const excludedTags = (c: LoyaltyConfig) => c.excludeTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
