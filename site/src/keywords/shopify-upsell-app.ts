/**
 * /shopify-upsell-app/: main search "shopify upsell app".
 * Facts from the help guides (upsell-offers, checkout) and lib/features.ts; plans from app/lib/plans.ts.
 */
import { cheapestPaid, money, PLANS, FEATURE_PLAN } from "../lib/app";
import type { KeywordPage } from "../lib/keywords";
import { planOf, freeLimits } from "../lib/plan-lines";

const upsellPlan = PLANS[FEATURE_PLAN.upsell].name;

const page: KeywordPage = {
  slug: "shopify-upsell-app",
  order: 10,
  menu: "Upsell app",
  keyword: "Shopify upsell app",
  title: "Shopify upsell app: quantity breaks, size upgrades and after purchase offers",
  description: `CRO Toolbox is a Shopify upsell app: quantity breaks, size upgrades, upgrade offers and a one click offer after payment. Free plan, paid from ${money(cheapestPaid.monthly)} a month.`,
  ogTitle: "A Shopify upsell app for bigger orders",
  kicker: "Upsells",
  h1: "Shopify upsell app: more of what shoppers already want",
  answer:
    "An upsell app gets shoppers to buy more of the product they chose or a better version of it, for example \"Buy 2, save 10%\" or a bigger size for a small extra. CRO Toolbox does this on Shopify with quantity breaks, size upgrades, upgrade offers and a one click offer after payment, and the discounts apply at checkout.",
  updated: "2026-10-17",
  shot: { name: "features/upsell", alt: "Quantity breaks on a product page of a demo store: Buy 1, Buy 2 and Buy 3 with savings", caption: "Quantity breaks on a demo store, made with the app's first template." },
  sections: [
    {
      heading: "What is an upsell?",
      paragraphs: [
        "An upsell raises what one order is worth by offering more of the same product, a bigger size or a better option, at the moment the shopper is deciding. The shopper keeps the product they wanted and gets a reason to take a little more.",
        "A cross sell is different: it offers another product that goes with the first one, like a case with a phone. CRO Toolbox does both; see <a href=\"/shopify-cross-sell/\">Shopify cross sell and frequently bought together</a>.",
      ],
    },
    {
      heading: "How CRO Toolbox does upsells",
      list: [
        "<b>Quantity breaks:</b> tiers such as Buy 2, save 10% and Buy 3, save 15%, with an optional badge like Most popular. The tier the shopper picks sets the quantity on your normal Add to cart button.",
        "<b>Size upgrades:</b> tiers on one option, for example L saves 10% and XL saves 20%. Picking a tier switches the product to that size with your theme's own size picker.",
        "<b>A size per item:</b> Buy 2 can be one M and one L. Each size goes into the cart and the tier discount still applies.",
        "<b>Upgrade offers:</b> swap the chosen option for a better one for the price difference.",
        "<b>After purchase offer:</b> one product at a discount, added to the paid order in one click, without entering payment details again.",
      ],
      after: ["Every upsell is set up in the app with a live preview of your own offer, and placed in your theme with the theme editor. Your theme's code is never edited."],
    },
    {
      heading: "How to set up an upsell",
      steps: [
        "Install CRO Toolbox and open <b>Offers → Upsell offers</b>. Create an offer.",
        "Choose which products get it: all products, specific products or collections.",
        "Add tiers: quantity, discount, and an optional label and badge.",
        "Open <b>Style</b>, pick a ready made look and adjust colours, corners and wording with the live preview.",
        "Click <b>Add to theme</b>: the theme editor opens with the block ready. Place it and save.",
      ],
      after: ["At checkout the discount applies to that product once the cart reaches the tier's quantity. Different variants of the same product count together."],
    },
  ],
  table: {
    heading: "Upsell types in CRO Toolbox",
    caption: "Each upsell type, what the shopper sees, where it shows and the plan that includes it",
    head: ["Upsell", "What the shopper sees", "Where", "Plan"],
    rows: [
      ["Quantity breaks", "Buy 2, save 10%; Buy 3, save 15%", "Product page", planOf("upsell")],
      ["Size upgrade", "A saving on a bigger size, for example L saves 10%", "Product page", planOf("upsell")],
      ["Upgrade offer", "A better option for the price difference", "Product page", planOf("upsell")],
      ["Volume discount", "Tiers by quantity, applied by Shopify at checkout", "Product page", planOf("discounts")],
      ["After purchase offer", "One more product at a discount, added in one click", "Right after payment", planOf("post_purchase")],
    ],
  },
  features: ["upsell", "post_purchase", "discounts"],
  demos: [
    { label: "Upsell offers demo", feature: "upsell" },
    { label: "After purchase offer demo", feature: "post_purchase" },
    { label: "Discounts demo", feature: "discounts" },
  ],
  help: ["upsell-offers", "checkout", "discounts-addons-personalization"],
  useCases: ["raise-average-order-value", "upsells-for-fashion"],
  articles: ["quantity-breaks-that-raise-aov", "cart-drawer-upsells-that-work"],
  related: ["shopify-cross-sell", "shopify-bundles", "increase-aov-shopify", "post-purchase-upsell-shopify"],
  faq: [
    {
      q: "What is the difference between an upsell and a cross sell?",
      a: "An upsell offers more of the same product or a better version of it: two instead of one, or a bigger size. A cross sell offers a different product that goes with it, like a case with a phone. CRO Toolbox has both: upsell offers and <a href=\"/shopify-cross-sell/\">cross sell offers</a>.",
    },
    {
      q: "Does the upsell discount apply at checkout?",
      a: "Yes. The shopper picks a tier, which sets the quantity on your normal Add to cart button. At checkout the discount applies to that product once the cart reaches the tier's quantity, and different variants of the same product count together.",
    },
    {
      q: "Can shoppers choose a different size for each item?",
      a: "Yes. With \"Let shoppers pick a size for each item\" on, choosing Buy 2 shows a size picker for each item, for example one M and one L. Your normal Add to cart adds each size and the tier discount still applies.",
    },
    {
      q: "Which plan do I need for upsells?",
      a: `Upsell offers are on the ${upsellPlan} plan. The ${PLANS.free.name} plan allows ${freeLimits()}. Paid plans start at ${money(cheapestPaid.monthly)} a month, with unlimited offers on at once. See <a href="/pricing/">pricing</a>.`,
    },
    {
      q: "Does it work with my theme?",
      a: "Yes, with any Online Store 2.0 theme. You set up the offer in the app and place its block in the theme editor; your theme's code is never edited.",
    },
    {
      q: "Can I offer an upsell after checkout?",
      a: "Yes. The after purchase offer shows one product at a discount right after payment, and the shopper adds it to the paid order in one click without entering payment details again. You choose the product, the discount and a minimum order amount.",
    },
  ],
};

export default page;
