/**
 * What each feature page says beyond the catalog's one line (app/lib/catalog.ts): who it's for, what
 * you can set, and related features. Every point here must be true of the app today (check the code
 * and docs/README-merchant.md before adding one). Template names come from the app (lib/templates.ts).
 */
import type { FeatureKey } from "./app";
import { METERS, limitOf, type LimitKey, type PlanKey } from "../../../app/lib/plans";
import { LOYALTY_PRO } from "../../../app/lib/loyalty/config";

/** A plan limit as a number, "2,000". */
const n = (p: PlanKey, k: LimitKey) => (limitOf(p, k) ?? 0).toLocaleString("en-US");

export type FeatureCopy = {
  /** One sentence: who it's for and why. */
  who: string;
  /** What you can set, short lines. */
  points: string[];
  related: FeatureKey[];
  /** A fact worth knowing (limits, where it works). */
  note?: string;
  /** Its own setup steps, when the usual ones (pick a template, Add to theme) don't fit. */
  steps?: string[];
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
  cart_code: {
    who: "For stores that share discount codes and want shoppers to use them before checkout.",
    points: ["A discount code box on the cart page and in the theme's cart drawer", "Each applied code shows what it takes off the cart, and can be removed", "Clear reasons when a code can't be used: already applied, doesn't combine with another code, not valid for the cart", "Every word, the button place and the look are yours"],
    related: ["cart_extras", "shipping_bar"],
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
    related: ["reviews", "image_carousel"],
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
    points: ["A size chart window with columns like chest, waist and inseam, in cm or inches", "A drawing of the garment or your own picture", "Different charts for products, collections or tags", "A size finder that asks only the questions you pick: height, weight, fit or their usual size", "Your own answers decide the size: a height and weight range per size, or “usual size → size” pairs", "Your own fit note, like “Runs large, size down”"],
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
  image_carousel: {
    who: "For collections, lookbooks and categories as scrolling pictures.",
    points: ["Each picture with a title, text, button and link", "Captions below or on the pictures", "Pictures per row, shape, arrows and dots"],
    related: ["videos", "collection_pills"],
  },
  loyalty: {
    who: "For stores that want shoppers to come back and spend again.",
    points: [
      "Points for orders, account signups, the first order, birthdays, product reviews and social follows",
      "Rewards shoppers spend: amount or percent off, free shipping, a free product or store credit",
      "A Points shop: products members get with points, or points plus money, and products sold only with points",
      "Referrals: the friend gets a discount and the member gets points when the friend orders",
      "A rewards button and panel, points on product pages and in the cart, and a Rewards page",
      "Points in customer accounts, on the thank you and order status pages, and at Shopify POS",
      "Emails for welcome, points earned, reward ready, reward codes, birthdays and points about to expire",
      `Growth: ${n("growth", "loyaltyOrders")} orders that earn points and ${n("growth", "loyaltyEmails")} emails a month. Pro: ${n("pro", "loyaltyOrders")} and ${n("pro", "loyaltyEmails")}`,
      `Pro adds ${LOYALTY_PRO.slice(0, -1).join(", ")}, and ${LOYALTY_PRO.at(-1)}`,
    ],
    steps: [
      "Install CRO Toolbox from the Shopify App Store.",
      "Open Loyalty in the app: choose what earns points and add the rewards members spend them on.",
      "Turn the program on, then turn on the Conversion boosters embed in your theme: the rewards button shows on every page.",
    ],
    related: ["track", "email_popup"],
    note: `At a monthly limit orders stop earning and emails wait until next month, unless you turn on extra in the app: $${METERS.loyaltyOrders.price} per ${METERS.loyaltyOrders.per} more orders and $${METERS.loyaltyEmails.price} per ${METERS.loyaltyEmails.per.toLocaleString("en-US")} more emails, billed by Shopify. Extras are on monthly billing; yearly plans keep the limits.`,
  },
  coverflow: {
    who: "For lookbooks, customer photos and new arrivals that deserve one big picture at a time.",
    points: ["One large picture in the centre, the others smaller behind it", "Turns with arrows, dots, a swipe or by itself", "Each picture with a title, text, button and link", "Works next to Image carousel: use both on one store"],
    related: ["image_carousel", "videos"],
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
    related: ["quick_add", "image_carousel"],
  },
  header: {
    who: "For a header that looks designed without editing theme code.",
    points: ["Glass, rounded, classic, minimal and bold looks", "Your menu with dropdowns or mega menus", "Search, cart count and an optional button", "Sticky, and over the hero on the home page if you want"],
    related: ["announcements", "collection_pills"],
  },
  compare_table: {
    who: "For products that win on facts: show shoppers why yours beats the usual choice.",
    points: ["Your column against up to 3 others", "Up to 12 rows with a tick, a cross or short text", "A table or cards side by side, with your column highlighted", "Turns into a phone friendly layout by itself"],
    related: ["benefits", "guarantee", "product_tabs"],
  },
  benefits: {
    who: "For answering why buy here in one glance: shipping, returns, payment, support.",
    points: ["Up to 6 benefits with a built in icon or your own picture", "Icons on top, on the left, in boxes or as a slim strip", "Two per row, one per row or swipe sideways on phones"],
    related: ["guarantee", "trust_badges", "how_it_works"],
  },
  product_tabs: {
    who: "For long product pages: details, shipping and returns without the endless scroll.",
    points: ["Tabs or an accordion", "The first tab can be the product's own description", "Up to 5 more tabs with the same text on every product, or a product's own text from a metafield"],
    related: ["size_guide", "delivery", "faq"],
  },
  guarantee: {
    who: "For lowering the risk of buying: a money back or free returns promise next to Add to cart.",
    points: ["A drawn seal (money back, free returns, free shipping, secure checkout, premium quality) or your own picture", "Title, text and a link to your policy", "Badge, centred seal, banner or a small line"],
    related: ["trust_badges", "benefits", "compare_table"],
    note: "Promise only what your refund policy really says.",
  },
  before_after: {
    who: "For products whose result shows in a picture: skincare, cleaning, repairs, restoration.",
    points: ["Two pictures with a handle shoppers drag", "Side to side or top to bottom", "Labels, a caption and three handle styles", "Works with a mouse, a finger and the keyboard"],
    related: ["image_carousel", "reviews", "shoppable"],
  },
  shoppable: {
    who: "For lifestyle photos that sell: shoppers tap a product in the picture and add it.",
    points: ["Up to 8 products on one picture, placed by clicking", "Dots, numbers or plus signs, with a gentle pulse", "A card with the picture, the live price and Add to cart (or View product for products with options)"],
    related: ["image_carousel", "quick_add"],
  },
  recently_viewed: {
    who: "For bringing shoppers back to what they were already considering.",
    points: ["The last 2 to 12 products the shopper opened, with live prices", "Cards, compact rows or a carousel", "Add to cart on each card; products with options link to their page"],
    related: ["wishlist", "quick_add", "cross_sell"],
    note: "The list stays in the shopper's own browser; nothing is sent to the app.",
  },
  how_it_works: {
    who: "For new brands, subscriptions and anything shoppers need explained first.",
    points: ["3 to 5 steps with numbers or icons", "Circles in a row, a timeline or cards", "An optional button to your products"],
    related: ["benefits", "faq", "compare_table"],
  },
  email_popup: {
    who: "For growing your email list with a welcome discount.",
    points: ["Each email gets its own one use code that only that shopper can use", "Sign ups join your Shopify customers with email marketing consent and the tag cro-popup", "Shows after a delay, after scrolling or when the mouse leaves the page, on the pages you pick", "Centred, with a picture, as a bottom bar or full screen on phones"],
    related: ["announcements", "countdown", "sales_pop"],
    note: "The app keeps no emails: they live in your Shopify customers.",
  },
  track: {
    who: "For fewer where is my order messages.",
    points: ["Shoppers look up their order with the order number and email", "Delivery status, tracking number and the carrier's tracking link", "Estimated and delivered dates from Shopify, for any carrier you add a tracking number for", "Live updates from 3,500+ carriers (200 shipments a month on Growth, 500 on Pro), your own 17TRACK, AfterShip, TrackingMore or Ship24 key with no limit, or a webhook link", "Any other shipping company, like a local courier: a webhook link, updates you type, or a link to its own tracking page", "The page sells too (Growth): recommendations, a real next order discount code, a buy again button, a how was your order message after delivery, an apology (and optional code) for late orders", "Offers above and below the tracking with real codes that expire (Pro)", "Orders older than 60 days once Shopify approves access to all orders"],
    related: ["returns", "faq"],
  },
  returns: {
    who: "For handling returns without email back and forth.",
    points: ["Shoppers ask for a return with the order number and email", "Each request is a real Shopify return you approve or decline, with Shopify emailing the shopper", "Rules: return window, products that can't be returned, reasons approved at once, your return address", "Upload your return label for the shopper, then refund when the items arrive", "Pro: exchanges for another size and store credit, gift card or discount code instead of a refund"],
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
  return_saving: {
    who: "For stores that want to keep the sale when a shopper returns something.",
    points: ["Shoppers choose store credit instead of a refund, with an optional bonus", "Exchanges for another size or colour, with the new shipment held until the items arrive", "Credit as a refund to Shopify store credit, so the order shows the money as refunded", "Approve returns by rule: reason, product tag, order value, days since delivery", "Put returned items back in stock at your location", "Refunds to the original payment stay available"],
    related: ["returns", "track"],
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
