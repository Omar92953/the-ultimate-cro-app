import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getPlan } from "../lib/billing.server";
import { EXTRA_PLAN, PLANS, atLeast } from "../lib/plans";
import { UpgradeCard, usePlan } from "../components/Upgrade";
import { errorMessage } from "../lib/admin.server";
import { getExperiment, getResults, saveExperiment } from "../lib/results.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { Button, NumberField, Switch } from "../components/fields";
import { Explainer } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const xp = await getExperiment(admin);
  const [results, theme] = await Promise.all([getResults(admin, xp).catch((e) => ({ error: errorMessage(e) })), getThemeStatus(admin, session.shop).catch(() => null)]);
  return { xp, results, boostersOn: theme ? theme.installed.boosters : null, boostersLink: sectionLinks(session.shop).boosters };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    // Starting the test needs a plan that includes it (lib/plans.ts); stopping it is always allowed.
    if (form.get("on") === "true" && !(await getExperiment(admin)).on && !atLeast((await getPlan(admin, session.shop)).plan, EXTRA_PLAN.holdoutTest)) {
      return { ok: false, error: `The holdout test is on the ${PLANS[EXTRA_PLAN.holdoutTest].name} plan.`, xp: null };
    }
    const xp = await saveExperiment(admin, { on: form.get("on") === "true", holdout: Number(form.get("holdout")), since: form.get("on") === "true" && form.get("restart") !== "true" ? ((await getExperiment(admin)).since ?? null) : null });
    return { ok: true, error: null, xp };
  } catch (e) {
    return { ok: false, error: errorMessage(e), xp: null };
  }
};

export default function Results() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const { plan } = usePlan();
  const [holdout, setHoldout] = useState(data.xp.holdout);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show(fetcher.data.xp?.on ? "Holdout test running" : "Holdout test stopped");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);
  const r = "error" in data.results ? null : data.results;
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: r?.currency ?? "USD", maximumFractionDigits: 0 }).format(n);
    } catch {
      return n.toFixed(0);
    }
  };
  const appRevenue = r ? r.bySource.reduce((n, s) => n + s.revenue, 0) : 0;
  const run = (on: boolean, restart = false) => fetcher.submit({ on: String(on), holdout: String(holdout), restart: String(restart) }, { method: "post" });

  return (
    <s-page heading="Results" inlineSize="large">
      <s-stack gap="base">
        <Explainer
          what="What the app's widgets sell: every item they add to a cart is marked with the widget, so orders show which one brought it in."
          how="Revenue below comes from your orders of the last 60 days. The holdout test hides the widgets from a small share of shoppers; comparing how often each group orders shows the real lift — not just what passed through the widgets."
          example="Upsell offers: EGP 12,400 from 31 orders. Holdout test: shoppers who see the app order 9% more often."
        />
        {"error" in data.results ? (
          /not approved to access/i.test(data.results.error) ? (
            <s-banner tone="warning" heading="Results need access to your orders">
              Shopify hasn’t yet approved this app to read order data, so sales from the app’s widgets can’t be counted. The widgets themselves work as usual.
            </s-banner>
          ) : (
            <s-banner tone="critical" heading="Orders could not be read">
              {data.results.error}
            </s-banner>
          )
        ) : null}
        {r ? (
          <s-section heading={`Last 60 days · ${r.orders} orders · ${fmt(r.revenue)}`}>
            <s-stack gap="base">
              <s-text>
                Items added by the app’s widgets: <b>{fmt(appRevenue)}</b>
                {r.revenue ? ` (${Math.round((appRevenue / r.revenue) * 100)}% of sales)` : ""}
              </s-text>
              {r.bySource.length ? (
                <s-table>
                  <s-table-header-row>
                    <s-table-header>Widget</s-table-header>
                    <s-table-header format="numeric">Revenue</s-table-header>
                    <s-table-header format="numeric">Orders</s-table-header>
                    <s-table-header format="numeric">Items</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {r.bySource.map((s) => (
                      <s-table-row key={s.key}>
                        <s-table-cell>{s.label}</s-table-cell>
                        <s-table-cell>{fmt(s.revenue)}</s-table-cell>
                        <s-table-cell>{s.orders}</s-table-cell>
                        <s-table-cell>{s.lines}</s-table-cell>
                      </s-table-row>
                    ))}
                  </s-table-body>
                </s-table>
              ) : (
                <s-paragraph>No orders with items from the app’s widgets yet. New items are marked from now on.</s-paragraph>
              )}
            </s-stack>
          </s-section>
        ) : null}

        <s-section heading="Holdout test">
          <s-stack gap="base">
            <s-text color="subdued">A share of shoppers (picked at random, kept for their visits) see your store without the app’s widgets. Orders from each group are compared — the honest way to know what the app adds.</s-text>
            {data.boostersOn === false ? (
              <s-banner tone="warning" heading="The test runs from the Conversion boosters embed — turn it on">
                <s-link href={data.boostersLink} target="_top">
                  Open App embeds
                </s-link>
              </s-banner>
            ) : null}
            {!data.xp.on && !atLeast(plan, EXTRA_PLAN.holdoutTest) ? (
              <UpgradeCard needs={EXTRA_PLAN.holdoutTest} title={`The holdout test is on the ${PLANS[EXTRA_PLAN.holdoutTest].name} plan`} text="Find out what the app really adds to your sales, not just what passed through its widgets." />
            ) : (
            <>
            <NumberField label="Shoppers in the holdout" suffix="%" details="5–50%. 10% is a good start: few shoppers miss out, and results come in a few weeks." min={5} max={50} step={1} value={holdout} onValue={setHoldout} />
            <Switch label={data.xp.on ? "Test running" : "Run the test"} checked={data.xp.on} onValue={(v) => run(v)} />
            {data.xp.on ? (
              <Button variant="tertiary" onClick={() => run(true, true)}>
                Start over (new groups, results from today)
              </Button>
            ) : null}
            </>
            )}
            {r?.groups ? (
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-text type="strong">See the app</s-text>
                  <s-paragraph>
                    {r.groups.app.orders} orders · {fmt(r.groups.app.revenue)}
                  </s-paragraph>
                </s-box>
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-text type="strong">Holdout ({data.xp.holdout}%)</s-text>
                  <s-paragraph>
                    {r.groups.holdout.orders} orders · {fmt(r.groups.holdout.revenue)}
                  </s-paragraph>
                </s-box>
              </s-grid>
            ) : null}
            {r?.groups ? (
              r.lift === null ? (
                <s-text color="subdued">The lift shows once each group has at least 5 orders.</s-text>
              ) : (
                <s-banner tone={r.lift >= 0 ? "success" : "warning"} heading={`Shoppers who see the app order ${Math.abs(Math.round(r.lift * 100))}% ${r.lift >= 0 ? "more" : "less"} often`}>
                  Based on {r.groups.app.orders + r.groups.holdout.orders} orders since the test started. More orders make it more certain.
                </s-banner>
              )
            ) : null}
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
