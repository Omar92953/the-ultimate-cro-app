/**
 * /shopify-returns-app/: main search "shopify returns app", also "shopify exchanges".
 * Facts from the help guide track-and-returns-pages (returns and return saving rules), the app's Tracking &
 * Returns setup (app/routes/app.tracking-returns.tsx) and lib/features.ts; plans from app/lib/plans.ts.
 */
import { PLANS, FEATURE_PLAN, money } from "../lib/app";
import type { KeywordPage } from "../lib/keywords";
import { planOf } from "../lib/plan-lines";

const returnsPlan = PLANS[FEATURE_PLAN.returns];
const savingPlan = PLANS[FEATURE_PLAN.return_saving];

const page: KeywordPage = {
  slug: "shopify-returns-app",
  order: 80,
  menu: "Returns app",
  keyword: "Shopify returns app",
  title: "Shopify returns app: a returns page, exchanges and store credit",
  description: "CRO Toolbox is a Shopify returns app: a returns page on your store, real Shopify returns you approve, labels and refunds, plus exchanges and store credit with a bonus.",
  ogTitle: "Returns, exchanges and store credit",
  kicker: "Returns",
  h1: "Shopify returns app: returns, exchanges and store credit",
  answer: `A returns app gives shoppers a page on your store to ask for a return, and turns each request into a Shopify return you approve, send a label for and refund. CRO Toolbox does this on Shopify, and on the ${savingPlan.name} plan it can offer an exchange or store credit with a bonus before a refund, approve returns by rule and put items back in stock.`,
  updated: "2026-10-18",
  shot: { name: "features/returns", alt: "A Returns page on a demo store where a shopper chooses items and a reason", caption: "The Returns page on a demo store." },
  sections: [
    {
      heading: "What a Shopify returns app does",
      paragraphs: [
        "Without one, returns arrive by email: you ask for the order number, the items and the reason, then create the return in Shopify by hand. A returns app puts a form on your store that collects all of that, applies your rules, and creates the return in Shopify for you.",
        "A returns app can also try to keep the sale: an exchange for another size, or store credit, before a refund.",
      ],
    },
    {
      heading: "How returns work in CRO Toolbox",
      list: [
        "Shoppers ask for a return on your Returns page with the order number and email, and choose the items and a reason.",
        "Each request is a real Shopify return you approve or decline in the app, and Shopify emails the shopper.",
        "Your rules: the return window, products that can't be returned, reasons approved at once, and your return address.",
        "Upload your return label for the shopper, then refund when the items arrive.",
      ],
    },
    {
      heading: `Exchanges and store credit (${savingPlan.name})`,
      list: [
        "<b>Store credit instead of a refund</b>, with an optional bonus such as 10% extra. It is given as a refund to Shopify store credit on the customer's account, so the order shows the money as refunded. The shopper sees the credit on the Returns page.",
        "<b>Exchanges</b> for another size or colour of the same product that is in stock. The shopper sees the price difference before sending. When you approve, the app makes the Shopify return with the exchange, and the new shipment waits on hold until you mark the items as arrived.",
        "<b>Approve by rule:</b> reason, product tag, order value and days since delivery.",
        "<b>Back in stock:</b> returned items go back into stock at your location.",
      ],
      after: ["Refunds to the original payment stay available for every shopper. If an exchange costs more, you send the invoice from the order in Shopify; if it costs less, the difference is refunded."],
    },
    {
      heading: "How to set it up",
      steps: [
        "Install CRO Toolbox, open <b>Tracking & Returns</b> and approve the returns permission when Shopify asks.",
        "Click <b>Make the pages</b>: the app creates the \"Track your order\" and \"Returns\" pages in your store.",
        "Click <b>Open the theme editor</b>, choose Add block, CRO Toolbox, Order & wishlist pages, and save.",
        "Set your return window, products that can't be returned and your return address.",
        "Add the Returns page to your menu or footer.",
      ],
    },
  ],
  table: {
    heading: "What each plan includes",
    caption: "Returns features in CRO Toolbox and the plan that includes each",
    head: ["Feature", "What it does", "Plan"],
    rows: [
      ["Returns page", "Shoppers ask for a return with the order number and email", planOf("returns")],
      ["Real Shopify returns", "Approve or decline in the app; Shopify emails the shopper", planOf("returns")],
      ["Return rules", "Return window, products that can't be returned, reasons approved at once, return address", planOf("returns")],
      ["Labels and refunds", "Upload a return label, refund when the items arrive", planOf("returns")],
      ["Store credit with a bonus", "Credit instead of a refund, as a refund to Shopify store credit", planOf("return_saving")],
      ["Exchanges", "Another size or colour, with the new shipment held until the items arrive", planOf("return_saving")],
      ["Approve by rule and restock", "Rules by reason, tag, order value and days since delivery; items back in stock", planOf("return_saving")],
    ],
  },
  features: ["returns", "return_saving", "track"],
  demos: [
    { label: "Returns page demo", feature: "returns" },
    { label: "Track order page demo", feature: "track" },
  ],
  help: ["track-and-returns-pages"],
  useCases: [],
  articles: [],
  related: ["shopify-order-tracking-page", "shopify-cro"],
  faq: [
    {
      q: "Does CRO Toolbox create real Shopify returns?",
      a: "Yes. Each request from the Returns page becomes a Shopify return that you approve or decline in the app, and Shopify emails the shopper.",
    },
    {
      q: "Can shoppers exchange an item for another size or colour?",
      a: `Yes, on the ${savingPlan.name} plan. The shopper picks another variant of the same product that is in stock and sees the price difference before sending. The new shipment waits on hold until you mark the returned items as arrived.`,
    },
    {
      q: "Can I offer store credit instead of a refund?",
      a: `Yes, on the ${savingPlan.name} plan, with an optional bonus such as 10% extra. The credit is a refund to Shopify store credit on the customer's account.`,
    },
    {
      q: "Can shoppers still get a refund?",
      a: "Yes. Refunds to the original payment stay available for every shopper.",
    },
    {
      q: "Who sends the return label?",
      a: "You do: upload your return label in the app for the shopper, then refund when the items arrive.",
    },
    {
      q: "Which plan do I need?",
      a: `Returns are on the ${returnsPlan.name} plan (${money(returnsPlan.monthly)} a month). Exchanges, store credit, approve by rule and restocking are on the ${savingPlan.name} plan (${money(savingPlan.monthly)} a month). ${returnsPlan.trialDays === savingPlan.trialDays ? `Both have a ${savingPlan.trialDays} day free trial. ` : ""}See <a href="/pricing/">pricing</a>.`,
    },
  ],
};

export default page;
