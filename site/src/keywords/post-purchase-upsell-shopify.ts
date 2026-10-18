/**
 * /post-purchase-upsell-shopify/: main search "post purchase upsell".
 * Facts from the after purchase offer page in the app (app/routes/app.checkout.after-purchase.tsx),
 * the checkout help guide and lib/features.ts; plans from app/lib/plans.ts.
 */
import { PLANS, FEATURE_PLAN, cheapestPaid, money } from "../lib/app";
import type { KeywordPage } from "../lib/keywords";
import { planOf, freeLimits } from "../lib/plan-lines";

const ppPlan = PLANS[FEATURE_PLAN.post_purchase].name;
const tyPlan = PLANS[FEATURE_PLAN.thank_you].name;

const page: KeywordPage = {
  slug: "post-purchase-upsell-shopify",
  order: 60,
  menu: "Post purchase upsell",
  keyword: "post purchase upsell",
  title: "Post purchase upsell for Shopify: a one click offer after payment",
  description: "Add a post purchase upsell to Shopify with CRO Toolbox: one product at a discount right after payment, added to the same order in one click without entering card details again.",
  ogTitle: "A one click offer after payment",
  kicker: "Post purchase",
  h1: "Post purchase upsell on Shopify",
  answer:
    "A post purchase upsell is an offer shown right after the shopper pays, which they can add to the order they just placed in one click, without entering card details again. In CRO Toolbox you pick one product and a discount, and Shopify shows the offer between payment and the thank you page and adds it to the same order and shipment.",
  updated: "2026-10-18",
  shot: { name: "features/post-purchase", alt: "An after purchase offer on a demo store: one product at a discount with an accept button", caption: "An after purchase offer, on a demo store." },
  sections: [
    {
      heading: "What is a post purchase upsell?",
      paragraphs: [
        "It is the last offer of the visit, shown after the order is paid and before the thank you page. Because the first order is already placed, the offer can't put that sale at risk, and the shopper doesn't type anything again: accepting adds the product to the same order.",
        "It suits small, useful extras: a refill, a travel size, a case, a second colour of what they just bought.",
      ],
    },
    {
      heading: "How CRO Toolbox does it",
      list: [
        "One product at a discount you choose, from 0 to 90% off.",
        "Your own heading and text. The product and discount are added after your text, for example \"Get 15% off Travel case.\"",
        "Only for bigger orders if you want: show it from an order amount you set, or on every order.",
        "Added to the same order and shipment. It isn't shown when the product is already in the order.",
        "The shopper sees the price, shipping and taxes before paying. The buttons read \"Pay now\" and \"Decline this offer\": those are Shopify's rules for after purchase offers.",
      ],
      after: ["Shopify shows after purchase offers for card and Shop Pay payments."],
    },
    {
      heading: "How to set it up",
      steps: [
        "Install CRO Toolbox and open <b>Offers → Upsell → After purchase</b>.",
        "Pick the product and the discount, and if you want, the order amount it starts from.",
        "Write the heading and text, and switch the offer on.",
        "In Shopify, open <b>Settings → Checkout</b> and under <b>Post purchase page</b> choose CRO Toolbox.",
        "Place a test order and check the offer after payment.",
      ],
    },
    {
      heading: "After the offer: the thank you page",
      paragraphs: [
        "The thank you page comes next. CRO Toolbox can add modules there: a discount code for the next order with a copy button, a message, follow us buttons and product suggestions. It works on every Shopify plan.",
      ],
    },
  ],
  table: {
    heading: "Upsells before and after payment",
    caption: "Where each kind of upsell in CRO Toolbox shows and the plan that includes it",
    head: ["Offer", "When the shopper sees it", "Plan"],
    rows: [
      ["Quantity breaks and size upgrades", "On the product page, before adding to cart", planOf("upsell")],
      ["Cross sell offers", "On the product page, the cart page and the cart drawer", planOf("cross_sell")],
      ["After purchase offer", "Right after payment, before the thank you page", planOf("post_purchase")],
      ["Thank you page modules", "On the thank you page, for the next order", planOf("thank_you")],
    ],
  },
  features: ["post_purchase", "thank_you", "upsell"],
  demos: [
    { label: "After purchase offer demo", feature: "post_purchase" },
    { label: "Thank you page demo", feature: "thank_you" },
  ],
  help: ["checkout", "upsell-offers"],
  useCases: ["raise-average-order-value"],
  articles: ["quantity-breaks-that-raise-aov"],
  related: ["shopify-upsell-app", "increase-aov-shopify", "shopify-cross-sell"],
  faq: [
    {
      q: "What is a post purchase upsell?",
      a: "An offer shown right after the shopper pays and before the thank you page. Accepting adds the product to the order they just placed, without entering card details again.",
    },
    {
      q: "Does the shopper have to pay again?",
      a: "They accept with one click and don't type their card details again. Before accepting they see the price, shipping and taxes; Shopify's buttons read \"Pay now\" and \"Decline this offer\".",
    },
    {
      q: "Is the extra product shipped with the first order?",
      a: "Yes. Shopify adds it to the same order and shipment.",
    },
    {
      q: "Which payment methods show the offer?",
      a: "Shopify shows after purchase offers for card and Shop Pay payments.",
    },
    {
      q: "How do I turn it on?",
      a: "Set up the offer in CRO Toolbox (Offers → Upsell → After purchase), then in Shopify open Settings → Checkout and under Post purchase page choose CRO Toolbox.",
    },
    {
      q: "Which plan do I need?",
      a: `The after purchase offer is on the ${ppPlan} plan and uses one of the plan's offers on at once; thank you page modules are on the ${tyPlan} plan. The ${PLANS.free.name} plan allows ${freeLimits()}; paid plans start at ${money(cheapestPaid.monthly)} a month. See <a href="/pricing/">pricing</a>.`,
    },
  ],
};

export default page;
