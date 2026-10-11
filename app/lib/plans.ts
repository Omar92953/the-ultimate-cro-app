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
  /** Orders a month. Soft: going over only shows a banner, nothing is switched off. */
  monthlyOrders: number | null;
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
  /** What the plan adds over the plan below (its card on Home and the Plans page). */
  highlights: string[];
};

/** Shown on every paid plan (Shopify billing: merchants change or cancel from the plan page). */
export const GUARANTEE = "Cancel or change your plan anytime. No contract.";

// PROPOSAL — confirm with Omar (prices, trial, limits).
export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: "free",
    name: "Free",
    handle: "free",
    job: "Try everything: a little of every tool, free forever.",
    monthly: 0,
    yearly: 0,
    trialDays: 0,
    limits: { offerSlots: 3, checkoutRules: 3, countdownPlaces: 1, thankYouModules: 2, trialFeatures: 1, offerStats: 1, designsPerSection: 1, monthlyOrders: null },
    highlights: [
      "3 offer slots: any mix of upsells, cross-sells, bundles and deals",
      "Cart drawer, free-shipping and announcement bars, 1 countdown",
      "Unlimited reviews, FAQ, logos, hero, wishlist, back in stock",
      "Sticky add to cart, quick add, trust badges, sales pop-ups",
      "3 checkout rules and a thank-you page with 2 modules",
      "Try 1 Starter feature of your choice",
      "No order cap",
    ],
  },
  starter: {
    key: "starter",
    name: "Starter",
    handle: "starter",
    job: "Sell more per order: every offer, bundle and storefront tool.",
    monthly: 9.99,
    yearly: 99,
    trialDays: 14,
    limits: { offerSlots: null, checkoutRules: 6, countdownPlaces: null, thankYouModules: null, trialFeatures: 0, offerStats: 3, designsPerSection: 5, monthlyOrders: 500 },
    highlights: [
      "Unlimited offers and all 7 bundle types, price tiers and option pricing",
      "Add-ons, personalization, gift note and delivery date",
      "Full cart drawer: express checkout, best discount, share cart",
      "Quiz, image and video carousels, collection pills, delivery estimate",
      "Header, footer, contact, track order and returns pages",
      "5 styles per section, unlimited countdowns and thank-you modules",
      "6 checkout rules and results for your top 3 offers",
      "Up to 500 orders a month",
    ],
  },
  growth: {
    key: "growth",
    name: "Growth",
    handle: "growth",
    job: "Convert and optimise: checkout control and the numbers behind every offer.",
    monthly: 24.99,
    yearly: 249,
    trialDays: 14,
    limits: { offerSlots: null, checkoutRules: null, countdownPlaces: null, thankYouModules: null, trialFeatures: 0, offerStats: null, designsPerSection: 5, monthlyOrders: 2000 },
    highlights: [
      "Everything in Starter",
      "Unlimited payment rules, delivery rules and order limits",
      "Results for every offer and every bundle",
      "Holdout test: measure what the app really adds",
      "Request any feature — we build it for you",
      "Up to 2,000 orders a month",
    ],
  },
  pro: {
    key: "pro",
    name: "Pro",
    handle: "pro",
    job: "Priority: no limits, and we're first in line for you.",
    monthly: 49.99,
    yearly: 499,
    trialDays: 14,
    limits: { offerSlots: null, checkoutRules: null, countdownPlaces: null, thankYouModules: null, trialFeatures: 0, offerStats: null, designsPerSection: 5, monthlyOrders: null },
    highlights: ["Everything in Growth", "Unlimited orders", "Priority support", "Your feature requests built first"],
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
