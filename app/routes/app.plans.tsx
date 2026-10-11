/**
 * Plans: what each plan is for, what it adds, and the full comparison. Not in the menu — linked
 * from Home, Settings and every upgrade card. Prices, limits and features all come from
 * lib/plans.ts; choosing a plan happens on Shopify's plan selection page (planUrl, target _top).
 */
import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getPlan } from "../lib/billing.server";
import { getHomeState, setHomeState } from "../lib/home-state.server";
import { getValue } from "../lib/value.server";
import { AREAS, feature, featuresIn } from "../lib/catalog";
import { EXTRA_PLAN, FEATURE_PLAN, GUARANTEE, PLANS, PLAN_KEYS, atLeast, limitOf, planRank, price, type LimitKey, type PlanKey } from "../lib/plans";
import { Button } from "../components/fields";
import { Pill } from "../components/ui";
import styles from "../components/Home.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [info, value] = await Promise.all([getPlan(admin, session.shop), getValue(admin, session.shop)]);
  // Looking at the plans ticks the last step of Home's setup guide (in the background).
  getHomeState(admin)
    .then((s) => (s.planSeen ? null : setHomeState(admin, { planSeen: true })))
    .catch(() => null);
  return { plan: info.plan, planUrl: info.planUrl, trialEndsAt: info.trialEndsAt, value };
};

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${Math.round(n)} ${currency}`;
  }
};

/** Counted limits, in the order of the plans' jobs. */
const LIMIT_ROWS: { key: LimitKey; label: string }[] = [
  { key: "offerSlots", label: "Offers on at the same time" },
  { key: "countdownPlaces", label: "Countdown timers" },
  { key: "designsPerSection", label: "Styles per section" },
  { key: "thankYouModules", label: "Thank-you page modules" },
  { key: "checkoutRules", label: "Checkout rules (payment, delivery, order limits)" },
  { key: "offerStats", label: "Offers with their own results" },
  { key: "monthlyOrders", label: "Orders a month" },
];

const EXTRA_ROWS: { label: string; needs: PlanKey }[] = [
  { label: "Cart drawer: express checkout, best discount, share cart", needs: EXTRA_PLAN.cartDrawerPro },
  { label: "Holdout test (measure what the app adds)", needs: EXTRA_PLAN.holdoutTest },
  { label: "Request any feature — we build it", needs: EXTRA_PLAN.featureRequests },
  { label: "Priority support", needs: EXTRA_PLAN.prioritySupport },
  { label: "Your requests built first", needs: EXTRA_PLAN.requestsFirst },
];

/** Kinds of apps one CRO Toolbox plan does the job of (generic: no other app's name or price). */
const REPLACES = [
  "Bundles and quantity breaks",
  "Upsell and cross-sell offers",
  "Cart drawer",
  "Announcement, free-shipping and countdown bars",
  "Product reviews",
  "Sales pop-ups and trust badges",
  "Back in stock and pre-orders",
  "Wishlist",
  "Payment and delivery customizations",
  "Thank-you and after-purchase offers",
  "Page sections (hero, FAQ, logos, carousels)",
];

function limitCell(p: PlanKey, key: LimitKey) {
  const n = limitOf(p, key);
  return n === null ? "Unlimited" : n.toLocaleString("en-US");
}

export default function Plans() {
  const { plan, planUrl, trialEndsAt, value } = useLoaderData<typeof loader>();
  const [yearly, setYearly] = useState(false);
  const current = PLANS[plan];

  return (
    <s-page heading="Plans" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>
      <s-stack gap="base">
        <s-section>
          <s-stack gap="small-200">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-heading>{`You're on ${current.name}`}</s-heading>
              {trialEndsAt ? <Pill tone="ok">{`Free trial until ${new Date(trialEndsAt).toLocaleDateString()}`}</Pill> : null}
            </s-stack>
            <s-text color="subdued">{current.job}</s-text>
            {value && value.appOrders > 0 ? (
              <s-text>
                {`Last 30 days: ${money(value.appRevenue, value.currency)} in sales from the app's offers and widgets (${value.appOrders} order${value.appOrders === 1 ? "" : "s"})` +
                  (current.monthly ? ` · your plan: ${price(current.monthly)}/month.` : ".")}
              </s-text>
            ) : null}
          </s-stack>
        </s-section>

        <s-stack direction="inline" gap="small-200" alignItems="center">
          <Button variant={yearly ? "secondary" : "primary"} onClick={() => setYearly(false)}>
            Monthly
          </Button>
          <Button variant={yearly ? "primary" : "secondary"} onClick={() => setYearly(true)}>
            Yearly — 2 months free
          </Button>
        </s-stack>

        <div className={styles.plans}>
          {PLAN_KEYS.map((k) => {
            const p = PLANS[k];
            const isCurrent = k === plan;
            const amount = yearly ? p.yearly : p.monthly;
            return (
              <div key={k} className={`${styles.plan} ${isCurrent ? styles.planCurrent : ""}`}>
                <div className={styles.planHead}>
                  <span className={styles.planName}>{p.name}</span>
                  {isCurrent ? <Pill tone="ok">Current plan</Pill> : null}
                </div>
                <p className={styles.planPrice}>
                  {price(amount)}
                  {amount ? <span className={styles.per}>{yearly ? "/year" : "/month"}</span> : null}
                </p>
                <p className={styles.planSub}>{p.job}</p>
                {p.trialDays ? <p className={styles.planSub}>{`${p.trialDays}-day free trial`}</p> : null}
                <ul className={styles.planList}>
                  {p.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                {p.monthly ? <p className={styles.planSub}>{GUARANTEE}</p> : null}
                <div className={styles.planAction}>
                  {isCurrent ? (
                    <s-text color="subdued">Your plan</s-text>
                  ) : (
                    <Button href={planUrl} target="_top" variant={planRank(k) > planRank(plan) ? "primary" : "secondary"}>
                      {planRank(k) > planRank(plan) ? `Choose ${p.name}` : `Switch to ${p.name}`}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <s-section heading="Compare plans" padding="none">
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">What you get</s-table-header>
              {PLAN_KEYS.map((k) => (
                <s-table-header key={k}>{PLANS[k].name}</s-table-header>
              ))}
            </s-table-header-row>
            <s-table-body>
              {LIMIT_ROWS.map((r) => (
                <s-table-row key={r.key}>
                  <s-table-cell>{r.label}</s-table-cell>
                  {PLAN_KEYS.map((k) => (
                    <s-table-cell key={k}>{limitCell(k, r.key)}</s-table-cell>
                  ))}
                </s-table-row>
              ))}
              <s-table-row>
                <s-table-cell>Try a feature of the next plan</s-table-cell>
                {PLAN_KEYS.map((k) => (
                  <s-table-cell key={k}>{PLANS[k].limits.trialFeatures ? `${PLANS[k].limits.trialFeatures} of your choice` : "—"}</s-table-cell>
                ))}
              </s-table-row>
              {AREAS.flatMap((a) =>
                featuresIn(a.key)
                  .filter((f) => feature(f).area === a.key)
                  .map((f) => (
                    <s-table-row key={f}>
                      <s-table-cell>{`${a.title}: ${feature(f).title}`}</s-table-cell>
                      {PLAN_KEYS.map((k) => (
                        <s-table-cell key={k}>{atLeast(k, FEATURE_PLAN[f]) ? "✓" : "—"}</s-table-cell>
                      ))}
                    </s-table-row>
                  )),
              )}
              {EXTRA_ROWS.map((r) => (
                <s-table-row key={r.label}>
                  <s-table-cell>{r.label}</s-table-cell>
                  {PLAN_KEYS.map((k) => (
                    <s-table-cell key={k}>{atLeast(k, r.needs) ? "✓" : "—"}</s-table-cell>
                  ))}
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>

        <s-section heading="One app instead of many">
          <s-stack gap="small-200">
            <s-paragraph>Every plan covers the jobs stores usually install separate apps for:</s-paragraph>
            <ul className={styles.planList}>
              {REPLACES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <s-text color="subdued">{`Paid plans are billed by Shopify on your Shopify invoice. ${GUARANTEE} Nothing is deleted when you change plans: offers over a limit are switched off and come back on when you upgrade.`}</s-text>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
