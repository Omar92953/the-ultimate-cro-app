/**
 * Home: is the app set up and working, and what is it bringing in. Top to bottom: one banner at
 * most, the setup guide (5 steps that tick themselves, can be dismissed), the last 30 days, what
 * needs attention, what to try next, the plan, and help. Features themselves live in the hubs
 * (Offers, Storefront, Cart, Checkout). One loader; reads run at once and are remembered per shop.
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { cachedResults } from "../lib/value.server";
import { getMonthlyOrders, getPlan, getPlanState } from "../lib/billing.server";
import { getHomeState, setHomeState } from "../lib/home-state.server";
import { listReturns } from "../lib/orders-lookup.server";
import { waitingEmails } from "../lib/stock.server";
import { remember } from "../lib/short-cache.server";
import { feature, featureHref, type FeatureKey } from "../lib/catalog";
import { EXTRA_PLAN, FEATURE_PLAN, PLANS, atLeast, canUse, limitOf, limitText, ordersOver, type PlanKey } from "../lib/plans";
import { TUTORIALS, WHATS_NEW, tutorialEmbedUrl, tutorialWatchUrl, type Tutorial } from "../lib/tutorials";
import { Button } from "../components/fields";
import { Card, CardGrid, CardText, Pill } from "../components/ui";
import { UpgradeButton, planPriceText } from "../components/Upgrade";
import { PlanFeatures } from "../components/PlanCard";
import { loadHub } from "../lib/hub.server";
import styles from "../components/Home.module.css";

/** Theme embeds that count as "the app is switched on in your theme". */
const EMBED_KEYS = ["boosters", "drawer", "cart_tools", "announcements", "quick_add", "wishlist"] as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  // Everything at once. The hub data is the same the Storefront hub uses (remembered for both);
  // orders are the slowest, so Home waits at most 3 s for them and fills in on the next visit.
  const [plan, hub, extras, results] = await Promise.all([
    getPlan(admin, shop),
    remember(shop, "hub", 30000, () => loadHub(admin, session), 300000),
    remember(shop, "home", 30000, () =>
      Promise.all([
        getPlanState(admin).catch(() => ({ plan: null, paused: [], at: null })),
        getHomeState(admin).catch(() => ({ dismissed: false, planSeen: false })),
        getMonthlyOrders(admin, shop),
        listReturns(shop).catch(() => []),
        waitingEmails(shop).catch(() => []),
      ]), 300000),
    cachedResults(admin, shop),
  ]);
  const [planState, homeState, monthOrders, returns, waiting] = extras;
  const installed = hub.theme?.installed ?? null;
  const offerCount = hub.counts.upsell + hub.counts.cross_sell + hub.counts.bundles;

  // What to try next: features not set up yet, in the order they usually pay off.
  const notUsed: Record<string, boolean> = {
    bundles: !hub.counts.bundles,
    upsell: !hub.counts.upsell,
    cross_sell: !hub.counts.cross_sell,
    shipping_bar: !hub.shipBarSaved,
    reviews: !hub.sectionCounts.reviews.total,
    cart_tools: installed ? !installed.cart_tools : false,
    sticky_atc: !hub.boosters.sticky.enabled,
    announcements: !hub.sectionCounts.announcements.total,
    payment_rules: hub.checkout ? hub.checkout.payment === 0 : false,
  };
  const recommended = (Object.keys(notUsed) as FeatureKey[]).filter((k) => notUsed[k]).slice(0, 3);

  // Needs your attention: things the merchant should do now, each with its link.
  const attention: { text: string; href: string; external?: boolean; action: string }[] = [];
  if (installed && !EMBED_KEYS.some((k) => installed[k])) attention.push({ text: "The app is switched off in your theme", href: hub.sectionLinks.boosters, external: true, action: "Turn on" });
  for (const [k, title, link] of [["upsell", "Upsell offers", hub.links.upsell], ["cross_sell", "Cross-sell offers", hub.links.cross_sell], ["bundles", "Bundles", hub.links.bundles]] as const) {
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
    plan: { key: plan.plan, source: plan.source, trialEndsAt: plan.trialEndsAt },
    paused: planState.paused,
    orders: monthOrders,
    ordersOver: ordersOver(plan.plan, monthOrders),
    dismissed: homeState.dismissed,
    steps: {
      // null = couldn't be checked (theme or orders not readable).
      embed: installed ? EMBED_KEYS.some((k) => installed[k]) : null,
      offer: offerCount > 0,
      section: installed ? Object.entries(installed).some(([k, on]) => on && !(EMBED_KEYS as readonly string[]).includes(k)) : null,
      order: results ? results.bySource.length > 0 : null,
      plan: plan.plan !== "free" || homeState.planSeen,
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
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "dismiss" || intent === "restore") await setHomeState(admin, { dismissed: intent === "dismiss" });
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
  const fetcher = useFetcher();
  const current = PLANS[data.plan.key];
  const [playing, setPlaying] = useState<Tutorial | null>(null);
  const dismissed = fetcher.formData ? fetcher.formData.get("intent") === "dismiss" : data.dismissed;

  const steps: { done: boolean | null; title: string; text: string; action: JSX.Element }[] = [
    {
      done: data.steps.embed,
      title: "Turn on the app in your theme",
      text: `Switch on “Conversion boosters” in App embeds${data.themeName ? ` of “${data.themeName}”` : ""}. Bars, pop-ups and the cart drawer need it.`,
      action: <Button href={data.embedLink} target="_top" variant="tertiary">Open App embeds</Button>,
    },
    {
      done: data.steps.offer,
      title: "Create your first offer",
      text: "An upsell (“Buy 2, save 10%”), a cross-sell or a bundle.",
      action: <Button href="/app/offers/new" variant="tertiary">Create offer</Button>,
    },
    {
      done: data.steps.section,
      title: "Add a section to your store",
      text: "Place a block (offers, reviews, FAQ, banners…) on a page in the theme editor.",
      action: <Button href={data.editorLink} target="_top" variant="tertiary">Open theme editor</Button>,
    },
    {
      done: data.steps.order,
      title: "Check a test order",
      text: "Place a test order with an item added by the app; it then shows in Analytics.",
      action: <Button href={`https://${data.shop}`} target="_blank" variant="tertiary">View store</Button>,
    },
    {
      done: data.steps.plan,
      title: "Pick your plan",
      text: "See what each plan adds. Free stays free; paid plans have a free trial and can be cancelled anytime.",
      action: <Button href="/app/plans" variant="tertiary">Compare plans</Button>,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  // One banner at most: the most urgent one.
  const banner = data.plan.source === "error"
    ? { tone: "warning" as const, heading: "Your plan couldn't be checked", text: "Everything stays open until it can be checked again. Refresh in a minute.", upgrade: false }
    : data.paused.length
      ? { tone: "warning" as const, heading: `${data.paused.length} offer${data.paused.length === 1 ? " was" : "s were"} switched off to fit your plan`, text: `Nothing was deleted: ${data.paused.map((p) => p.name).join(", ")}. They switch back on when you upgrade.`, upgrade: true }
      : data.ordersOver
        ? { tone: "warning" as const, heading: "You're past your plan's monthly orders", text: `${data.orders?.toLocaleString()} orders this month; ${current.name} includes ${limitText("monthlyOrders", limitOf(data.plan.key, "monthlyOrders") ?? 0)}. Everything keeps working.`, upgrade: true }
        : null;

  const m = data.metrics;
  const sales = m ? change(m.current.appRevenue, m.previous.appRevenue) : null;
  const ordersChange = m ? change(m.current.appOrders, m.previous.appOrders) : null;

  return (
    <s-page heading="CRO Toolbox" inlineSize="base">
      <Button slot="secondary-actions" href={`https://${data.shop}`} target="_blank" icon="view">
        View store
      </Button>
      <s-stack gap="base">
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

        {/* Setup guide */}
        {!dismissed ? (
          <s-section heading="Setup guide">
            <s-stack gap="small-300">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <Pill tone={doneCount === steps.length ? "ok" : "warn"}>{`${doneCount} of ${steps.length} done`}</Pill>
                <Button variant="tertiary" onClick={() => fetcher.submit({ intent: "dismiss" }, { method: "post" })}>
                  {doneCount === steps.length ? "Hide the setup guide" : "Hide for now"}
                </Button>
              </s-stack>
              <ol className={styles.steps}>
                {steps.map((s, i) => (
                  <li key={s.title} className={`${styles.step} ${s.done ? styles.stepDone : ""}`}>
                    <span className={styles.stepNum} aria-hidden="true">{s.done ? "✓" : i + 1}</span>
                    <span className={styles.stepBody}>
                      <span className={styles.stepTitle}>
                        {s.title}
                        <span className={styles.srOnly}>{s.done ? " (done)" : " (not done)"}</span>
                      </span>
                      <span className={styles.stepText}>{s.text}</span>
                    </span>
                    {s.done ? <Pill tone="ok">Done</Pill> : s.action}
                  </li>
                ))}
              </ol>
            </s-stack>
          </s-section>
        ) : null}

        {/* Last 30 days */}
        <s-section heading="Last 30 days">
          <s-stack gap="small-300">
            {m ? (
              <div className={styles.metrics}>
                <Metric label="Sales from the app" value={money(m.current.appRevenue, m.currency)} change={sales} />
                <Metric label="Orders with app items" value={String(m.current.appOrders)} change={ordersChange} />
                <Metric
                  label="Average order with app items"
                  value={m.aovWith !== null ? money(m.aovWith, m.currency) : "—"}
                  note={m.aovWithout !== null ? `${money(m.aovWithout, m.currency)} without` : undefined}
                />
                <Metric
                  label="Your plan"
                  value={current.monthly ? `${current.name} · $${current.monthly}` : "Free"}
                  note={current.monthly && m.current.appRevenue > 0 ? `The app brought in ${Math.max(1, Math.round(m.current.appRevenue / current.monthly))}× its price` : undefined}
                />
              </div>
            ) : (
              <s-paragraph>Sales from the app show here once Shopify approves the app&apos;s access to orders. Your offers and widgets work in the meantime.</s-paragraph>
            )}
            <s-stack direction="inline" justifyContent="end">
              <Button href="/app/analytics" variant="tertiary">Open Analytics</Button>
            </s-stack>
          </s-stack>
        </s-section>

        {/* Needs your attention */}
        {data.attention.length ? (
          <s-section heading="Needs your attention">
            <ul className={styles.rows}>
              {data.attention.map((a) => (
                <li key={a.text} className={styles.row}>
                  <span>{a.text}</span>
                  <Button href={a.href} target={a.external ? "_top" : undefined} variant="tertiary">
                    {a.action}
                  </Button>
                </li>
              ))}
            </ul>
          </s-section>
        ) : null}

        {/* Try next */}
        {data.recommended.length ? (
          <s-section heading="Try next">
            <ul className={styles.rows}>
              {data.recommended.map((k) => (
                <li key={k} className={styles.row}>
                  <span className={styles.rowText}>
                    <Link to={featureHref(k)}>{feature(k).title}</Link>
                    <span className={styles.stepText}>{feature(k).about}</span>
                  </span>
                  {canUse(data.plan.key, k) ? (
                    <Button href={featureHref(k)} variant="tertiary">Set up</Button>
                  ) : (
                    <Pill>{`${PLANS[FEATURE_PLAN[k]].name} plan`}</Pill>
                  )}
                </li>
              ))}
            </ul>
          </s-section>
        ) : null}

        <CardGrid cols={3}>
          {/* Plan */}
          <Card title="Your plan" badge={<Pill tone="ok">{current.name}</Pill>} actions={<><Button href="/app/plans" variant={data.plan.key === "pro" ? "tertiary" : "primary"}>Compare plans</Button><UpgradeButton variant="tertiary">Change plan</UpgradeButton></>}>
            <CardText>
              {planPriceText(data.plan.key)}
              {data.plan.trialEndsAt ? ` · free trial until ${new Date(data.plan.trialEndsAt).toLocaleDateString()}` : ""}
            </CardText>
            <PlanFeatures plan={data.plan.key} limit={3} />
          </Card>

          {/* Request a feature (Growth and up) */}
          <FeatureRequestCard plan={data.plan.key} shop={data.shop} supportEmail={data.supportEmail} />

          {/* Help */}
          <Card title="Help">
            <ul className={styles.links}>
              {data.supportEmail ? (
                <li>
                  <a href={`mailto:${data.supportEmail}`} target="_blank" rel="noreferrer">Email support</a>
                  {atLeast(data.plan.key, EXTRA_PLAN.prioritySupport) ? " (priority)" : ""}
                </li>
              ) : null}
              <li><Link to="/app/settings">Settings and app embeds</Link></li>
              <li><a href="/privacy" target="_blank" rel="noreferrer">Privacy policy</a></li>
            </ul>
            {data.dismissed ? (
              <Button variant="tertiary" onClick={() => fetcher.submit({ intent: "restore" }, { method: "post" })}>
                Show the setup guide
              </Button>
            ) : null}
          </Card>
        </CardGrid>

        {/* Tutorials: only once there are videos to play */}
        {TUTORIALS.some((t) => t.youtubeId) ? (
          <s-section heading="Tutorials">
            <div className={styles.videos}>
              {TUTORIALS.filter((t) => t.youtubeId).map((t) => (
                <button key={t.title} type="button" className={styles.video} onClick={() => setPlaying(t)}>
                  <span className={styles.thumb}>
                    <span className={styles.play} aria-hidden="true">▶</span>
                    <span className={styles.length}>{t.length}</span>
                  </span>
                  <span className={styles.videoTitle}>{t.title}</span>
                  <span className={styles.videoMeta}>{t.feature ? feature(t.feature).title : "Getting started"}</span>
                </button>
              ))}
            </div>
          </s-section>
        ) : null}

        <s-section heading="What's new">
          <ul className={styles.news}>
            {WHATS_NEW.map((n) => (
              <li key={n.text}>
                <span className={styles.newsDate}>{n.date}</span>
                {n.href ? <Link to={n.href}>{n.text}</Link> : n.text}
              </li>
            ))}
          </ul>
        </s-section>
      </s-stack>

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

function FeatureRequestCard({ plan, shop, supportEmail }: { plan: PlanKey; shop: string; supportEmail: string }) {
  const needs = EXTRA_PLAN.featureRequests;
  if (!atLeast(plan, needs)) {
    return (
      <Card title="Request a feature" badge={<Pill>{`${PLANS[needs].name} plan`}</Pill>} actions={<UpgradeButton to={needs} />}>
        <CardText>{`Need something the app doesn't do yet? On ${PLANS[needs].name} and up, ask for any feature and we build it for you.`}</CardText>
      </Card>
    );
  }
  const first = atLeast(plan, EXTRA_PLAN.requestsFirst);
  const mail = `mailto:${supportEmail}?subject=${encodeURIComponent(`Feature request — ${shop}`)}&body=${encodeURIComponent("What would you like your store to do?\n\nWhere should it show (page, cart, checkout…)?\n\nAn example or a link to a store that does it (optional):\n")}`;
  return (
    <Card title="Request a feature" badge={<Pill tone="ok">{first ? "Built first" : "Included"}</Pill>} actions={supportEmail ? <Button href={mail} target="_blank">Request a feature</Button> : null}>
      <CardText>{first ? "Tell us what you'd like your store to do. We build it for you, and Pro requests come first." : "Tell us what you'd like your store to do. We build it for you; it's included in your plan."}</CardText>
      {supportEmail ? null : <CardText>Requests open as soon as our support email is set up.</CardText>}
    </Card>
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
