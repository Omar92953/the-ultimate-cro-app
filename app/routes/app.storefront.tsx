import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { timedLoader, timed } from "../lib/timing.server";
import {
  setSavedSections,
  setSetting,
  FEATURE_KEYS,
  type Settings,
} from "../lib/cro.server";
import { errorMessage } from "../lib/admin.server";
import { Button } from "../components/fields";
import {
  AnnouncementShippingShowcase,
  AnnouncementShowcase,
  AnnouncementStyleShowcase,
  BundlesShowcase,
  BundlesStepsShowcase,
  CountdownBarDarkShowcase,
  CountdownBarShowcase,
  CountdownRowShowcase,
  CountdownShowcase,
  CrossSellCardsShowcase,
  CrossSellShowcase,
  FaqCardsShowcase,
  FaqShowcase,
  HeroCenteredShowcase,
  HeroShowcase,
  LogosGridShowcase,
  LogosOneLineShowcase,
  LogosShowcase,
  QuickAddShowcase,
  QuickAddToastShowcase,
  ReviewsChatShowcase,
  ReviewsPhotosShowcase,
  ReviewsShowcase,
  UpsellListShowcase,
  UpsellShowcase,
  UpsellSizesShowcase,
  VideosLargeShowcase,
  ImageCarouselShowcase,
  AddonsShowcase,
  CollectionPillsShowcase,
  ShippingBarShowcase,
  ShippingBarCartShowcase,
  ShippingBarCardShowcase,
  CollectionPillsImagesShowcase,
  AddonsCardsShowcase,
  ImageCarouselOverlayShowcase,
  VideosShowcase,
  SalesPopShowcase,
  SalesPopStackShowcase,
  SectionCard,
  type CardMenuItem,
  StickyMobileShowcase,
  StickyShowcase,
  TrustGridShowcase,
  TrustShowcase,
  UrgencyLastShowcase,
  UrgencyShowcase,
  ContactShowcase,
  ContactInfoShowcase,
  HeaderGlassShowcase,
  HeaderRoundedShowcase,
  FooterShowcase,
  ProductReviewsShowcase,
  StockShowcase,
  DeliveryShowcase,
  PersonalizeShowcase,
  CartExtrasShowcase,
  WishlistShowcase,
  QuizShowcase,
  TrackShowcase,
  ReturnsShowcase,
  PaymentRulesShowcase,
  DeliveryRulesShowcase,
  OrderLimitsShowcase,
  ThankYouShowcase,
  PostPurchaseShowcase,
} from "../components/SectionShowcase";
import showcase from "../components/SectionShowcase.module.css";
import { GroupTitle, Segmented } from "../components/ui";
import { type BoostersConfig } from "../lib/boosters";
import { SECTIONS, type SectionKind } from "../lib/sections";
import { GROUPS, area as areaOf, feature, featuresIn, type AreaKey, type FeatureKey as RegistryKey } from "../lib/catalog";
import { FEATURE_PLAN, PLANS, canUse } from "../lib/plans";
import { usePlan } from "../components/Upgrade";
import { canTry } from "../lib/plan-gate";
import { remember } from "../lib/short-cache.server";
import { loadHub } from "../lib/hub.server";

export const loader = timedLoader("app.storefront", async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  // Fresh for 30 s, then answered from memory while it refreshes (up to 5 min); any save in the
  // app clears it (short-cache.server.ts).
  return timed("hub", () => remember(session.shop, "hub", 30000, () => loadHub(admin, session), 300000));
});

/** Changing the filters only changes the address: no need to reload everything. */
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl, formMethod, defaultShouldRevalidate }) =>
  !formMethod && currentUrl.pathname === nextUrl.pathname ? false : defaultShouldRevalidate;

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  if (form.get("intent") === "saved") {
    // The page sends the whole saved list, so quick clicks on several cards can't overwrite each other.
    try {
      await setSavedSections(admin, JSON.parse(String(form.get("list"))));
      return { ok: true, error: null, message: String(form.get("message") || "") };
    } catch (e) {
      return { ok: false, error: errorMessage(e), message: null };
    }
  }
  const key = String(form.get("key")) as keyof Settings;
  if (!FEATURE_KEYS.includes(key)) return { ok: false, error: "Unknown feature.", message: null };
  try {
    await setSetting(admin, key, form.get("value") === "true");
    return { ok: true, error: null, message: "Saved" };
  } catch (e) {
    return { ok: false, error: errorMessage(e), message: null };
  }
};

type Counts = { cross_sell: number; upsell: number; drawer: number; videos: number; bundles: number };
type FeatureKey = "upsell" | "cross_sell" | "videos" | "bundles";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const FEATURES: {
  key: FeatureKey;
  setting: keyof Settings;
  title: string;
  description: string;
  href: string;
  createHref: string;
  createLabel: string;
  count: (c: Counts) => number;
  noun: string;
  Previews: (() => JSX.Element)[];
}[] = [
  {
    key: "upsell",
    setting: "upsell_enabled",
    title: "Upsell offers",
    description: "“Buy 2, save 10%” and bigger-size offers on product pages.",
    href: "/app/offers/upsell",
    createHref: "/app/offers/upsell/new",
    createLabel: "Create an offer",
    count: (c) => c.upsell,
    noun: "offer",
    Previews: [UpsellShowcase, UpsellSizesShowcase, UpsellListShowcase],
  },
  {
    key: "cross_sell",
    setting: "cross_sell_enabled",
    title: "Cross-sell offers",
    description: "“Pairs well with” products shoppers tick and add in one click.",
    href: "/app/offers/cross-sell",
    createHref: "/app/offers/cross-sell/new",
    createLabel: "Create an offer",
    count: (c) => c.cross_sell,
    noun: "offer",
    Previews: [CrossSellShowcase, CrossSellCardsShowcase],
  },
  {
    key: "videos",
    setting: "videos_enabled",
    title: "Video carousel",
    description: "Shoppable videos, each linked to a product.",
    href: "/app/videos",
    createHref: "/app/videos",
    createLabel: "Add videos",
    count: (c) => c.videos,
    noun: "video",
    Previews: [VideosShowcase, VideosLargeShowcase],
  },
  {
    key: "bundles",
    setting: "bundles_enabled",
    title: "Bundles",
    description: "Mix and match bundles at one price.",
    href: "/app/bundles",
    createHref: "/app/bundles/new",
    createLabel: "Create a bundle",
    count: (c) => c.bundles,
    noun: "bundle",
    Previews: [BundlesShowcase, BundlesStepsShowcase],
  },
];

type SectionCardKey = SectionKind | "product_reviews" | "stock" | "delivery" | "personalize" | "cart_extras" | "wishlist" | "quiz" | "quick_add" | "hero" | "countdown_bar" | "image_carousel" | "addons" | "collection_pills" | "shipping_bar";

/** Sections and boosters, shown in the same card format as the features above. */
/** `app`: designed in the app (the theme editor only switches it on). */
const SECTION_CARDS: { key: SectionCardKey; title: string; description: string; list: SectionKind | null; embed: boolean; app?: string; cat?: "offers" | "boosters"; Previews: (() => JSX.Element)[] }[] = [
  { key: "reviews", title: "Customer reviews", description: "Text, photo and video reviews with WhatsApp, Instagram and TikTok badges.", list: "reviews", embed: false, Previews: [ReviewsShowcase, ReviewsChatShowcase, ReviewsPhotosShowcase] },
  { key: "product_reviews", title: "Product page reviews", description: "A review card or the star rating next to the price and Add to cart.", list: null, embed: false, app: "/app/designs/product-reviews", Previews: [ProductReviewsShowcase] },
  { key: "quiz", title: "Product quiz", description: "A few questions that lead shoppers to the right products, with add to cart.", list: null, embed: false, app: "/app/designs/quiz", Previews: [QuizShowcase] },
  { key: "faq", title: "FAQ", description: "Questions and answers with search and group buttons.", list: "faq", embed: false, Previews: [FaqShowcase, FaqCardsShowcase] },
  { key: "logos", title: "Scrolling logos and text", description: "Logos or short texts in a scrolling strip or a grid.", list: "logos", embed: false, Previews: [LogosShowcase, LogosOneLineShowcase, LogosGridShowcase] },
  { key: "announcements", title: "Announcement bar", description: "Rotating messages at the top, with free-shipping progress.", list: "announcements", embed: true, cat: "boosters", Previews: [AnnouncementShowcase, AnnouncementShippingShowcase, AnnouncementStyleShowcase] },
  { key: "cart_extras", title: "Gift note & delivery date", description: "“This is a gift”, a gift message and a delivery date picked in the cart, all saved on the order.", list: null, embed: false, app: "/app/designs/cart-extras", cat: "offers", Previews: [CartExtrasShowcase] },
  { key: "personalize", title: "Personalization", description: "Engraving or names on the product with a live preview, saved on the order, with an optional fee.", list: null, embed: false, app: "/app/designs/personalize", cat: "offers", Previews: [PersonalizeShowcase] },
  { key: "wishlist", title: "Wishlist", description: "Hearts on products and cards, a wishlist page with “price dropped” badges and a share link.", list: null, embed: true, app: "/app/designs/wishlist", cat: "boosters", Previews: [WishlistShowcase] },
  { key: "delivery", title: "Delivery estimate", description: "“Order within 2h 15m and get it Thu to Sat” on product pages and the cart.", list: null, embed: false, app: "/app/designs/delivery", cat: "boosters", Previews: [DeliveryShowcase] },
  { key: "stock", title: "Back in stock & pre-order", description: "“Notify me” on sold-out products, and “Pre-order” on products you still sell when out of stock.", list: null, embed: false, app: "/app/stock", cat: "boosters", Previews: [StockShowcase] },
  { key: "quick_add", title: "Quick add to cart", description: "A button on every product card; sizes open a small picker.", list: null, embed: true, app: "/app/designs/quick-add", cat: "boosters", Previews: [QuickAddShowcase, QuickAddToastShowcase] },
  { key: "hero", title: "Hero image", description: "A banner with separate desktop and mobile images.", list: null, embed: false, app: "/app/designs/hero", Previews: [HeroShowcase, HeroCenteredShowcase] },
  { key: "addons", title: "Add-ons", description: "Gift wrapping and other extras ticked under Add to cart, plus a gift message.", list: null, embed: false, app: "/app/designs/add-ons", cat: "offers", Previews: [AddonsShowcase, AddonsCardsShowcase] },
  { key: "shipping_bar", title: "Free shipping bar", description: "Shows how much more to spend for free shipping, in the cart and at the top of the store.", list: null, embed: false, app: "/app/designs/shipping-bar", cat: "boosters", Previews: [ShippingBarCartShowcase, ShippingBarShowcase, ShippingBarCardShowcase] },
  { key: "collection_pills", title: "Collection pills", description: "A row of buttons to your collections, with the current one highlighted.", list: null, embed: false, app: "/app/designs/collection-pills", Previews: [CollectionPillsShowcase, CollectionPillsImagesShowcase] },
  { key: "image_carousel", title: "Image carousel", description: "Pictures that scroll, each with an optional title, text, button and link.", list: null, embed: false, app: "/app/designs/image-carousel", Previews: [ImageCarouselShowcase, ImageCarouselOverlayShowcase] },
  { key: "countdown_bar", title: "Countdown timers", description: "Timers for the header, footer, home page, product pages and cart page, each with its own design.", list: null, embed: false, app: "/app/designs/countdown-bar", cat: "boosters", Previews: [CountdownBarShowcase, CountdownShowcase, CountdownRowShowcase, CountdownBarDarkShowcase] },
];

/** Pages designed in the app (Contact page now; the others are coming). */
const PAGE_CARDS: { key: string; title: string; href: string; Previews: (() => JSX.Element)[] }[] = [
  { key: "page_contact", title: "Contact page", href: "/app/pages/contact", Previews: [ContactShowcase, ContactInfoShowcase] },
];

/** The four boosters live in one app embed; each is switched on and edited on the Conversion boosters page. */
const BOOSTER_CARDS: { key: keyof BoostersConfig; title: string; Previews: (() => JSX.Element)[] }[] = [
  { key: "sticky", title: "Sticky add to cart", Previews: [StickyShowcase, StickyMobileShowcase] },
  { key: "urgency", title: "Stock urgency", Previews: [UrgencyShowcase, UrgencyLastShowcase] },
  { key: "trust", title: "Trust badges", Previews: [TrustShowcase, TrustGridShowcase] },
  { key: "salesPop", title: "Sales pop-ups", Previews: [SalesPopShowcase, SalesPopStackShowcase] },
];

type Status = { tone: "success" | "warning" | "neutral"; text: string };
type Next = { label: string; href: string; external?: boolean };

/** Hub cards (named by their old keys, kept for bookmarks) → the feature they show (lib/catalog.ts). */
const REGISTRY: Record<string, RegistryKey> = {
  countdown_bar: "countdown",
  sticky: "sticky_atc",
  urgency: "stock_urgency",
  trust: "trust_badges",
  salesPop: "sales_pop",
  page_contact: "contact",
  checkout_payment: "payment_rules",
  checkout_delivery: "delivery_rules",
  checkout_limits: "order_limits",
  checkout_thank_you: "thank_you",
  checkout_post_purchase: "post_purchase",
};

export default function Storefront() {
  return <FeatureHub area="storefront" />;
}

/**
 * A hub: every feature of one area (Storefront, Cart, Checkout) as a card with its preview, status
 * and next step — the same cards on every hub, listed from lib/catalog.ts.
 */
/** `top`: shown above the cards (the Cart page puts its "which cart" choice there). */
export function FeatureHub({ area, top }: { area: AreaKey; top?: ReactNode }) {
  const { plan, trial } = usePlan();
  const grouped = area === "storefront";
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const saveFetcher = useFetcher<typeof action>();
  const [params, setParams] = useSearchParams();
  // Filters (kept in the address, so going back returns to the same view)
  const cat = params.get("cat") ?? (params.get("view") === "saved" ? "saved" : "all");
  const status = params.get("status") ?? "all";
  const [query, setQuery] = useState("");
  const setFilter = (patch: { cat?: string; status?: string }) => {
    const next = new URLSearchParams(params);
    next.delete("view");
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === "all") next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (fetcher.data?.ok) shopify.toast.show(fetcher.data.message || "Saved");
    if (fetcher.data?.error) shopify.toast.show(fetcher.data.error, { isError: true });
  }, [fetcher.data, shopify]);
  useEffect(() => {
    if (saveFetcher.data?.ok && saveFetcher.data.message) shopify.toast.show(saveFetcher.data.message);
    if (saveFetcher.data?.error) shopify.toast.show(saveFetcher.data.error, { isError: true });
  }, [saveFetcher.data, shopify]);

  // Saved cards, newest first. The page keeps its own copy, updated the moment a bookmark is
  // clicked, so switching to Saved straight away shows it; the store is updated in the background.
  const [saved, setSaved] = useState<string[]>(data.saved);
  const [loadedSaved, setLoadedSaved] = useState(data.saved);
  if (loadedSaved !== data.saved && saveFetcher.state === "idle") {
    setLoadedSaved(data.saved);
    setSaved(data.saved);
  }
  // Several quick clicks send one request with the final list (an older request can't land last).
  const pending = useRef<ReturnType<typeof setTimeout>>();
  const save = (key: string) => ({
    saved: saved.includes(key),
    onChange: (value: boolean) => {
      const next = value ? [key, ...saved.filter((x) => x !== key)] : saved.filter((x) => x !== key);
      setSaved(next);
      clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        saveFetcher.submit({ intent: "saved", list: JSON.stringify(next), message: value ? "Added to Saved" : "Removed from Saved" }, { method: "post" });
      }, 350);
    },
  });

  const settings: Settings = { ...data.settings };
  if (fetcher.formData?.get("key")) {
    settings[String(fetcher.formData.get("key")) as keyof Settings] = fetcher.formData.get("value") === "true";
  }

  const installed = data.theme?.installed;
  const hasDiscountedOffers = data.counts.upsell + data.counts.cross_sell > 0;
  const discountActive =
    data.discount.engine === "native" ? data.discount.nativeCount > 0 : data.discount.status === "ACTIVE";

  return (
    <s-page heading={areaOf(area).title} inlineSize="large">
      <Button slot="secondary-actions" href={`https://${data.shop}`} target="_blank" icon="view">
        View store
      </Button>
      <s-stack gap="base">
      {top}

      {data.loadError ? (
        <s-banner tone="critical" heading="Something went wrong">
          {data.loadError}
        </s-banner>
      ) : null}
      {hasDiscountedOffers && !discountActive && !data.loadError ? (
        <s-banner tone="warning" heading="Discounts aren't active yet">
          Open any upsell or cross-sell offer and click Save to switch its discount on at checkout.
        </s-banner>
      ) : null}


      {(() => {
        /** `onStore`: it's in the theme right now (on or off), so it belongs in "On my store". */
        type Entry = { key: string; reg: RegistryKey; title: string; tone: Status["tone"]; locked: boolean; onStore: boolean; el: ReactElement };
        const cards: Entry[] = [];
        const add = (e: { key: string; cat?: string; title?: string; onStore: boolean; status: Status; next?: Next; open: { href: string; external?: boolean }; previews: (() => JSX.Element)[]; menu: CardMenuItem[]; off?: boolean }) => {
          const reg = (REGISTRY[e.key] ?? e.key) as RegistryKey;
          if (!featuresIn(area).includes(reg)) return;
          // Titles come from the catalog, so a card always matches its page.
          const title = feature(reg).title;
          // Not in the plan: the card still shows what it does, and its plan; opening it explains and offers the upgrade.
          const locked = !canUse(plan, reg) && trial !== reg;
          const status: Status = locked
            ? { tone: "neutral", text: `On the ${PLANS[FEATURE_PLAN[reg]].name} plan${canTry(plan, reg) ? " · try it free" : ""}` }
            : e.status;
          cards.push({
            key: e.key,
            reg,
            title,
            tone: status.tone,
            locked,
            onStore: e.onStore,
            el: (
              <SectionCard
                key={e.key}
                title={title}
                status={status}
                next={locked ? { label: "See what it does", href: e.open.href } : e.next}
                open={locked ? { href: e.open.href } : e.open}
                previews={e.previews.map((P, i) => <P key={i} />)}
                menu={locked ? [{ label: "See what it does", href: e.open.href }] : e.menu}
                off={e.off || locked}
                save={save(e.key)}
              />
            ),
          });
        };
        const editor = (href: string, inTheme: boolean | null): CardMenuItem => ({ label: inTheme ? "Open in theme editor" : "Add to theme", href, external: true });

        FEATURES.forEach((f) => {
          const on = settings[f.setting];
          const count = f.count(data.counts);
          const inTheme = installed ? (installed[f.key] ?? false) : null;
          let status: Status, next: Next | undefined;
          if (!on) status = { tone: "neutral", text: "Turned off" };
          else if (!count) [status, next] = [{ tone: "warning", text: "Needs setup" }, { label: f.createLabel, href: f.createHref }];
          else if (inTheme === false) [status, next] = [{ tone: "warning", text: `${plural(count, f.noun)} ready` }, { label: "Add to theme", href: data.links[f.key], external: true }];
          else status = { tone: "success", text: `Live · ${plural(count, f.noun)}` };
          add({
            key: f.key,
            // The video carousel is a section on the store page, not an offer.
            cat: f.key === "videos" ? "sections" : "offers",
            title: f.title,
            onStore: inTheme === true,
            status,
            next,
            open: { href: f.href },
            previews: f.Previews,
            off: !on,
            menu: [
              { label: "Manage", href: f.href },
              ...(f.key === "upsell" ? [{ label: "Style", href: "/app/designs/upsell" }] : f.key === "cross_sell" ? [{ label: "Style", href: "/app/designs/cross-sell" }] : f.key === "videos" ? [{ label: "Style", href: "/app/designs/video-carousel" }] : f.key === "bundles" ? [{ label: "Style", href: "/app/designs/bundles" }] : []),
              ...(count ? [{ label: f.createLabel, href: f.createHref }] : []),
              { label: on ? "Turn off" : "Turn on", onClick: () => fetcher.submit({ key: f.setting, value: String(!on) }, { method: "post" }) },
              editor(data.links[f.key], inTheme),
            ],
          });
        });
        SECTION_CARDS.forEach((c) => {
          const counts = c.list ? data.sectionCounts[c.list] : null;
          const inTheme = installed ? (installed[c.key] ?? false) : null;
          const themeHref = data.sectionLinks[c.key];
          const manage = c.app ?? (c.list ? `/app/sections/${c.list}` : null);
          let status: Status, next: Next | undefined;
          if (c.key === "shipping_bar" && !data.shipBarSaved) [status, next] = [{ tone: "warning", text: "Needs setup" }, { label: "Set the goal", href: c.app! }];
          else if (c.key === "collection_pills" && !data.pillCount) [status, next] = [{ tone: "warning", text: "Needs setup" }, { label: "Choose collections", href: c.app! }];
          else if (c.key === "addons" && !data.addonCount) [status, next] = [{ tone: "warning", text: "Needs setup" }, { label: "Add an add-on", href: c.app! }];
          else if (c.key === "image_carousel" && !data.carouselImages) [status, next] = [{ tone: "warning", text: "Needs setup" }, { label: "Add images", href: c.app! }];
          else if (c.list && counts && !counts.total) [status, next] = [{ tone: "warning", text: "Needs setup" }, { label: SECTIONS[c.list].addLabel, href: `/app/sections/${c.list}/new` }];
          else if (inTheme === false) [status, next] = [{ tone: "warning", text: c.embed ? "Off in theme" : "Not on store" }, { label: c.embed ? "Turn on" : "Add to theme", href: themeHref, external: true }];
          else if (inTheme === null && !c.list) status = { tone: "neutral", text: "Set up in theme editor" };
          else status = { tone: "success", text: c.list && counts ? `Live · ${counts.shown} shown` : c.key === "image_carousel" ? `Live · ${data.carouselImages} images` : c.key === "addons" ? `Live · ${plural(data.addonCount, "add-on")}` : c.key === "collection_pills" ? `Live · ${plural(data.pillCount, "collection")}` : "Live" };
          add({
            key: c.key,
            cat: c.cat ?? "sections",
            title: c.title,
            onStore: inTheme === true,
            status,
            next,
            open: manage ? { href: manage } : { href: c.embed ? themeHref : data.links.editor, external: true },
            previews: c.Previews,
            menu: [
              ...(manage ? [{ label: c.key === "hero" ? "Banners" : c.app ? "Style" : "Manage", href: manage }] : []),
              ...(c.list && SECTIONS[c.list].design ? [{ label: "Style", href: SECTIONS[c.list].design! }] : []),
              ...(c.list && counts?.total ? [{ label: SECTIONS[c.list].addLabel, href: `/app/sections/${c.list}/new` }] : []),
              { ...editor(themeHref, inTheme), ...(c.embed && !inTheme ? { label: "Turn on in theme" } : {}) },
            ],
          });
        });
        BOOSTER_CARDS.forEach((b) => {
          const embedOn = installed ? (installed.boosters ?? false) : null;
          const enabled = data.boosters[b.key].enabled;
          let status: Status, next: Next | undefined;
          if (!enabled) [status, next] = [{ tone: "neutral", text: "Turned off" }, { label: "Switch on", href: "/app/boosters" }];
          else if (embedOn === false) [status, next] = [{ tone: "warning", text: "Off in theme" }, { label: "Turn on", href: data.sectionLinks.boosters, external: true }];
          else status = { tone: "success", text: "Live" };
          add({
            key: b.key,
            cat: "boosters",
            title: b.title,
            onStore: embedOn === true && enabled,
            status,
            next,
            open: { href: "/app/boosters" },
            previews: b.Previews,
            off: !enabled,
            menu: [{ label: "Open boosters", href: "/app/boosters" }, { ...editor(data.sectionLinks.boosters, embedOn), ...(!embedOn ? { label: "Turn on in theme" } : {}) }],
          });
        });
        PAGE_CARDS.forEach((pg) => {
          const inTheme = installed ? (installed.contact ?? false) : null;
          let status: Status, next: Next | undefined;
          if (!data.contactSaved) [status, next] = [{ tone: "warning", text: "Needs style" }, { label: "Style it", href: pg.href }];
          else if (inTheme === false) [status, next] = [{ tone: "warning", text: "Designed" }, { label: "Add to page", href: data.links.contact, external: true }];
          else status = { tone: "success", text: "Live" };
          add({
            key: pg.key,
            cat: "design",
            title: pg.title,
            onStore: inTheme === true,
            status,
            next,
            open: { href: pg.href },
            previews: pg.Previews,
            menu: [{ label: "Style", href: pg.href }, { ...editor(data.links.contact, inTheme), ...(!inTheme ? { label: "Add to page" } : {}) }],
          });
        });

        // Headers and footers: the header is designed in the app and switched on as an app embed.
        {
          const inTheme = installed ? (installed.header ?? false) : null;
          let status: Status, next: Next | undefined;
          if (!data.headerSaved) [status, next] = [{ tone: "warning", text: "Needs style" }, { label: "Style it", href: "/app/designs/header" }];
          else if (inTheme === false) [status, next] = [{ tone: "warning", text: "Not on store" }, { label: "Add to header", href: data.sectionLinks.header, external: true }];
          else status = { tone: "success", text: "Live" };
          add({
            key: "header",
            cat: "design",
            title: "Header",
            onStore: inTheme === true,
            status,
            next,
            open: { href: "/app/designs/header" },
            previews: [HeaderGlassShowcase, HeaderRoundedShowcase],
            menu: [{ label: "Style", href: "/app/designs/header" }, { ...editor(data.sectionLinks.header, inTheme), ...(!inTheme ? { label: "Add to header" } : {}) }],
          });
          const footerIn = installed ? (installed.footer ?? false) : null;
          let fStatus: Status, fNext: Next | undefined;
          if (!data.footerSaved) [fStatus, fNext] = [{ tone: "warning", text: "Needs style" }, { label: "Style it", href: "/app/designs/footer" }];
          else if (footerIn === false) [fStatus, fNext] = [{ tone: "warning", text: "Not on store" }, { label: "Add to footer", href: data.sectionLinks.footer, external: true }];
          else fStatus = { tone: "success", text: "Live" };
          for (const page of [
            { key: "track" as const, title: "Track order page", href: "/app/pages/track", Preview: TrackShowcase },
            { key: "returns" as const, title: "Returns page", href: "/app/returns", Preview: ReturnsShowcase },
          ]) {
            const on = installed ? (installed[page.key] ?? false) : null;
            add({
              key: page.key,
              cat: "design",
              title: page.title,
              onStore: on === true,
              status: on === false ? { tone: "warning", text: "Not on store" } : on ? { tone: "success", text: "Live" } : { tone: "neutral", text: "Set up in theme editor" },
              next: on === false ? { label: "Add to a page", href: data.sectionLinks[page.key], external: true } : undefined,
              open: { href: page.href },
              previews: [page.Preview],
              menu: [{ label: page.key === "returns" ? "Requests" : "Style", href: page.href }, ...(page.key === "returns" ? [{ label: "Style", href: "/app/pages/returns" }] : []), { ...editor(data.sectionLinks[page.key], on), ...(!on ? { label: "Add to a page" } : {}) }],
            });
          }
          add({
            key: "footer",
            cat: "design",
            title: "Footer",
            onStore: footerIn === true,
            status: fStatus,
            next: fNext,
            open: { href: "/app/designs/footer" },
            previews: [FooterShowcase],
            menu: [{ label: "Style", href: "/app/designs/footer" }, { ...editor(data.sectionLinks.footer, footerIn), ...(!footerIn ? { label: "Add to footer" } : {}) }],
          });
        }

        // Checkout: rules run by the app's Functions inside Shopify checkout (nothing to add to the theme).
        for (const c of [
          { key: "checkout_payment", title: "Payment rules", n: data.checkout?.payment, href: "/app/checkout/payment", Previews: [PaymentRulesShowcase] },
          { key: "checkout_delivery", title: "Delivery rules", n: data.checkout?.delivery, href: "/app/checkout/delivery", Previews: [DeliveryRulesShowcase] },
          { key: "checkout_limits", title: "Order limits", n: data.checkout?.limits, href: "/app/checkout/limits", Previews: [OrderLimitsShowcase] },
        ]) {
          const status: Status =
            c.n === undefined ? { tone: "warning", text: "Needs permission" } : c.n === -1 ? { tone: "neutral", text: "Turned off" } : c.n ? { tone: "success", text: `Live · ${plural(c.n, "rule")}` } : { tone: "warning", text: "Needs setup" };
          add({
            key: c.key,
            cat: "checkout",
            title: c.title,
            onStore: !!c.n && c.n > 0,
            status,
            next: c.n ? undefined : { label: "Add a rule", href: c.href },
            open: { href: c.href },
            previews: c.Previews,
            off: c.n === -1,
            menu: [{ label: "Rules", href: c.href }],
          });
        }

        add({
          key: "checkout_thank_you",
          cat: "checkout",
          title: "Thank-you page",
          onStore: data.thankYou > 0,
          status: data.thankYou ? { tone: "success", text: `${plural(data.thankYou, "module")} · add the block in checkout` } : { tone: "warning", text: "Needs setup" },
          next: data.thankYou ? undefined : { label: "Add modules", href: "/app/checkout/thank-you" },
          open: { href: "/app/checkout/thank-you" },
          previews: [ThankYouShowcase],
          menu: [{ label: "Modules", href: "/app/checkout/thank-you" }],
        });

        add({
          key: "checkout_post_purchase",
          cat: "checkout",
          title: "After-purchase offer",
          onStore: data.postPurchase === "on",
          status: data.postPurchase === "on" ? { tone: "success", text: "Live" } : data.postPurchase === "off" ? { tone: "neutral", text: "Turned off" } : { tone: "warning", text: "Needs setup" },
          next: data.postPurchase === "none" ? { label: "Pick a product", href: "/app/checkout/after-purchase" } : undefined,
          open: { href: "/app/checkout/after-purchase" },
          previews: [PostPurchaseShowcase],
          off: data.postPurchase === "off",
          menu: [{ label: "Offer", href: "/app/checkout/after-purchase" }],
        });

        // Cross-sell offers inside the theme's own cart drawer (the "Cart drawer offers" app embed).
        {
          const embedOn = installed ? (installed.drawer ?? false) : null;
          add({
            key: "cart_offers",
            onStore: embedOn === true && data.counts.drawer > 0,
            status: !data.counts.drawer
              ? { tone: "warning", text: "No offer in the cart yet" }
              : embedOn === false
                ? { tone: "warning", text: "Off in theme" }
                : { tone: "success", text: `Live · ${plural(data.counts.drawer, "offer")}` },
            next: !data.counts.drawer ? { label: "Create a cross-sell", href: "/app/offers/cross-sell/new" } : embedOn === false ? { label: "Turn on", href: data.links.drawer, external: true } : undefined,
            open: { href: "/app/offers/cross-sell" },
            previews: [CrossSellCardsShowcase],
            menu: [{ label: "Offers", href: "/app/offers/cross-sell" }, { label: "Style", href: "/app/designs/cross-sell" }, editor(data.links.drawer, embedOn)],
          });
        }

        const CATS: { key: string; title: string }[] = grouped ? GROUPS : [{ key: area, title: areaOf(area).title }];
        const groupOf = (c: Entry) => (grouped ? (feature(c.reg).group ?? "content") : area);
        const onStoreCount = cards.filter((c) => c.onStore).length;
        const q = query.trim().toLowerCase();
        const match = (c: Entry) =>
          (cat !== "store" || c.onStore) &&
          (status === "all" || (status === "locked" ? c.locked : !c.locked && (status === "live" ? c.tone === "success" : status === "setup" ? c.tone === "warning" : c.tone === "neutral"))) &&
          (!q || c.title.toLowerCase().includes(q));
        const empty = (text: string) => <div className={showcase.empty}>{text}</div>;
        const grid = (list: Entry[]) => <div className={showcase.grid}>{list.map((c) => c.el)}</div>;
        const renderGroups = (cats: typeof CATS, emptyText: string) => {
          const groups = cats.map((c) => ({ ...c, list: cards.filter((x) => groupOf(x) === c.key && match(x)) })).filter((g) => g.list.length || cats.length === 1);
          if (!groups.length) return empty(emptyText);
          return groups.map((g) => (
            <s-stack key={g.key} gap="small-200">
              {grouped ? <GroupTitle>{`${g.title} (${g.list.length})`}</GroupTitle> : null}
              {g.list.length ? grid(g.list) : empty("Nothing matches these filters.")}
            </s-stack>
          ));
        };

        return (
          <>
            <s-text color="subdued">{areaOf(area).intro}</s-text>
            <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
              {/* Categories, then (set a little apart) the two personal views: what's on the store and what's saved. */}
              {!grouped ? <span /> : <s-stack direction="inline" gap="small-100" alignItems="center">
                <Segmented
                  label="Group"
                  value={cat}
                  options={[{ value: "all", label: "All" }, ...CATS.map((c) => ({ value: c.key, label: c.title }))]}
                  onChange={(v) => setFilter({ cat: v })}
                />
                <Segmented
                  label="My views"
                  value={cat}
                  options={[
                    { value: "store", label: "On my store", count: onStoreCount },
                    { value: "saved", label: "Saved", count: saved.length },
                  ]}
                  onChange={(v) => setFilter({ cat: v })}
                />
              </s-stack>}
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <select className={`${showcase.find} ${showcase.statusSel}`} aria-label="Status" value={status} onChange={(e) => setFilter({ status: e.target.value })}>
                  <option value="all">All statuses</option>
                  <option value="live">Live</option>
                  <option value="setup">Needs a step</option>
                  <option value="off">Turned off</option>
                  <option value="locked">Not in my plan</option>
                </select>
                <input className={showcase.find} type="search" placeholder="Search…" aria-label="Search features" value={query} onChange={(e) => setQuery(e.target.value)} />
              </s-stack>
            </s-stack>
            {cat === "store" ? (
              <s-text color="subdued">Everything from the app that is in your theme right now. Use ⋯ on a card to manage it, turn it off or open it in the theme editor.</s-text>
            ) : null}
            {cat === "saved"
              ? (() => {
                  const list = saved.map((k) => cards.find((c) => c.key === k)).filter((c): c is Entry => !!c && match(c));
                  return list.length ? grid(list) : empty("No saved items here. Click the bookmark on any card to keep it in Saved.");
                })()
              : cat === "store"
                ? renderGroups(CATS, "Nothing from the app is on your store yet. Pick a card and follow its next step to add it.")
                : renderGroups(CATS.filter((c) => !grouped || cat === "all" || cat === c.key), "Nothing matches these filters.")}
          </>
        );
      })()}

      {data.themeError ? <s-text color="subdued">Theme check unavailable: {data.themeError}</s-text> : null}
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
