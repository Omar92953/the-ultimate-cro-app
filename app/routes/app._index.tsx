import { useEffect, useRef, useState, type ReactElement } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  editorLinks,
  getDiscountStatus,
  getSavedSections,
  getSettings,
  getSlides,
  getThemeStatus,
  hasCartTransform,
  listBundles,
  listRules,
  setSavedSections,
  setSetting,
  FEATURE_KEYS,
  type Settings,
} from "../lib/cro.server";
import type { DiscountMode } from "../lib/types";
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
  ProductPageShowcase,
  CollectionPageShowcase,
  HeaderGlassShowcase,
  HeaderRoundedShowcase,
  FooterShowcase,
} from "../components/SectionShowcase";
import showcase from "../components/SectionShowcase.module.css";
import { Card, Checklist, GroupTitle, Pill, Segmented } from "../components/ui";
import { listItems, sectionLinks } from "../lib/sections.server";
import { getBoosters } from "../lib/boosters.server";
import { getContact } from "../lib/pages.server";
import { getAddons, getHeader, getImageCarousel, getPills, getShippingBar } from "../lib/designs.server";
import { DEFAULT_BOOSTERS, type BoostersConfig } from "../lib/boosters";
import { SECTIONS, SECTION_KINDS, itemStatus, type SectionKind } from "../lib/sections";
import { CATEGORIES, category, type CategoryKey } from "../lib/catalog";

function settled<T>(r: PromiseSettledResult<T>, fallback: T): T {
  return r.status === "fulfilled" ? r.value : fallback;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [settings, rules, slides, bundles, theme, discount, transform] = await Promise.allSettled([
    getSettings(admin),
    listRules(admin),
    getSlides(admin),
    listBundles(admin),
    getThemeStatus(admin),
    getDiscountStatus(admin),
    hasCartTransform(admin),
  ]);
  const ruleList = settled(rules, []);
  const [lists, boosters, saved, contact, carousel, addons, header, pills, shipBar] = await Promise.all([
    Promise.allSettled(SECTION_KINDS.map((k) => listItems(admin, k))),
    getBoosters(admin).catch(() => DEFAULT_BOOSTERS),
    getSavedSections(admin).catch(() => [] as string[]),
    getContact(admin).catch(() => ({ saved: false })),
    getImageCarousel(admin).catch(() => null),
    getAddons(admin).catch(() => null),
    getHeader(admin).catch(() => null),
    getPills(admin).catch(() => null),
    getShippingBar(admin).catch(() => null),
  ]);
  const sectionCounts = Object.fromEntries(
    SECTION_KINDS.map((k, i) => {
      const items = settled(lists[i], []);
      return [k, { total: items.length, shown: items.filter((it) => itemStatus(k, it).tone === "ok").length }];
    }),
  ) as Record<SectionKind, { total: number; shown: number }>;
  return {
    boosters,
    saved,
    contactSaved: contact.saved,
    headerSaved: !!header?.saved,
    pillCount: pills ? pills.config.items.length : 0,
    shipBarSaved: !!shipBar?.saved,
    addonCount: addons ? addons.config.items.length + (addons.config.message.on ? 1 : 0) : 0,
    carouselImages: carousel ? carousel.config.slides.filter((x) => x.image).length : 0,
    sectionCounts,
    sectionLinks: sectionLinks(session.shop),
    shop: session.shop,
    links: editorLinks(session.shop),
    settings: settled(settings, { cross_sell_enabled: true, upsell_enabled: true, videos_enabled: true, bundles_enabled: true }),
    counts: {
      cross_sell: ruleList.filter((r) => r.kind === "cross_sell" && r.active).length,
      upsell: ruleList.filter((r) => r.kind === "upsell" && r.active).length,
      drawer: ruleList.filter((r) => r.kind === "cross_sell" && r.active && r.placements.includes("drawer")).length,
      videos: settled(slides, []).length,
      bundles: settled(bundles, []).filter((b) => b.active).length,
    },
    theme: theme.status === "fulfilled" ? theme.value : null,
    themeError: theme.status === "rejected" ? errorMessage(theme.reason) : null,
    discount: settled(discount, {
      id: null,
      status: null,
      needed: false,
      mode: "auto" as DiscountMode,
      engine: "function" as const,
      reason: "",
      nativeCount: 0,
    }),
    cartTransform: settled(transform, false),
    loadError: [settings, rules].find((r) => r.status === "rejected") ? "Some data could not be loaded. Refresh to try again." : null,
  };
};

/** Changing the Home filters only changes the address: no need to reload everything. */
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
    description: "Mix-and-match bundles at one price.",
    href: "/app/bundles",
    createHref: "/app/bundles/new",
    createLabel: "Create a bundle",
    count: (c) => c.bundles,
    noun: "bundle",
    Previews: [BundlesShowcase, BundlesStepsShowcase],
  },
];

type SectionCardKey = SectionKind | "quick_add" | "hero" | "countdown_bar" | "image_carousel" | "addons" | "collection_pills" | "shipping_bar";

/** Sections and boosters, shown in the same card format as the features above. */
/** `app`: designed in the app (the theme editor only switches it on). */
const SECTION_CARDS: { key: SectionCardKey; title: string; description: string; list: SectionKind | null; embed: boolean; app?: string; cat?: "offers" | "boosters"; Previews: (() => JSX.Element)[] }[] = [
  { key: "reviews", title: "Customer reviews", description: "Text, photo and video reviews with WhatsApp, Instagram and TikTok badges.", list: "reviews", embed: false, Previews: [ReviewsShowcase, ReviewsChatShowcase, ReviewsPhotosShowcase] },
  { key: "faq", title: "FAQ", description: "Questions and answers with search and group buttons.", list: "faq", embed: false, Previews: [FaqShowcase, FaqCardsShowcase] },
  { key: "logos", title: "Scrolling logos and text", description: "Logos or short texts in a scrolling strip or a grid.", list: "logos", embed: false, Previews: [LogosShowcase, LogosOneLineShowcase, LogosGridShowcase] },
  { key: "announcements", title: "Announcement bar", description: "Rotating messages at the top, with free-shipping progress.", list: "announcements", embed: true, cat: "boosters", Previews: [AnnouncementShowcase, AnnouncementShippingShowcase, AnnouncementStyleShowcase] },
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
  { key: "page_product", title: "Product page", href: "/app/browse/design", Previews: [ProductPageShowcase] },
  { key: "page_collection", title: "Collection page", href: "/app/browse/design", Previews: [CollectionPageShowcase] },
];

/** The four boosters live in one app embed; each is switched on and edited on the Boosters page. */
const BOOSTER_CARDS: { key: keyof BoostersConfig; title: string; Previews: (() => JSX.Element)[] }[] = [
  { key: "sticky", title: "Sticky add to cart", Previews: [StickyShowcase, StickyMobileShowcase] },
  { key: "urgency", title: "Stock urgency", Previews: [UrgencyShowcase, UrgencyLastShowcase] },
  { key: "trust", title: "Trust badges", Previews: [TrustShowcase, TrustGridShowcase] },
  { key: "salesPop", title: "Sales pop-ups", Previews: [SalesPopShowcase, SalesPopStackShowcase] },
];

type Status = { tone: "success" | "warning" | "neutral"; text: string };
type Next = { label: string; href: string; external?: boolean };

export default function Home() {
  return <HomeView />;
}

/** Home (all categories), or one category's page (`only`) — the same cards either way. */
export function HomeView({ only }: { only?: CategoryKey }) {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const saveFetcher = useFetcher<typeof action>();
  const [params, setParams] = useSearchParams();
  // Home filters (kept in the address, so going back returns to the same view)
  const cat = only ?? params.get("cat") ?? (params.get("view") === "saved" ? "saved" : "all");
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
  const anyBlock = !!installed && Object.values(installed).some(Boolean);
  const anyConfig = Object.values(data.counts).some((n) => n > 0);
  const steps = [anyConfig, anyBlock, anyBlock && anyConfig];
  const doneCount = steps.filter(Boolean).length;
  const hasDiscountedOffers = data.counts.upsell + data.counts.cross_sell > 0;
  const discountActive =
    data.discount.engine === "native" ? data.discount.nativeCount > 0 : data.discount.status === "ACTIVE";

  return (
    <s-page heading={only ? category(only).title : "CRO Toolbox"} inlineSize="large">
      <Button slot="secondary-actions" href={`https://${data.shop}`} target="_blank" icon="view">
        View store
      </Button>
      <s-stack gap="base">

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

      {!only && doneCount < 3 ? (
        <Card title="Get set up" badge={<Pill tone="warn">{`${doneCount} of 3 done`}</Pill>}>
          <Checklist
            items={[
              !steps[0] && { text: "Create your first offer, video or bundle", action: <Button href="/app/offers/upsell/new" variant="tertiary">Create an offer</Button> },
              !steps[1] && {
                text: `Add the app's blocks to your theme${data.theme?.themeName ? ` (“${data.theme.themeName}”)` : ""}`,
                action: (
                  <Button href={data.links.upsell} target="_top" variant="tertiary">
                    Open theme editor
                  </Button>
                ),
              },
              !steps[2] && {
                text: "Check it on your store, then try the discount at checkout",
                action: (
                  <Button href={`https://${data.shop}`} target="_blank" variant="tertiary">
                    View store
                  </Button>
                ),
              },
            ].filter((x): x is { text: string; action: JSX.Element } => !!x)}
          />
        </Card>
      ) : null}

      {(() => {
        type Cat = CategoryKey;
        /** `onStore`: it's in the theme right now (on or off), so it belongs in "On my store". */
        type Entry = { key: string; cat: Cat; title: string; tone: Status["tone"]; onStore: boolean; el: ReactElement };
        const cards: Entry[] = [];
        const add = (e: Omit<Entry, "el" | "tone"> & { status: Status; next?: Next; open: { href: string; external?: boolean }; previews: (() => JSX.Element)[]; menu: CardMenuItem[]; off?: boolean }) =>
          cards.push({
            key: e.key,
            cat: e.cat,
            title: e.title,
            tone: e.status.tone,
            onStore: e.onStore,
            el: (
              <SectionCard
                key={e.key}
                title={e.title}
                status={e.status}
                next={e.next}
                open={e.open}
                previews={e.previews.map((P, i) => <P key={i} />)}
                menu={e.menu}
                off={e.off}
                save={save(e.key)}
              />
            ),
          });
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
              ...(f.key === "upsell" ? [{ label: "Design", href: "/app/designs/upsell" }] : f.key === "cross_sell" ? [{ label: "Design", href: "/app/designs/cross-sell" }] : f.key === "videos" ? [{ label: "Design", href: "/app/designs/video-carousel" }] : f.key === "bundles" ? [{ label: "Design", href: "/app/designs/bundles" }] : []),
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
              ...(manage ? [{ label: c.key === "hero" ? "Banners" : c.app ? "Design" : "Manage", href: manage }] : []),
              ...(c.list && SECTIONS[c.list].design ? [{ label: "Design", href: SECTIONS[c.list].design! }] : []),
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
            menu: [{ label: "Manage boosters", href: "/app/boosters" }, { ...editor(data.sectionLinks.boosters, embedOn), ...(!embedOn ? { label: "Turn on in theme" } : {}) }],
          });
        });
        PAGE_CARDS.forEach((pg) => {
          const ready = pg.key === "page_contact";
          const inTheme = installed ? (installed.contact ?? false) : null;
          let status: Status, next: Next | undefined;
          if (!ready) status = { tone: "neutral", text: "Coming soon" };
          else if (!data.contactSaved) [status, next] = [{ tone: "warning", text: "Needs design" }, { label: "Design it", href: pg.href }];
          else if (inTheme === false) [status, next] = [{ tone: "warning", text: "Designed" }, { label: "Add to page", href: data.links.contact, external: true }];
          else status = { tone: "success", text: "Live" };
          add({
            key: pg.key,
            cat: "design",
            title: pg.title,
            onStore: ready && inTheme === true,
            status,
            next,
            open: { href: pg.href },
            previews: pg.Previews,
            off: !ready,
            menu: ready ? [{ label: "Design", href: pg.href }, { ...editor(data.links.contact, inTheme), ...(!inTheme ? { label: "Add to page" } : {}) }] : [],
          });
        });

        // Headers and footers: the header is designed in the app and switched on as an app embed.
        {
          const inTheme = installed ? (installed.header ?? false) : null;
          let status: Status, next: Next | undefined;
          if (!data.headerSaved) [status, next] = [{ tone: "warning", text: "Needs design" }, { label: "Design it", href: "/app/designs/header" }];
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
            menu: [{ label: "Design", href: "/app/designs/header" }, { ...editor(data.sectionLinks.header, inTheme), ...(!inTheme ? { label: "Add to header" } : {}) }],
          });
          add({ key: "footer", cat: "design", title: "Footer", onStore: false, status: { tone: "neutral", text: "Coming soon" }, open: { href: "/app/browse/design" }, previews: [FooterShowcase], off: true, menu: [] });
        }

        const CATS = CATEGORIES;
        const onStoreCount = cards.filter((c) => c.onStore).length;
        const q = query.trim().toLowerCase();
        const match = (c: Entry) =>
          (cat !== "store" || c.onStore) &&
          (status === "all" || (status === "live" ? c.tone === "success" : status === "setup" ? c.tone === "warning" : c.tone === "neutral")) &&
          (!q || c.title.toLowerCase().includes(q));
        const empty = (text: string) => <div className={showcase.empty}>{text}</div>;
        const grid = (list: Entry[]) => <div className={showcase.grid}>{list.map((c) => c.el)}</div>;
        const grouped = (cats: typeof CATS, emptyText: string) => {
          const groups = cats.map((c) => ({ ...c, list: cards.filter((x) => x.cat === c.key && match(x)) })).filter((g) => g.list.length || cats.length === 1);
          if (!groups.length) return empty(emptyText);
          return groups.map((g) => (
            <s-stack key={g.key} gap="small-200">
              {only ? null : <GroupTitle>{`${g.title} (${g.list.length})`}</GroupTitle>}
              {g.list.length ? grid(g.list) : empty("Nothing matches these filters.")}
            </s-stack>
          ));
        };

        return (
          <>
            {only ? <s-text color="subdued">{category(only).intro}</s-text> : null}
            <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
              {/* Categories, then (set a little apart) the two personal views: what's on the store and what's saved. */}
              {only ? <span /> : <s-stack direction="inline" gap="small-100" alignItems="center">
                <Segmented
                  label="Category"
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
                  <option value="off">Off or coming soon</option>
                </select>
                <input className={showcase.find} type="search" placeholder="Search…" aria-label="Search sections" value={query} onChange={(e) => setQuery(e.target.value)} />
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
                ? grouped(CATS, "Nothing from the app is on your store yet. Pick a card and follow its next step to add it.")
                : grouped(CATS.filter((c) => cat === "all" || cat === c.key), "Nothing matches these filters.")}
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
