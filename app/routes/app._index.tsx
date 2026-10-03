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
import { Button, Switch } from "../components/fields";
import {
  AnnouncementPreview,
  BundlePreview,
  CountdownBarPreview,
  CountdownPreview,
  CrossSellPreview,
  FaqPreview,
  HeroPreview,
  LogosPreview,
  QuickAddPreview,
  ReviewsPreview,
  UpsellPreview,
  VideoPreview,
} from "../components/FeaturePreview";
import styles from "../components/Home.module.css";
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
  },
];

type SectionCardKey = SectionKind | "quick_add" | "hero" | "countdown" | "countdown_bar";

/** Store sections, shown in the same card format as the features above. */
const SECTION_CARDS: { key: SectionCardKey; title: string; description: string; list: SectionKind | null; embed: boolean; Preview: () => JSX.Element }[] = [
  { key: "reviews", title: "Customer reviews", description: "Text, photo and video reviews with WhatsApp, Instagram and TikTok badges.", list: "reviews", embed: false, Preview: ReviewsPreview },
  { key: "faq", title: "FAQ", description: "Questions and answers with search and group buttons.", list: "faq", embed: false, Preview: FaqPreview },
  { key: "logos", title: "Trusted-by logos", description: "Press and partner logos in a scrolling strip or a grid.", list: "logos", embed: false, Preview: LogosPreview },
  { key: "announcements", title: "Announcement bar", description: "Rotating messages at the top, with free-shipping progress.", list: "announcements", embed: true, Preview: AnnouncementPreview },
  { key: "quick_add", title: "Quick add to cart", description: "A button on every product card; sizes open a small picker.", list: null, embed: true, Preview: QuickAddPreview },
  { key: "hero", title: "Hero image", description: "A banner with separate desktop and mobile images.", list: null, embed: false, Preview: HeroPreview },
  { key: "countdown", title: "Countdown timer", description: "Sale end, a timer per visitor, or a daily order cut-off.", list: null, embed: false, Preview: CountdownPreview },
  { key: "countdown_bar", title: "Countdown bar", description: "A slim timer bar at the top or bottom of every page.", list: null, embed: true, Preview: CountdownBarPreview },
];

function sectionStatus(list: SectionKind | null, counts: { total: number; shown: number } | null, installed: boolean | null, embed: boolean): Status {
  if (list && counts && !counts.total) return { tone: "warning", text: `Next: add your first ${SECTIONS[list].singular}`, next: "create" };
  if (installed === false) return { tone: "warning", text: embed ? "Next: turn it on in your theme" : "Next: add it to your theme", next: "theme" };
  if (installed === null && !list) return { tone: "neutral", text: "Set it up in the theme editor", next: "theme" };
  if (list && counts) return { tone: "success", text: `Live · ${counts.shown} of ${plural(counts.total, SECTIONS[list].singular)} shown`, next: null };
  return { tone: "success", text: embed ? "Live · turned on in your theme" : "Live · in your theme", next: null };
}

type Status = { tone: "success" | "warning" | "neutral"; text: string; next: "create" | "theme" | null };

function featureStatus(on: boolean, count: number, noun: string, installed: boolean | null): Status {
  if (!on) return { tone: "neutral", text: "Turned off — hidden on your store", next: null };
  if (!count) return { tone: "warning", text: `Next: set up your first ${noun}`, next: "create" };
  if (installed === false) return { tone: "warning", text: "Next: add it to your theme", next: "theme" };
  return { tone: "success", text: `Live · ${plural(count, `active ${noun}`)}`, next: null };
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

      <GroupTitle>Features</GroupTitle>
      <div className={styles.cards}>
        {FEATURES.map((f) => {
          const on = settings[f.setting];
          const count = f.count(data.counts);
          const isInstalled = installed ? (installed[f.key] ?? false) : null;
          const status = featureStatus(on, count, f.noun, isInstalled);
          return (
            <div key={f.key} className={`${styles.card} ${on ? "" : styles.off}`}>
              <div className={styles.preview}>
                {f.key === "upsell" ? <UpsellPreview /> : null}
                {f.key === "cross_sell" ? <CrossSellPreview /> : null}
                {f.key === "videos" ? <VideoPreview /> : null}
                {f.key === "bundles" ? <BundlePreview /> : null}
              </div>
              <div className={styles.body}>
                <div className={styles.titleRow}>
                  <s-heading>{f.title}</s-heading>
                  <Switch
                    label={on ? "On" : "Off"}
                    checked={on}
                    onValue={(value) => fetcher.submit({ key: f.setting, value: String(value) }, { method: "post" })}
                  />
                </div>
                <p className={styles.desc}>{f.description}</p>
                <span className={`${styles.status} ${styles[status.tone]}`}>{status.text}</span>
                <div className={styles.actions}>
                  {status.next === "create" ? (
                    <Button href={f.createHref} variant="primary">
                      {f.createLabel}
                    </Button>
                  ) : status.next === "theme" ? (
                    <Button href={data.links[f.key]} target="_top" variant="primary" icon="theme-edit">
                      Add to theme
                    </Button>
                  ) : (
                    <Button href={f.href} variant="primary">
                      Manage
                    </Button>
                  )}
                  {status.next === null ? (
                    <Button href={data.links[f.key]} target="_top" icon="theme-edit" variant="tertiary">
                      Theme editor
                    </Button>
                  ) : (
                    <Button href={f.href} variant="tertiary">
                      Open
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <GroupTitle>Store sections</GroupTitle>
      <div className={styles.cards}>
        {SECTION_CARDS.map((c) => {
          const counts = c.list ? data.sectionCounts[c.list] : null;
          const isInstalled = installed ? (installed[c.key] ?? false) : null;
          const status = sectionStatus(c.list, counts, isInstalled, c.embed);
          const listHref = c.list ? `/app/sections/${c.list}` : null;
          const themeHref = data.sectionLinks[c.key];
          return (
            <div key={c.key} className={styles.card}>
              <div className={styles.preview}>
                <c.Preview />
              </div>
              <div className={styles.body}>
                <div className={styles.titleRow}>
                  <s-heading>{c.title}</s-heading>
                </div>
                <p className={styles.desc}>{c.description}</p>
                <span className={`${styles.status} ${styles[status.tone]}`}>{status.text}</span>
                <div className={styles.actions}>
                  {status.next === "create" && c.list ? (
                    <Button href={`/app/sections/${c.list}/new`} variant="primary">
                      {SECTIONS[c.list].addLabel}
                    </Button>
                  ) : status.next === "theme" ? (
                    <Button href={themeHref} target="_top" variant="primary" icon="theme-edit">
                      {c.embed ? "Turn on" : "Add to theme"}
                    </Button>
                  ) : listHref ? (
                    <Button href={listHref} variant="primary">
                      Manage
                    </Button>
                  ) : (
                    <Button href={c.embed ? themeHref : data.links.editor} target="_top" variant="primary" icon="theme-edit">
                      Customize
                    </Button>
                  )}
                  {listHref && status.next !== null ? (
                    <Button href={listHref} variant="tertiary">
                      Open
                    </Button>
                  ) : listHref ? (
                    <Button href={c.embed ? themeHref : data.links.editor} target="_top" icon="theme-edit" variant="tertiary">
                      Theme editor
                    </Button>
                  ) : (
                    <Button href={`https://${data.shop}`} target="_blank" icon="view" variant="tertiary">
                      View store
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
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
