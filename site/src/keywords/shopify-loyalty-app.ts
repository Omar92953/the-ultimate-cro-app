/**
 * /shopify-loyalty-app/: main search "shopify loyalty app", also "points and rewards", "referral program".
 * Facts from the help guide loyalty-program, lib/features.ts and app/lib/loyalty/config.ts (LOYALTY_PRO through
 * lib/app, without the loyalty email part while emails are hidden); plans and limits from app/lib/plans.ts.
 */
import { PLANS, FEATURE_PLAN, LOYALTY_PRO, money } from "../lib/app";
import type { KeywordPage } from "../lib/keywords";
import { planOf } from "../lib/plan-lines";

const growth = PLANS[FEATURE_PLAN.loyalty];
const pro = PLANS.pro;
const orders = (n: number | null) => (n ?? 0).toLocaleString("en-US");
const proList = `${LOYALTY_PRO.slice(0, -1).join(", ")} and ${LOYALTY_PRO.at(-1)}`;

const page: KeywordPage = {
  slug: "shopify-loyalty-app",
  order: 75,
  menu: "Loyalty app",
  keyword: "Shopify loyalty app",
  title: "Shopify loyalty app with points, rewards and referrals",
  description: `CRO Toolbox is a Shopify loyalty app with points, rewards, a Points shop and referrals, plus upsells, bundles and a Track page in the same plan, from ${money(growth.monthly)} a month.`,
  ogTitle: "Loyalty that also raises order value",
  kicker: "Loyalty",
  h1: "Shopify loyalty app: points, rewards and referrals",
  answer: `A Shopify loyalty app gives customers points for orders and other actions and lets them spend the points on rewards, so they come back and buy again. CRO Toolbox does this on the ${growth.name} plan (${money(growth.monthly)} a month), and the same plan also has upsells, bundles, cart offers, a Track page and returns, so one app raises both lifetime value (LTV) and average order value (AOV).`,
  updated: "2026-10-30",
  shot: { name: "features/loyalty-program", alt: "A rewards panel on a demo store with the points balance, ways to earn and rewards", caption: "The rewards panel on a demo store." },
  sections: [
    {
      heading: "What a Shopify loyalty app does",
      paragraphs: [
        "A loyalty app keeps a points balance for each customer. Orders and actions such as creating an account add points; rewards such as money off or free shipping spend them. Shoppers see their balance on the store, so the next order feels like it is worth more.",
        "Most loyalty apps stop there: they bring customers back, but don't change what each order is worth. That part usually needs a second app for upsells and bundles.",
      ],
    },
    {
      heading: "Why one app for loyalty and order value is better value",
      list: [
        `<b>One plan instead of two or three apps.</b> ${growth.name} includes the loyalty program and every upsell, cross sell, bundle and discount type, plus the Track order and Returns pages.`,
        "<b>Loyalty raises LTV, offers raise AOV.</b> Points bring the customer back; quantity breaks, bundles and cart offers make each of those orders bigger.",
        "<b>The pieces work together.</b> Points show on product pages and in the cart next to your offers, the Track page shows offers while the customer waits for the parcel, and on Pro, returns can keep the sale with store credit or an exchange.",
        "<b>One look and one menu.</b> The rewards widget, offers and sections share one design style and are set up in the same app, with a live preview.",
        "<b>Fewer scripts on the store.</b> Widgets are theme app blocks and app embeds that read your store's own data, instead of several apps each adding their own.",
      ],
    },
    {
      heading: "Loyalty in CRO Toolbox",
      list: [
        "<b>Earn:</b> points for paid orders, creating an account, the first order, birthdays, product reviews and social follows.",
        "<b>Rewards:</b> an amount or percent off, free shipping, a free product or store credit.",
        "<b>Points shop:</b> products members get with points, or points plus money, and products sold only with points.",
        "<b>Referrals:</b> a friend gets a discount on their first order, and the member gets points or store credit once that order is paid.",
        "<b>Where members see it:</b> a rewards button and panel on every page, points on product pages and in the cart, a Rewards page, customer accounts, the thank you page and Shopify POS.",
        "<b>Guests and refunds:</b> choose whether guest orders earn; refunds and cancellations take points back; new points can stay pending before they can be spent.",
        "<b>Languages:</b> 7 built in translations, and right to left languages.",
        `<b>${pro.name} adds</b> ${proList}.`,
      ],
      after: ["Loyalty emails (welcome, points earned, reward ready) are coming soon; until then members see everything in the widget, on the Rewards page and in their account."],
    },
    {
      heading: "How to set it up",
      steps: [
        "Install CRO Toolbox and choose the Growth or Pro plan (14 day free trial).",
        "Open <b>Loyalty → Earn points</b> and choose what earns points.",
        "Open <b>Rewards</b> and add what members spend their points on.",
        "Turn the program on on <b>Loyalty home</b>, and choose whether past orders (30 or 90 days) count.",
        "Turn on the <b>Conversion boosters</b> app embed in your theme: the rewards button shows on every page.",
      ],
    },
  ],
  table: {
    heading: "What each plan includes",
    caption: "Loyalty features in CRO Toolbox and the plan that includes each",
    head: ["Feature", "What it does", "Plan"],
    rows: [
      ["Points and rewards", "Points for orders and actions, rewards members spend", planOf("loyalty")],
      ["Points shop", "Products for points, or points plus money", planOf("loyalty")],
      ["Referrals", "A first order discount for the friend, a gift for the member", planOf("loyalty")],
      ["Orders that earn points", `${orders(PLANS.growth.limits.loyaltyOrders)} a month on ${PLANS.growth.name}, ${orders(PLANS.pro.limits.loyaltyOrders)} on ${pro.name}`, planOf("loyalty")],
      ["VIP tiers, campaigns, cashback, affiliates", "Bigger rewards for your best customers and partners", `${pro.name} (${money(pro.monthly)} a month)`],
      ["Klaviyo, Omnisend, Judge.me, Shopify Flow", "Points and members in the tools you already use", `${pro.name} (${money(pro.monthly)} a month)`],
      ["Upsells, bundles, cart offers", "Raise order value in the same app", planOf("upsell")],
      ["Track order and Returns pages", "Bring customers back after the order", planOf("track")],
    ],
  },
  features: ["loyalty", "upsell", "bundles", "track"],
  demos: [],
  help: ["loyalty-program"],
  useCases: ["raise-average-order-value"],
  articles: ["shopify-loyalty-program-setup", "shopify-referral-program"],
  related: ["increase-aov-shopify", "shopify-upsell-app", "shopify-order-tracking-page"],
  faq: [
    {
      q: "What is the best value loyalty app for Shopify?",
      a: `It depends on what else you need. If you also want upsells, bundles or a tracking page, an app that includes them saves a second subscription: CRO Toolbox has the loyalty program, every offer type, and the Track order and Returns pages in the ${growth.name} plan at ${money(growth.monthly)} a month (${money(growth.yearly)} a year).`,
    },
    {
      q: "Which plan includes the loyalty program?",
      a: `${growth.name} (${money(growth.monthly)} a month) and ${pro.name} (${money(pro.monthly)} a month), each with a ${growth.trialDays} day free trial. ${growth.name} includes ${orders(PLANS.growth.limits.loyaltyOrders)} orders that earn points a month and ${pro.name} ${orders(PLANS.pro.limits.loyaltyOrders)}. See <a href="/pricing/">pricing</a>.`,
    },
    {
      q: "What happens at the monthly limit?",
      a: "Orders stop earning points until next month, unless you turn on Allow extra in the app on monthly billing; the extra is added to your Shopify bill. Nothing else switches off.",
    },
    {
      q: "Does it work with guest checkouts?",
      a: "Yes. You choose whether guest orders earn points right away (kept for that email until the customer signs in), only once they create an account, or not at all.",
    },
    {
      q: "Does it work at Shopify POS?",
      a: "Yes. Members' points show at Shopify POS as well as on the store, in customer accounts and on the thank you page.",
    },
    {
      q: "Can I move members from another loyalty app?",
      a: "Yes. On the Members page you can import members and their points from a CSV file, and export them the same way.",
    },
  ],
};

export default page;
