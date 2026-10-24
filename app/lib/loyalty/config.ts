/**
 * Loyalty program settings (Growth and Pro; Pro only parts in `forPlan`): how members earn points, when points can be used and when they expire.
 * Stored per store in LoyaltyProgram.config (lib/loyalty/program.server.ts). Rewards, tiers, referrals,
 * emails and the storefront look are added to this same object by their own pages.
 * Shared by client and server; no dashes or first person in the texts.
 */
import { color, num, pick, str } from "../designs";
import type { PlanKey } from "../plans";
import { DEFAULT_EMAILS, EMAIL_KINDS, withEmailDefaults, type EmailKind, type EmailSettings } from "./emails";

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
/** What a referred friend gets on their first order: a percent or amount off, or free shipping. */
export const FRIEND_KINDS = ["percent", "amount", "shipping"] as const;
export type FriendKind = (typeof FRIEND_KINDS)[number];
/**
 * A creator or partner with their own discount code. Orders with it are counted as their sales; `commission`
 * is the percent of those sales the store owes them (only shown: the app pays nobody).
 */
export type Affiliate = { id: string; on: boolean; name: string; code: string; kind: FriendKind; value: number; minimum: number; commission: number };
export const MAX_AFFILIATES = 50;
/** Who sees a Points shop product: everyone (guests see it but can't get it), members with enough points, or members from `from` points. */
export const SHOP_SHOW = ["all", "afford", "from"] as const;
export type ShopShow = (typeof SHOP_SHOW)[number];
export const SHOP_SHOW_LABEL: Record<ShopShow, string> = { all: "Everyone", afford: "Members with enough points", from: "Members from a number of points" };
/**
 * A product in the Points shop (Omar, 2026-10-24): members get it for `points`, plus `money` per item (0 = points only,
 * always less than the price), with a one use code for that variant. `only`: it can't be bought with money;
 * `unlisted`: hidden from collections and search (only with `only`). `limit` per customer (0 = no limit).
 */
export type ShopItem = { id: string; on: boolean; product: { id: string; title: string; handle: string; image: string; price: number }; points: number; money: number; only: boolean; unlisted: boolean; show: ShopShow; from: number; limit: number };
export const MAX_SHOP_ITEMS = 50;
/** Affiliate codes: upper case letters, digits, _ and -, 3 to 30 characters. */
export const cleanCode = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30);

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
  reviewWay: "Write a product review",
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
  referTitle: "Refer a friend",
  referText: "Give a friend {friend} on their first order. You get {gift} when they order.",
  referLink: "Your link",
  shareText: "Here is {friend} for your first order:",
  refBanner: "A friend gave you {friend}. It is added at checkout.",
  offPercent: "{x}% off",
  offAmount: "{x} off",
  freeShip: "free shipping",
  creditGift: "{x} in store credit",
  referWay: "Refer a friend",
  email: "Email",
  shopTitle: "Shop with points",
  shopGet: "Get it for {price}",
  shopSignIn: "Sign in to get it with points",
  shopMore: "{n} more to get it",
  shopHave: "You have {have} of {n}",
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
    /** A product review (the app's Customer reviews once approved, or Judge.me once published); `photo` more with a photo. */
    review: { on: boolean; points: number; photo: number };
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
  /**
   * Refer a friend: each member's code gives a friend `friend` on their first order; the member gets `gift`
   * (points or store credit) once that order is paid, at most `monthly` times every 30 days (0 = no limit).
   */
  referral: { on: boolean; friend: { kind: FriendKind; value: number; minimum: number }; gift: { kind: "points" | "credit"; value: number }; monthly: number };
  affiliates: Affiliate[];
  /** The Points shop: products members get with points (codes valid `days` days, like the rewards'). */
  shop: { on: boolean; days: number; items: ShopItem[] };
  /** Emails to members (Loyalty → Emails; lib/loyalty/emails.ts). */
  emails: EmailSettings;
  /** Set by plan.server.ts `planned` only, never saved: the plan, for the monthly limits (plans.ts METERS). */
  usage?: { plan: PlanKey; ordersExtra: boolean; emailsExtra: boolean };
  /** The storefront widget: launcher, panel, points on product pages and in the cart. */
  widget: { position: "left" | "right"; accent: string; onAccent: string; radius: number; launcher: "text" | "icon"; productPoints: boolean; cartPoints: boolean; texts: WidgetTexts };
  /** The Rewards page (made by the app, shown by the Order & wishlist pages block). */
  page: { title: string; sub: string; how: { t: string; x: string }[]; faq: { q: string; a: string }[] };
  /** The store's other languages (Loyalty → Languages, languages.ts). */
  languages: LoyaltyLanguage[];
};

/**
 * Texts in one more store language. Shoppers see the language their store page is in, emails go in the language of
 * the customer's account; an empty text uses the main language's (the program's own settings).
 */
export type LoyaltyLanguage = {
  /** The store language's code, lower case: "fr", "pt-br". */
  code: string;
  texts: Partial<WidgetTexts>;
  unit: { one: string; many: string };
  /** The Rewards page; `how` and `faq` follow the main page's items by their place. */
  page: { title: string; sub: string; how: { t: string; x: string }[]; faq: { q: string; a: string }[] };
  /** Reward titles by reward id. */
  rewards: Record<string, string>;
  emails: Partial<Record<EmailKind, { subject: string; heading: string; body: string; button: string }>>;
  footer: string;
  unsubscribe: string;
};
export const MAX_LANGUAGES = 10;
const LANG_CODE = /^[a-z]{2,3}(-[a-z0-9]{2,4})?$/;

/** The languages, cleaned: known text keys only, each text cut to its main text's length, empties left out. */
export function cleanLanguages(raw: unknown): LoyaltyLanguage[] {
  const line = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\r\n]+/g, " ").slice(0, max).trim() : "");
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max).trim() : "");
  const seen = new Set<string>();
  const out: LoyaltyLanguage[] = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    const l = obj(x);
    const code = String(l.code ?? "").toLowerCase().trim();
    if (!LANG_CODE.test(code) || seen.has(code) || out.length >= MAX_LANGUAGES) continue;
    seen.add(code);
    const t = obj(l.texts), u = obj(l.unit), g = obj(l.page), rw = obj(l.rewards), em = obj(l.emails);
    const list = (v: unknown, n: number) => (Array.isArray(v) ? v.slice(0, n).map(obj) : []);
    out.push({
      code,
      texts: Object.fromEntries((Object.keys(WIDGET_TEXTS) as (keyof typeof WIDGET_TEXTS)[]).map((k) => [k, line(t[k], 200)]).filter(([, v]) => v)) as Partial<WidgetTexts>,
      unit: { one: line(u.one, 20), many: line(u.many, 20) },
      page: {
        title: line(g.title, 60),
        sub: line(g.sub, 200),
        how: list(g.how, 4).map((h) => ({ t: line(h.t, 40), x: line(h.x, 160) })),
        faq: list(g.faq, MAX_FAQ).map((f) => ({ q: line(f.q, 160), a: text(f.a, 600) })),
      },
      rewards: Object.fromEntries(Object.entries(rw).filter(([id]) => /^[a-z0-9]{1,12}$/i.test(id)).slice(0, 50).map(([id, v]) => [id, line(v, 80)]).filter(([, v]) => v)),
      emails: Object.fromEntries(
        EMAIL_KINDS.map((k) => {
          const e = obj(em[k]);
          return [k, { subject: line(e.subject, 120), heading: line(e.heading, 120), body: text(e.body, 600), button: line(e.button, 40) }] as const;
        }).filter(([, e]) => e.subject || e.heading || e.body || e.button),
      ),
      footer: line(l.footer, 300),
      unsubscribe: line(l.unsubscribe, 40),
    });
  }
  return out;
}

/** Only the texts a language fills in, for the storefront copy ("lg"): the widget's words, points name, page, rewards. */
type StorefrontPage = { title?: string; sub?: string; how: { t: string; x: string }[]; faq: { q: string; a: string }[] };
function storefrontLanguages(c: LoyaltyConfig) {
  return Object.fromEntries(
    c.languages.map((l) => [
      l.code,
      {
        t: l.texts,
        u: l.unit.one || l.unit.many ? { one: l.unit.one || c.unit.one, many: l.unit.many || c.unit.many } : null,
        pg: {
          ...(l.page.title ? { title: l.page.title } : {}),
          ...(l.page.sub ? { sub: l.page.sub } : {}),
          how: c.page.how.map((h, i) => ({ t: l.page.how[i]?.t || h.t, x: l.page.how[i]?.x || h.x })),
          faq: c.page.faq.map((f, i) => ({ q: l.page.faq[i]?.q || f.q, a: l.page.faq[i]?.a || f.a })),
        } as StorefrontPage,
        rw: l.rewards,
      },
    ]),
  );
}

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
    review: { on: false, points: 50, photo: 50 },
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
  referral: { on: false, friend: { kind: "percent", value: 10, minimum: 0 }, gift: { kind: "points", value: 200 }, monthly: 10 },
  affiliates: [],
  shop: { on: false, days: 30, items: [] },
  emails: DEFAULT_EMAILS,
  widget: { position: "right", accent: "#111111", onAccent: "#ffffff", radius: 18, launcher: "text", productPoints: true, cartPoints: true, texts: { ...WIDGET_TEXTS } },
  page: DEFAULT_PAGE,
  languages: [],
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

const money = (v: unknown, min: number) => Math.max(min, Math.min(100000, Math.round((Number(v) || 0) * 100) / 100));
/** A friend's discount value: percent 1 to 100, an amount, nothing for free shipping. */
const friendValue = (kind: FriendKind, v: unknown, d: number) => (kind === "percent" ? num(v, 1, 100, d) : kind === "amount" ? money(v, 0.01) : 0);

function cleanReferral(raw: unknown, d: LoyaltyConfig["referral"]): LoyaltyConfig["referral"] {
  const r = obj(raw), f = obj(r.friend), g = obj(r.gift);
  const kind = pick(f.kind, FRIEND_KINDS, d.friend.kind);
  const gift = pick(g.kind, ["points", "credit"] as const, d.gift.kind);
  return {
    on: bool(r.on, d.on),
    friend: { kind, value: friendValue(kind, f.value ?? d.friend.value, d.friend.value), minimum: money(f.minimum, 0) },
    gift: { kind: gift, value: gift === "points" ? num(g.value, 1, 100000, d.gift.value) : money(g.value ?? 5, 0.01) },
    monthly: num(r.monthly, 0, 1000, d.monthly),
  };
}

function cleanAffiliates(raw: unknown): Affiliate[] {
  const list = (Array.isArray(raw) ? raw : []).slice(0, MAX_AFFILIATES).flatMap((x, i) => {
    const o = obj(x);
    const code = cleanCode(o.code);
    if (code.length < 3) return [];
    const kind = pick(o.kind, FRIEND_KINDS, "percent");
    return [{ id: idOk(o.id, i, "a"), on: bool(o.on, true), name: str(o.name, "", 60).trim() || code, code, kind, value: friendValue(kind, o.value, 10), minimum: money(o.minimum, 0), commission: Math.max(0, Math.min(100, Math.round((Number(o.commission) || 0) * 100) / 100)) }];
  });
  // Ids and codes unique (the first one wins).
  return list.filter((x, i, a) => a.findIndex((y) => y.id === x.id || y.code === x.code) === i);
}

function cleanShop(raw: unknown, d: LoyaltyConfig["shop"]): LoyaltyConfig["shop"] {
  const r = obj(raw);
  const items = (Array.isArray(r.items) ? r.items : []).slice(0, MAX_SHOP_ITEMS).flatMap((x, i): ShopItem[] => {
    const o = obj(x), p = obj(o.product);
    if (typeof p.id !== "string" || !/^gid:\/\/shopify\/Product\/\d+$/.test(p.id)) return [];
    const price = money(p.price, 0);
    const points = num(o.points, 1, 1_000_000, 1000);
    const m = money(o.money, 0);
    const image = str(p.image, "", 500).trim();
    const only = bool(o.only, false);
    return [{
      id: idOk(o.id, i, "s"),
      on: bool(o.on, true),
      product: { id: p.id, title: str(p.title, "", 120).trim() || "Product", handle: str(p.handle, "", 255).trim(), image: /^https:\/\/\S+$/.test(image) ? image : "", price },
      points,
      // The money part is always less than the price (else the code would take nothing off).
      money: m < price ? m : 0,
      only,
      unlisted: only && bool(o.unlisted, false),
      show: pick(o.show, SHOP_SHOW, "all"),
      from: num(o.from, 1, points, Math.max(1, Math.floor(points / 2))),
      limit: num(o.limit, 0, 1000, 0),
    }];
  });
  // Ids and products unique (the first one wins).
  return { on: bool(r.on, d.on), days: num(r.days, 1, 365, d.days), items: items.filter((x, i, a) => a.findIndex((y) => y.id === x.id || y.product.id === x.product.id) === i) };
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
      review: { on: bool(obj(e.review).on, d.earn.review.on), points: num(obj(e.review).points, 0, 100000, d.earn.review.points), photo: num(obj(e.review).photo, 0, 100000, d.earn.review.photo) },
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
    referral: cleanReferral(r.referral, d.referral),
    affiliates: cleanAffiliates(r.affiliates),
    shop: cleanShop(r.shop, d.shop),
    emails: withEmailDefaults(r.emails),
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
    languages: cleanLanguages(r.languages),
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
    rv: c.earn.review.on ? c.earn.review.points : 0,
    ti: c.tiers.on ? { b: c.tiers.basis, l: c.tiers.list.map((x) => ({ id: x.id, n: x.name, m: x.min, x: x.multiplier })) } : null,
    rf: c.referral.on ? { k: c.referral.friend.kind, v: c.referral.friend.value, m: c.referral.friend.minimum, g: c.referral.gift.kind, gv: c.referral.gift.value } : null,
    ca: c.campaigns.map((x) => ({ n: x.name, x: x.multiplier, f: x.from, t: x.to })),
    w: { pos: c.widget.position, a: c.widget.accent, oa: c.widget.onAccent, r: c.widget.radius, l: c.widget.launcher, pp: c.widget.productPoints, cp: c.widget.cartPoints },
    t: c.widget.texts,
    pg: c.page,
    lg: c.languages.length ? storefrontLanguages(c) : null,
    // The Points shop as everyone sees it; members get their own list from the app proxy (`shopFor`).
    ...(c.shop.on ? { ps: shopFor(c, null) } : {}),
  };
}

/** The storefront copy of a Points shop product. */
const shopItem = (x: ShopItem) => ({ id: x.id, t: x.product.title, h: x.product.handle, i: x.product.image, p: x.points, m: x.money, pid: x.product.id.split("/").pop(), o: x.only });

/** May a shopper with these points (null: not a member) see this product? */
export const canSeeItem = (x: ShopItem, points: number | null) => x.on && (x.show === "all" || (points !== null && points >= (x.show === "afford" ? x.points : x.from)));

/** The Points shop products this shopper sees: "all" ones for everyone, the others only for members with the points. */
export const shopFor = (c: LoyaltyConfig, points: number | null) => (c.shop.on ? c.shop.items.filter((x) => canSeeItem(x, points)).map(shopItem) : []);

/**
 * Growth has the loyalty program within its limits (plans.ts loyaltyOrders, loyaltyEmails); these parts are
 * Pro only (Omar, 2026-10-22). Growth keeps the store's Pro settings saved but runs without them, so they come
 * back on an upgrade: affiliate codes are turned off, not deleted.
 */
export const LOYALTY_PRO = ["VIP tiers", "bonus campaigns", "product and collection rules", "cashback", "affiliate links", "Klaviyo, Omnisend, Judge.me and Shopify Flow", "sending from your own address"] as const;
export function forPlan(c: LoyaltyConfig, pro: boolean): LoyaltyConfig {
  if (pro) return c;
  return {
    ...c,
    tiers: { ...c.tiers, on: false },
    campaigns: [],
    productRules: [],
    cashback: { ...c.cashback, on: false },
    affiliates: c.affiliates.map((x) => ({ ...x, on: false })),
    emails: { ...c.emails, sender: { email: "", name: "" } },
  };
}

/** "1 point" / "250 points". */
export const pointsLabel = (c: LoyaltyConfig, n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? c.unit.one : c.unit.many}`;

/** The customer tags that keep a customer out of the program. */
export const excludedTags = (c: LoyaltyConfig) => c.excludeTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
