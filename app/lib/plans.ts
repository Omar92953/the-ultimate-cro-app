/**
 * Plans and what each one includes — the ONLY place prices, trials and limits live.
 * Change a number here and every page (Home's plan cards, upgrade cards, limit messages) follows.
 *
 * Prices and the revenue limits were confirmed with Omar on 2026-10-14. They must match the plans
 * created in the Partner Dashboard (docs/billing.md).
 *
 * Billing runs on Shopify App Pricing: the plans themselves are created in the Partner Dashboard,
 * Shopify hosts the plan selection page and creates the subscription. The app never charges anyone;
 * it only reads which plan a shop is on (billing.server.ts) and shows or hides features.
 * `handle` must equal the plan's handle in the Partner Dashboard (Shopify's `plan_handle`).
 *
 * Shared by client and server. Imports only types, so `npm run test:app` can load it directly.
 */
import type { FeatureKey } from "./catalog";

export type PlanKey = "free" | "starter" | "growth" | "pro";
export const PLAN_KEYS: PlanKey[] = ["free", "starter", "growth", "pro"];

/**
 * Counted limits. `null` = unlimited. Every plan also gets a small taste of the next plan
 * (Omar: "so people can test everything"): Free tries 1 Starter feature and gets 3 checkout rules,
 * Starter gets 6 checkout rules and per-offer results for its top 3 offers, and so on.
 */
export type Limits = {
  /** Offers switched on at the same time, any type: upsells, cross-sells, bundles, bundle products, deals, the after-purchase offer. */
  offerSlots: number | null;
  /** Checkout rules switched on: payment + delivery + order limits together. */
  checkoutRules: number | null;
  /** Countdown timers (header, footer, home, product, cart: one place each). */
  countdownPlaces: number | null;
  /** Thank-you page modules switched on. */
  thankYouModules: number | null;
  /** Features of the next plan the store can use now (it picks which; plan_state.trial). */
  trialFeatures: number;
  /** Offers with their own results on Analytics (the rest are shown as a teaser). */
  offerStats: number | null;
  /** Styles per section (Design 1…5 on a design page). */
  designsPerSection: number | null;
  /**
   * Revenue the app's offers and widgets added in the last 30 days, in US dollars (the store's
   * currency is converted with USD_RATE). Soft: going over only shows a banner, nothing switches off.
   */
  monthlyRevenue: number | null;
};
export type LimitKey = keyof Omit<Limits, "trialFeatures">;

export type Plan = {
  key: PlanKey;
  /** Shown in the app. */
  name: string;
  /** The plan's handle in the Partner Dashboard (Shopify App Pricing `plan_handle`). */
  handle: string;
  /** What the plan is for, in one line (leads its card). */
  job: string;
  /** USD. */
  monthly: number;
  yearly: number;
  trialDays: number;
  limits: Limits;
  /** What the plan includes, short lines for its card (Plans page, upgrade cards). */
  highlights: string[];
  /** The plan card's badge, e.g. "Popular". */
  badge?: string;
};

/** Shown on every paid plan (Shopify billing: merchants change or cancel from the plan page). */
export const GUARANTEE = "Cancel or change your plan anytime. No contract.";

export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: "free",
    name: "Free",
    handle: "free",
    job: "Try everything: a little of every tool, free forever.",
    monthly: 0,
    yearly: 0,
    trialDays: 0,
    limits: { offerSlots: 3, checkoutRules: 3, countdownPlaces: 1, thankYouModules: 2, trialFeatures: 1, offerStats: 1, designsPerSection: 1, monthlyRevenue: 100 },
    highlights: ["3 offers on at once", "Cart drawer and announcement bars", "Reviews, FAQ and wishlist", "3 checkout rules", "Try 1 Starter feature free"],
  },
  starter: {
    key: "starter",
    name: "Starter",
    handle: "starter",
    job: "Sell more per order: every offer, bundle and storefront tool.",
    monthly: 5.99,
    yearly: 59,
    trialDays: 14,
    limits: { offerSlots: null, checkoutRules: 6, countdownPlaces: null, thankYouModules: null, trialFeatures: 0, offerStats: 3, designsPerSection: 5, monthlyRevenue: 500 },
    highlights: ["Unlimited offers", "Every bundle and discount type", "Add-ons and personalization", "Full cart drawer", "Quiz, carousels and store pages", "5 styles per section"],
  },
  growth: {
    key: "growth",
    name: "Growth",
    handle: "growth",
    job: "Convert and optimise: checkout control and the numbers behind every offer.",
    monthly: 14.99,
    yearly: 149,
    trialDays: 14,
    limits: { offerSlots: null, checkoutRules: null, countdownPlaces: null, thankYouModules: null, trialFeatures: 0, offerStats: null, designsPerSection: 5, monthlyRevenue: 2000 },
    badge: "Popular",
    highlights: ["Everything in Starter", "Unlimited checkout rules", "Results for every offer", "Holdout test", "Features built on request"],
  },
  pro: {
    key: "pro",
    name: "Pro",
    handle: "pro",
    job: "Priority: no limits, and we're first in line for you.",
    monthly: 24.99,
    yearly: 249,
    trialDays: 14,
    limits: { offerSlots: null, checkoutRules: null, countdownPlaces: null, thankYouModules: null, trialFeatures: 0, offerStats: null, designsPerSection: 5, monthlyRevenue: null },
    highlights: ["Everything in Growth", "Your requests built first", "Priority support"],
  },
};

/**
 * The lowest plan that unlocks each feature (every key of FEATURES in catalog.ts must be here —
 * the type checks it). Features with a counted limit (upsell, bundles…) are open on Free and
 * capped by `limits` instead. PROPOSAL — confirm with Omar.
 */
export const FEATURE_PLAN: Record<FeatureKey, PlanKey> = {
  // Offers (Free: within the offer slots)
  upsell: "free",
  cross_sell: "free",
  bundles: "free",
  discounts: "free",
  addons: "starter",
  personalize: "starter",
  // Cart
  cart_tools: "free",
  cart_offers: "free",
  cart_extras: "starter",
  // Storefront
  reviews: "free",
  product_reviews: "free",
  sales_pop: "free",
  trust_badges: "free",
  logos: "free",
  announcements: "free",
  countdown: "free",
  shipping_bar: "free",
  stock_urgency: "free",
  sticky_atc: "free",
  quick_add: "free",
  delivery: "starter",
  stock: "free",
  wishlist: "free",
  hero: "free",
  image_carousel: "starter",
  videos: "starter",
  faq: "free",
  quiz: "starter",
  collection_pills: "starter",
  header: "starter",
  footer: "starter",
  contact: "starter",
  track: "starter",
  returns: "starter",
  // Checkout (Free: within the checkout-rule and thank-you limits)
  payment_rules: "free",
  delivery_rules: "free",
  order_limits: "free",
  thank_you: "free",
  post_purchase: "free",
};

/** Things inside a page that need a plan (the page itself stays open). */
export const EXTRA_PLAN = {
  /** "Request a feature" on Home: the merchant asks, we build it for them. */
  featureRequests: "growth",
  holdoutTest: "growth",
  /** The cart drawer's express checkout, best-discount and share-cart modules. */
  cartDrawerPro: "starter",
  prioritySupport: "pro",
  requestsFirst: "pro",
} satisfies Record<string, PlanKey>;

/** Referral reward text and link. PROPOSAL — the referral reward is Omar's decision. */
export const REFERRAL = {
  /** Shown in Settings only once rewards are really applied (App Store review: no promises the app can't keep). */
  live: false,
  reward: "1 free month for you and the store you refer",
  /** TODO(Omar): how rewards are applied isn't built yet — likely a private plan or a discount in
   * Shopify App Pricing (Partner Dashboard), applied by hand or with Shopify CLI when a referred
   * store subscribes. Codes are only generated and stored for now (referral.server.ts). */
  /** The App Store listing (confirm the handle once the listing is live). */
  listingUrl: "https://apps.shopify.com/cro-toolbox",
  howItWorks: "Share your link. When a store installs CRO Toolbox with it and picks a paid plan, you both get the reward.",
};

/** The app's handle in the Partner Dashboard (used in the plan selection page URL). Can be
 * overridden with the CRO_APP_HANDLE env var. Confirm it in Partner Dashboard → App setup. */
export const DEFAULT_APP_HANDLE = "cro-toolbox";

/* ------------------------------------------------------------- helpers -- */

export const isPlanKey = (v: unknown): v is PlanKey => PLAN_KEYS.includes(v as PlanKey);
export const planRank = (p: PlanKey) => PLAN_KEYS.indexOf(p);
/** Is plan `p` at least `min`? */
export const atLeast = (p: PlanKey, min: PlanKey) => planRank(p) >= planRank(min);
export const canUse = (p: PlanKey, f: FeatureKey) => atLeast(p, FEATURE_PLAN[f]);
export const limitOf = (p: PlanKey, k: LimitKey) => PLANS[p].limits[k];
/** The cheapest plan above `from` where `k` is above `count` (null when none is). */
export function planAbove(k: LimitKey, count: number, from: PlanKey = "free"): PlanKey | null {
  return PLAN_KEYS.find((p) => {
    const n = limitOf(p, k);
    return planRank(p) > planRank(from) && (n === null || n > count);
  }) ?? null;
}

const NOUN: Record<LimitKey, [string, string]> = {
  offerSlots: ["offer slot", "offer slots"],
  checkoutRules: ["checkout rule", "checkout rules"],
  countdownPlaces: ["countdown timer", "countdown timers"],
  thankYouModules: ["thank-you module", "thank-you modules"],
  offerStats: ["offer with its own results", "offers with their own results"],
  designsPerSection: ["style per section", "styles per section"],
  monthlyRevenue: ["", ""],
};
export const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
export const limitText = (k: LimitKey, n: number) => (k === "monthlyRevenue" ? `${usd(n)} revenue added a month` : `${n.toLocaleString("en-US")} ${NOUN[k][n === 1 ? 0 : 1]}`);
/** "Up to $500 revenue added monthly" / "Unlimited revenue added monthly" (the plan card's line). */
export function revenueLine(p: PlanKey): { amount: string; rest: string } {
  const n = limitOf(p, "monthlyRevenue");
  return n === null ? { amount: "Unlimited", rest: " revenue added monthly" } : { amount: usd(n), rest: " revenue added monthly" };
}

/**
 * Can one more be switched on? `othersOn` = how many are already on, not counting the one being
 * saved. Returns null when allowed, otherwise the message shown to the merchant.
 */
export function limitError(p: PlanKey, k: LimitKey, othersOn: number): string | null {
  const n = limitOf(p, k);
  if (n === null || othersOn < n) return null;
  const next = planAbove(k, othersOn, p);
  return (
    `The ${PLANS[p].name} plan includes ${limitText(k, n)}.` +
    (next ? ` Upgrade to ${PLANS[next].name} for more, or turn another one off first.` : " Turn another one off first.")
  );
}

/**
 * After a downgrade: which items to switch off so only the first `limit` stay on. Items are in the
 * order the app lists them (the merchant can reorder to choose which stay). Items already off are
 * never touched. Returns the items to turn off.
 */
export function overLimit<T extends { active: boolean }>(items: T[], limit: number | null): T[] {
  if (limit === null) return [];
  return items.filter((i) => i.active).slice(limit);
}

/**
 * After an upgrade: which items the app switched off earlier (`paused`) can come back on, without
 * going over the new limit. `activeNow` = how many are on right now.
 */
export function canResume<T>(paused: T[], activeNow: number, limit: number | null): T[] {
  if (limit === null) return paused;
  return paused.slice(0, Math.max(0, limit - activeNow));
}

/**
 * Approximate US dollars per unit of a store currency, for the soft revenue limit only (a banner,
 * never a lock). Update now and then; a currency missing here simply shows no limit.
 */
export const USD_RATE: Record<string, number> = {
  USD: 1, EUR: 1.08, GBP: 1.27, CAD: 0.73, AUD: 0.66, NZD: 0.6, CHF: 1.13, SEK: 0.095, NOK: 0.093, DKK: 0.145, PLN: 0.25, CZK: 0.043, HUF: 0.0027, RON: 0.22,
  EGP: 0.02, SAR: 0.27, AED: 0.27, QAR: 0.27, KWD: 3.25, BHD: 2.65, OMR: 2.6, JOD: 1.41, MAD: 0.1, TND: 0.32, TRY: 0.029, ILS: 0.27,
  INR: 0.012, PKR: 0.0036, BDT: 0.0084, JPY: 0.0067, CNY: 0.14, HKD: 0.13, TWD: 0.031, KRW: 0.00073, SGD: 0.74, MYR: 0.22, IDR: 0.000062, PHP: 0.017, THB: 0.028, VND: 0.00004,
  BRL: 0.18, MXN: 0.055, ARS: 0.001, CLP: 0.0011, COP: 0.00025, PEN: 0.27, ZAR: 0.054, NGN: 0.00065, KES: 0.0077,
};
/** An amount in a store currency, in US dollars (null when the currency isn't known). */
export function toUsd(amount: number, currency: string): number | null {
  const rate = USD_RATE[currency.toUpperCase()];
  return rate === undefined ? null : amount * rate;
}

/** Is the revenue the app added (last 30 days, US dollars) over the plan's soft limit? */
export function revenueOver(p: PlanKey, revenueUsd: number | null): boolean {
  const n = limitOf(p, "monthlyRevenue");
  return n !== null && revenueUsd !== null && revenueUsd > n;
}

/** Shopify's hosted plan selection page (open it with target="_top"). */
export function planPageUrl(shop: string, appHandle: string) {
  const store = shop.replace(/\.myshopify\.com$/, "");
  return `https://admin.shopify.com/store/${store}/charges/${appHandle}/pricing_plans`;
}

/** Map a subscription's plan handle or name (Partner API / Admin API) to a plan key. */
export function planFromSubscription(handleOrName: string | null | undefined): PlanKey | null {
  if (!handleOrName) return null;
  const v = handleOrName.trim().toLowerCase();
  const exact = PLAN_KEYS.find((p) => PLANS[p].handle === v || PLANS[p].name.toLowerCase() === v);
  if (exact) return exact;
  // "Growth (yearly)", "growth_yearly"… match by the plan's name inside it, highest plan first.
  return [...PLAN_KEYS].reverse().find((p) => p !== "free" && v.includes(PLANS[p].handle)) ?? null;
}

export const price = (n: number) => (n === 0 ? "Free" : `$${n % 1 ? n.toFixed(2) : n}`);
