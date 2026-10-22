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
  /** Offers switched on at the same time, any type: upsells, cross sells, bundles, bundle products, deals, the after-purchase offer. */
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
   * All of the store's orders in the calendar month (Shopify's order count, which works before the
   * protected customer data approval). Soft: going over only shows a banner, nothing switches off.
   */
  monthlyOrders: number | null;
  /** Shipments tracked live through the app's own tracking account (17TRACK) each calendar month. A store's own tracking key has no limit (Omar, 2026-10-22). */
  liveShipments: number | null;
  /** Loyalty members. At the limit new customers stop joining; members keep earning and spending. */
  loyaltyMembers: number | null;
  /** Loyalty emails sent each calendar month. */
  loyaltyEmails: number | null;
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
    limits: { offerSlots: 3, checkoutRules: 3, countdownPlaces: 1, thankYouModules: 2, trialFeatures: 1, offerStats: 1, designsPerSection: 1, monthlyOrders: 50, liveShipments: 0, loyaltyMembers: 0, loyaltyEmails: 0 },
    highlights: ["3 offers on at once", "Cart offers and announcement bars", "Reviews, FAQ and wishlist", "Sales pop-ups and trust badges", "After purchase offer and thank you", "3 checkout rules", "Try 1 Starter feature free"],
  },
  starter: {
    key: "starter",
    name: "Starter",
    handle: "starter",
    job: "Sell more per order: every offer, bundle and storefront tool.",
    monthly: 5.99,
    yearly: 59,
    trialDays: 14,
    limits: { offerSlots: null, checkoutRules: 6, countdownPlaces: null, thankYouModules: null, trialFeatures: 0, offerStats: 3, designsPerSection: 5, monthlyOrders: 500, liveShipments: 0, loyaltyMembers: 0, loyaltyEmails: 0 },
    highlights: ["Unlimited offers", "Every bundle and discount type", "Add-ons and personalization", "Gift note and delivery date", "Quiz, carousels and store pages", "5 styles per section", "Connect Claude to your store"],
  },
  growth: {
    key: "growth",
    name: "Growth",
    handle: "growth",
    job: "Convert and optimise: checkout control and the numbers behind every offer.",
    monthly: 19.99,
    yearly: 199,
    trialDays: 14,
    limits: { offerSlots: null, checkoutRules: null, countdownPlaces: null, thankYouModules: null, trialFeatures: 0, offerStats: null, designsPerSection: 5, monthlyOrders: 1000, liveShipments: 150, loyaltyMembers: 1000, loyaltyEmails: 1000 },
    badge: "Popular",
    highlights: ["Everything in Starter", "Unlimited checkout rules", "Offer results and a holdout test", "Track and Returns pages", "Live tracking, 150 shipments a month", "Loyalty program, up to 1,000 members", "Your tracking page sells too", "Shoppable images"],
  },
  pro: {
    key: "pro",
    name: "Pro",
    handle: "pro",
    job: "Test, save returns and sell more, with no limits.",
    monthly: 39.99,
    yearly: 399,
    trialDays: 14,
    limits: { offerSlots: null, checkoutRules: null, countdownPlaces: null, thankYouModules: null, trialFeatures: 0, offerStats: null, designsPerSection: 5, monthlyOrders: null, liveShipments: 500, loyaltyMembers: null, loyaltyEmails: 10000 },
    badge: "No limits",
    highlights: ["Everything in Growth", "A/B tests for upsells and cross sells", "Live tracking, 500 shipments a month", "Full loyalty: VIP tiers, Klaviyo, Flow", "Store credit and exchanges on returns", "Auto approve and restock returns", "Track page offer slots", "Priority support"],
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
  // Cart (these sit in the Storefront hub, group Cart)
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
  size_guide: "starter",
  stock: "free",
  wishlist: "free",
  image_carousel: "starter",
  coverflow: "starter",
  videos: "starter",
  faq: "free",
  quiz: "starter",
  collection_pills: "starter",
  header: "starter",
  compare_table: "starter",
  benefits: "free",
  product_tabs: "free",
  guarantee: "free",
  before_after: "starter",
  shoppable: "growth",
  recently_viewed: "starter",
  how_it_works: "free",
  email_popup: "starter",
  track: "growth",
  returns: "growth",
  // Checkout (Free: within the checkout-rule and thank-you limits)
  payment_rules: "free",
  delivery_rules: "free",
  order_limits: "free",
  thank_you: "free",
  post_purchase: "free",
  ab_tests: "pro",
  return_saving: "pro",
  // Growth: points, rewards, referrals and emails within the loyalty limits; Pro: everything (LOYALTY_PRO in lib/loyalty/config.ts).
  loyalty: "growth",
};

/** Things inside a page that need a plan (the page itself stays open). */
export const EXTRA_PLAN = {
  holdoutTest: "growth",
  prioritySupport: "pro",
  /** Offers above and below the tracking on the Track page, made in Offers. */
  trackOffers: "pro",
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
 * overridden with the CRO_APP_HANDLE env var. Checked on Testing2 2026-10-16: the admin URL is apps/the-ultimate-cro-app. */
export const DEFAULT_APP_HANDLE = "the-ultimate-cro-app";

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
  liveShipments: ["live tracked shipment a month", "live tracked shipments a month"],
  loyaltyMembers: ["loyalty member", "loyalty members"],
  loyaltyEmails: ["loyalty email a month", "loyalty emails a month"],
};
export const limitText = (k: LimitKey, n: number) => `${n.toLocaleString("en-US")} ${NOUN[k][n === 1 ? 0 : 1]}`;
/** "Up to 500 orders monthly" / "Unlimited orders monthly" (the plan card's line). */
export function ordersLine(p: PlanKey): { amount: string; rest: string } {
  const n = limitOf(p, "monthlyOrders");
  return n === null ? { amount: "Unlimited", rest: " orders monthly" } : { amount: n.toLocaleString("en-US"), rest: " orders monthly" };
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

/** Is this month's order count over the plan's (soft) limit? */
export function ordersOver(p: PlanKey, orders: number | null): boolean {
  const n = limitOf(p, "monthlyOrders");
  return n !== null && orders !== null && orders > n;
}

/**
 * The app's own Plans page (/app/plans) as a full admin URL, for links opened outside the app frame
 * (target="_top", AI assistant replies). Merchants choose a plan there, never on Shopify's hosted
 * pricing_plans page. Inside the app, link to "/app/plans".
 */
export function planPageUrl(shop: string, appHandle: string) {
  const store = shop.replace(/\.myshopify\.com$/, "");
  return `https://admin.shopify.com/store/${store}/apps/${appHandle}/app/plans`;
}

/**
 * Shopify's approval page for one plan and billing period, skipping its plan selection page (the
 * Plans page in the app does the choosing). Shopify's interval codes: EVERY_30_DAYS and ANNUAL.
 */
export function planApproveUrl(shop: string, appHandle: string, plan: PlanKey, yearly: boolean) {
  const store = shop.replace(/\.myshopify\.com$/, "");
  const interval = yearly && plan !== "free" ? "ANNUAL" : "EVERY_30_DAYS";
  return `https://admin.shopify.com/store/${store}/charges/${appHandle}/plans/${PLANS[plan].handle}?interval=${interval}`;
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
