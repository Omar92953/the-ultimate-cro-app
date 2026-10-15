/**
 * Use case and industry pages (/use-cases/<slug>/): a goal or a kind of store, and which CRO Toolbox
 * features to set up for it. Only features the app has; no promised results.
 */
import type { FeatureKey } from "./app";

export type UseCase = {
  slug: string;
  kind: "Goal" | "Industry";
  title: string;
  description: string;
  lead: string;
  picks: { feature: FeatureKey; how: string }[];
  steps: string[];
};

export const USE_CASES: UseCase[] = [
  {
    slug: "raise-average-order-value",
    kind: "Goal",
    title: "Raise average order value on Shopify",
    description: "How to raise average order value on Shopify with quantity breaks, bundles, cross sells, a free shipping bar and an offer after payment, all in CRO Toolbox.",
    lead: "Average order value grows when shoppers have a clear reason to add one more item. These are the CRO Toolbox features that give them one, in the order most stores set them up.",
    picks: [
      { feature: "upsell", how: "Quantity breaks on your best sellers: Buy 2, save 10%; Buy 3, save 15%." },
      { feature: "bundles", how: "A frequently bought together box on products that go together, or a build your own box." },
      { feature: "shipping_bar", how: "Set the goal a little above your typical order, so the bar shows a reachable next step." },
      { feature: "cross_sell", how: "Pairs well with offers on the product page and in the cart drawer." },
      { feature: "post_purchase", how: "One product at a discount right after payment, added without new card details." },
    ],
    steps: ["Install CRO Toolbox and turn on the app embed.", "Create a quantity break offer for your best seller.", "Add a frequently bought together bundle on two products that sell together.", "Set the free shipping goal and check a test order at checkout."],
  },
  {
    slug: "bundles-for-beauty-brands",
    kind: "Industry",
    title: "Bundles for beauty and skincare brands",
    description: "Routine kits, build your own skin sets and serum plus cream bundles for beauty brands on Shopify, with CRO Toolbox.",
    lead: "Skincare sells as routines. Bundles let shoppers buy the whole routine at once, and reviews with photos show it works.",
    picks: [
      { feature: "bundles", how: "A routine kit sold as one product, or a build your set with more off for each extra item." },
      { feature: "upsell", how: "A bigger size as an upgrade: 50 ml instead of 30 ml for the difference." },
      { feature: "product_reviews", how: "The star rating next to the price and a review card near Add to cart." },
      { feature: "addons", how: "A travel size or sample ticked under Add to cart." },
      { feature: "thank_you", how: "A code for the next order, for refills." },
    ],
    steps: ["Create a kit for your best routine.", "Make a growing discount bundle from your skincare collection.", "Turn on product page reviews."],
  },
  {
    slug: "upsells-for-fashion",
    kind: "Industry",
    title: "Upsells for fashion and apparel stores",
    description: "Quantity breaks with a size per item, accessories as cross sells, quick add and wishlists for fashion stores on Shopify, with CRO Toolbox.",
    lead: "Fashion shoppers browse a lot and buy in sizes. These features cut the steps between liking something and buying it.",
    picks: [
      { feature: "upsell", how: "Buy 2 tees, save 10%, with a size picker for each tee." },
      { feature: "cross_sell", how: "Socks, bags and belts as pairs well with offers." },
      { feature: "quick_add", how: "Add to cart from collection pages, with a small size picker." },
      { feature: "wishlist", how: "Hearts on cards and a wishlist page with price dropped badges." },
      { feature: "sticky_atc", how: "Add to cart stays on screen on long product pages." },
    ],
    steps: ["Create a quantity break offer with Let shoppers pick a size for each item on.", "Turn on quick add and the wishlist.", "Add cross sells to your basics."],
  },
  {
    slug: "food-and-drink-mixed-cases",
    kind: "Industry",
    title: "Mixed cases for food and drink stores",
    description: "Any 6 for one price, build your own box, minimum orders and delivery dates for food and drink stores on Shopify, with CRO Toolbox.",
    lead: "Food and drink stores sell mixed cases and boxes, often with a minimum order and a delivery day. CRO Toolbox covers all three.",
    picks: [
      { feature: "bundles", how: "Any 6 for one price from a long collection, or a mix and match box." },
      { feature: "order_limits", how: "A minimum order total at checkout, with your own message." },
      { feature: "cart_extras", how: "A delivery date picked in the cart, saved on the order." },
      { feature: "delivery", how: "Order within 2h and get it tomorrow, from your cut off time." },
    ],
    steps: ["Create an any N bundle from your products collection.", "Set a minimum order total in Checkout.", "Turn on the delivery date picker in the cart."],
  },
  {
    slug: "home-and-candle-stores",
    kind: "Industry",
    title: "Bundles and gifts for home and candle stores",
    description: "Pick 3 candle boxes, gift wrapping, gift notes and frequently bought together sets for home and candle stores on Shopify, with CRO Toolbox.",
    lead: "Home and candle shoppers often buy gifts. Make the gift easy: a box to fill, wrapping and a note.",
    picks: [
      { feature: "bundles", how: "A pick 3 candle box for one price." },
      { feature: "addons", how: "Gift wrapping ticked under Add to cart." },
      { feature: "cart_extras", how: "This is a gift, a gift message and a delivery date." },
      { feature: "discounts", how: "Buy 2, get 1 free on a collection." },
    ],
    steps: ["Create a mix and match box from your candles collection.", "Add gift wrapping as an add on.", "Turn on the gift note in the cart."],
  },
  {
    slug: "personalized-gifts-and-jewelry",
    kind: "Industry",
    title: "Personalized gifts and jewelry",
    description: "Engraving with a live preview, gift wrapping, gift notes and review proof for jewelry and personalized gift stores on Shopify, with CRO Toolbox.",
    lead: "Personal items sell when shoppers can see the result. Show the engraving live and make gifting simple.",
    picks: [
      { feature: "personalize", how: "Engraving with a live preview on the product picture, and an optional fee." },
      { feature: "addons", how: "A gift box ticked under Add to cart." },
      { feature: "reviews", how: "Photo reviews from happy customers." },
      { feature: "trust_badges", how: "Secure checkout and free returns under Add to cart." },
    ],
    steps: ["Turn on personalization for your engravable products.", "Add a gift box as an add on.", "Collect and show photo reviews."],
  },
];
