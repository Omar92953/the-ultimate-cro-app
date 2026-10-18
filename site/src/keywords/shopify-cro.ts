/**
 * /shopify-cro/: main search "shopify cro app", also "conversion rate optimization shopify".
 * The tools table is generated from app/lib/catalog.ts (titles and one line descriptions) and
 * app/lib/plans.ts; the rest from the help guides (bars-and-product-tools, analytics, checkout) and
 * lib/features.ts.
 */
import { PLANS, PLAN_KEYS, EXTRA_PLAN, FEATURE_PLAN, cheapestPaid, money, featureTitle, featureAbout, plain, type FeatureKey } from "../lib/app";
import type { KeywordPage } from "../lib/keywords";
import { planOf, freeLimits } from "../lib/plan-lines";
import { FEATURE_COPY } from "../lib/features";

const holdout = PLANS[EXTRA_PLAN.holdoutTest].name;
const abPlan = PLANS[FEATURE_PLAN.ab_tests].name;
/** The tools in the table, in the order a shopper meets them. */
const tools: FeatureKey[] = ["product_reviews", "trust_badges", "delivery", "stock_urgency", "countdown", "sales_pop", "sticky_atc", "quick_add", "shipping_bar", "cart_offers", "payment_rules", "order_limits", "ab_tests"];
const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0]);
const byPlan = PLAN_KEYS.map((pk) => ({ plan: PLANS[pk].name, keys: tools.filter((k) => FEATURE_PLAN[k] === pk) }))
  .filter((g) => g.keys.length)
  .map((g) => `${list(g.keys.map(featureTitle))} ${g.keys.length > 1 ? "are" : "is"} on the ${g.plan} plan`)
  .join("; ");

const page: KeywordPage = {
  slug: "shopify-cro",
  order: 50,
  menu: "Shopify CRO",
  keyword: "Shopify CRO app",
  title: "Shopify CRO app: conversion rate optimization tools in one app",
  description: "CRO Toolbox is a Shopify CRO app: reviews, trust badges, delivery estimates, sticky add to cart, offers, checkout rules and A/B tests for any Online Store 2.0 theme.",
  ogTitle: "Conversion rate optimization for Shopify",
  kicker: "Conversion rate optimization",
  h1: "Shopify CRO app: more visitors who buy, and bigger orders",
  answer:
    "Conversion rate optimization (CRO) means getting more of your visitors to buy, and to buy more, by removing what stops them and giving them good reasons to go ahead. CRO Toolbox is a Shopify CRO app that puts the usual tools in one app: reviews and trust badges, delivery estimates and honest urgency, sticky add to cart, cart offers, checkout rules, analytics and A/B tests.",
  updated: "2026-10-18",
  shot: { name: "features/sticky-atc", alt: "A sticky add to cart bar on a product page of a demo store", caption: "Sticky add to cart on a demo store." },
  sections: [
    {
      heading: "What is CRO on Shopify?",
      paragraphs: [
        "Your conversion rate is the share of visits that end in an order: 30 orders from 1,000 sessions is a 3% conversion rate. Shopify shows it in Analytics, with how many sessions added to cart and reached checkout.",
        "CRO works on two numbers: how many visitors buy, and how much each order is worth. The second is <a href=\"/use-cases/raise-average-order-value/\">average order value</a>; together they decide revenue from the same traffic.",
      ],
    },
    {
      heading: "How CRO Toolbox helps",
      list: [
        "<b>Trust on the product page:</b> star ratings next to the price, reviews, and payment, shipping and guarantee badges under Add to cart.",
        "<b>Clear delivery:</b> \"Order within 2h 15m and get it Thu to Sat\", from your cut off time, days off and delivery times per country.",
        "<b>Honest urgency:</b> \"Only 3 left\" from your real stock, countdown timers to real deadlines, and pop ups with recent real purchases (never names).",
        "<b>The buy button in reach:</b> a sticky add to cart bar while shoppers scroll, and quick add on every product card.",
        "<b>A better cart and checkout:</b> a free shipping goal, offers in the cart, and payment and delivery rules and order limits at checkout.",
        "<b>Proof:</b> Analytics with sales from each offer, a holdout test, and A/B tests for upsells and cross sells.",
      ],
      after: ["Every widget is set up in the app with a live preview and placed in the theme editor, for any Online Store 2.0 theme, without editing your theme's code."],
    },
    {
      heading: "A simple CRO routine",
      steps: [
        "In Shopify's Analytics, look at where shoppers leave: product pages, the cart or checkout.",
        "Fix the biggest gap first. Product pages usually need reviews, trust badges and a delivery estimate.",
        "Change one thing at a time and compare the same number of days before and after.",
        `Test offers properly: the holdout test (${holdout} plan and above) compares shoppers with and without the app's widgets, and A/B tests (${abPlan} plan) split shoppers between two versions of an offer.`,
      ],
    },
    {
      heading: "A/B tests for offers",
      list: FEATURE_COPY.ab_tests.points.map((t) => plain(t)),
    },
  ],
  table: {
    heading: "Conversion tools in CRO Toolbox",
    caption: "Each conversion tool in CRO Toolbox, what it does and the plan that includes it",
    head: ["Tool", "What it does", "Plan"],
    rows: tools.map((k) => [`<a href="/features/${k.replace(/_/g, "-")}/">${featureTitle(k)}</a>`, featureAbout(k), planOf(k)]),
  },
  features: ["product_reviews", "trust_badges", "sticky_atc", "delivery", "stock_urgency", "ab_tests"],
  demos: [
    { label: "Product page reviews demo", feature: "product_reviews" },
    { label: "Trust badges demo", feature: "trust_badges" },
    { label: "Sticky add to cart demo", feature: "sticky_atc" },
    { label: "Delivery estimate demo", feature: "delivery" },
    { label: "Stock urgency demo", feature: "stock_urgency" },
    { label: "Countdown timers demo", feature: "countdown" },
  ],
  help: ["bars-and-product-tools", "storefront-sections", "analytics", "checkout"],
  useCases: ["raise-average-order-value", "upsells-for-fashion"],
  articles: ["countdown-timers-without-fake-urgency", "cart-drawer-upsells-that-work"],
  related: ["increase-aov-shopify", "shopify-upsell-app", "shopify-bundles", "shopify-cross-sell"],
  faq: [
    {
      q: "What is CRO for a Shopify store?",
      a: "Conversion rate optimization: changes that get more of your visitors to buy, and to buy more per order. It works on your conversion rate (orders divided by sessions) and your average order value.",
    },
    {
      q: "How do I see my conversion rate on Shopify?",
      a: "Shopify's Analytics shows your conversion rate and how many sessions added to cart, reached checkout and ordered. Divide orders by sessions for the same period: 30 orders from 1,000 sessions is 3%.",
    },
    {
      q: "Which conversion tools should I add first?",
      a: "Start where shoppers decide: the product page. Reviews next to the price, trust badges under Add to cart and a delivery estimate answer the usual doubts. Then a sticky add to cart bar and a free shipping goal.",
    },
    {
      q: "Do sales pop ups and urgency use real data?",
      a: "Yes. Sales pop ups show recent real purchases (the product and time, the city only if you turn it on, never names). Stock urgency comes from your real stock, and countdown timers should count to real deadlines only.",
    },
    {
      q: "Can I A/B test offers?",
      a: `Yes, on the ${abPlan} plan. Half of your shoppers see version B of an upsell or cross sell, with different words, discount or style. Each shopper keeps one version, the app says which is ahead only when there is enough data, and one click uses the winner.`,
    },
    {
      q: "Which plan do I need?",
      a: `${byPlan}. The ${PLANS.free.name} plan allows ${freeLimits()}; paid plans start at ${money(cheapestPaid.monthly)} a month. See <a href="/pricing/">pricing</a>.`,
    },
  ],
};

export default page;
