import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  editorLinks,
  getDiscountStatus,
  getSettings,
  getSlides,
  getThemeStatus,
  hasCartTransform,
  listBundles,
  listRules,
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
  SectionCard,
} from "../components/SectionShowcase";
import showcase from "../components/SectionShowcase.module.css";
import { Card, Checklist, GroupTitle, Pill } from "../components/ui";
import { listItems, sectionLinks } from "../lib/sections.server";
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
  const lists = await Promise.allSettled(SECTION_KINDS.map((k) => listItems(admin, k)));
  const sectionCounts = Object.fromEntries(
    SECTION_KINDS.map((k, i) => {
      const items = settled(lists[i], []);
      return [k, { total: items.length, shown: items.filter((it) => itemStatus(k, it).tone === "ok").length }];
    }),
  ) as Record<SectionKind, { total: number; shown: number }>;
  return {
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

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const key = String(form.get("key")) as keyof Settings;
  if (!FEATURE_KEYS.includes(key)) return { ok: false, error: "Unknown feature." };
  try {
    await setSetting(admin, key, form.get("value") === "true");
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
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
const SECTION_CARDS: { key: SectionCardKey; title: string; description: string; list: SectionKind | null; embed: boolean; Previews: (() => JSX.Element)[] }[] = [
  { key: "reviews", title: "Customer reviews", description: "Text, photo and video reviews with WhatsApp, Instagram and TikTok badges.", list: "reviews", embed: false, Previews: [ReviewsShowcase, ReviewsChatShowcase, ReviewsPhotosShowcase] },
  { key: "faq", title: "FAQ", description: "Questions and answers with search and group buttons.", list: "faq", embed: false, Previews: [FaqShowcase, FaqCardsShowcase] },
  { key: "logos", title: "Trusted-by logos", description: "Press and partner logos in a scrolling strip or a grid.", list: "logos", embed: false, Previews: [LogosShowcase, LogosOneLineShowcase, LogosGridShowcase] },
  { key: "announcements", title: "Announcement bar", description: "Rotating messages at the top, with free-shipping progress.", list: "announcements", embed: true, Previews: [AnnouncementShowcase, AnnouncementShippingShowcase, AnnouncementStyleShowcase] },
  { key: "quick_add", title: "Quick add to cart", description: "A button on every product card; sizes open a small picker.", list: null, embed: true, Previews: [QuickAddShowcase, QuickAddToastShowcase] },
  { key: "hero", title: "Hero image", description: "A banner with separate desktop and mobile images.", list: null, embed: false, Previews: [HeroShowcase, HeroCenteredShowcase] },
  { key: "countdown", title: "Countdown timer", description: "Sale end, a timer per visitor, or a daily order cut-off.", list: null, embed: false, Previews: [CountdownShowcase, CountdownRowShowcase, CountdownDailyShowcase] },
  { key: "countdown_bar", title: "Countdown bar", description: "A slim timer bar at the top or bottom of every page.", list: null, embed: true, Previews: [CountdownBarShowcase, CountdownBarDarkShowcase] },
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

  useEffect(() => {
    if (fetcher.data?.ok) shopify.toast.show("Saved");
    if (fetcher.data?.error) shopify.toast.show(fetcher.data.error, { isError: true });
  }, [fetcher.data, shopify]);

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

      <GroupTitle>Sections</GroupTitle>
      <div className={showcase.grid}>
        {FEATURES.map((f) => {
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
          return (
            <SectionCard
              key={f.key}
              title={f.title}
              status={status}
              action={action}
              open={{ href: f.href }}
              previews={f.Previews.map((P, i) => <P key={i} />)}
              off={!on}
              toggle={{ on, onChange: (value) => fetcher.submit({ key: f.setting, value: String(value) }, { method: "post" }) }}
            />
          );
        })}
        {SECTION_CARDS.map((c) => {
          const counts = c.list ? data.sectionCounts[c.list] : null;
          const isInstalled = installed ? (installed[c.key] ?? false) : null;
          const status = sectionStatus(c.list, counts, isInstalled, c.embed);
          const themeHref = data.sectionLinks[c.key];
          const open = c.list ? { href: `/app/sections/${c.list}` } : { href: c.embed ? themeHref : data.links.editor, external: true };
          const action =
            status.next === "create" && c.list
              ? { label: SECTIONS[c.list].addLabel, href: `/app/sections/${c.list}/new` }
              : status.next === "theme"
                ? { label: c.embed ? "Turn on" : "Add to theme", href: themeHref, external: true }
                : { label: "Live", done: true, ...open };
          return <SectionCard key={c.key} title={c.title} status={status} action={action} open={open} previews={c.Previews.map((P, i) => <P key={i} />)} />;
        })}
      </div>

      {data.themeError ? <s-text color="subdued">Theme check unavailable: {data.themeError}</s-text> : null}
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
