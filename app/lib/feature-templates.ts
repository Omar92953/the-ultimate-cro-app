/** The ready-made looks ("Templates") the app offers per feature, read from the app's own design files. Used by the website and the MCP tools. */
import { UPSELL_PRESETS } from "./upsell-design";
import { CROSS_SELL_PRESETS } from "./cross-sell-design";
import { BUNDLE_PRESETS } from "./bundle-design";
import { VIDEO_CAROUSEL_PRESETS } from "./video-carousel-design";
import { REVIEW_PRESETS, PRODUCT_REVIEW_PRESETS } from "./reviews-design";
import { FAQ_PRESETS } from "./faq-design";
import { LOGOS_PRESETS } from "./logos-design";
import { ANNOUNCEMENT_PRESETS } from "./announcement-design";
import { SHIPPING_BAR_PRESETS } from "./shipping-bar";
import { COUNTDOWN_BAR_PRESETS } from "./designs";
import { QUICK_ADD_PRESETS } from "./quick-add-design";
import { DELIVERY_PRESETS } from "./delivery-design";
import { SIZE_GUIDE_PRESETS } from "./size-guide";
import { STOCK_PRESETS } from "./stock-design";
import { WISHLIST_PRESETS } from "./wishlist-design";
import { ORDER_PAGE_PRESETS } from "./order-pages";
import { PERSONALIZE_PRESETS } from "./personalize-design";
import { CART_EXTRAS_PRESETS } from "./cart-extras-design";
import { QUIZ_PRESETS } from "./quiz-design";
import { PRESETS as HEADER_PRESETS } from "./header";
import type { FeatureKey } from "./catalog";

const t = (list: { title: string }[]) => list.map((p) => p.title);

export const TEMPLATES: Partial<Record<FeatureKey, string[]>> = {
  upsell: t(UPSELL_PRESETS),
  cross_sell: t(CROSS_SELL_PRESETS),
  bundles: t(BUNDLE_PRESETS),
  videos: t(VIDEO_CAROUSEL_PRESETS),
  reviews: t(REVIEW_PRESETS),
  product_reviews: t(PRODUCT_REVIEW_PRESETS),
  faq: t(FAQ_PRESETS),
  logos: t(LOGOS_PRESETS),
  announcements: t(ANNOUNCEMENT_PRESETS),
  shipping_bar: t(SHIPPING_BAR_PRESETS),
  countdown: t(COUNTDOWN_BAR_PRESETS),
  quick_add: t(QUICK_ADD_PRESETS),
  delivery: t(DELIVERY_PRESETS),
  size_guide: t(SIZE_GUIDE_PRESETS),
  stock: t(STOCK_PRESETS),
  wishlist: t(WISHLIST_PRESETS),
  header: t(HEADER_PRESETS),
  track: t(ORDER_PAGE_PRESETS),
  returns: t(ORDER_PAGE_PRESETS),
  personalize: t(PERSONALIZE_PRESETS),
  cart_extras: t(CART_EXTRAS_PRESETS),
  quiz: t(QUIZ_PRESETS),
};
