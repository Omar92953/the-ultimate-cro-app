/**
 * What each feature page says beyond the catalog's one line (app/lib/catalog.ts): who it's for, what
 * you can set, and related features. Every point here must be true of the app today (check the code
 * and docs/README-merchant.md before adding one). Template names come from the app (lib/templates.ts).
 */
import type { FeatureKey } from "./app";

export type FeatureCopy = {
  /** One sentence: who it's for and why. */
  who: string;
  /** What you can set, short lines. */
  points: string[];
  related: FeatureKey[];
  /** A fact worth knowing (limits, where it works). */
  note?: string;
};

export const FEATURE_COPY: Record<FeatureKey, FeatureCopy> = {
  upsell: {
    who: "For stores that want shoppers to take two or three instead of one, or a bigger size.",
    points: [
      "Quantity tiers such as Buy 2, save 10% and Buy 3, save 15%, with an optional badge like Most popular",
      "Size upgrades: tiers on one option, for example L saves 10%",
      "A size picker per item, so Buy 2 can be one M and one L",
      "Upgrade offers: swap the chosen option for a better one for the price difference",
      "Products by all, specific products or collections; the discount applies at checkout",
    ],
    related: ["cross_sell", "bundles", "discounts"],
  },
  cross_sell: {
    who: "For stores with products that go together, like a case with a phone or a cream with a serum.",
    points: [
      "Offered products shoppers tick and add in one click; never ticked in advance",
      "Show on the product page, the cart page and the cart drawer",
      "Optional percentage off the offered products while a trigger product is in the cart",
      "Sold out products, the product being viewed and products already in the cart are skipped",
      "Shopify recommendations for products no rule covers",
    ],
    related: ["cart_offers", "upsell", "bundles"],
  },
  bundles: {
    who: "For stores that sell sets, gift boxes, multipacks or build your own boxes.",
    points: [
      "Six ways to bundle: frequently bought together, a fixed bundle sold as one product, mix and match, build your own bundle, a tiered bundle and a fixed price bundle",
      "Shopify prices the bundle at checkout and each picked item's stock goes down",
      "One price, a percentage off, or tiers by item count",
      "The app can create and publish the bundle product and its store page for you",
      "Every bundle type is included on the Free plan, within its offer slots",
    ],
    related: ["upsell", "discounts", "cross_sell"],
    note: "Bundle prices and stock tracking need the app installed from the Shopify App Store (or a Shopify Plus store).",
  },
  discounts: {
    who: "For promotions: buy two get one, spend more save more, or a free gift.",
    points: ["Buy X get Y, with the same or different products", "Volume discounts by quantity, shown as tiers on the product page", "A free gift once the cart reaches an amount", "Applied by Shopify at checkout"],
    related: ["upsell", "bundles", "shipping_bar"],
  },
  addons: {
    who: "For extras shoppers often want: gift wrapping, a greeting card or a matching small item.",
    points: ["Add ons ticked under Add to cart, added together with the product", "An optional gift message saved on the order", "A list or cards, your own heading and colours", "Show on all products, specific products or collections"],
    related: ["personalize", "cart_extras", "cross_sell"],
  },
  personalize: {
    who: "For engraved, printed or named products.",
    points: ["Text fields with a live preview on the product picture", "Colour choices", "Required fields and a character limit", "An optional fee for personalization", "Saved on the order with the item"],
    related: ["addons", "cart_extras"],
  },
  cart_offers: {
    who: "For stores that keep their theme's own cart drawer and want offers in it.",
    points: ["Cross sell offers inside the theme's cart drawer", "Shows when the cart has a trigger product", "Heading, number of products and button text are yours"],
    related: ["cross_sell", "cart_extras", "shipping_bar"],
    note: "Offers in the theme's own drawer work with Dawn and Dawn based themes.",
  },
  cart_extras: {
    who: "For gift shops and stores that deliver on a chosen day.",
    points: ["This is a gift, with a gift message", "A delivery date picker, with time slots if you want", "A discount code box on the cart page and in the cart drawer, with applied codes and an error for codes that do not work", "Gift and date details saved on the order"],
    related: ["addons", "cart_offers", "delivery"],
  },
  reviews: {
    who: "For every store: proof from real customers next to your products.",
    points: ["Text, photo and video reviews", "Badges for WhatsApp, Instagram, TikTok and Google reviews", "Carousel, grid, masonry or a full list with stars summary", "Shoppers can write reviews you approve first", "Review data for Google on product pages"],
    related: ["product_reviews", "trust_badges", "sales_pop"],
  },
  product_reviews: {
    who: "For product pages: the rating and a review near the price and Add to cart.",
    points: ["A star rating line next to the price", "A snippet card with one review", "A full review list with Write a review"],
    related: ["reviews", "trust_badges"],
  },
  sales_pop: {
    who: "For showing that people really buy from your store.",
    points: ["Pop ups with recent real purchases: product and time", "The city only if you turn it on; never names", "Position, timing, how many per visit and devices"],
    related: ["reviews", "stock_urgency"],
  },
  trust_badges: {
    who: "For new visitors who want to know their order is safe.",
    points: ["Badges like secure checkout, fast delivery, free returns", "Your store's payment icons", "A row or a grid, with an optional heading"],
    related: ["reviews", "delivery"],
  },
  logos: {
    who: "For press mentions, partner brands or short selling points.",
    points: ["Logos or text in a scrolling strip or a grid", "One or two lines, grey or full colour", "Optional links"],
    related: ["reviews", "hero"],
  },
  announcements: {
    who: "For news, offers and shipping messages at the top of every page.",
    points: ["Rotating messages with icons and links", "Start and end dates per message", "Free shipping progress in the bar", "Slide or fade, a close button, colours"],
    related: ["countdown", "shipping_bar"],
  },
  countdown: {
    who: "For real deadlines: a sale end, a daily order cut off, a launch.",
    points: ["Timers for the top of the page, the bottom, the home page, product pages and the cart", "A fixed end date, a daily cut off, or a timer per visitor", "Boxes, circles, flip cards or plain numbers"],
    related: ["announcements", "delivery", "stock_urgency"],
    note: "Use real deadlines only. A timer that resets for every visitor should match a real offer.",
  },
  shipping_bar: {
    who: "For stores with a free shipping threshold.",
    points: ["Shows how much more to spend for free shipping", "In your theme's cart drawer, on the cart page and at the top of the store", "Can create the matching automatic free shipping discount", "Extra reward tiers like a free gift or 10% off"],
    related: ["cart_offers", "announcements", "discounts"],
  },
  stock_urgency: {
    who: "For products that really run low.",
    points: ["Only 3 left on product pages when stock is low, from your real stock", "Your own threshold and wording", "An optional stock bar"],
    related: ["stock", "countdown"],
  },
  sticky_atc: {
    who: "For long product pages, especially on phones.",
    points: ["An Add to cart bar that stays on screen while scrolling", "Product picture and options in the bar", "Top or bottom, colours, phones, desktop or both"],
    related: ["quick_add", "upsell"],
  },
  quick_add: {
    who: "For collection pages: add to cart without opening the product.",
    points: ["A button on every product card", "Sizes and colours open a small picker", "An Added to your cart popup or the cart drawer", "Bundle products open their own page instead of being added alone"],
    related: ["wishlist", "sticky_atc", "collection_pills"],
  },
  size_guide: {
    who: "For clothing, shoes and anything with sizes.",
    points: ["A size chart window with columns like chest, waist and inseam, in cm or inches", "A drawing of the garment or your own picture", "Different charts for products, collections or tags", "A size recommendation from the height and weight ranges you set, with a snug or relaxed fit choice", "Your own fit note, like “Runs large, size down”"],
    related: ["delivery", "stock", "quiz"],
  },
  delivery: {
    who: "For answering when will it arrive before shoppers ask.",
    points: ["Order within 2h 15m and get it Thu to Sat", "Order cut off time, days off, holidays and delivery times per country", "On product pages and in the cart"],
    related: ["countdown", "trust_badges", "cart_extras"],
  },
  stock: {
    who: "For sold out products you'll restock or still sell.",
    points: ["Notify me on sold out products; requests are listed in the app", "Pre order on products you sell when out of stock", "Box or plain look, your wording"],
    related: ["stock_urgency", "wishlist"],
  },
  wishlist: {
    who: "For shoppers who are not ready to buy today.",
    points: ["Hearts on product pages and product cards", "A wishlist page with add to cart and a share link", "Price dropped badges", "Saved in the shopper's browser, no account needed"],
    related: ["quick_add", "stock"],
  },
  hero: {
    who: "For the first thing visitors see.",
    points: ["Separate desktop and phone images", "Heading, text and up to two buttons", "Where the text sits, colours, overlay and height", "Load only when scrolled to, for banners lower on the page"],
    related: ["image_carousel", "announcements", "logos"],
  },
  image_carousel: {
    who: "For collections, lookbooks and categories as scrolling pictures.",
    points: ["Each picture with a title, text, button and link", "Captions below or on the pictures", "Pictures per row, shape, arrows and dots"],
    related: ["hero", "videos", "collection_pills"],
  },
  videos: {
    who: "For showing products in use, like short social videos.",
    points: ["Videos from your Shopify files or product media", "Each video linked to a product, with price and Add to cart", "Reels, stories or square tiles, and the pages it shows on"],
    related: ["image_carousel", "reviews"],
  },
  faq: {
    who: "For answering common questions before shoppers write to you.",
    points: ["Questions grouped with buttons, and a search box", "Lines or cards, icon left or right", "FAQ data for Google, on or off"],
    related: ["track", "returns"],
  },
  quiz: {
    who: "For stores with many products and shoppers who need a nudge.",
    points: ["A few questions; each answer points to product tags", "The best matching products with add to cart", "Answers saved on the cart"],
    related: ["collection_pills", "quick_add"],
  },
  collection_pills: {
    who: "For moving between collections quickly.",
    points: ["A row of buttons to your collections", "The current one highlighted", "Scroll or wrap, outline or filled"],
    related: ["quick_add", "hero"],
  },
  track: {
    who: "For fewer where is my order messages.",
    points: ["Shoppers look up their order with the order number and email", "Delivery status, tracking number and the carrier's tracking link", "Estimated and delivered dates from Shopify", "Orders older than 60 days once Shopify approves access to all orders"],
    related: ["returns", "faq"],
  },
  returns: {
    who: "For handling returns without email back and forth.",
    points: ["Shoppers ask for a return with the order number and email", "Each request is a real Shopify return you approve or decline, with Shopify emailing the shopper", "Rules: return window, products that can't be returned, reasons approved at once, your return address", "Upload your return label for the shopper, then refund when the items arrive", "Refunds only for now: no exchanges or store credit"],
    related: ["track", "faq"],
  },
  payment_rules: {
    who: "For hiding or renaming payment methods for some orders.",
    points: ["Hide, rename or reorder payment methods", "Conditions such as order amount, countries, products or customer type"],
    related: ["delivery_rules", "order_limits"],
  },
  delivery_rules: {
    who: "For delivery options that don't fit every cart.",
    points: ["Hide, rename or reorder delivery options", "Conditions such as order amount, countries, products or customer type"],
    related: ["payment_rules", "order_limits"],
  },
  order_limits: {
    who: "For minimum orders, launches and limited stock.",
    points: ["Minimum or maximum order total", "Minimum or maximum items, in the order or per product", "Your own message at checkout"],
    related: ["payment_rules", "delivery_rules"],
  },
  thank_you: {
    who: "For bringing customers back after their first order.",
    points: ["A discount code for the next order with a copy button", "A message, follow us buttons and product suggestions", "Works on every Shopify plan"],
    related: ["post_purchase", "reviews"],
  },
  ab_tests: {
    who: "For stores that want proof before they change an offer.",
    points: ["Show half of your shoppers another version of an upsell or cross sell", "Change the words, the discount or the style in version B", "Each shopper keeps one version, so orders can be told apart", "Real shoppers and real orders: we say which is ahead only when there is enough data", "One click to use the winner"],
    related: ["upsell", "cross_sell", "discounts"],
  },
  post_purchase: {
    who: "For one more sale right after payment.",
    points: ["One product at a discount, added to the paid order in one click", "No new payment details", "Your product, discount and minimum order amount"],
    related: ["thank_you", "upsell"],
  },
};
