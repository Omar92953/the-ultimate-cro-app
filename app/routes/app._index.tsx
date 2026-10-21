/**
 * Home: is the app set up and working, and what is it bringing in. Top to bottom: one banner at
 * most, the setup guide (4 steps that tick themselves, "Mark as done" as a fallback), the plan bar,
 * the last 30 days, what needs attention, what to try next, tutorials, then help and what's new. Features live in the hubs. One loader; reads run at once, remembered per shop.
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useFetcher, useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { timedLoader, timed } from "../lib/timing.server";
import { EMBED_KEYS, themeSteps } from "../lib/setup-steps";
import { cachedResults } from "../lib/value.server";
import { getMonthlyOrders, getPlan, getPlanState } from "../lib/billing.server";
import { listOffers } from "../lib/offers.server";
import { getHomeState, setHomeState } from "../lib/home-state.server";
import { listReturns } from "../lib/orders-lookup.server";
import { waitingEmails } from "../lib/stock.server";
import { remember } from "../lib/short-cache.server";
import { feature, featureHref, type FeatureKey } from "../lib/catalog";
import { EXTRA_PLAN, FEATURE_PLAN, PLANS, atLeast, limitOf, limitText, ordersOver } from "../lib/plans";
import { FEATURE_IDEAS_EMAIL, TUTORIALS_URL, helpUrl } from "../lib/site";
import { TUTORIALS, WHATS_NEW, tutorialEmbedUrl, tutorialWatchUrl, type Tutorial } from "../lib/tutorials";
import { Button } from "../components/fields";
import { HomeRow, HomeRows, LinkTiles, PageIntro, Pill } from "../components/ui";
import ui from "../components/ui.module.css";
import { usePlan } from "../components/Upgrade";
import { isLocked } from "../lib/plan-gate";
import { PlanBar } from "../components/PlanCard";
import { SetupGuide, type GuideStep } from "../components/SetupGuide";
import { loadHub } from "../lib/hub.server";
import { FeatureHub } from "./app.library";
import styles from "../components/Home.module.css";

/** Theme embeds that count as "the app is switched on in your theme". */

export const loader = timedLoader("app._index", async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  // Everything at once. The hub data is the same the Storefront hub uses (remembered for both);
  // orders are the slowest, so Home waits at most 3 s for them and fills in on the next visit.
  const [plan, hub, extras, results] = await Promise.all([
    getPlan(admin, shop),
    timed("hub", () => remember(shop, "hub", 30000, () => loadHub(admin, session), 300000)),
    remember(shop, "home", 30000, () =>
      Promise.all([
        getPlanState(admin).catch(() => ({ plan: null, paused: [], at: null })),
        getHomeState(admin).catch(() => ({ dismissed: false, manual: [] as string[] })),
        listOffers(admin).catch(() => []),
        getMonthlyOrders(admin, shop),
        listReturns(shop).catch(() => []),
        waitingEmails(shop).catch(() => []),
      ]), 300000),
    cachedResults(admin, shop),
  ]);
  const [planState, homeState, offers, monthOrders, returns, waiting] = extras;
  const installed = hub.theme?.installed ?? null;
  // Any offer of any type that's switched on (upsells, cross sells, bundles, deals…).
  const offerCount = offers.filter((o) => o.active).length || hub.counts.upsell + hub.counts.cross_sell + hub.counts.bundles;

  // What to try next: features not set up yet, in the order they usually pay off.
  const notUsed: Record<string, boolean> = {
    bundles: !hub.counts.bundles,
    upsell: !hub.counts.upsell,
    cross_sell: !hub.counts.cross_sell,
    shipping_bar: !hub.shipBarSaved,
    reviews: !hub.sectionCounts.reviews.total,
    sticky_atc: !hub.boosters.sticky.enabled,
    announcements: !hub.sectionCounts.announcements.total,
    payment_rules: hub.checkout ? hub.checkout.payment === 0 : false,
  };
  const recommended = (Object.keys(notUsed) as FeatureKey[]).filter((k) => notUsed[k]).slice(0, 3);

  // Needs your attention: things the merchant should do now, each with its link.
  const attention: { text: string; href: string; external?: boolean; action: string }[] = [];
  if (installed && !EMBED_KEYS.some((k) => installed[k])) attention.push({ text: "The app is switched off in your theme", href: hub.sectionLinks.boosters, external: true, action: "Turn on" });
  for (const [k, title, link] of [["upsell", "Upsell offers", hub.links.upsell], ["cross_sell", "Cross sell offers", hub.links.cross_sell], ["bundles", "Bundles", hub.links.bundles]] as const) {
    if (installed && hub.counts[k] > 0 && !installed[k]) attention.push({ text: `${title} are ready but not on your store`, href: link, external: true, action: "Add to theme" });
  }
  const discountActive = hub.discount.engine === "native" ? hub.discount.nativeCount > 0 : hub.discount.status === "ACTIVE";
  if (hub.counts.upsell + hub.counts.cross_sell > 0 && !discountActive) attention.push({ text: "Offer discounts aren't active at checkout yet", href: "/app/offers", action: "Open offers" });
  if (hub.pendingReviews) attention.push({ text: `${hub.pendingReviews} review${hub.pendingReviews === 1 ? "" : "s"} waiting for your approval`, href: "/app/sections/reviews", action: "Review" });
  const newReturns = returns.filter((r) => r.status === "pending").length;
  if (newReturns) attention.push({ text: `${newReturns} new return request${newReturns === 1 ? "" : "s"}`, href: "/app/returns", action: "Open" });
  if (waiting.length) attention.push({ text: `${waiting.length} shopper${waiting.length === 1 ? " is" : "s are"} waiting for a product to be back in stock`, href: "/app/stock", action: "Open" });

  const cur = results?.periods.current ?? null;
  return {
    shop,
    hub,
    plan: { key: plan.plan, source: plan.source, trialEndsAt: plan.trialEndsAt },
    paused: planState.paused,
    // All of the store's orders this month (the plans' soft limit).
    orders: monthOrders,
    ordersOver: ordersOver(plan.plan, monthOrders),
    dismissed: homeState.dismissed,
    manual: homeState.manual,
    steps: {
      ...themeSteps(installed),
      offer: offerCount > 0,
      works: results ? results.bySource.length > 0 : false,
    },
    themeName: hub.theme?.themeName ?? null,
    embedLink: hub.sectionLinks.boosters,
    editorLink: hub.links.editor,
    metrics: results && cur
      ? {
          currency: results.currency,
          current: cur,
          previous: results.periods.previous,
          // Average order value of orders with the app's items vs orders without them.
          aovWith: cur.appOrders ? cur.appOrdersTotal / cur.appOrders : null,
          aovWithout: cur.orders - cur.appOrders ? (cur.revenue - cur.appOrdersTotal) / (cur.orders - cur.appOrders) : null,
        }
      : null,
    attention,
    recommended,
    supportEmail: process.env.SUPPORT_EMAIL || "",
  };
});

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "dismiss" || intent === "restore") await setHomeState(admin, { dismissed: intent === "dismiss" });
  if (intent === "manual") {
    const step = String(form.get("step") ?? "");
    const { manual } = await getHomeState(admin);
    if (step && !manual.includes(step)) await setHomeState(admin, { manual: [...manual, step] });
  }
  return { ok: true };
};

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${Math.round(n)} ${currency}`;
  }
};
/** "+12%" against the previous 30 days; null when there's nothing to compare. */
const change = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

export default function Home() {
  const data = useLoaderData<typeof loader>();
  const { trial } = usePlan();
  const fetcher = useFetcher();
  const current = PLANS[data.plan.key];
  const [playing, setPlaying] = useState<Tutorial | null>(null);
  const pending = fetcher.formData?.get("intent");
  // The setup guide ticks itself: the theme is re-read (fresh, not from the cache) when the tab comes back, and every
  // 5 seconds for 2 minutes after "Turn on" is clicked; the rest of the page is reloaded too (useRevalidator).
  const check = useFetcher<{ embed: boolean; place: boolean }>();
  const revalidator = useRevalidator();
  const [watchUntil, setWatchUntil] = useState(0);
  const fresh = check.data;
  const stepDone = { embed: data.steps.embed || !!fresh?.embed, place: data.steps.place || !!fresh?.place };
  const dismissed = pending === "dismiss" ? true : pending === "restore" ? false : data.dismissed;
  // Ticked by hand ("Mark as done"), including the one being saved right now.
  const manual = new Set([...data.manual, ...(pending === "manual" ? [String(fetcher.formData?.get("step"))] : [])]);

  const steps: GuideStep[] = [
    {
      key: "embed",
      title: "Turn on the app embed",
      text: `In your theme's App embeds${data.themeName ? ` (“${data.themeName}”)` : ""}, switch on “Conversion boosters” and save. Bars, pop-ups and discounts run from it.`,
      done: stepDone.embed || manual.has("embed"),
      // Opens in a new tab, so this page stays open and notices when the embed is on.
      action: <Button href={data.embedLink} target="_blank" variant="primary" onClick={() => setWatchUntil(Date.now() + 120000)}>Turn on</Button>,
    },
    {
      key: "offer",
      title: "Create your first offer",
      text: "An upsell (“Buy 2, save 10%”), a cross sell, a bundle or a discount. Pick a group and fill in the offer.",
      done: data.steps.offer || manual.has("offer"),
      action: <Button href="/app/offers" variant="primary">Create offer</Button>,
    },
    {
      key: "place",
      title: "Place it on your store",
      text: "Open the theme editor and add the offer's block to your product page (or the cart). Each offer page has an “Add to theme” button that opens the right spot.",
      done: stepDone.place || manual.has("place"),
      action: <Button href={data.editorLink} target="_top" variant="primary">Open theme editor</Button>,
    },
    {
      key: "works",
      title: "Check that it works",
      text: "Open your store, add the offer to the cart and place a test order. The sale then shows in Analytics.",
      done: data.steps.works || manual.has("works"),
      action: <Button href={`https://${data.shop}`} target="_blank" variant="primary">View store</Button>,
    },
  ];

  const guideOpen = !dismissed && steps.some((st) => !st.done);
  const themePending = !stepDone.embed && !manual.has("embed") ? true : !stepDone.place && !manual.has("place");
  useEffect(() => {
    if (!guideOpen) return;
    const run = () => {
      if (document.visibilityState !== "visible") return;
      if (themePending && check.state === "idle") check.load("/app/setup-check");
      if (revalidator.state === "idle") revalidator.revalidate();
    };
    const onShow = () => run();
    window.addEventListener("focus", onShow);
    document.addEventListener("visibilitychange", onShow);
    // After "Turn on": every 5 seconds for 2 minutes.
    const timer = watchUntil > Date.now() ? setInterval(() => (Date.now() > watchUntil ? clearInterval(timer) : run()), 5000) : undefined;
    return () => {
      window.removeEventListener("focus", onShow);
      document.removeEventListener("visibilitychange", onShow);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetcher and revalidator objects change on every state; their state is read when it runs
  }, [guideOpen, themePending, watchUntil]);

  // One banner at most: the most urgent one.
  const banner = data.plan.source === "error"
    ? { tone: "warning" as const, heading: "Your plan couldn't be checked", text: "Everything stays open until it can be checked again. Refresh in a minute.", upgrade: false }
    : data.paused.length
      ? { tone: "warning" as const, heading: `${data.paused.length} offer${data.paused.length === 1 ? " was" : "s were"} switched off to fit your plan`, text: `Nothing was deleted: ${data.paused.map((p) => p.name).join(", ")}. They switch back on when you upgrade.`, upgrade: true }
      : data.ordersOver && data.orders !== null
        ? { tone: "warning" as const, heading: "You're past your plan's monthly orders", text: `${data.orders.toLocaleString("en-US")} orders this month; ${current.name} includes ${limitText("monthlyOrders", limitOf(data.plan.key, "monthlyOrders") ?? 0)}. Everything keeps working.`, upgrade: true }
        : null;

  const m = data.metrics;
  const sales = m ? change(m.current.appRevenue, m.previous.appRevenue) : null;
  const ordersChange = m ? change(m.current.appOrders, m.previous.appOrders) : null;

  return (
    <s-page heading="CRO Toolbox" inlineSize="base">
      <Button slot="secondary-actions" href={`https://${data.shop}`} target="_blank" icon="view">
        View store
      </Button>
      <HomeRows>
        <PageIntro text="Increase average order value (AOV) and customer lifetime value (LTV): offers and bundles make each order bigger, and a Track page that sells and returns that keep the sale bring shoppers back." />
        {banner ? (
          <s-banner tone={banner.tone} heading={banner.heading}>
            <s-stack gap="small-200">
              <s-text>{banner.text}</s-text>
              {banner.upgrade ? (
                <s-stack direction="inline" gap="small-200">
                  <Button href="/app/plans" variant="secondary">See plans</Button>
                </s-stack>
              ) : null}
            </s-stack>
          </s-banner>
        ) : null}

        {!dismissed ? (
          <SetupGuide
            steps={steps}
            onManual={(step) => fetcher.submit({ intent: "manual", step }, { method: "post" })}
            onHide={() => fetcher.submit({ intent: "dismiss" }, { method: "post" })}
          />
        ) : null}

        <HomeRow title="Your plan">
          <PlanBar
            plan={data.plan.key}
            orders={data.orders}
            trialEndsAt={data.plan.trialEndsAt}
            action={<Button href="/app/plans" variant={data.plan.key === "free" ? "primary" : "secondary"}>{data.plan.key === "pro" ? "Your plan" : "See plans"}</Button>}
          />
        </HomeRow>

        <HomeRow title="Last 30 days" action={<Button href="/app/analytics" variant="tertiary">Open Analytics</Button>}>
            {m ? (
              <div className={styles.metrics}>
                <Metric label="Sales from the app" value={money(m.current.appRevenue, m.currency)} change={sales} />
                <Metric label="Orders with app items" value={String(m.current.appOrders)} change={ordersChange} />
                <Metric
                  label="Average order with app items"
                  value={m.aovWith !== null ? money(m.aovWith, m.currency) : "No data yet"}
                  note={m.aovWithout !== null ? `${money(m.aovWithout, m.currency)} without` : undefined}
                />
                <Metric
                  label="Share of your sales"
                  value={m.current.revenue > 0 ? `${Math.round((m.current.appRevenue / m.current.revenue) * 100)}%` : "No data yet"}
                  note="Sales from the app out of all your sales"
                />
              </div>
            ) : (
              <s-paragraph>Sales from the app show here once Shopify approves the app&apos;s access to orders. Your offers and widgets work in the meantime.</s-paragraph>
            )}
        </HomeRow>

        <HomeRow
          title="Active sections"
          subtitle="Live on your store now."
          bare
          footer={<Button href="/app/library?cat=store" variant="secondary">Show all sections</Button>}
        >
          <FeatureHub area="library" hub={data.hub} active={4} />
        </HomeRow>

        {data.attention.length ? (
          <HomeRow title="Needs your attention">
            <LinkTiles items={data.attention.map((a) => ({ key: a.text, title: a.text, href: a.href, external: a.external, end: a.action }))} />
          </HomeRow>
        ) : null}

        {data.recommended.length ? (
          <HomeRow title="Try next">
            <LinkTiles
              items={data.recommended.map((k) => ({
                key: k,
                title: feature(k).title,
                sub: feature(k).about,
                href: featureHref(k),
                locked: isLocked(data.plan.key, k, trial),
                end: isLocked(data.plan.key, k, trial) ? <Pill>{`${PLANS[FEATURE_PLAN[k]].name} plan`}</Pill> : null,
              }))}
            />
          </HomeRow>
        ) : null}

        {/* Tutorials: every one in lib/tutorials.ts; a card without a video yet says "Coming soon" */}
        <HomeRow title="Tutorials" subtitle="Short videos for every part of the app." bare>
            <div className={styles.videos}>
              {TUTORIALS.map((t) => (
                <button key={t.title} type="button" className={styles.video} disabled={!t.youtubeId} onClick={() => t.youtubeId && setPlaying(t)}>
                  <span className={styles.thumb}>
                    {t.youtubeId ? (
                      <>
                        <span className={styles.play} aria-hidden="true">▶</span>
                        <span className={styles.length}>{t.length}</span>
                      </>
                    ) : (
                      <span className={styles.soon}>Coming soon</span>
                    )}
                  </span>
                  <span className={styles.videoTitle}>{t.title}</span>
                  <span className={styles.videoMeta}>{t.feature ? feature(t.feature).title : "Getting started"}</span>
                </button>
              ))}
            </div>
        </HomeRow>

        <div className={ui.rowPair}>
          <HomeRow title="Help">
            <ul className={styles.links}>
              <li><a href={helpUrl()} target="_blank" rel="noreferrer">Help center</a></li>
              <li><a href={TUTORIALS_URL} target="_blank" rel="noreferrer">Tutorials</a></li>
              {data.supportEmail ? (
                <li>
                  <a href={`mailto:${data.supportEmail}`} target="_blank" rel="noreferrer">Email support</a>
                  {atLeast(data.plan.key, EXTRA_PLAN.prioritySupport) ? " (priority)" : ""}
                </li>
              ) : null}
              <li><a href={`mailto:${FEATURE_IDEAS_EMAIL}?subject=Feature%20idea`} target="_blank" rel="noreferrer">Suggest a feature</a></li>
              <li><Link to="/app/settings" prefetch="intent">Settings and app embeds</Link></li>
              <li><a href="/privacy" target="_blank" rel="noreferrer">Privacy policy</a></li>
            </ul>
            {dismissed ? (
              <Button variant="tertiary" onClick={() => fetcher.submit({ intent: "restore" }, { method: "post" })}>
                Show the setup guide
              </Button>
            ) : null}
          </HomeRow>

          <HomeRow title="What's new">
            <ul className={styles.news}>
              {WHATS_NEW.slice(0, 4).map((n) => (
                <li key={n.text}>
                  <span className={styles.newsDate}>{n.date}</span>
                  {n.href ? <Link to={n.href} prefetch="intent">{n.text}</Link> : n.text}
                </li>
              ))}
            </ul>
          </HomeRow>
        </div>
      </HomeRows>

      {playing ? <VideoModal tutorial={playing} onClose={() => setPlaying(null)} /> : null}
    </s-page>
  );
}

function Metric({ label, value, change, note }: { label: string; value: string; change?: number | null; note?: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
      {change !== undefined && change !== null ? (
        <span className={change >= 0 ? styles.up : styles.down}>{`${change >= 0 ? "↑" : "↓"} ${Math.abs(change)}% vs the 30 days before`}</span>
      ) : null}
      {note ? <span className={styles.metricNote}>{note}</span> : null}
    </div>
  );
}

function VideoModal({ tutorial, onClose }: { tutorial: Tutorial; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const src = tutorialEmbedUrl(tutorial);
  const watch = tutorialWatchUrl(tutorial);
  return (
    // A click on the dark backdrop (not the box) closes it; Escape too.
    <div className={styles.modalBack} role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={tutorial.title}>
        <div className={styles.modalHead}>
          <span className={styles.planName}>{tutorial.title}</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {src ? <iframe className={styles.player} src={src} title={tutorial.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : null}
        {watch ? (
          <a href={watch} target="_blank" rel="noreferrer" className={styles.watch}>
            Watch on YouTube
          </a>
        ) : null}
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
