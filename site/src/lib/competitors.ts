/**
 * Facts about other Shopify apps for the /compare/ pages. Rules: only what a source says, with the
 * source and the date checked; never guess. Every table cell about the other app is filled: `true` when
 * its listing says so, `false` when its listing doesn't mention it ("Not on its listing"), or a short text
 * with what the listing says. `level` says how sure we are: "vendor" = the app's own Shopify App Store
 * listing or website, opened on `checked`; "third party" = review sites, often out of date.
 * Update this file when you check a listing yourself, and `checked` with it.
 *
 * Everything about CRO Toolbox comes from the app's plans.ts and catalog.ts (through lib/app.ts).
 */
import { PLANS, FEATURE_PLAN, LOYALTY_PRO, money, type FeatureKey, type PlanKey } from "./app";
import { LIVE_TRACKING } from "../../../app/lib/plans";

export type Source = { label: string; url: string };
/** About the other app: true = its listing says so; false = its listing doesn't mention it; text = what it says, in short. */
export type Cell = boolean | string;
/** One row of an area table (loyalty, tracking, returns, reviews, upsells): what each app has. */
export type Row = { label: string; ours: string; theirs: Cell };
export type Area = "Bundles and offers" | "Upsells" | "Loyalty" | "Order tracking" | "Returns" | "Reviews" | "All in one";
/** The order of the groups on /compare/. */
export const AREAS: Area[] = ["Bundles and offers", "Upsells", "Loyalty", "Order tracking", "Returns", "Reviews", "All in one"];

export type Competitor = {
  slug: string;
  name: string;
  listing: string;
  area: Area;
  /** What the app is mainly for, from its listing name and description. */
  focus: string;
  /** What CRO Toolbox has for the same job, one sentence (lead and first answer). Default: the offers line. */
  ours?: string;
  pricing: string[];
  /** Rating and review count shown on its listing on the checked date. */
  rating?: string;
  level: "vendor" | "third party";
  sources: Source[];
  /** The day its sources were opened, YYYY-MM-DD. */
  checked: string;
  /** Offer and bundle apps: every capability below, filled. */
  has?: Record<Capability, Cell>;
  /** Apps for another job: rows compared on that job. */
  rows?: Row[];
  /** What a `false` cell says. Default "Not on its listing". */
  missing?: string;
  /** Where the other app is stronger, from its sources. Be fair: it builds trust. */
  theirEdge: string[];
  /** Where CRO Toolbox is stronger for this job, from plans.ts and catalog.ts. Default: the general lines. */
  ourEdge?: string[];
};

export type Capability = "bundles" | "quantity" | "cross_sell" | "bogo" | "gift" | "reviews" | "sections" | "checkout_rules" | "post_purchase";
export const CAPABILITIES: { key: Capability; label: string }[] = [
  { key: "bundles", label: "Bundles (mix and match, kits, fixed sets)" },
  { key: "quantity", label: "Quantity breaks" },
  { key: "cross_sell", label: "Cross sells and upsells" },
  { key: "bogo", label: "Buy X get Y" },
  { key: "gift", label: "Free gift with purchase" },
  { key: "reviews", label: "Product reviews" },
  { key: "sections", label: "Storefront sections (hero, FAQ, carousels…)" },
  { key: "checkout_rules", label: "Payment and delivery rules, order limits" },
  { key: "post_purchase", label: "One click offer after payment" },
];
/** CRO Toolbox: every capability above is in the app today (catalog.ts). */
export const OURS: Record<Capability, true> = { bundles: true, quantity: true, cross_sell: true, bogo: true, gift: true, reviews: true, sections: true, checkout_rules: true, post_purchase: true };

/** "November 16, 2026" from "2026-11-16". */
export const checkedText = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/* ---- CRO Toolbox facts for the area tables, read from plans.ts ---- */
const at = (k: PlanKey) => (PLANS[k].monthly ? `${PLANS[k].name} (${money(PLANS[k].monthly)} a month)` : `${PLANS[k].name} plan`);
/** "Every plan, Free included", "Growth ($19.99 a month) and up", "Pro ($39.99 a month)". */
const plan = (k: PlanKey) => (k === "free" ? "Every plan, Free included" : k === "pro" ? at(k) : `${at(k)} and up`);
const planF = (f: FeatureKey) => plan(FEATURE_PLAN[f]);
const num = (n: number | null) => (n === null ? "unlimited" : n.toLocaleString("en-US"));
const proOnly = (part: string) => (LOYALTY_PRO as readonly string[]).some((t) => t.includes(part));
const vipPlan: PlanKey = proOnly("VIP tiers") ? "pro" : FEATURE_PLAN.loyalty;
const integrationsPlan: PlanKey = proOnly("Klaviyo") ? "pro" : FEATURE_PLAN.loyalty;
const loyaltyStart = PLANS[FEATURE_PLAN.loyalty];
const loyaltyOrders = `${num(PLANS.growth.limits.loyaltyOrders)} orders that earn points a month on ${PLANS.growth.name}, ${num(PLANS.pro.limits.loyaltyOrders)} on ${PLANS.pro.name}; then $5 per 100 more on monthly billing`;
const free = PLANS.free;
const freeLine = `${free.limits.offerSlots} offers on at once, stores up to ${num(free.limits.monthlyOrders)} orders a month`;
const planOrders = `No quota of its own; your plan's monthly orders apply (${PLANS.growth.name} ${num(PLANS.growth.limits.monthlyOrders)}, ${PLANS.pro.name} ${num(PLANS.pro.limits.monthlyOrders)})`;
const sameApp = "Yes: offers, bundles, storefront sections, checkout rules, loyalty, tracking and returns";
const oneApp = "Upsells, bundles and the other tools in the same app";

const CHECKED_ON = "2026-11-16";
const listing = (handle: string): Source => ({ label: "Shopify App Store listing", url: `https://apps.shopify.com/${handle}` });

export const COMPETITORS: Competitor[] = [
  {
    slug: "bundler",
    name: "Bundler",
    listing: "https://apps.shopify.com/bundler-product-bundles",
    area: "Bundles and offers",
    focus: "Product bundles and discounts.",
    pricing: ["Free: no limit on revenue or orders (Buy X get Y, quantity breaks, product page upsells, Shopify POS)", "Premium $9.99 a month (adds mix and match, landing pages, free shipping, funnel upsells)", "Executive $19.99 a month (adds bundle analytics)", "7 day free trial on paid plans"],
    rating: "4.9 from 2,791 reviews; shows the Built for Shopify badge",
    level: "vendor",
    sources: [listing("bundler-product-bundles")],
    checked: CHECKED_ON,
    has: { bundles: true, quantity: true, cross_sell: true, bogo: true, gift: true, reviews: false, sections: false, checkout_rules: false, post_purchase: false },
    theirEdge: ["A free plan with no limit on revenue or orders: Buy X get Y, quantity breaks and product page upsells", "Mix and match for $9.99 a month with no revenue limit", "Works with Shopify POS and subscription apps"],
  },
  {
    slug: "simple-bundles",
    name: "Simple Bundles",
    listing: "https://apps.shopify.com/simple-bundles",
    area: "Bundles and offers",
    focus: "Bundles and kits, with inventory synced to the bundled items.",
    pricing: ["Free: 3 bundles and 50 orders a month", "Basic $24 a month, or $14 a month for stores under 100 orders a month (unlimited bundles)", "Grow & Advanced $39 a month (for Shopify Grow and Advanced stores)", "Plus $149 a month (for Shopify Plus stores)", "Yearly billing saves 17%"],
    rating: "4.9 from 841 reviews; shows the Built for Shopify badge",
    level: "vendor",
    sources: [listing("simple-bundles")],
    checked: CHECKED_ON,
    has: { bundles: true, quantity: true, cross_sell: true, bogo: true, gift: true, reviews: "Works with Judge.me; no reviews of its own listed", sections: false, checkout_rules: false, post_purchase: "Thank you page upsells listed" },
    theirEdge: ["Inventory synced for single and multi SKU bundles, with links to 3PL, WMS and ERP tools", "Bundles broken down into their items for fulfillment", "Shopify POS and headless (Hydrogen) support"],
  },
  {
    slug: "fast-bundle",
    name: "Fast Bundle",
    listing: "https://apps.shopify.com/fast-bundle-product-bundles",
    area: "Bundles and offers",
    focus: "Product bundles, upsells and free gifts.",
    pricing: ["Free on development stores", "Standard $19 a month (up to $1,000 of bundle sales), $49 (up to $3,000), $139 (up to $10,000)", "Priced by monthly bundle sales; yearly billing saves 17% to 21%", "Optional auto bundle detection: $49 a month more", "7 day free trial on paid plans"],
    rating: "5.0 from 3,675 reviews",
    level: "vendor",
    sources: [listing("fast-bundle-product-bundles")],
    checked: CHECKED_ON,
    has: { bundles: true, quantity: true, cross_sell: true, bogo: true, gift: true, reviews: false, sections: false, checkout_rules: false, post_purchase: false },
    theirEdge: ["AI frequently bought together and an AI bundle image generator", "Bundle offers for Shopify POS", "24/7 support in English, as its plans say"],
  },
  {
    slug: "kaching",
    name: "Kaching Bundles",
    listing: "https://apps.shopify.com/bundle-deals",
    area: "Bundles and offers",
    focus: "Bundles and upsells.",
    pricing: ["Free on development stores", "Starter $14.99, Scale $29.99, Pro $59.99 a month ($131.88, $263.88, $539.88 a year)", "Each plan capped by the extra revenue the app makes ($1,000, $5,000, $10,000)", "7 day free trial on paid plans"],
    rating: "5.0 from 6,756 reviews; shows the Built for Shopify badge",
    level: "vendor",
    sources: [listing("bundle-deals")],
    checked: CHECKED_ON,
    has: { bundles: true, quantity: true, cross_sell: true, bogo: true, gift: true, reviews: false, sections: false, checkout_rules: false, post_purchase: false },
    theirEdge: ["A/B testing built in on every paid plan", "Subscription and wholesale bundles, and Shopify POS and Flow", "A long record: 5.0 from 6,756 reviews"],
  },
  {
    slug: "bogos",
    name: "BOGOS",
    listing: "https://apps.shopify.com/freegifts",
    area: "Bundles and offers",
    focus: "Free gifts, buy X get Y, bundles and upsells.",
    pricing: ["Free: 30 orders in total", "Basic $29.99 a month: 300 orders a month (Shopify Basic stores only)", "Grow $49.99 a month: 600 orders a month ($69.99 with 1,000 orders for Advanced and larger stores)", "Plus $109.99 a month: 2,000 orders a month (Shopify Plus only)", "$0.05 for each extra order; 7 day free trial on paid plans"],
    rating: "5.0 from 4,711 reviews; shows the Built for Shopify badge",
    level: "vendor",
    sources: [listing("freegifts")],
    checked: CHECKED_ON,
    has: { bundles: true, quantity: true, cross_sell: true, bogo: true, gift: true, reviews: false, sections: false, checkout_rules: false, post_purchase: "Thank you page upsells listed" },
    theirEdge: ["Gifts added to the cart for the shopper, a gift pop up and multiplier gifts", "Offers on Shopify POS and a headless API", "Twelve years on the App Store, as its listing says"],
  },
  {
    slug: "rebuy",
    name: "Rebuy",
    listing: "https://apps.shopify.com/rebuy",
    area: "Upsells",
    focus: "Personalized upsells and cross sells, bundles and post purchase offers.",
    pricing: ["Rebuy Monetize (offers from other brands after purchase): free", "Packages priced by monthly orders: from $25 a month for one package (Checkout & Post Purchase, up to 500 orders); Cart & Merchandising from $45", "10% off two packages, 20% off three, 30% off all four; yearly billing takes off 10% more", "14 day free trial on each package"],
    rating: "Not shown: its Shopify App Store page says the app is not currently available there",
    level: "vendor",
    sources: [
      { label: "rebuyengine.com pricing", url: "https://www.rebuyengine.com/pricing" },
      { label: "Shopify App Store page", url: "https://apps.shopify.com/rebuy" },
    ],
    checked: CHECKED_ON,
    missing: "Not on its pricing page",
    has: { bundles: true, quantity: false, cross_sell: true, bogo: false, gift: false, reviews: false, sections: false, checkout_rules: false, post_purchase: true },
    theirEdge: ["AI recommendations, smart search and smart collections", "Rebuy Monetize pays you for offers from other brands after purchase", "Checkout extensions with offers on Shopify Plus"],
  },
  {
    slug: "vitals",
    name: "Vitals",
    listing: "https://apps.shopify.com/vitals",
    area: "All in one",
    focus: "Many storefront tools in one app (reviews, bundles and more).",
    pricing: ["Starter $29.99 a month: up to 200 orders a month", "Growth $79 a month: 201 to 1,000 orders a month", "Pro $179 a month: 1,001 to 5,000 orders a month", "All 40+ tools on every plan; no free plan", "7 day free trial"],
    rating: "4.9 from 2,976 reviews; shows the Built for Shopify badge",
    level: "vendor",
    sources: [listing("vitals")],
    checked: CHECKED_ON,
    has: { bundles: true, quantity: true, cross_sell: true, bogo: true, gift: true, reviews: true, sections: true, checkout_rules: false, post_purchase: false },
    theirEdge: ["Visitor replays and heatmaps, back in stock alerts, email marketing and pop ups", "Review import from AliExpress and review emails", "24/7 live chat support on every plan"],
  },
  {
    slug: "section-store",
    name: "Section Store",
    listing: "https://apps.shopify.com/section-factory",
    area: "All in one",
    focus: "Theme sections you buy or add one by one, plus a cart drawer and bundles.",
    pricing: ["Free to install: free sections, and premium sections for a one time charge", "Section Store Plus $15 a month (cart drawer, bundles, quantity breaks, mix and match, A/B tests, 30+ sections)", "14 day free trial on Plus"],
    rating: "4.9 from 3,046 reviews; shows the Built for Shopify badge",
    level: "vendor",
    sources: [listing("section-factory")],
    checked: CHECKED_ON,
    has: { bundles: true, quantity: true, cross_sell: true, bogo: true, gift: true, reviews: "A reviews page layout; no review collection listed", sections: true, checkout_rules: "Shipping method rules listed", post_purchase: false },
    theirEdge: ["A large catalog of theme sections you can buy once and keep", "An AI page builder for product, home and landing pages", "A cart drawer with a rewards bar"],
  },

  /* ---- Loyalty ---- */
  {
    slug: "smile",
    name: "Smile",
    listing: "https://apps.shopify.com/smile-io",
    area: "Loyalty",
    focus: "Loyalty: points, VIP tiers and referrals.",
    ours: `CRO Toolbox has a loyalty program with points, rewards, referrals and a Points shop from ${at(loyaltyStart.key)}, and VIP tiers on ${at(vipPlan)}, in the same app as its offers, bundles, tracking and returns.`,
    pricing: ["Free: up to 200 orders a month (points, rewards and referrals, discount and free shipping rewards, Shopify POS)", "Essential $15 a month: up to 500 orders (adds a loyalty page, free product rewards, Shopify Flow, 1 integration)", "Standard $79 a month: up to 1,000 orders (adds bonus events, points on product pages and the thank you page, 2 integrations)", "Growth $199 a month: 2,500 orders, then $20 per 100 more (adds VIP tiers, points expiry, redeem at checkout on Shopify Plus, unlimited integrations)", "14 day free trial on paid plans"],
    rating: "4.9 from 4,681 reviews; shows the Built for Shopify badge and a 2026 Shopify Build Award",
    level: "vendor",
    sources: [listing("smile-io")],
    checked: CHECKED_ON,
    rows: [
      { label: "Loyalty on a free plan", ours: `No: loyalty starts on ${at(loyaltyStart.key)}`, theirs: "Yes, up to 200 orders a month" },
      { label: "Points, rewards and referrals", ours: plan(loyaltyStart.key), theirs: "Every plan, Free included" },
      { label: "VIP tiers", ours: plan(vipPlan), theirs: "Growth ($199 a month)" },
      { label: "Points expiry", ours: plan(loyaltyStart.key), theirs: "Growth ($199 a month)" },
      { label: "Free product rewards", ours: plan(loyaltyStart.key), theirs: "Essential ($15 a month) and up" },
      { label: "Points on product pages", ours: plan(loyaltyStart.key), theirs: "Standard ($79 a month) and up" },
      { label: "Shopify POS", ours: plan(loyaltyStart.key), theirs: "Every plan, Free included" },
      { label: "Klaviyo and Shopify Flow", ours: plan(integrationsPlan), theirs: "Flow from Essential; 1 integration on Essential, 2 on Standard, unlimited on Growth" },
      { label: "Orders a month on the plan with VIP tiers", ours: `${num(PLANS[vipPlan].limits.loyaltyOrders)}, then $5 per 100 more on monthly billing`, theirs: "2,500, then $20 per 100 more" },
      { label: oneApp, ours: sameApp, theirs: false },
    ],
    theirEdge: ["Loyalty on a free plan, up to 200 orders a month", "Points redeemed at checkout on Shopify Plus (Growth plan)", "A long record: 4,681 reviews and a 2026 Shopify Build Award", "Its listing names Klaviyo, Judge.me, Gorgias and 30+ other tools"],
    ourEdge: [`VIP tiers for ${money(PLANS[vipPlan].monthly)} a month on ${PLANS[vipPlan].name}, where Smile asks $199`, `Points expiry, free product rewards and points on product pages from ${money(loyaltyStart.monthly)} a month`, "A Points shop: products members get with points, or points plus money", "Loyalty, upsells, bundles, tracking and returns on one plan"],
  },
  {
    slug: "bon-loyalty",
    name: "BON Loyalty",
    listing: "https://apps.shopify.com/bon-loyalty-rewards",
    area: "Loyalty",
    focus: "Loyalty: points, VIP tiers, referrals and Shopify POS.",
    ours: `CRO Toolbox has a loyalty program with points, rewards, referrals and a Points shop from ${at(loyaltyStart.key)}, and VIP tiers on ${at(vipPlan)}, in the same app as its offers, bundles, tracking and returns.`,
    pricing: ["Free: up to 150 orders a month (points and rewards, referrals, automated emails, redeem at checkout on Shopify Plus)", "Starter $15 a month: up to 300 orders (adds a loyalty page, free product and birthday rewards, points expiry, Klaviyo and review apps)", "Basic $29 a month or $324 a year: up to 500 orders (adds Shopify POS, 2x points days, Shopify Flow and unlimited integrations)", "Growth $129 a month or $1,236 a year: unlimited orders (adds VIP tiers and B2B tiers, points on the product page)", "7 day free trial on paid plans"],
    rating: "5.0 from 1,992 reviews; shows the Built for Shopify badge",
    level: "vendor",
    sources: [listing("bon-loyalty-rewards")],
    checked: CHECKED_ON,
    rows: [
      { label: "Loyalty on a free plan", ours: `No: loyalty starts on ${at(loyaltyStart.key)}`, theirs: "Yes, up to 150 orders a month" },
      { label: "Points, rewards and referrals", ours: plan(loyaltyStart.key), theirs: "Every plan, Free included" },
      { label: "Loyalty emails", ours: "Coming soon", theirs: "Automated emails for points and referrals, Free included" },
      { label: "Birthday rewards", ours: plan(loyaltyStart.key), theirs: "Starter ($15 a month) and up" },
      { label: "Points expiry", ours: plan(loyaltyStart.key), theirs: "Starter ($15 a month) and up" },
      { label: "Shopify POS", ours: plan(loyaltyStart.key), theirs: "Basic ($29 a month) and up" },
      { label: "VIP tiers", ours: plan(vipPlan), theirs: "Growth ($129 a month)" },
      { label: "Points on product pages", ours: plan(loyaltyStart.key), theirs: "Growth ($129 a month)" },
      { label: "Orders that earn points", ours: loyaltyOrders, theirs: "150 free, 300 on Starter, 500 on Basic, unlimited on Growth" },
      { label: oneApp, ours: sameApp, theirs: false },
    ],
    theirEdge: ["Loyalty on a free plan, up to 150 orders a month, with automated emails", "Unlimited orders on Growth for $129 a month; a big store can pay less than with a monthly limit plus extras", "B2B tiers for wholesale customers", "Its listing promises 24/7 support"],
    ourEdge: [`VIP tiers for ${money(PLANS[vipPlan].monthly)} a month on ${PLANS[vipPlan].name}, where BON asks $129`, `Shopify POS, birthday rewards, points expiry and points on product pages from ${money(loyaltyStart.monthly)} a month`, "A Points shop: products members get with points, or points plus money", "Loyalty, upsells, bundles, tracking and returns on one plan"],
  },

  /* ---- Order tracking ---- */
  {
    slug: "parcelpanel",
    name: "ParcelPanel",
    listing: "https://apps.shopify.com/parcelpanel",
    area: "Order tracking",
    focus: "Order tracking: a branded tracking page and shipping notifications. Its listing is now called CWILL Order Tracking.",
    ours: `CRO Toolbox has a Track your order page that sells too, and a Returns page, from ${at(FEATURE_PLAN.track)}, in the same app as its offers, bundles and loyalty.`,
    pricing: ["Free: 20 orders a month", "Essential $11 a month or $108 a year: 200 orders (adds shipping notifications, delivery estimates after purchase, AI recommendations, discount upsells, shipping protection)", "Professional $59 a month or $564 a year: 2,000 orders (adds delivery estimates before purchase, Klaviyo and PayPal, API, no CWILL branding)", "Enterprise $479 a month or $4,548 a year: 25,000 orders", "$0.05 for each extra order on paid plans; 7 day free trial"],
    rating: "4.9 from 3,211 reviews; shows the Built for Shopify badge",
    level: "vendor",
    sources: [listing("parcelpanel")],
    checked: CHECKED_ON,
    rows: [
      { label: "Tracking page in your store", ours: planF("track"), theirs: "Every plan, Free included" },
      { label: "Where the tracking comes from", ours: LIVE_TRACKING ? "Live from 3,500+ carriers through the app, your own tracking key, a webhook link or updates you type" : "Shopify's tracking data, your own 17TRACK, AfterShip, TrackingMore or Ship24 key, a webhook link or updates you type", theirs: "1,600+ carriers, synced in real time" },
      { label: "Orders it covers", ours: LIVE_TRACKING ? planOrders : `No limit with your own key or a webhook link; ${planOrders.charAt(0).toLowerCase()}${planOrders.slice(1)}`, theirs: "20 a month free, 200 on Essential, 2,000 on Professional, then $0.05 each" },
      { label: "Shipping notifications by email or SMS", ours: "No: Shopify sends its own shipping emails", theirs: "Essential ($11 a month) and up" },
      { label: "Estimated delivery dates", ours: "Estimated and delivered dates from Shopify", theirs: "After purchase on Essential; on product pages before purchase on Professional" },
      { label: "Selling on the tracking page", ours: `${PLANS[FEATURE_PLAN.track].name}: recommendations, a next order discount code, buy again; ${PLANS.pro.name}: offers above and below the tracking`, theirs: "AI recommendations and discount upsells, Essential and up" },
      { label: "Shipping protection", ours: "No", theirs: "Essential ($11 a month) and up" },
      { label: "Returns page", ours: planF("returns"), theirs: false },
      { label: oneApp, ours: sameApp, theirs: false },
    ],
    theirEdge: ["Real time tracking from 1,600+ carriers without a tracking key of your own", "Shipping notifications by email and SMS, and shipping protection", "Delivery estimates on product pages before purchase (Professional)", "A free plan for 20 orders a month"],
    ourEdge: [`A Track page and a Returns page on ${PLANS[FEATURE_PLAN.track].name} for ${money(PLANS[FEATURE_PLAN.track].monthly)} a month, with offers, bundles and loyalty on the same plan`, "Any courier works: your own tracking key, a webhook link, typed updates or a link to its tracking page", "The tracking page sells: recommendations, a real next order discount code and buy again"],
  },

  /* ---- Returns ---- */
  {
    slug: "returngo",
    name: "ReturnGO",
    listing: "https://apps.shopify.com/returngo",
    area: "Returns",
    focus: "Returns and exchanges, with a branded self service return portal.",
    ours: `CRO Toolbox has a Returns page that creates real Shopify returns from ${at(FEATURE_PLAN.returns)}, with store credit, exchanges and approval by rule on ${at(FEATURE_PLAN.return_saving)}.`,
    pricing: ["Premium $147 a month: 110 returns a month, then $1.25 per extra return", "Pro $297 a month: 300 returns a month, then $0.90 per extra return", "Add ons and integrations available; no free plan", "14 day free trial"],
    rating: "4.9 from 410 reviews",
    level: "vendor",
    sources: [listing("returngo")],
    checked: CHECKED_ON,
    rows: [
      { label: "Returns page for shoppers", ours: planF("returns"), theirs: "Premium ($147 a month) and up" },
      { label: "Returns included", ours: planOrders, theirs: "110 a month on Premium, then $1.25 each; 300 on Pro, then $0.90 each" },
      { label: "Store credit and gift cards instead of a refund", ours: planF("return_saving"), theirs: "Premium ($147 a month) and up" },
      { label: "Exchanges", ours: `${planF("return_saving")}: another size or colour`, theirs: "Variant, product and Shop Now exchanges, Premium and up" },
      { label: "Approve returns by rule", ours: planF("return_saving"), theirs: "Auto approval on Premium; more automation on Pro" },
      { label: "Return labels", ours: "You upload your label for the shopper", theirs: "Return labels through Ship by ReturnGO, and carrier integrations" },
      { label: "Restock returned items", ours: planF("return_saving"), theirs: "Stock updates listed" },
      { label: "Order tracking page", ours: planF("track"), theirs: "Order tracking and notifications listed" },
      { label: oneApp, ours: sameApp, theirs: false },
    ],
    theirEdge: ["Prepaid return labels and integrations with Canada Post, USPS, Sendcloud, Shippo and ShipStation", "Shop Now exchanges, gift returns and order cancellation", "Return reasons with follow up questions and photo and video upload", "ERP integrations, packing slips and item validation on Pro"],
    ourEdge: [`Store credit, exchanges and approval by rule on ${PLANS.pro.name} for ${money(PLANS.pro.monthly)} a month, where ReturnGO starts at $147`, "No fee per return", `A Returns page that creates real Shopify returns from ${money(PLANS[FEATURE_PLAN.returns].monthly)} a month`],
  },
  {
    slug: "return-prime",
    name: "Return Prime",
    listing: "https://apps.shopify.com/return-prime",
    area: "Returns",
    focus: "Returns and exchanges, with a branded return portal.",
    ours: `CRO Toolbox has a Returns page that creates real Shopify returns from ${at(FEATURE_PLAN.returns)}, with store credit, exchanges and approval by rule on ${at(FEATURE_PLAN.return_saving)}.`,
    pricing: ["Start: free, 5 return requests, then $0.49 per request", "Grow from $19.99 a month: 60 requests a month, then $0.49 each (adds Shop Now, instant exchange, refund to store credit, API)", "Thrive AI $79.99 a month: 180 requests, then $0.79 each (adds fraud controls, smart exchange discounts and return fees)", "Scale $149.99 a month: 450+ requests, then $0.49 each (adds WMS integration, SLA management)", "15 day free trial on paid plans"],
    rating: "4.8 from 780 reviews",
    level: "vendor",
    sources: [listing("return-prime")],
    checked: CHECKED_ON,
    rows: [
      { label: "Returns on a free plan", ours: `No: returns start on ${at(FEATURE_PLAN.returns)}`, theirs: "Yes, 5 requests, then $0.49 each" },
      { label: "Returns included", ours: planOrders, theirs: "60 a month on Grow, 180 on Thrive AI, 450+ on Scale, then a fee per request" },
      { label: "Exchanges", ours: `${planF("return_saving")}: another size or colour`, theirs: "Variant exchanges, Free included; instant exchange on Grow" },
      { label: "Refund to store credit", ours: planF("return_saving"), theirs: "Grow ($19.99 a month) and up" },
      { label: "Approve returns by rule", ours: planF("return_saving"), theirs: "Auto approve or reject by reason, product and return window, listed" },
      { label: "Return labels", ours: "You upload your label for the shopper", theirs: "Generates return labels and tracks the shipment" },
      { label: "Restock returned items", ours: planF("return_saving"), theirs: "Stock updates listed" },
      { label: oneApp, ours: sameApp, theirs: false },
    ],
    theirEdge: ["A free plan for 5 return requests, with variant exchanges", `Store credit from $19.99 a month on Grow; in CRO Toolbox it is on ${PLANS[FEATURE_PLAN.return_saving].name} (${money(PLANS[FEATURE_PLAN.return_saving].monthly)})`, "Return labels, 100+ integrations and an EU withdrawal button", "Fraud controls and return fees on Thrive AI"],
    ourEdge: ["No fee per return request", `Store credit, exchanges, approval by rule and restocking on ${PLANS.pro.name} with no cap on requests`, "Returns, tracking, loyalty and offers on one plan"],
  },

  /* ---- Upsells ---- */
  {
    slug: "aftersell",
    name: "AfterSell",
    listing: "https://apps.shopify.com/aftersell",
    area: "Upsells",
    focus: "One click post purchase upsells, an AI cart and thank you page offers.",
    ours: `CRO Toolbox has a one click offer after payment on every plan, Free included, plus thank you page modules, cart offers and upsells.`,
    pricing: ["Free for development and partner stores only", "Post Purchase $34.99 a month (one click post purchase offers, smart funnels, subscription upgrades, checkout upsells, thank you page offers, multivariate testing)", "Pre Purchase $59.99 a month (AI cart with 18+ blocks, rewards bars, free gifts, product page upsells, A/B testing)", "Complete $79.99 a month (both, plus a recommendation engine)", "30 day free trial"],
    rating: "4.9 from 1,128 reviews",
    level: "vendor",
    sources: [listing("aftersell")],
    checked: CHECKED_ON,
    rows: [
      { label: "One click offer after payment", ours: `${planF("post_purchase")} (on ${free.name}: ${freeLine})`, theirs: "Post Purchase ($34.99 a month) and up" },
      { label: "Free plan for live stores", ours: `Yes: ${freeLine}`, theirs: "No: free only for development stores" },
      { label: "Funnels with downsells", ours: "No: one product at a discount", theirs: "Smart funnels and downsells on Post Purchase" },
      { label: "Thank you page offers", ours: `${planF("thank_you")}: a next order code, product suggestions`, theirs: "Post Purchase ($34.99 a month) and up" },
      { label: "Testing offers", ours: `${planF("ab_tests")}: A/B tests with up to 4 versions of an upsell or cross sell`, theirs: "Multivariate testing on Post Purchase; A/B testing on Pre Purchase" },
      { label: "Cart offers", ours: `${planF("cart_offers")}: cross sells in your theme's cart drawer`, theirs: "AI cart with 18+ blocks on Pre Purchase ($59.99 a month)" },
      { label: "Checkout upsells (Shopify Plus)", ours: "No", theirs: "Post Purchase plan, Shopify Plus only" },
      { label: "Bundles and quantity breaks", ours: planF("bundles"), theirs: false },
    ],
    theirEdge: ["Funnels with downsells, and Smart Funnel AI to pick the offer", "Checkout upsells on Shopify Plus and subscription upgrades", "Rokt Thanks offers that pay up to $0.80 per order", "A 30 day free trial"],
    ourEdge: ["The after purchase offer is on the Free plan; AfterSell starts at $34.99 a month", "Bundles, quantity breaks and storefront sections in the same app", "Payment and delivery rules and order limits at checkout"],
  },
  {
    slug: "selleasy",
    name: "Selleasy",
    listing: "https://apps.shopify.com/upsell-cross-sell-kit-1",
    area: "Upsells",
    focus: "Upsells and cross sells on the product page, cart, thank you page and after purchase.",
    ours: `CRO Toolbox has upsells, cross sells, cart offers, a one click offer after payment and six bundle types, with a ${free.name} plan and unlimited offers from ${at("starter")}.`,
    pricing: ["Free: unlimited orders, up to 5 campaigns", "Starter $9 a month or $91 a year: unlimited campaigns, 50 AI recommendations", "Pro $29 a month or $295 a year: 1,000 AI recommendations a month, checkout upsells for Shopify Plus", "Max $59 a month or $601 a year: 2,500 AI recommendations a month, rules engine, priority support", "30 day free trial on paid plans"],
    rating: "4.9 from 2,791 reviews",
    level: "vendor",
    sources: [listing("upsell-cross-sell-kit-1")],
    checked: CHECKED_ON,
    rows: [
      { label: "Free plan", ours: freeLine, theirs: "Up to 5 campaigns, unlimited orders" },
      { label: "Unlimited offers", ours: plan("starter"), theirs: "Starter ($9 a month) and up" },
      { label: "Add ons and cross sells on product pages", ours: planF("cross_sell"), theirs: true },
      { label: "Upsells in the cart drawer", ours: planF("cart_offers"), theirs: true },
      { label: "One click offer after payment", ours: planF("post_purchase"), theirs: "Post purchase page upsells listed" },
      { label: "Thank you page", ours: planF("thank_you"), theirs: "AI recommended products on the thank you and order status pages" },
      { label: "Bundles", ours: `${planF("bundles")}: six bundle types`, theirs: "Frequently bought together and fixed bundles listed" },
      { label: "Quantity breaks", ours: planF("upsell"), theirs: false },
      { label: "AI recommendations", ours: "Shopify's recommendations for products no rule covers", theirs: "50 on Starter, 1,000 a month on Pro, 2,500 on Max" },
      { label: "Checkout upsells (Shopify Plus)", ours: "No", theirs: "Pro ($29 a month) and up" },
    ],
    theirEdge: [`A free plan with unlimited orders; the CRO Toolbox ${free.name} plan is for stores up to ${num(free.limits.monthlyOrders)} orders a month`, "AI recommendations and an AI campaign optimizer", "Checkout upsells on Shopify Plus", "A 30 day free trial and a free setup call on Starter"],
    ourEdge: [`Unlimited offers from ${money(PLANS.starter.monthly)} a month on ${PLANS.starter.name}`, "Quantity breaks, six bundle types and storefront sections", "Payment and delivery rules and order limits at checkout"],
  },

  /* ---- Reviews ---- */
  {
    slug: "judge-me",
    name: "Judge.me",
    listing: "https://apps.shopify.com/judgeme",
    area: "Reviews",
    focus: "Product reviews: photo and video reviews, review requests and Google reviews.",
    ours: `CRO Toolbox has text, photo and video reviews and a star rating near the price on every plan, Free included, in the same app as its offers and bundles.`,
    pricing: ["Forever Free: unlimited product and store reviews, photos and videos, review widget and star badge, carousels, Google reviews sync and rich snippets, review importer", "Awesome $15 a month: AI replies and summaries, 130+ integrations, Q&A and reviews page, automatic reminders, coupons and referrals, Google Shopping, Meta and TikTok Shop sync", "15 day free trial on Awesome"],
    rating: "5.0 from 50,240 reviews; shows the Built for Shopify badge and a 2025 Shopify Build Award",
    level: "vendor",
    sources: [listing("judgeme")],
    checked: CHECKED_ON,
    rows: [
      { label: "Reviews on a free plan", ours: planF("reviews"), theirs: "Yes, unlimited reviews" },
      { label: "Photo and video reviews", ours: planF("reviews"), theirs: "Every plan, Free included" },
      { label: "Star rating near the price", ours: planF("product_reviews"), theirs: "Star rating badge, Free included" },
      { label: "Shoppers write reviews", ours: "Yes, and you approve them first", theirs: true },
      { label: "Review request emails", ours: "No", theirs: "Email requests listed; automatic reminders on Awesome" },
      { label: "Import reviews from other apps", ours: "No", theirs: "Free: importer, AliExpress sync, Etsy and Amazon sync" },
      { label: "Review data for Google", ours: "Yes, on product pages", theirs: "Google reviews sync and rich snippets, Free included" },
      { label: "Questions and answers", ours: "No", theirs: "Q&A on Awesome ($15 a month)" },
      { label: oneApp, ours: sameApp, theirs: false },
    ],
    theirEdge: ["The reviews specialist: 50,240 reviews on its own listing", "Review requests sent after fulfillment or delivery, and a review importer", "Reviews synced to Google, Meta, TikTok Shop and the Shop app", "If reviews are the main thing you need, its free plan is hard to beat"],
    ourEdge: ["Reviews in the same app as offers, bundles and checkout rules", "Review badges for WhatsApp, Instagram, TikTok and Google", `You can use both: the loyalty program on ${PLANS[integrationsPlan].name} connects with Judge.me`],
  },
];

/** The newest date any competitor was checked, for the /compare/ page. */
export const CHECKED = checkedText(COMPETITORS.map((c) => c.checked).sort().at(-1)!);

for (const c of COMPETITORS) {
  if (!c.has === !c.rows) throw new Error(`Competitor ${c.slug}: give either has (offer apps) or rows (other jobs)`);
  if (!c.theirEdge.length) throw new Error(`Competitor ${c.slug}: say where it is stronger (theirEdge)`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.checked)) throw new Error(`Competitor ${c.slug}: checked must be YYYY-MM-DD`);
  const text = JSON.stringify(c);
  if (/[–—]/.test(text)) throw new Error(`Competitor ${c.slug}: no en or em dashes in the text`);
}
