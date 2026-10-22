import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getPlan } from "../lib/billing.server";
import { EXTRA_PLAN, PLANS, atLeast, limitOf, planAbove } from "../lib/plans";
import { UpgradeButton, UpgradeCard, usePlan } from "../components/Upgrade";
import { errorMessage } from "../lib/admin.server";
import { getExperiment, getResults, saveExperiment, type Results } from "../lib/results.server";
import { remember } from "../lib/short-cache.server";
import { lookupsSince } from "../lib/track-sell.server";
import { returnSavings } from "../lib/orders-lookup.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { Button, NumberField, Switch } from "../components/fields";
import { PageIntro, Pill, Segmented } from "../components/ui";
import { AbResults } from "../components/AbResults";
import { listTests, testResults } from "../lib/ab-tests.server";
import { AB_CHANGE_LABELS, testSummary, type AbResult } from "../lib/ab-tests";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const xp = await getExperiment(admin);
  const [raw, theme, info, lookups, kept, tests] = await Promise.all([
    // Shared with Home (same key as value.server.ts cachedResults): the slow order read runs once per shop every 10 minutes.
    remember(session.shop, "home-results", 10 * 60000, () => getResults(admin, xp, session.shop), 60 * 60000).catch((e) => ({ error: errorMessage(e) })),
    getThemeStatus(admin, session.shop).catch(() => null),
    getPlan(admin, session.shop),
    lookupsSince(session.shop, 30).catch(() => 0),
    returnSavings(session.shop, 30).catch(() => null),
    listTests(admin).catch(() => []),
  ]);
  // A/B test results (tests are created on the Offers page): the running ones and the latest ended ones.
  const abResults = await testResults(admin, session.shop, tests.slice(0, 10)).catch(() => ({}) as Record<string, AbResult>);
  // Results per widget and per bundle: the plan shows its top N (plans.ts offerStats); the rest
  // are summed into one teaser row, so the merchant sees there's more to see.
  const n = limitOf(info.plan, "offerStats");
  const cut = <T extends { revenue: number }>(rows: T[]) => {
    const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
    const hidden = n === null ? [] : sorted.slice(n);
    return { rows: n === null ? sorted : sorted.slice(0, n), hidden: { count: hidden.length, revenue: hidden.reduce((t, r) => t + r.revenue, 0) } };
  };
  let results: { error: string } | (Omit<Results, "bySource" | "byBundle"> & { sources: ReturnType<typeof cut<Results["bySource"][number]>>; bundles: ReturnType<typeof cut<Results["byBundle"][number]>> });
  if ("error" in raw) results = raw;
  else {
    const { bySource, byBundle, ...rest } = raw;
    results = { ...rest, sources: cut(bySource), bundles: cut(byBundle) };
  }
  return { tests, abResults, lookups, kept: kept ? { credit: kept.credit.value, exchanges: kept.exchanges.value, count: kept.credit.count + kept.exchanges.count, currency: kept.currency } : null, xp, results, boostersOn: theme ? theme.installed.boosters : null, boostersLink: sectionLinks(session.shop).boosters };
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

/** "+12%" against the 30 days before; null when there's nothing to compare. */
const change = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

type Tab = "overview" | "offers" | "bundles" | "tests" | "track" | "holdout";

export default function Analytics() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const { plan } = usePlan();
  const [tab, setTab] = useState<Tab>("overview");
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
  const run = (on: boolean, restart = false) => fetcher.submit({ on: String(on), holdout: String(holdout), restart: String(restart) }, { method: "post" });
  const statsLimit = limitOf(plan, "offerStats");
  const statsNext = statsLimit === null ? null : planAbove("offerStats", statsLimit, plan);

  /** The rows the plan doesn't show one by one: their total, and the plan that shows each. */
  const teaser = (hidden: { count: number; revenue: number }, noun: string) =>
    hidden.count && statsNext ? (
      <s-box padding="base">
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-text color="subdued">{`${hidden.count} more ${noun}${hidden.count === 1 ? "" : "s"} brought in ${fmt(hidden.revenue)}. ${PLANS[statsNext].name} shows each one.`}</s-text>
          <UpgradeButton to={statsNext} variant="secondary" />
        </s-stack>
      </s-box>
    ) : null;

  const running = data.tests.filter((t) => t.status === "running");
  const cur = r?.periods.current;
  const prev = r?.periods.previous;
  const kpis = cur && prev
    ? [
        { label: "Sales from the app", value: fmt(cur.appRevenue), delta: change(cur.appRevenue, prev.appRevenue) },
        { label: "Orders with the app's items", value: String(cur.appOrders), delta: change(cur.appOrders, prev.appOrders) },
        { label: "Share of your sales", value: cur.revenue ? `${Math.round((cur.appRevenue / cur.revenue) * 100)}%` : "No data yet", delta: null },
        { label: "All orders", value: String(cur.orders), delta: change(cur.orders, prev.orders) },
      ]
    : [];

  return (
    <s-page heading="Analytics" inlineSize="large">
      <s-stack gap="base">
        <PageIntro text="What the app's offers and sections sell, counted from your real orders." />
        {"error" in data.results ? (
          /not approved to access/i.test(data.results.error) ? (
            <s-banner tone="warning" heading="Analytics need access to your orders">
              Shopify hasn’t yet approved this app to read order data, so sales from the app’s widgets can’t be counted. The widgets themselves work as usual.
            </s-banner>
          ) : (
            <s-banner tone="critical" heading="Orders could not be read">
              {data.results.error}
            </s-banner>
          )
        ) : null}

        <Segmented<Tab>
          label="Analytics"
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Overview" },
            { value: "offers", label: "Offers and widgets" },
            { value: "bundles", label: "Bundles" },
            { value: "tests", label: "A/B tests" },
            { value: "track", label: "Track & Returns" },
            { value: "holdout", label: "Holdout test" },
          ]}
        />

        {tab === "overview" && r ? (
          <s-section heading="Last 30 days">
            <s-stack gap="base">
              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="base">
                {kpis.map((k) => (
                  <s-box key={k.label} padding="base" borderWidth="base" borderRadius="base">
                    <s-stack gap="small-100">
                      <s-text color="subdued">{k.label}</s-text>
                      <s-heading>{k.value}</s-heading>
                      {k.delta !== null ? (
                        <s-text tone={k.delta >= 0 ? "success" : "critical"}>{`${k.delta >= 0 ? "+" : ""}${k.delta}% vs the 30 days before`}</s-text>
                      ) : (
                        <s-text color="subdued">Nothing to compare yet</s-text>
                      )}
                    </s-stack>
                  </s-box>
                ))}
              </s-grid>
              <s-text color="subdued">{`Last 60 days: ${r.orders} orders · ${fmt(r.revenue)} in sales.`}</s-text>
            </s-stack>
          </s-section>
        ) : null}

        {tab === "overview" && running.length ? (
          <s-section heading="A/B tests running">
            <s-stack gap="small-200">
              {running.map((t) => (
                <s-stack key={t.id} direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                  <s-text>{t.name}</s-text>
                  <s-text color="subdued">{testSummary(data.abResults[t.id])}</s-text>
                </s-stack>
              ))}
              <s-stack direction="inline">
                <Button variant="tertiary" onClick={() => setTab("tests")}>
                  See the results
                </Button>
              </s-stack>
            </s-stack>
          </s-section>
        ) : null}

        {tab === "tests" ? (
          <s-stack gap="base">
            <s-text color="subdued">Half of the shoppers see the offer as saved (version A), half see version B. Orders are counted from your real orders. Tests are created and ended on the Offers page.</s-text>
            {data.tests.length ? (
              data.tests.map((t) => (
                <s-section key={t.id} heading={t.name}>
                  <s-stack gap="small-200">
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <Pill tone={t.status === "running" ? "ok" : undefined}>{t.status === "running" ? "Running" : t.status === "applied" ? `Ended: version ${t.winner} chosen` : "Stopped"}</Pill>
                      <s-text color="subdued">{`Started ${new Date(t.startedAt).toLocaleDateString()}${t.endedAt ? `, ended ${new Date(t.endedAt).toLocaleDateString()}` : ""}`}</s-text>
                    </s-stack>
                    <s-text color="subdued">{`Version B changes: ${Object.keys(t.b).map((k) => AB_CHANGE_LABELS[k] ?? k).join(", ")}.`}</s-text>
                    {data.abResults[t.id] ? <AbResults r={data.abResults[t.id]} money={fmt} /> : null}
                    {t.status === "running" ? (
                      <s-stack direction="inline">
                        <s-link href="/app/offers/tests">Choose a winner or stop the test</s-link>
                      </s-stack>
                    ) : null}
                  </s-stack>
                </s-section>
              ))
            ) : atLeast(plan, "pro") ? (
              <s-section heading="No tests yet">
                <s-stack gap="small-200">
                  <s-paragraph>Show half of your shoppers a second version of an upsell or cross sell. The results appear here.</s-paragraph>
                  <s-stack direction="inline">
                    <s-link href="/app/offers/tests">Start a test</s-link>
                  </s-stack>
                </s-stack>
              </s-section>
            ) : (
              <UpgradeCard needs="pro" title="A/B tests are on the Pro plan" text="Test two versions of an offer and see which one sells more." />
            )}
          </s-stack>
        ) : null}

        {tab === "offers" && r ? (
          <s-section heading="Offers and widgets · last 60 days" padding={r.sources.rows.length ? "none" : undefined}>
            {r.sources.rows.length ? (
              <s-stack gap="none">
                <s-table>
                  <s-table-header-row>
                    <s-table-header listSlot="primary">Offer or widget</s-table-header>
                    <s-table-header format="numeric">Revenue</s-table-header>
                    <s-table-header format="numeric">Orders</s-table-header>
                    <s-table-header format="numeric">Items</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {r.sources.rows.map((s) => (
                      <s-table-row key={s.key}>
                        <s-table-cell>{s.label}</s-table-cell>
                        <s-table-cell>{fmt(s.revenue)}</s-table-cell>
                        <s-table-cell>{s.orders}</s-table-cell>
                        <s-table-cell>{s.lines}</s-table-cell>
                      </s-table-row>
                    ))}
                  </s-table-body>
                </s-table>
                {teaser(r.sources.hidden, "offer or widget")}
              </s-stack>
            ) : (
              <s-paragraph>No orders with items from the app’s offers or widgets yet. New items are marked from now on.</s-paragraph>
            )}
          </s-section>
        ) : null}

        {tab === "bundles" && r ? (
          <s-section heading="Bundles · last 60 days" padding={r.bundles.rows.length ? "none" : undefined}>
            {r.bundles.rows.length ? (
              <s-stack gap="none">
                <s-table>
                  <s-table-header-row>
                    <s-table-header listSlot="primary">Bundle</s-table-header>
                    <s-table-header format="numeric">Bundles sold</s-table-header>
                    <s-table-header format="numeric">Orders</s-table-header>
                    <s-table-header format="numeric">Revenue</s-table-header>
                    <s-table-header format="numeric">Average order</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {r.bundles.rows.map((b) => (
                      <s-table-row key={b.key}>
                        <s-table-cell>{b.name}</s-table-cell>
                        <s-table-cell>{b.units}</s-table-cell>
                        <s-table-cell>{b.orders}</s-table-cell>
                        <s-table-cell>{fmt(b.revenue)}</s-table-cell>
                        <s-table-cell>{fmt(b.aov)}</s-table-cell>
                      </s-table-row>
                    ))}
                  </s-table-body>
                </s-table>
                {teaser(r.bundles.hidden, "bundle")}
              </s-stack>
            ) : (
              <s-paragraph>No bundles sold in the last 60 days. Mix and match bundles and fixed bundles show here with their sales, orders and average order value.</s-paragraph>
            )}
          </s-section>
        ) : null}

        {tab === "track" && r ? (
          <s-section heading="Track & Returns · last 30 days">
            <s-stack gap="base">
              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(190px, 1fr))" gap="base">
                {[
                  { label: "Orders looked up", value: String(data.lookups), note: "On your Track page (counted from the day this card shipped)" },
                  { label: "Sales from recommendations", value: fmt(r.track.recs.revenue), note: `${r.track.recs.orders} order${r.track.recs.orders === 1 ? "" : "s"} with a recommended item` },
                  { label: "Sales from Track page offers", value: fmt(r.track.offers.revenue), note: `${r.track.offers.orders} order${r.track.offers.orders === 1 ? "" : "s"} with an offer's item` },
                  { label: "Buy again orders", value: String(r.track.buyAgain.orders), note: `${fmt(r.track.buyAgain.revenue)} from the Buy again button` },
                  { label: "Codes used", value: String(r.track.codes.orders), note: `${fmt(r.track.codes.revenue)} in orders · next order ${r.track.codes.byKind.next}, friend ${r.track.codes.byKind.friend}, late order ${r.track.codes.byKind.delay}, offers ${r.track.codes.byKind.offer}` },
                  { label: "Sales kept by return saving", value: data.kept ? `${(data.kept.credit + data.kept.exchanges).toFixed(2)} ${data.kept.currency}` : "No data yet", note: data.kept ? `${data.kept.count} return${data.kept.count === 1 ? "" : "s"} paid back as store credit or exchanged instead of refunded` : "Return saving rules (Pro)" },
                ].map((k) => (
                  <s-box key={k.label} padding="base" borderWidth="base" borderRadius="base">
                    <s-stack gap="small-100">
                      <s-text color="subdued">{k.label}</s-text>
                      <s-heading>{k.value}</s-heading>
                      <s-text color="subdued">{k.note}</s-text>
                    </s-stack>
                  </s-box>
                ))}
              </s-grid>
              <s-text color="subdued">Real orders only. Items are counted when the page added them to a new cart (marked on the cart line); codes when an order used a code the Track page gave. An order that used a code and also has a marked item shows in both.</s-text>
            </s-stack>
          </s-section>
        ) : null}

        {tab === "holdout" ? (
        <s-section heading="Holdout test">
          <s-stack gap="base">
            <s-text color="subdued">A share of shoppers (picked at random, kept for their visits) see your store without the app’s widgets. Orders from each group are compared. It&apos;s the honest way to know what the app adds.</s-text>
            {data.boostersOn === false ? (
              <s-banner tone="warning" heading="The test runs from the Conversion boosters embed. Turn it on">
                <s-link href={data.boostersLink} target="_top">
                  Open App embeds
                </s-link>
              </s-banner>
            ) : null}
            {!data.xp.on && !atLeast(plan, EXTRA_PLAN.holdoutTest) ? (
              <UpgradeCard needs={EXTRA_PLAN.holdoutTest} title={`The holdout test is on the ${PLANS[EXTRA_PLAN.holdoutTest].name} plan`} text="Find out what the app really adds to your sales, not just what passed through its widgets." />
            ) : (
            <>
            <NumberField label="Shoppers in the holdout" suffix="%" details="5% to 50%. 10% is a good start: few shoppers miss out, and results come in a few weeks." min={5} max={50} step={1} value={holdout} onValue={setHoldout} />
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
        ) : null}
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
