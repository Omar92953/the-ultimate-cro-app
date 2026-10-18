/**
 * /shopify-order-tracking-page/: main search "shopify order tracking page".
 * Facts from the app's Tracking & Returns setup (app/routes/app.tracking-returns.tsx,
 * app.tracking-source.tsx), the track page recommendations (app/lib/track-recs.server.ts), the help guide
 * track-and-returns-pages and lib/features.ts. Statuses, sources and the live tracking limit come from
 * app/lib/tracking.ts; plans from app/lib/plans.ts.
 */
import { PLANS, PLAN_KEYS, FEATURE_PLAN, money, type PlanKey } from "../lib/app";
import type { KeywordPage } from "../lib/keywords";
import { TRACK_STATUSES, TRACK_STATUS_LABEL, SOURCE_PLAN, LIVE_MONTHLY_LIMIT } from "../../../app/lib/tracking";

const trackPlan = PLANS[FEATURE_PLAN.track];
const livePlan = PLANS[SOURCE_PLAN.live].name;
/** A source needs both the Track page's plan and its own. */
const sourcePlan = (k: keyof typeof SOURCE_PLAN) => {
  const need = [FEATURE_PLAN.track, SOURCE_PLAN[k] as PlanKey].sort((a, b) => PLAN_KEYS.indexOf(a) - PLAN_KEYS.indexOf(b)).at(-1)!;
  const p = PLANS[need];
  return `${p.name} (${money(p.monthly)} a month)`;
};
const statuses = TRACK_STATUSES.map((s) => TRACK_STATUS_LABEL[s]);
const list = (items: string[]) => `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

const page: KeywordPage = {
  slug: "shopify-order-tracking-page",
  order: 70,
  menu: "Order tracking page",
  keyword: "Shopify order tracking page",
  title: "Shopify order tracking page on your own store",
  description: "Add a Shopify order tracking page with CRO Toolbox: shoppers enter their order number and email and see the delivery status, the carrier link and dates, with product rows below.",
  ogTitle: "An order tracking page on your store",
  kicker: "Order tracking",
  h1: "Shopify order tracking page, on your own store",
  answer:
    "An order tracking page lets shoppers look up their order on your store with the order number and email and see where it is, so they don't have to email you to ask. CRO Toolbox makes the page for you on Shopify and shows the delivery status, tracking number, carrier link and dates, with optional product rows under the order.",
  updated: "2026-10-18",
  shot: { name: "features/track", alt: "A Track your order page on a demo store with an order's delivery status", caption: "The Track order page on a demo store." },
  sections: [
    {
      heading: "Why a tracking page on your own store",
      paragraphs: [
        "Shopify sends shipping emails and has an order status page, but shoppers lose the email and then write to you. A Track your order page in your menu or footer answers \"where is my order?\" at any time, with nothing more than the order number and email.",
        "The page is on your store, not the carrier's site, so it keeps your look and can show products the shopper may want next.",
      ],
    },
    {
      heading: "What shoppers see",
      list: [
        `<b>The status:</b> ${list(statuses)}.`,
        "<b>The tracking number</b> and the carrier's tracking link.",
        "<b>Dates:</b> the estimated delivery and the delivered date when Shopify has them, and the latest place when it is known.",
        "<b>Product rows under the order:</b> \"You may also like\" and \"Complete your order\", from the order's collections, products bought together in your orders, or products you choose. Products already in the order are never shown, and only products in stock.",
      ],
      after: ["The page has ready made looks, and you set its words, colours and width in the app."],
    },
    {
      heading: "How to set it up",
      steps: [
        "Install CRO Toolbox and open <b>Tracking & Returns</b>.",
        "Choose where tracking comes from. Shopify's data is the default.",
        "Click <b>Make the pages</b>: the app creates the \"Track your order\" and \"Returns\" pages in your store.",
        "Click <b>Open the theme editor</b>, choose Add block, CRO Toolbox, Order & wishlist pages, and save. It shows only on those two pages.",
        "Add the Track your order page to your menu or footer.",
      ],
      after: ["Until Shopify approves the app's access to all orders, orders older than 60 days can't be found on the page."],
    },
  ],
  table: {
    heading: "Where tracking comes from",
    caption: "The tracking sources for the Track order page and the plan each needs",
    head: ["Source", "What it gives", "Plan"],
    rows: [
      ["Shopify's tracking data", "The status, tracking number, estimated delivery and any events Shopify has for the shipment. Every country, at no extra cost.", sourcePlan("shopify")],
      ["Live tracking", `Where the parcel is now and the full history, from most carriers worldwide. Up to ${LIVE_MONTHLY_LIMIT} shipments a month; over the limit the page uses Shopify's data.`, sourcePlan("live")],
      ["Your own key", "A key from your shipping company or tracking service. No limit from us.", sourcePlan("own")],
      ["Webhook link", "For carriers or services that send you updates: every update shows on the page.", sourcePlan("webhook")],
    ],
  },
  features: ["track", "returns"],
  demos: [
    { label: "Track order page demo", feature: "track" },
    { label: "Returns page demo", feature: "returns" },
  ],
  help: ["track-and-returns-pages"],
  useCases: [],
  articles: [],
  related: ["shopify-returns-app", "shopify-cro"],
  faq: [
    {
      q: "How do customers track an order on a Shopify store?",
      a: "Shopify's shipping emails and order status page show tracking for that order. A tracking page on your store lets shoppers look it up at any time with the order number and email, without finding the email.",
    },
    {
      q: "What do shoppers need to look up an order?",
      a: "The order number and the email used for the order.",
    },
    {
      q: "Where does the tracking information come from?",
      a: `From Shopify's tracking data by default. On ${livePlan}, live tracking shows where the parcel is now from most carriers, up to ${LIVE_MONTHLY_LIMIT} shipments a month. You can also use your own key from a shipping company or tracking service, or a webhook link.`,
    },
    {
      q: "Can I show products on the tracking page?",
      a: "Yes. Up to two rows under the order, \"You may also like\" and \"Complete your order\", from the order's collections, products bought together in your orders, or products you pick. Products already in the order are never shown, only products in stock.",
    },
    {
      q: "Can shoppers find old orders?",
      a: "Orders from the last 60 days, and older ones once Shopify approves the app's access to all orders.",
    },
    {
      q: "Which plan do I need?",
      a: `The Track order page is on the ${trackPlan.name} plan (${money(trackPlan.monthly)} a month or ${money(trackPlan.yearly)} a year, with a ${trackPlan.trialDays} day free trial). Live tracking is included on ${livePlan}. See <a href="/pricing/">pricing</a>.`,
    },
  ],
};

export default page;
