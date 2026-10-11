/**
 * Plans and what each one includes — the ONLY place prices, trials and limits live.
 * Change a number here and every page (Home's plan cards, upgrade cards, limit messages) follows.
 *
 * ⚠️ PROPOSAL — confirm with Omar. Prices, trial length, order limits, Free contents and which plan
 * unlocks each feature are the proposal from the pricing research (Oct 2026), not final decisions.
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

/** Counted limits. `null` = unlimited. Offers and bundles count the ones switched on (active). */
export type Limits = {
  upsellOffers: number | null;
  crossSellOffers: number | null;
  /** Mix & match bundles and deals (fixed, buy X get Y, volume, gift, upgrade) together. */
  bundlesAndDeals: number | null;
  /** Designs per section (Design 1…5 on a design page). */
  designsPerSection: number | null;
  /** Orders a month. Soft: going over only shows a banner, nothing is switched off. */
  monthlyOrders: number | null;
};
export type LimitKey = keyof Limits;

export type Plan = {
  key: PlanKey;
  /** Shown in the app. */
  name: string;
  /** The plan's handle in the Partner Dashboard (Shopify App Pricing `plan_handle`). */
  handle: string;
  /** USD. */
  monthly: number;
  yearly: number;
  trialDays: number;
  limits: Limits;
  /** Short lines for the plan cards on Home. */
  highlights: string[];
};

// PROPOSAL — confirm with Omar (prices, trial, limits).
export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: "free",
    name: "Free",
    handle: "free",
    monthly: 0,
    yearly: 0,
    trialDays: 0,
    limits: { upsellOffers: 1, crossSellOffers: 1, bundlesAndDeals: 1, designsPerSection: 1, monthlyOrders: null },
    highlights: [
      "1 upsell, 1 cross-sell and 1 bundle or deal",
      "Announcement, countdown and free-shipping bars",
      "Reviews, FAQ, logos and hero banners",
      "Quick add and sticky add to cart",
      "1 design per section, no order cap",
    ],
  },
  starter: {
    key: "starter",
    name: "Starter",
    handle: "starter",
    monthly: 9.99,
    yearly: 99,
    trialDays: 14,
    limits: { upsellOffers: null, crossSellOffers: null, bundlesAndDeals: null, designsPerSection: 5, monthlyOrders: 500 },
    highlights: [
      "Unlimited offers, bundles, deals and add-ons",
      "Every section and booster, 5 designs per section",
      "Cart drawer, wishlist, back in stock, quiz, delivery estimate",
      "Personalization, gift note, track order and returns pages",
      "Up to 500 orders a month",
    ],
  },
  growth: {
    key: "growth",
    name: "Growth",
    handle: "growth",
    monthly: 24.99,
    yearly: 249,
    trialDays: 14,
    limits: { upsellOffers: null, crossSellOffers: null, bundlesAndDeals: null, designsPerSection: 5, monthlyOrders: 2000 },
    highlights: [
      "Everything in Starter",
      "Payment and delivery rules, order limits",
      "Thank-you page modules and the after-purchase offer",
      "Results holdout test",
      "Request any feature — we build it for you",
      "Up to 2,000 orders a month",
    ],
  },
  pro: {
    key: "pro",
    name: "Pro",
    handle: "pro",
    monthly: 49.99,
    yearly: 499,
    trialDays: 14,
    limits: { upsellOffers: null, crossSellOffers: null, bundlesAndDeals: null, designsPerSection: 5, monthlyOrders: null },
    highlights: ["Everything in Growth", "Unlimited orders", "Priority support", "Help setting up your store"],
  },
};

/**
 * The lowest plan that unlocks each feature (every key of FEATURES in catalog.ts must be here —
 * the type checks it). Features with a counted limit (upsell, bundles…) are open on Free and
 * capped by `limits` instead. PROPOSAL — confirm with Omar.
 */
export const FEATURE_PLAN: Record<FeatureKey, PlanKey> = {
  // Offers & bundles
  upsell: "free",
  cross_sell: "free",
  bundles: "free",
  addons: "starter",
  cart_extras: "starter",
  personalize: "starter",
  // Sections
  hero: "free",
  reviews: "free",
  product_reviews: "free",
  faq: "free",
  logos: "free",
  videos: "starter",
  image_carousel: "starter",
  quiz: "starter",
  collection_pills: "starter",
  // Boosters
  announcements: "free",
  countdown: "free",
  shipping_bar: "free",
  quick_add: "free",
  boosters: "free",
  wishlist: "starter",
  cart_tools: "starter",
  delivery: "starter",
  stock: "starter",
  // Header & pages
  header: "starter",
  footer: "starter",
  track: "starter",
  returns: "starter",
  contact: "starter",
  // Checkout
  checkout_rules: "growth",
  order_limits: "growth",
  thank_you: "growth",
  post_purchase: "growth",
};

/** Things inside a page that need a plan (the page itself stays open). */
export const EXTRA_PLAN = {
  /** "Request a feature" on Home: the merchant asks, we build it for them. */
  featureRequests: "growth",
  holdoutTest: "growth",
  prioritySupport: "pro",
} satisfies Record<string, PlanKey>;

/** Referral reward text and link. PROPOSAL — the referral reward is Omar's decision. */
export const REFERRAL = {
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
  upsellOffers: ["active upsell offer", "active upsell offers"],
  crossSellOffers: ["active cross-sell offer", "active cross-sell offers"],
  bundlesAndDeals: ["active bundle or deal", "active bundles and deals"],
  designsPerSection: ["design per section", "designs per section"],
  monthlyOrders: ["order a month", "orders a month"],
};
export const limitText = (k: LimitKey, n: number) => `${n.toLocaleString("en-US")} ${NOUN[k][n === 1 ? 0 : 1]}`;

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

/** Is the monthly order count over the plan's (soft) limit? */
export function ordersOver(p: PlanKey, orders: number | null): boolean {
  const n = limitOf(p, "monthlyOrders");
  return n !== null && orders !== null && orders > n;
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
