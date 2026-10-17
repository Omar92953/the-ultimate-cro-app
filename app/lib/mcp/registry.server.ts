/**
 * The designs an assistant can read and (PR3) change: one entry per feature that has a design page,
 * wired to the same get/save functions, cleaners and templates the app's own pages use.
 */
import type { AdminClient } from "../admin.server";
import type { FeatureKey } from "../catalog";
import * as D from "../designs.server";
import { applyDeliveryPreset, DELIVERY_PRESETS, withDeliveryDefaults } from "../delivery-design";
import { applyWishlistPreset, WISHLIST_PRESETS, withWishlistDefaults } from "../wishlist-design";
import { applyCartExtrasPreset, CART_EXTRAS_PRESETS, withCartExtrasDefaults } from "../cart-extras-design";
import { applySizeGuidePreset, SIZE_GUIDE_PRESETS, withSizeGuideDefaults } from "../size-guide";
import { applyQuizPreset, QUIZ_PRESETS, withQuizDefaults } from "../quiz-design";
import { applyPersonalizePreset, PERSONALIZE_PRESETS, withPersonalizeDefaults } from "../personalize-design";
import { applyStockPreset, STOCK_PRESETS, withStockDefaults } from "../stock-design";
import { applyFaqPreset, FAQ_PRESETS, withFaqDefaults } from "../faq-design";
import { applyLogosPreset, LOGOS_PRESETS, withLogosDefaults } from "../logos-design";
import { applyAnnouncementPreset, ANNOUNCEMENT_PRESETS, withAnnouncementDefaults } from "../announcement-design";
import { applyQuickAddPreset, QUICK_ADD_PRESETS, withQuickAddDefaults } from "../quick-add-design";
import { applyCrossSellPreset, CROSS_SELL_PRESETS, withCrossSellDefaults } from "../cross-sell-design";

export type DesignEntry = {
  get: (admin: AdminClient) => Promise<{ config: unknown; saved: boolean }>;
  /** Saves `config` (already cleaned by `clean`); `draftOnly` stores only the theme editor draft. */
  save: (admin: AdminClient, config: never, draftOnly: boolean) => Promise<unknown>;
  clean: (raw: unknown) => unknown;
  presets: { key: string; title: string }[];
  apply: (config: never, key: string) => unknown;
};

// The casts are the one place the generic table meets each design's own type; each entry's functions are a matching set.
const entry = <C>(e: { get: (a: AdminClient) => Promise<{ config: C; saved: boolean }>; save: (a: AdminClient, c: C, draftOnly: boolean) => Promise<unknown>; clean: (r: unknown) => C; presets: { key: string; title: string }[]; apply: (c: C, k: string) => C }) => e as unknown as DesignEntry;

export const DESIGNS: Partial<Record<FeatureKey, DesignEntry>> = {
  delivery: entry({ get: D.getDeliveryDesign, save: (a, c, d) => D.saveDeliveryDesign(a, c, d), clean: withDeliveryDefaults, presets: DELIVERY_PRESETS, apply: applyDeliveryPreset }),
  wishlist: entry({ get: D.getWishlist, save: (a, c, d) => D.saveWishlist(a, c, d), clean: withWishlistDefaults, presets: WISHLIST_PRESETS, apply: applyWishlistPreset }),
  cart_extras: entry({ get: D.getCartExtras, save: (a, c, d) => D.saveCartExtras(a, c, d), clean: withCartExtrasDefaults, presets: CART_EXTRAS_PRESETS, apply: applyCartExtrasPreset }),
  size_guide: entry({ get: D.getSizeGuide, save: (a, c, d) => D.saveSizeGuide(a, c, d), clean: withSizeGuideDefaults, presets: SIZE_GUIDE_PRESETS, apply: applySizeGuidePreset }),
  quiz: entry({ get: D.getQuiz, save: (a, c, d) => D.saveQuiz(a, c, d), clean: withQuizDefaults, presets: QUIZ_PRESETS, apply: applyQuizPreset }),
  personalize: entry({ get: D.getPersonalizeDesign, save: (a, c, d) => D.savePersonalizeDesign(a, c, d), clean: withPersonalizeDefaults, presets: PERSONALIZE_PRESETS, apply: applyPersonalizePreset }),
  stock: entry({ get: D.getStockDesign, save: (a, c, d) => D.saveStockDesign(a, c, d), clean: withStockDefaults, presets: STOCK_PRESETS, apply: applyStockPreset }),
  faq: entry({ get: D.getFaqDesign, save: (a, c, d) => D.saveFaqDesign(a, c, d), clean: withFaqDefaults, presets: FAQ_PRESETS, apply: applyFaqPreset }),
  logos: entry({ get: D.getLogosDesign, save: (a, c, d) => D.saveLogosDesign(a, c, d), clean: withLogosDefaults, presets: LOGOS_PRESETS, apply: applyLogosPreset }),
  announcements: entry({ get: D.getAnnouncementDesign, save: (a, c, d) => D.saveAnnouncementDesign(a, c, d), clean: withAnnouncementDefaults, presets: ANNOUNCEMENT_PRESETS, apply: applyAnnouncementPreset }),
  quick_add: entry({ get: D.getQuickAddDesign, save: (a, c, d) => D.saveQuickAddDesign(a, c, d), clean: withQuickAddDefaults, presets: QUICK_ADD_PRESETS, apply: applyQuickAddPreset }),
  cross_sell: entry({ get: D.getCrossSellDesign, save: (a, c, d) => D.saveCrossSellDesign(a, c, d), clean: withCrossSellDefaults, presets: CROSS_SELL_PRESETS, apply: applyCrossSellPreset }),
};

export const designFeatures = () => Object.keys(DESIGNS) as FeatureKey[];
