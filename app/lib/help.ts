/** Plain-language "what / how / example" for each feature page (shown as three equal cards). */
export const HELP = {
  upsell: {
    what: "Offers on the product page that reward buying more (“Buy 2, save 10%”) or choosing a bigger size.",
    how: "The shopper picks an offer, it sets the quantity or size on your normal Add to cart, and the discount is applied at checkout automatically. If several offers match a product, the lowest priority number wins.",
    example: "Hoodie at 500: Buy 1 = 500, Buy 2 = 900 (save 10%), Buy 3 = 1,275 (save 15%, “Most popular”).",
  },
  cross_sell: {
    what: "“Pairs well with” suggestions shoppers tick and add in one click, on the product page, cart page or slide-out cart.",
    how: "When a shopper views (or has in their cart) one of the products you choose, the app suggests your other products. An optional discount applies at checkout while both are in the cart.",
    example: "Viewing a snowboard shows ski wax and a beanie. With 10% off, the 250 wax costs 225 when bought with the board.",
  },
  videos: {
    what: "A row of short vertical videos on your store, each linked to a product with its price and an Add to cart button.",
    how: "Pick videos from Content → Files or from product media, order them and link products. They play muted only while on screen, so pages stay fast.",
    example: "Three 15-second clips on the home page: “Unboxing”, “How to style”, “In use”, each with Add to cart.",
  },
  bundles: {
    what: "Mix-and-match bundles: the shopper builds a set from your products for one fixed price.",
    how: "You create a bundle product with the bundle price, then steps like “Choose 3 posters”. At checkout the bundle is split into the picked items, so each item's stock goes down.",
    example: "“Any 3 posters for 399”: the shopper picks 3 of 20 posters; the order shows the 3 posters and charges 399.",
  },
} as const;
