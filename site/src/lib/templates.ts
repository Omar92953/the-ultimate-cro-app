/** The ready-made looks ("Templates") the app offers per feature, read from the app's own design files. */
import { UPSELL_PRESETS } from "../../../app/lib/upsell-design";
import { CROSS_SELL_PRESETS } from "../../../app/lib/cross-sell-design";
import { BUNDLE_PRESETS } from "../../../app/lib/bundle-design";
import { VIDEO_CAROUSEL_PRESETS } from "../../../app/lib/video-carousel-design";
import { REVIEW_PRESETS, PRODUCT_REVIEW_PRESETS } from "../../../app/lib/reviews-design";
import { FAQ_PRESETS } from "../../../app/lib/faq-design";
import { LOGOS_PRESETS } from "../../../app/lib/logos-design";
import { ANNOUNCEMENT_PRESETS } from "../../../app/lib/announcement-design";
import { SHIPPING_BAR_PRESETS } from "../../../app/lib/shipping-bar";
import { COUNTDOWN_BAR_PRESETS } from "../../../app/lib/designs";
import { QUICK_ADD_PRESETS } from "../../../app/lib/quick-add-design";
import { DELIVERY_PRESETS } from "../../../app/lib/delivery-design";
import { SIZE_GUIDE_PRESETS } from "../../../app/lib/size-guide";
import { STOCK_PRESETS } from "../../../app/lib/stock-design";
import { WISHLIST_PRESETS } from "../../../app/lib/wishlist-design";
import { HERO_PRESETS } from "../../../app/lib/hero-design";
import { ORDER_PAGE_PRESETS } from "../../../app/lib/order-pages";
import { PERSONALIZE_PRESETS } from "../../../app/lib/personalize-design";
import { CART_EXTRAS_PRESETS } from "../../../app/lib/cart-extras-design";
import { QUIZ_PRESETS } from "../../../app/lib/quiz-design";
import type { FeatureKey } from "./app";

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
  hero: t(HERO_PRESETS),
  track: t(ORDER_PAGE_PRESETS),
  returns: t(ORDER_PAGE_PRESETS),
  personalize: t(PERSONALIZE_PRESETS),
  cart_extras: t(CART_EXTRAS_PRESETS),
  quiz: t(QUIZ_PRESETS),
};
