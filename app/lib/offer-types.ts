/**
 * Every kind of offer the app can run, in one list: the Offers hub's table and filter, and the
 * "Create offer" picker (grouped like the Offers hub, catalog.ts OFFER_GROUPS). Shared by client and server.
 */
import type { OfferGroupKey } from "./catalog";
import { DEAL_TYPES } from "./deals";
import type { RecipeKey } from "./bundle-recipes";

export type OfferTypeKey = "upsell" | "cross_sell" | "bundle" | "kit" | "fixed" | "bogo" | "volume" | "gift" | "upgrade" | "post_purchase" | "track";

export const OFFER_TYPES: Record<OfferTypeKey, { title: string; group: OfferGroupKey; about: string; create: string; list: string }> = {
  upsell: { title: "Quantity & size offer", group: "upsell", about: "“Buy 2, save 10%” or a bigger size, picked on the product page.", create: "/app/offers/upsell/new", list: "/app/offers/upsell" },
  upgrade: { title: DEAL_TYPES.upgrade.title.replace(/s$/, ""), group: "upsell", about: DEAL_TYPES.upgrade.what, create: "/app/deals/upgrade/new", list: "/app/deals/upgrade" },
  post_purchase: { title: "After-purchase offer", group: "upsell", about: "A one-click offer right after payment, added to the same order.", create: "/app/checkout/after-purchase", list: "/app/checkout/after-purchase" },
  track: { title: "Track page offer", group: "cross_sell", about: "An offer above or below the tracking on the Track page: a cross sell, free shipping, a free gift or a discount, with real codes that expire.", create: "/app/offers/track/new", list: "/app/offers/track" },
  cross_sell: { title: "Cross sell", group: "cross_sell", about: "“Pairs well with” products, on the product page, the cart page or in your theme's cart.", create: "/app/offers/cross-sell/new", list: "/app/offers/cross-sell" },
  bundle: { title: "Mix and match", group: "bundles", about: "Shoppers build a set from your products at one price, or by number of items.", create: "/app/bundles/new", list: "/app/bundles" },
  kit: { title: "Fixed bundle", group: "bundles", about: "A set sold as its own product, with its own page, price and stock from its items.", create: "/app/kits/new", list: "/app/kits" },
  fixed: { title: DEAL_TYPES.fixed.title.replace(/s$/, ""), group: "bundles", about: DEAL_TYPES.fixed.what, create: "/app/deals/fixed/new", list: "/app/deals/fixed" },
  bogo: { title: DEAL_TYPES.bogo.title, group: "discounts", about: DEAL_TYPES.bogo.what, create: "/app/deals/bogo/new", list: "/app/deals/bogo" },
  volume: { title: DEAL_TYPES.volume.title.replace(/s$/, ""), group: "discounts", about: DEAL_TYPES.volume.what, create: "/app/deals/volume/new", list: "/app/deals/volume" },
  gift: { title: DEAL_TYPES.gift.title, group: "discounts", about: DEAL_TYPES.gift.what, create: "/app/deals/gift/new", list: "/app/deals/gift" },
};
export const OFFER_TYPE_KEYS = Object.keys(OFFER_TYPES) as OfferTypeKey[];

/** One offer as the Offers hub lists it. `active`: it fills an offer slot (plans.ts). */
/** `recipe`: for bundle rows, which of the six bundle tabs it belongs to (bundle-recipes.ts). */
/** `statKeys`: where this offer's sales are found in the order results (results.server.ts byOffer); null = not measured. */
export type OfferRow = { id: string; type: OfferTypeKey; name: string; active: boolean; where: string; href: string; recipe?: RecipeKey; statKeys: string[] | null };
