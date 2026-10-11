/**
 * Home: the plan, the first steps, tutorials, plans, referral and shortcuts. Every feature as a card
 * is on All features (app.features.tsx). One loader; every read runs at once and is remembered
 * per shop (short-cache.server.ts), so coming back to Home is instant.
 */
import { useEffect, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useLocation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getThemeStatus, listBundles, listDeals, listRules, editorLinks } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { getExperiment, getResults } from "../lib/results.server";
import { getMonthlyOrders, getPlan, getPlanState } from "../lib/billing.server";
import { getReferral } from "../lib/referral.server";
import { remember } from "../lib/short-cache.server";
import { feature, type FeatureKey } from "../lib/catalog";
import { EXTRA_PLAN, FEATURE_PLAN, PLANS, PLAN_KEYS, atLeast, canUse, limitOf, limitText, ordersOver, planRank, price, type PlanKey } from "../lib/plans";
import { TUTORIALS, WHATS_NEW, tutorialEmbedUrl, tutorialWatchUrl, type Tutorial } from "../lib/tutorials";
import { Button } from "../components/fields";
import { Card, CardGrid, CardText, GroupTitle, Pill } from "../components/ui";
import { UpgradeButton } from "../components/Upgrade";
import styles from "../components/Home.module.css";

function settled<T>(r: PromiseSettledResult<T>, fallback: T): T {
  return r.status === "fulfilled" ? r.value : fallback;
}

/** Theme embeds that count as "the app is switched on in your theme". */
const EMBED_KEYS = ["boosters", "drawer", "cart_tools", "announcements", "quick_add", "wishlist"] as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  // Everything at once: none of these reads depends on another. Orders (Results) are the slowest,
  // so they're remembered longer and refreshed in the background.
  const [plan, [theme, rules, bundles, deals, referral, planState, monthOrders], results] = await Promise.all([
    getPlan(admin, shop),
    remember(shop, "home", 30000, () =>
      Promise.allSettled([
        getThemeStatus(admin, shop),
        listRules(admin),
        listBundles(admin),
        listDeals(admin),
        getReferral(admin, shop),
        getPlanState(admin),
        getMonthlyOrders(admin, shop),
      ]), 300000),
    // Reading 60 days of orders can take a while the first time: Home doesn't wait more than 3 s
    // for it (the read carries on and the card fills in on the next visit).
    Promise.race([
      remember(shop, "home-results", 10 * 60000, () => getExperiment(admin).then((xp) => getResults(admin, xp)), 60 * 60000),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]).catch(() => null),
  ]);

  const installed = theme.status === "fulfilled" ? theme.value.installed : null;
  const ruleList = settled(rules, []);
  const offers = ruleList.length + settled(bundles, []).length + settled(deals, []).length;
  const orders = settled(monthOrders, null);
  const appRevenue = results ? results.bySource.reduce((n, s) => n + s.revenue, 0) : null;
  return {
    shop,
    plan: { key: plan.plan, source: plan.source, trialEndsAt: plan.trialEndsAt },
    paused: settled(planState, { plan: null, paused: [], at: null }).paused,
    orders,
    ordersOver: ordersOver(plan.plan, orders),
    steps: {
      // null = couldn't be checked (theme or orders not readable).
      embed: installed ? EMBED_KEYS.some((k) => installed[k]) : null,
      offer: rules.status === "fulfilled" ? offers > 0 : null,
      section: installed ? Object.entries(installed).some(([k, on]) => on && !(EMBED_KEYS as readonly string[]).includes(k)) : null,
      order: results ? results.bySource.length > 0 : null,
    },
    themeName: theme.status === "fulfilled" ? theme.value.themeName : null,
    embedLink: sectionLinks(shop).boosters,
    editorLink: editorLinks(shop).editor,
    results: results ? { currency: results.currency, orders: results.orders, revenue: results.revenue, appRevenue: appRevenue ?? 0, top: results.bySource[0] ?? null } : null,
    referral: settled(referral, null),
    supportEmail: process.env.SUPPORT_EMAIL || "",
  };
};

const SHORTCUTS: FeatureKey[] = ["upsell", "bundles", "cross_sell", "reviews", "announcements", "shipping_bar", "cart_tools", "payment_rules"];

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${Math.round(n)} ${currency}`;
  }
};

export default function Home() {
  const data = useLoaderData<typeof loader>();
  const current = PLANS[data.plan.key];
  const [playing, setPlaying] = useState<Tutorial | null>(null);
  // "Compare plans" links elsewhere land on /app#plans.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === "#plans") document.getElementById("plans")?.scrollIntoView();
  }, [hash]);

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
      action: <Button href="/app/offers/upsell/new" variant="tertiary">Create an offer</Button>,
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
      text: "Place a test order with an item added by the app; it then shows in Results.",
      action: <Button href={`https://${data.shop}`} target="_blank" variant="tertiary">View store</Button>,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <s-page heading="CRO Toolbox" inlineSize="large">
      <Button slot="secondary-actions" href={`https://${data.shop}`} target="_blank" icon="view">
        View store
      </Button>
      <s-stack gap="large">
        {/* Welcome + current plan */}
        <div className={styles.welcome}>
          <div className={styles.welcomeText}>
            <h2 className={styles.h2}>Welcome to CRO Toolbox</h2>
            <p className={styles.sub}>
              You&apos;re on the <b>{current.name}</b> plan
              {data.plan.trialEndsAt ? ` — free trial until ${new Date(data.plan.trialEndsAt).toLocaleDateString()}` : ""}.
            </p>
            <ul className={styles.includes}>
              {current.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
          <div className={styles.welcomeActions}>
            <Pill tone="ok">{current.name}</Pill>
            <UpgradeButton variant={data.plan.key === "pro" ? "secondary" : "primary"}>Change plan</UpgradeButton>
            <Button onClick={() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })} variant="tertiary">
              Compare plans
            </Button>
          </div>
        </div>

        {data.plan.source === "error" ? (
          <s-banner tone="warning" heading="Your plan couldn't be checked">
            Everything stays open until it can be checked again. Refresh in a minute.
          </s-banner>
        ) : null}
        {data.paused.length ? (
          <s-banner tone="warning" heading={`${data.paused.length} item${data.paused.length === 1 ? " was" : "s were"} switched off to fit your plan`}>
            <s-stack gap="small-200">
              <s-text>
                {`Nothing was deleted. On ${current.name} the first ones in each list stay on; these are saved and switch back on when you upgrade: ${data.paused.map((p) => p.name).join(", ")}.`}
              </s-text>
              <s-stack direction="inline" gap="small-200">
                <UpgradeButton variant="secondary">See plans</UpgradeButton>
              </s-stack>
            </s-stack>
          </s-banner>
        ) : null}
        {data.ordersOver ? (
          <s-banner tone="warning" heading="You're past your plan's monthly orders">
            <s-stack gap="small-200">
              <s-text>{`${data.orders?.toLocaleString()} orders this month; ${current.name} includes ${limitText("monthlyOrders", limitOf(data.plan.key, "monthlyOrders") ?? 0)}. Everything keeps working — please move to a bigger plan.`}</s-text>
              <s-stack direction="inline" gap="small-200">
                <UpgradeButton variant="secondary">Change plan</UpgradeButton>
              </s-stack>
            </s-stack>
          </s-banner>
        ) : null}

        {/* Get started */}
        <s-stack gap="small-200">
          <div className={styles.rowHead}>
            <GroupTitle>Get started</GroupTitle>
            <Pill tone={doneCount === steps.length ? "ok" : "warn"}>{`${doneCount} of ${steps.length} done`}</Pill>
          </div>
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

        {/* Tutorials */}
        <s-stack gap="small-200">
          <GroupTitle>Tutorials</GroupTitle>
          <div className={styles.videos}>
            {TUTORIALS.map((t) => {
              const ready = !!t.youtubeId;
              return (
                <button key={t.title} type="button" className={styles.video} disabled={!ready} onClick={() => setPlaying(t)}>
                  <span className={styles.thumb}>
                    {ready ? <span className={styles.play} aria-hidden="true">▶</span> : <span className={styles.soon}>Coming with launch</span>}
                    <span className={styles.length}>{t.length}</span>
                  </span>
                  <span className={styles.videoTitle}>{t.title}</span>
                  <span className={styles.videoMeta}>{t.feature ? feature(t.feature).title : "Getting started"}</span>
                </button>
              );
            })}
          </div>
        </s-stack>

        {/* Plans */}
        <s-stack gap="small-200">
          <div id="plans" className={styles.rowHead}>
            <GroupTitle>Plans</GroupTitle>
            <s-text color="subdued">Change or cancel any time. Billed by Shopify.</s-text>
          </div>
          <div className={styles.plans}>
            {PLAN_KEYS.map((k) => (
              <PlanCard key={k} plan={k} current={data.plan.key} />
            ))}
          </div>
        </s-stack>

        <CardGrid cols={3}>
          {/* Refer a merchant */}
          <ReferralCard referral={data.referral} />

          {/* Results summary */}
          <Card title="Results" badge={<Pill>Last 60 days</Pill>} actions={<Button href="/app/results" variant="tertiary">Open Results</Button>}>
            {data.results ? (
              <>
                <p className={styles.bigNumber}>{money(data.results.appRevenue, data.results.currency)}</p>
                <CardText>
                  {`From items the app's widgets added, out of ${money(data.results.revenue, data.results.currency)} in ${data.results.orders} orders.`}
                  {data.results.top ? ` Top: ${data.results.top.label}.` : ""}
                </CardText>
              </>
            ) : (
              <CardText>Sales from the app show here once Shopify approves access to orders.</CardText>
            )}
          </Card>

          {/* Help */}
          <Card title="Help">
            <ul className={styles.links}>
              {data.supportEmail ? (
                <li>
                  <a href={`mailto:${data.supportEmail}`} target="_blank" rel="noreferrer">Email support</a>
                  {atLeast(data.plan.key, EXTRA_PLAN.prioritySupport) ? " (priority)" : ""}
                </li>
              ) : null}
              <li><Link to="/app/storefront">Storefront</Link></li>
              <li><Link to="/app/settings">Settings</Link></li>
              <li><a href="/privacy" target="_blank" rel="noreferrer">Privacy policy</a></li>
            </ul>
          </Card>
        </CardGrid>

        <CardGrid cols={3}>
          {/* Request a feature (Growth and up: we build it for them) */}
          <FeatureRequestCard plan={data.plan.key} shop={data.shop} supportEmail={data.supportEmail} />

          {/* Shortcuts */}
          <Card title="Shortcuts" actions={<Button href="/app/storefront" variant="tertiary">All features</Button>}>
            <ul className={styles.shortcuts}>
              {SHORTCUTS.map((k) => {
                const f = feature(k);
                return (
                  <li key={k}>
                    <Link to={f.tabs[0].href}>{f.title}</Link>
                    {canUse(data.plan.key, k) ? null : <Pill>{PLANS[FEATURE_PLAN[k]].name}</Pill>}
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* What's new */}
          <Card title="What's new">
            <ul className={styles.news}>
              {WHATS_NEW.map((n) => (
                <li key={n.text}>
                  <span className={styles.newsDate}>{n.date}</span>
                  {n.href ? <Link to={n.href}>{n.text}</Link> : n.text}
                </li>
              ))}
            </ul>
          </Card>
        </CardGrid>
      </s-stack>

      {playing ? <VideoModal tutorial={playing} onClose={() => setPlaying(null)} /> : null}
    </s-page>
  );
}

function FeatureRequestCard({ plan, shop, supportEmail }: { plan: PlanKey; shop: string; supportEmail: string }) {
  const needs = EXTRA_PLAN.featureRequests;
  if (!atLeast(plan, needs)) {
    return (
      <Card title="Request a feature" badge={<Pill>{PLANS[needs].name}</Pill>} actions={<UpgradeButton to={needs} />}>
        <CardText>{`Need something the app doesn't do yet? On ${PLANS[needs].name} and up, ask for any feature and we build it for you.`}</CardText>
      </Card>
    );
  }
  const mail = `mailto:${supportEmail}?subject=${encodeURIComponent(`Feature request — ${shop}`)}&body=${encodeURIComponent("What would you like your store to do?\n\nWhere should it show (page, cart, checkout…)?\n\nAn example or a link to a store that does it (optional):\n")}`;
  return (
    <Card title="Request a feature" badge={<Pill tone="ok">Included</Pill>} actions={supportEmail ? <Button href={mail} target="_blank">Request a feature</Button> : null}>
      <CardText>Tell us what you&apos;d like your store to do. We build it for you — it&apos;s included in your plan.</CardText>
      {supportEmail ? null : <CardText>Requests open as soon as our support email is set up.</CardText>}
    </Card>
  );
}

function PlanCard({ plan, current }: { plan: PlanKey; current: PlanKey }) {
  const p = PLANS[plan];
  const isCurrent = plan === current;
  return (
    <div className={`${styles.plan} ${isCurrent ? styles.planCurrent : ""}`}>
      <div className={styles.planHead}>
        <span className={styles.planName}>{p.name}</span>
        {isCurrent ? <Pill tone="ok">Current plan</Pill> : null}
      </div>
      <p className={styles.planPrice}>
        {price(p.monthly)}
        {p.monthly ? <span className={styles.per}>/month</span> : null}
      </p>
      <p className={styles.planSub}>
        {p.yearly ? `or ${price(p.yearly)}/year` : "No card needed"}
        {p.trialDays ? ` · ${p.trialDays}-day free trial` : ""}
      </p>
      <ul className={styles.planList}>
        {p.highlights.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      <div className={styles.planAction}>
        {isCurrent ? null : <UpgradeButton variant={planRank(plan) > planRank(current) ? "primary" : "tertiary"}>{planRank(plan) > planRank(current) ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}</UpgradeButton>}
      </div>
    </div>
  );
}

function ReferralCard({ referral }: { referral: { code: string; link: string; reward: string; howItWorks: string } | null }) {
  const shopify = useAppBridge();
  const copy = async () => {
    if (!referral) return;
    try {
      await navigator.clipboard.writeText(referral.link);
      shopify.toast.show("Link copied");
    } catch {
      shopify.toast.show("Copy didn't work — select the link and copy it", { isError: true });
    }
  };
  return (
    <Card title="Refer a merchant" badge={referral ? <Pill tone="ok">{referral.reward}</Pill> : null} actions={referral ? <Button onClick={copy} icon="clipboard">Copy link</Button> : null}>
      {referral ? (
        <>
          <CardText>{referral.howItWorks}</CardText>
          <input className={styles.refLink} readOnly value={referral.link} aria-label="Your referral link" onFocus={(e) => e.currentTarget.select()} />
          <CardText>{`Your code: ${referral.code}`}</CardText>
        </>
      ) : (
        <CardText>Your referral link couldn&apos;t be loaded. Refresh to try again.</CardText>
      )}
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
        {src ? (
          <iframe className={styles.player} src={src} title={tutorial.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        ) : null}
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
