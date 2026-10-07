import { useEffect, useState, type ReactElement } from "react";
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
  setSectionSaved,
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
  CountdownDailyShowcase,
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
  VideosShowcase,
  SalesPopShowcase,
  SalesPopStackShowcase,
  SectionCard,
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
} from "../components/SectionShowcase";
import showcase from "../components/SectionShowcase.module.css";
import { Card, Checklist, GroupTitle, Pill, Segmented } from "../components/ui";
import { listItems, sectionLinks } from "../lib/sections.server";
import { getBoosters } from "../lib/boosters.server";
import { getContact } from "../lib/pages.server";
import { DEFAULT_BOOSTERS, type BoostersConfig } from "../lib/boosters";
import { SECTIONS, SECTION_KINDS, itemStatus, type SectionKind } from "../lib/sections";

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
  const [lists, boosters, saved, contact] = await Promise.all([
    Promise.allSettled(SECTION_KINDS.map((k) => listItems(admin, k))),
    getBoosters(admin).catch(() => DEFAULT_BOOSTERS),
    getSavedSections(admin).catch(() => [] as string[]),
    getContact(admin).catch(() => ({ saved: false })),
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
  if (form.get("intent") === "save") {
    try {
      const saved = form.get("value") === "true";
      await setSectionSaved(admin, String(form.get("key")), saved);
      return { ok: true, error: null, message: saved ? "Added to Saved" : "Removed from Saved" };
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

type SectionCardKey = SectionKind | "quick_add" | "hero" | "countdown" | "countdown_bar";

/** Store sections, shown in the same card format as the features above. */
/** `app`: designed in the app (the theme editor only switches it on). */
const SECTION_CARDS: { key: SectionCardKey; title: string; description: string; list: SectionKind | null; embed: boolean; app?: string; Previews: (() => JSX.Element)[] }[] = [
  { key: "reviews", title: "Customer reviews", description: "Text, photo and video reviews with WhatsApp, Instagram and TikTok badges.", list: "reviews", embed: false, Previews: [ReviewsShowcase, ReviewsChatShowcase, ReviewsPhotosShowcase] },
  { key: "faq", title: "FAQ", description: "Questions and answers with search and group buttons.", list: "faq", embed: false, Previews: [FaqShowcase, FaqCardsShowcase] },
  { key: "logos", title: "Trusted-by logos", description: "Press and partner logos in a scrolling strip or a grid.", list: "logos", embed: false, Previews: [LogosShowcase, LogosOneLineShowcase, LogosGridShowcase] },
  { key: "announcements", title: "Announcement bar", description: "Rotating messages at the top, with free-shipping progress.", list: "announcements", embed: true, Previews: [AnnouncementShowcase, AnnouncementShippingShowcase, AnnouncementStyleShowcase] },
  { key: "quick_add", title: "Quick add to cart", description: "A button on every product card; sizes open a small picker.", list: null, embed: true, Previews: [QuickAddShowcase, QuickAddToastShowcase] },
  { key: "hero", title: "Hero image", description: "A banner with separate desktop and mobile images.", list: null, embed: false, Previews: [HeroShowcase, HeroCenteredShowcase] },
  { key: "countdown", title: "Countdown timer", description: "Sale end, a timer per visitor, or a daily order cut-off.", list: null, embed: false, Previews: [CountdownShowcase, CountdownRowShowcase, CountdownDailyShowcase] },
  { key: "countdown_bar", title: "Countdown bar", description: "A slim timer bar at the top or bottom of every page.", list: null, embed: true, app: "/app/designs/countdown-bar", Previews: [CountdownBarShowcase, CountdownBarDarkShowcase] },
];

/** Pages designed in the app (Contact page now; the others are coming). */
const PAGE_CARDS: { key: string; title: string; href: string; Previews: (() => JSX.Element)[] }[] = [
  { key: "page_contact", title: "Contact page", href: "/app/pages/contact", Previews: [ContactShowcase, ContactInfoShowcase] },
  { key: "page_product", title: "Product page", href: "/app/pages", Previews: [ProductPageShowcase] },
  { key: "page_collection", title: "Collection page", href: "/app/pages", Previews: [CollectionPageShowcase] },
  { key: "page_header", title: "Headers", href: "/app/pages", Previews: [HeaderGlassShowcase, HeaderRoundedShowcase] },
];

/** The four boosters live in one app embed; each is switched on and edited on the Boosters page. */
const BOOSTER_CARDS: { key: keyof BoostersConfig; title: string; Previews: (() => JSX.Element)[] }[] = [
  { key: "sticky", title: "Sticky add to cart", Previews: [StickyShowcase, StickyMobileShowcase] },
  { key: "urgency", title: "Stock urgency", Previews: [UrgencyShowcase, UrgencyLastShowcase] },
  { key: "trust", title: "Trust badges", Previews: [TrustShowcase, TrustGridShowcase] },
  { key: "salesPop", title: "Sales pop-ups", Previews: [SalesPopShowcase, SalesPopStackShowcase] },
];

function sectionStatus(list: SectionKind | null, counts: { total: number; shown: number } | null, installed: boolean | null, embed: boolean): Status {
  if (list && counts && !counts.total) return { tone: "warning", text: "Not set up", next: "create" };
  if (installed === false) return { tone: "warning", text: embed ? "Turned off" : "Not in theme", next: "theme" };
  if (installed === null && !list) return { tone: "neutral", text: "Theme editor", next: "theme" };
  if (list && counts) return { tone: "success", text: `Live · ${counts.shown} shown`, next: null };
  return { tone: "success", text: "Live", next: null };
}

type Status = { tone: "success" | "warning" | "neutral"; text: string; next: "create" | "theme" | null };

function featureStatus(on: boolean, count: number, noun: string, installed: boolean | null): Status {
  if (!on) return { tone: "neutral", text: "Off", next: null };
  if (!count) return { tone: "warning", text: "Not set up", next: "create" };
  if (installed === false) return { tone: "warning", text: "Not in theme", next: "theme" };
  return { tone: "success", text: `Live · ${plural(count, noun)}`, next: null };
}

export default function Home() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const saveFetcher = useFetcher<typeof action>();
  const [params, setParams] = useSearchParams();
  // Home filters (kept in the address, so going back returns to the same view)
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

  // Saved cards, newest first; a click shows right away while it's being stored.
  let saved = data.saved;
  if (saveFetcher.formData?.get("intent") === "save") {
    const key = String(saveFetcher.formData.get("key"));
    saved = saveFetcher.formData.get("value") === "true" ? [key, ...saved.filter((k) => k !== key)] : saved.filter((k) => k !== key);
  }
  const save = (key: string) => ({
    saved: saved.includes(key),
    onChange: (value: boolean) => saveFetcher.submit({ intent: "save", key, value: String(value) }, { method: "post" }),
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
    <s-page heading="The Ultimate CRO App" inlineSize="large">
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

      {doneCount < 3 ? (
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
        type Cat = "offers" | "sections" | "boosters" | "pages";
        type Entry = { key: string; cat: Cat; title: string; tone: Status["tone"]; el: ReactElement };
        const cards: Entry[] = [];
        FEATURES.forEach((f) => {
          const on = settings[f.setting];
          const count = f.count(data.counts);
          const isInstalled = installed ? (installed[f.key] ?? false) : null;
          const status = featureStatus(on, count, f.noun, isInstalled);
          const action =
            status.next === "create"
              ? { label: f.createLabel, href: f.createHref }
              : status.next === "theme"
                ? { label: "Add to theme", href: data.links[f.key], external: true }
                : { label: on ? "Live" : "Manage", done: on, href: f.href };
          cards.push({ key: f.key, cat: "offers", title: f.title, tone: status.tone, el: (
            <SectionCard
              key={f.key}
              title={f.title}
              status={status}
              action={action}
              open={{ href: f.href }}
              previews={f.Previews.map((P, i) => <P key={i} />)}
              off={!on}
              toggle={{ on, onChange: (value) => fetcher.submit({ key: f.setting, value: String(value) }, { method: "post" }) }}
              save={save(f.key)}
            />
          ) });
        });
        SECTION_CARDS.forEach((c) => {
          const counts = c.list ? data.sectionCounts[c.list] : null;
          const isInstalled = installed ? (installed[c.key] ?? false) : null;
          const status = sectionStatus(c.list, counts, isInstalled, c.embed);
          const themeHref = data.sectionLinks[c.key];
          const open = c.app ? { href: c.app } : c.list ? { href: `/app/sections/${c.list}` } : { href: c.embed ? themeHref : data.links.editor, external: true };
          const action =
            status.next === "create" && c.list
              ? { label: SECTIONS[c.list].addLabel, href: `/app/sections/${c.list}/new` }
              : status.next === "theme"
                ? { label: c.embed ? "Turn on" : "Add to theme", href: themeHref, external: true }
                : { label: "Live", done: true, ...open };
          cards.push({ key: c.key, cat: "sections", title: c.title, tone: status.tone, el: <SectionCard key={c.key} title={c.title} status={status} action={action} open={open} previews={c.Previews.map((P, i) => <P key={i} />)} save={save(c.key)} /> });
        });
        BOOSTER_CARDS.forEach((b) => {
          const embedOn = installed ? (installed.boosters ?? false) : null;
          const enabled = data.boosters[b.key].enabled;
          const status: Status = !enabled
            ? { tone: "neutral", text: "Off", next: null }
            : embedOn === false
              ? { tone: "warning", text: "Turned off", next: "theme" }
              : { tone: "success", text: "Live", next: null };
          const action =
            status.next === "theme"
              ? { label: "Turn on", href: data.sectionLinks.boosters, external: true }
              : enabled
                ? { label: "Live", done: true, href: "/app/boosters" }
                : { label: "Switch on", href: "/app/boosters" };
          cards.push({ key: b.key, cat: "boosters", title: b.title, tone: status.tone, el: (
            <SectionCard
              key={b.key}
              title={b.title}
              status={status}
              action={action}
              open={{ href: "/app/boosters" }}
              previews={b.Previews.map((P, i) => <P key={i} />)}
              save={save(b.key)}
            />
          ) });
        });
        PAGE_CARDS.forEach((pg) => {
          const ready = pg.key === "page_contact";
          const status: Status = !ready
            ? { tone: "neutral", text: "Coming soon", next: null }
            : !data.contactSaved
              ? { tone: "warning", text: "Not designed", next: "create" }
              : installed && installed.contact === false
                ? { tone: "warning", text: "Not in theme", next: "theme" }
                : { tone: "success", text: "Live", next: null };
          const action = !ready
            ? { label: "Soon", href: "/app/pages" }
            : status.next === "theme"
              ? { label: "Add to page", href: data.links.contact, external: true }
              : status.next === "create"
                ? { label: "Design", href: pg.href }
                : { label: "Live", done: true, href: pg.href };
          cards.push({ key: pg.key, cat: "pages", title: pg.title, tone: status.tone, el: (
            <SectionCard key={pg.key} title={pg.title} status={status} action={action} open={{ href: pg.href }} previews={pg.Previews.map((P, i) => <P key={i} />)} save={save(pg.key)} off={!ready} />
          ) });
        });

        const CATS: { key: Cat; title: string }[] = [
          { key: "offers", title: "Offers and bundles" },
          { key: "sections", title: "Store sections" },
          { key: "boosters", title: "Boosters" },
          { key: "pages", title: "Pages" },
        ];
        const q = query.trim().toLowerCase();
        const match = (c: Entry) =>
          (status === "all" || (status === "live" ? c.tone === "success" : status === "setup" ? c.tone === "warning" : c.tone === "neutral")) &&
          (!q || c.title.toLowerCase().includes(q));
        const empty = (text: string) => <div className={showcase.empty}>{text}</div>;
        const grid = (list: Entry[]) => <div className={showcase.grid}>{list.map((c) => c.el)}</div>;

        return (
          <>
            <s-stack gap="small-200">
              <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                <Segmented
                  label="Category"
                  value={cat}
                  options={[
                    { value: "all", label: "All" },
                    ...CATS.map((c) => ({ value: c.key, label: c.title })),
                    { value: "saved", label: `Saved (${saved.length})` },
                  ]}
                  onChange={(v) => setFilter({ cat: v })}
                />
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <Segmented
                    label="Status"
                    value={status}
                    options={[
                      { value: "all", label: "Any status" },
                      { value: "live", label: "Live" },
                      { value: "setup", label: "Needs setup" },
                      { value: "off", label: "Off / soon" },
                    ]}
                    onChange={(v) => setFilter({ status: v })}
                  />
                  <input className={showcase.find} type="search" placeholder="Find…" aria-label="Find a section" value={query} onChange={(e) => setQuery(e.target.value)} />
                </s-stack>
              </s-stack>
            </s-stack>
            {cat === "saved"
              ? (() => {
                  const list = saved.map((k) => cards.find((c) => c.key === k)).filter((c): c is Entry => !!c && match(c));
                  return list.length ? grid(list) : empty("No saved items here. Click the bookmark on any card to keep it in Saved.");
                })()
              : CATS.filter((c) => cat === "all" || cat === c.key).map((c) => {
                  const list = cards.filter((x) => x.cat === c.key && match(x));
                  if (!list.length && cat === "all") return null;
                  return (
                    <s-stack key={c.key} gap="small-200">
                      <GroupTitle>{`${c.title} (${list.length})`}</GroupTitle>
                      {list.length ? grid(list) : empty("Nothing matches these filters.")}
                    </s-stack>
                  );
                })}
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
