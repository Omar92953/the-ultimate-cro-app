/**
 * /increase-aov-shopify/: main search "increase average order value shopify".
 * Facts from the use case raise-average-order-value, the help guides (upsell-offers, bundles, cart,
 * checkout, analytics) and lib/features.ts; plans from app/lib/plans.ts.
 */
import { PLANS, PLAN_KEYS, EXTRA_PLAN, FEATURE_PLAN, cheapestPaid, money, featureTitle, type FeatureKey } from "../lib/app";
import type { KeywordPage } from "../lib/keywords";
import { planOf, freeLimits } from "../lib/plan-lines";

const holdout = PLANS[EXTRA_PLAN.holdoutTest].name;
const tools: FeatureKey[] = ["upsell", "bundles", "cross_sell", "shipping_bar", "discounts", "addons", "post_purchase", "thank_you"];
const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0]);
/** "Upsell offers, Bundles … are on the Free plan; Add ons is on the Starter plan." from plans.ts. */
const byPlan = PLAN_KEYS.map((pk) => ({ plan: PLANS[pk].name, keys: tools.filter((k) => FEATURE_PLAN[k] === pk) }))
  .filter((g) => g.keys.length)
  .map((g) => `${list(g.keys.map(featureTitle))} ${g.keys.length > 1 ? "are" : "is"} on the ${g.plan} plan`)
  .join("; ");

const page: KeywordPage = {
  slug: "increase-aov-shopify",
  order: 40,
  menu: "Increase AOV",
  keyword: "increase average order value",
  title: "How to increase average order value on Shopify: 8 ways",
  description: `How to increase average order value on Shopify: quantity breaks, bundles, cross sells, a free shipping goal, gifts and a one click offer after payment, all in CRO Toolbox.`,
  ogTitle: "8 ways to increase average order value",
  kicker: "Average order value",
  h1: "How to increase average order value on Shopify",
  answer:
    "To increase average order value on Shopify, give shoppers a clear reason to add one more item to the same order: quantity breaks, bundles, cross sells, a free shipping goal a little above your typical order, and an offer after payment. CRO Toolbox has each of these in one app, and Shopify applies every discount at checkout.",
  updated: "2026-10-18",
  shot: { name: "features/shipping-bar", alt: "A free shipping bar on a demo store showing how much more to spend for free shipping", caption: "A free shipping bar on a demo store." },
  sections: [
    {
      heading: "What is average order value?",
      paragraphs: [
        "Average order value (AOV) is your sales divided by your number of orders over the same period. For example, $5,000 of sales from 100 orders is an average order value of $50. Shopify shows it in Analytics.",
        "Raising it means more revenue from the shoppers you already have, without paying for more visits.",
      ],
    },
    {
      heading: "8 ways to raise it",
      list: [
        "<b>Quantity breaks</b> on your best sellers: Buy 2, save 10%; Buy 3, save 15%. See <a href=\"/shopify-upsell-app/\">upsells</a>.",
        "<b>Bundles</b>: a frequently bought together box, a fixed set, or a box the shopper fills. See <a href=\"/shopify-bundles/\">bundles</a>.",
        "<b>Cross sells</b>: products that pair well, on the product page and in the cart. See <a href=\"/shopify-cross-sell/\">cross sells</a>.",
        "<b>A free shipping goal</b> a little above your typical order, so the bar shows a reachable next step.",
        "<b>Volume discounts, buy X get Y and a gift with purchase</b>, applied at checkout.",
        "<b>Add ons</b> under Add to cart, such as gift wrapping with a gift message.",
        "<b>An offer after payment</b>: one product at a discount, added to the paid order in one click.",
        "<b>A discount code for the next order</b> on the thank you page, for the second order rather than this one.",
      ],
    },
    {
      heading: "Where to start",
      paragraphs: ["Most stores set these up in this order, and change one thing at a time so they can see what each change does:"],
      steps: [
        "Install CRO Toolbox and turn on the app embed.",
        "Create a quantity break offer for your best seller.",
        "Add a frequently bought together bundle on two products that sell together.",
        "Set the free shipping goal a little above your typical order and check a test order at checkout.",
      ],
    },
    {
      heading: "How to tell if it works",
      paragraphs: [
        "Compare average order value in Shopify's Analytics before and after a change, over the same number of days.",
        `CRO Toolbox's Analytics shows sales from the app's offers and widgets over the last 30 days compared with the 30 before, with results for each offer and each bundle. The holdout test, on the ${holdout} plan and above, shows a share of shoppers no app widgets so you can compare what shoppers with and without them spend.`,
      ],
    },
  ],
  table: {
    heading: "Which tool does what",
    caption: "Ways to raise average order value in CRO Toolbox, where each shows and the plan that includes it",
    head: ["Tool", "How it raises order value", "Where it shows", "Plan"],
    rows: [
      ["Quantity breaks", "More of the same product, at a lower price per item", "Product page", planOf("upsell")],
      ["Bundles", "Several products together for one price or a discount", "Product page or the bundle's own page", planOf("bundles")],
      ["Cross sells", "A product that goes with the one in the cart", "Product page, cart page, cart drawer", planOf("cross_sell")],
      ["Free shipping bar", "A spending goal shoppers can see", "Cart and the top of the store", planOf("shipping_bar")],
      ["Discounts", "Volume discounts, buy X get Y, a gift once the cart reaches an amount", "Product page and checkout", planOf("discounts")],
      ["Add ons", "Small extras ticked under Add to cart", "Product page", planOf("addons")],
      ["After purchase offer", "One more product after payment, in one click", "Right after payment", planOf("post_purchase")],
      ["Thank you page", "A discount code for the next order", "Thank you page", planOf("thank_you")],
    ],
  },
  features: ["upsell", "bundles", "cross_sell", "shipping_bar", "discounts", "post_purchase"],
  demos: [
    { label: "Quantity breaks demo", feature: "upsell" },
    { label: "Bundles demo", feature: "bundles" },
    { label: "Cross sell demo", feature: "cross_sell" },
    { label: "Free shipping bar demo", feature: "shipping_bar" },
    { label: "After purchase offer demo", feature: "post_purchase" },
  ],
  help: ["upsell-offers", "bundles", "cart", "analytics"],
  useCases: ["raise-average-order-value"],
  articles: ["quantity-breaks-that-raise-aov", "cart-drawer-upsells-that-work", "mix-and-match-bundles-on-shopify"],
  related: ["shopify-upsell-app", "shopify-cross-sell", "shopify-bundles", "post-purchase-upsell-shopify", "shopify-cro"],
  faq: [
    {
      q: "What is average order value on Shopify?",
      a: "Your sales divided by your number of orders over the same period. $5,000 of sales from 100 orders is an average order value of $50. Shopify shows it in Analytics.",
    },
    {
      q: "What is the easiest way to increase average order value?",
      a: "A free shipping goal set a little above your typical order and quantity breaks on your best sellers are quick to set up and easy for shoppers to understand. Change one thing at a time so you can see what each change does.",
    },
    {
      q: "Can I raise average order value without discounts?",
      a: "Yes. Cross sells can be shown without a discount, a free shipping goal costs only the shipping, add ons such as gift wrapping are sold at their own price, and a bundle can be priced at the full price of its items.",
    },
    {
      q: "What is the difference between an upsell and a cross sell?",
      a: "An upsell offers more of the same product or a better version of it. A cross sell offers a different product that goes with it. Both raise order value; see <a href=\"/shopify-upsell-app/\">upsells</a> and <a href=\"/shopify-cross-sell/\">cross sells</a>.",
    },
    {
      q: "How do I know if a change worked?",
      a: `Compare average order value in Shopify's Analytics over the same number of days before and after. CRO Toolbox's Analytics shows sales from each offer and bundle, and the holdout test (${holdout} plan and above) compares shoppers with and without the app's widgets.`,
    },
    {
      q: "Which plan do I need?",
      a: `${byPlan}. The ${PLANS.free.name} plan allows ${freeLimits()}; paid plans start at ${money(cheapestPaid.monthly)} a month. See <a href="/pricing/">pricing</a>.`,
    },
  ],
};

export default page;
