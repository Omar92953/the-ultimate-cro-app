/**
 * Every kind of offer the app can run, in one list: the Offers hub's table and filter, and the
 * "Create offer" picker (grouped by where the offer shows). Shared by client and server.
 */
import { DEAL_TYPES } from "./deals";

export type OfferTypeKey = "upsell" | "cross_sell" | "bundle" | "kit" | "fixed" | "bogo" | "volume" | "gift" | "upgrade" | "post_purchase";
export type OfferWhere = "product" | "cart" | "after";

export const OFFER_WHERE: { key: OfferWhere; title: string }[] = [
  { key: "product", title: "On product pages" },
  { key: "cart", title: "In the cart" },
  { key: "after", title: "After payment" },
];

export const OFFER_TYPES: Record<OfferTypeKey, { title: string; where: OfferWhere; about: string; create: string; list: string }> = {
  upsell: { title: "Upsell", where: "product", about: "“Buy 2, save 10%” or a bigger size, picked on the product page.", create: "/app/offers/upsell/new", list: "/app/offers/upsell" },
  bundle: { title: "Mix & match bundle", where: "product", about: "Shoppers build a set from your products at one price, or by number of items.", create: "/app/bundles/new", list: "/app/bundles" },
  kit: { title: "Bundle product", where: "product", about: "A set sold as its own product, with its own page, price and stock from its items.", create: "/app/kits/new", list: "/app/kits" },
  fixed: { title: DEAL_TYPES.fixed.title.replace(/s$/, ""), where: "product", about: DEAL_TYPES.fixed.what, create: "/app/deals/fixed/new", list: "/app/deals/fixed" },
  volume: { title: DEAL_TYPES.volume.title.replace(/s$/, ""), where: "product", about: DEAL_TYPES.volume.what, create: "/app/deals/volume/new", list: "/app/deals/volume" },
  bogo: { title: DEAL_TYPES.bogo.title, where: "cart", about: DEAL_TYPES.bogo.what, create: "/app/deals/bogo/new", list: "/app/deals/bogo" },
  cross_sell: { title: "Cross-sell", where: "cart", about: "“Pairs well with” products, on the product page, cart page or cart drawer.", create: "/app/offers/cross-sell/new", list: "/app/offers/cross-sell" },
  gift: { title: DEAL_TYPES.gift.title, where: "cart", about: DEAL_TYPES.gift.what, create: "/app/deals/gift/new", list: "/app/deals/gift" },
  upgrade: { title: DEAL_TYPES.upgrade.title.replace(/s$/, ""), where: "cart", about: DEAL_TYPES.upgrade.what, create: "/app/deals/upgrade/new", list: "/app/deals/upgrade" },
  post_purchase: { title: "After-purchase offer", where: "after", about: "A one-click offer right after payment, added to the same order.", create: "/app/checkout/after-purchase", list: "/app/checkout/after-purchase" },
};
export const OFFER_TYPE_KEYS = Object.keys(OFFER_TYPES) as OfferTypeKey[];

/** One offer as the Offers hub lists it. `active`: it fills an offer slot (plans.ts). */
export type OfferRow = { id: string; type: OfferTypeKey; name: string; active: boolean; where: string; href: string };
