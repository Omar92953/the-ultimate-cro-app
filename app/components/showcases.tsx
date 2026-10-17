/**
 * The pictures of every feature (the hub cards' showcases), by catalog feature key, so any page can show
 * what a feature looks like: the locked page, the Section library. Features without a showcase are left out.
 */
import type { FeatureKey } from "../lib/catalog";
import * as S from "./SectionShowcase";

type Looks = (() => JSX.Element)[];

export const SHOWCASES: Partial<Record<FeatureKey, Looks>> = {
  upsell: [S.UpsellShowcase, S.UpsellSizesShowcase, S.UpsellListShowcase],
  cross_sell: [S.CrossSellShowcase, S.CrossSellCardsShowcase],
  bundles: [S.BundlesShowcase, S.BundlesStepsShowcase],
  addons: [S.AddonsShowcase, S.AddonsCardsShowcase],
  personalize: [S.PersonalizeShowcase],
  cart_offers: [S.CrossSellCardsShowcase],
  cart_extras: [S.CartExtrasShowcase],
  reviews: [S.ReviewsShowcase, S.ReviewsChatShowcase, S.ReviewsPhotosShowcase],
  product_reviews: [S.ProductReviewsShowcase],
  sales_pop: [S.SalesPopShowcase, S.SalesPopStackShowcase],
  trust_badges: [S.TrustShowcase, S.TrustGridShowcase],
  logos: [S.LogosShowcase, S.LogosOneLineShowcase, S.LogosGridShowcase],
  announcements: [S.AnnouncementShowcase, S.AnnouncementShippingShowcase, S.AnnouncementStyleShowcase],
  countdown: [S.CountdownBarShowcase, S.CountdownShowcase, S.CountdownRowShowcase, S.CountdownBarDarkShowcase],
  shipping_bar: [S.ShippingBarCartShowcase, S.ShippingBarShowcase, S.ShippingBarCardShowcase],
  stock_urgency: [S.UrgencyShowcase, S.UrgencyLastShowcase],
  sticky_atc: [S.StickyShowcase, S.StickyMobileShowcase],
  quick_add: [S.QuickAddShowcase, S.QuickAddToastShowcase],
  delivery: [S.DeliveryShowcase],
  size_guide: [S.SizeGuideShowcase],
  stock: [S.StockShowcase],
  wishlist: [S.WishlistShowcase],
  hero: [S.HeroShowcase, S.HeroCenteredShowcase],
  image_carousel: [S.ImageCarouselShowcase, S.ImageCarouselOverlayShowcase],
  videos: [S.VideosShowcase, S.VideosLargeShowcase],
  faq: [S.FaqShowcase, S.FaqCardsShowcase],
  quiz: [S.QuizShowcase],
  collection_pills: [S.CollectionPillsShowcase, S.CollectionPillsImagesShowcase],
  track: [S.TrackShowcase],
  returns: [S.ReturnsShowcase],
  payment_rules: [S.PaymentRulesShowcase],
  delivery_rules: [S.DeliveryRulesShowcase],
  order_limits: [S.OrderLimitsShowcase],
  thank_you: [S.ThankYouShowcase],
  post_purchase: [S.PostPurchaseShowcase],
};
