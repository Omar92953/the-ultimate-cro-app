/**
 * Plans: the three paid plans as wide cards (Omar's reference style), Free as one slim row, then
 * the full comparison folded away. Not in the menu: linked from Home's plan bar, Settings and every
 * upgrade card. Prices, limits and features come from lib/plans.ts; choosing a plan happens on
 * Shopify's plan selection page (planUrl, target _top).
 */
import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getPlan } from "../lib/billing.server";
import { getValue } from "../lib/value.server";
import { AREAS, feature, featuresIn } from "../lib/catalog";
import { EXTRA_PLAN, REQUESTS_FIRST_TEXT, FEATURE_PLAN, GUARANTEE, PLANS, PLAN_KEYS, atLeast, limitOf, planRank, type LimitKey, type PlanKey } from "../lib/plans";
import { Button } from "../components/fields";
import { Pill, Segmented } from "../components/ui";
import { FreeRow, PlanCard } from "../components/PlanCard";
import styles from "../components/PlanCard.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [info, value] = await Promise.all([getPlan(admin, session.shop), getValue(admin, session.shop)]);
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
  { label: "Your requests built first", needs: EXTRA_PLAN.requestsFirst },
  { label: "Request any feature and we build it", needs: EXTRA_PLAN.featureRequests },
  { label: "Holdout test (measure what the app adds)", needs: EXTRA_PLAN.holdoutTest },
  { label: "Track page offers above and below the tracking", needs: EXTRA_PLAN.trackOffers },
  { label: "Priority support", needs: EXTRA_PLAN.prioritySupport },
];

function limitCell(p: PlanKey, key: LimitKey) {
  const n = limitOf(p, key);
  return n === null ? "Unlimited" : n.toLocaleString("en-US");
}

export default function Plans() {
  const { plan, planUrl, trialEndsAt, value } = useLoaderData<typeof loader>();
  const [yearly, setYearly] = useState(false);
  const current = PLANS[plan];
  const choose = (k: PlanKey) =>
    k === plan ? (
      <Button variant="secondary" inlineSize="fill" disabled>
        Your plan
      </Button>
    ) : (
      <Button href={planUrl} target="_top" inlineSize="fill" variant={planRank(k) > planRank(plan) ? "primary" : "secondary"}>
        {planRank(k) > planRank(plan) ? (PLANS[k].trialDays ? `Start ${PLANS[k].trialDays}-day free trial` : `Choose ${PLANS[k].name}`) : `Switch to ${PLANS[k].name}`}
      </Button>
    );

  return (
    <s-page heading="Plans" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>
      <s-stack gap="base">
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-stack gap="small-100">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-heading>{`You're on ${current.name}`}</s-heading>
              {trialEndsAt ? <Pill tone="ok">{`Free trial until ${new Date(trialEndsAt).toLocaleDateString()}`}</Pill> : null}
            </s-stack>
            {value && value.appOrders > 0 ? (
              <s-text color="subdued">{`The app added ${money(value.appRevenue, value.currency)} in the last 30 days (${value.appOrders} order${value.appOrders === 1 ? "" : "s"}).`}</s-text>
            ) : (
              <s-text color="subdued">{GUARANTEE}</s-text>
            )}
          </s-stack>
          <Segmented
            label="Billing period"
            value={yearly ? "yearly" : "monthly"}
            onChange={(v) => setYearly(v === "yearly")}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly: 2 months free" },
            ]}
          />
        </s-stack>

        <div className={styles.cards}>
          {PLAN_KEYS.filter((k) => k !== "free").map((k) => (
            <PlanCard key={k} plan={k} current={k === plan} yearly={yearly} action={choose(k)} />
          ))}
        </div>
        <s-banner tone="info" heading="Pro: your requests are built first">{REQUESTS_FIRST_TEXT}</s-banner>
        <s-text color="subdued">You confirm the plan on Shopify&apos;s page. Development stores show $0.</s-text>
        <FreeRow current={plan === "free"} action={plan === "free" ? null : choose("free")} />
        <s-text color="subdued">{`Paid plans are billed by Shopify on your Shopify invoice and start with a free trial. ${GUARANTEE} Nothing is deleted when you change plans.`}</s-text>

        <details className={styles.compare}>
          <summary className={styles.compareSummary}>Compare all features</summary>
          <s-section padding="none">
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
                    <s-table-cell key={k}>{PLANS[k].limits.trialFeatures ? `${PLANS[k].limits.trialFeatures} of your choice` : "✕"}</s-table-cell>
                  ))}
                </s-table-row>
                {AREAS.flatMap((a) =>
                  featuresIn(a.key)
                    .filter((f) => feature(f).area === a.key)
                    .map((f) => (
                      <s-table-row key={f}>
                        <s-table-cell>{`${a.title}: ${feature(f).title}`}</s-table-cell>
                        {PLAN_KEYS.map((k) => (
                          <s-table-cell key={k}>{atLeast(k, FEATURE_PLAN[f]) ? "✓" : "✕"}</s-table-cell>
                        ))}
                      </s-table-row>
                    )),
                )}
                {EXTRA_ROWS.map((r) => (
                  <s-table-row key={r.label}>
                    <s-table-cell>{r.label}</s-table-cell>
                    {PLAN_KEYS.map((k) => (
                      <s-table-cell key={k}>{atLeast(k, r.needs) ? "✓" : "✕"}</s-table-cell>
                    ))}
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          </s-section>
        </details>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
