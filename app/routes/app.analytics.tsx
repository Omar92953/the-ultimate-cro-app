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
import { AB_CHANGE_LABELS, type AbResult } from "../lib/ab-tests";
import { listOffers } from "../lib/offers.server";
import { OFFER_TYPES } from "../lib/offer-types";
import { offerStats } from "../lib/offer-stats";
import { money } from "../lib/format";
import css from "../components/AnalyticsOverview.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const xp = await getExperiment(admin);
  const [raw, theme, info, lookups, kept, tests, offers] = await Promise.all([
    // Shared with Home (same key as value.server.ts cachedResults): the slow order read runs once per shop every 10 minutes.
    remember(session.shop, "home-results", 10 * 60000, () => getResults(admin, xp, session.shop), 60 * 60000).catch((e) => ({ error: errorMessage(e) })),
    getThemeStatus(admin, session.shop).catch(() => null),
    getPlan(admin, session.shop),
    lookupsSince(session.shop, 30).catch(() => 0),
    returnSavings(session.shop, 30).catch(() => null),
    listTests(admin).catch(() => []),
    listOffers(admin).catch(() => []),
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
  // Overview: the offers that sold the most in the last 30 days (Offers hub keys, results.server.ts byOffer),
  // as many as the plan shows one by one, three at most.
  const topOffers = "error" in raw
    ? []
    : offers
        .flatMap((o) => {
          const st = o.statKeys ? offerStats(raw.byOffer, o.statKeys) : undefined;
          return st && st.revenue > 0 ? [{ id: o.id, name: o.name, type: OFFER_TYPES[o.type].title, orders: st.orders, revenue: st.revenue }] : [];
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, Math.min(3, n ?? 3));
  return { tests, abResults, topOffers, lookups, kept: kept ? { credit: kept.credit.value, exchanges: kept.exchanges.value, count: kept.credit.count + kept.exchanges.count, currency: kept.currency } : null, xp, results, boostersOn: theme ? theme.installed.boosters : null, boostersLink: sectionLinks(session.shop).boosters };
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
  const delta = (d: number | null, long = false) => (d === null ? null : `${d >= 0 ? "+" : ""}${d}%${long ? " vs the 30 days before" : ""}`);
  const avgWith = cur && cur.appOrders ? cur.appOrdersTotal / cur.appOrders : null;
  const avgWithout = cur && cur.orders > cur.appOrders ? (cur.revenue - cur.appOrdersTotal) / (cur.orders - cur.appOrders) : null;
  const kpis: { label: string; value: string; note: string; good?: boolean }[] = cur && prev && r
    ? [
        { label: "Sales from the app", value: fmt(cur.appRevenue), note: delta(change(cur.appRevenue, prev.appRevenue), true) ?? "Nothing to compare yet", good: change(cur.appRevenue, prev.appRevenue) !== null ? change(cur.appRevenue, prev.appRevenue)! >= 0 : undefined },
        { label: "Orders with app items", value: String(cur.appOrders), note: delta(change(cur.appOrders, prev.appOrders), true) ?? "Nothing to compare yet", good: change(cur.appOrders, prev.appOrders) !== null ? change(cur.appOrders, prev.appOrders)! >= 0 : undefined },
        { label: "Average order with app items", value: avgWith === null ? "No orders yet" : money(avgWith, r.currency), note: avgWithout === null ? "No orders without app items" : `${money(avgWithout, r.currency)} without`, good: avgWith !== null && avgWithout !== null ? avgWith >= avgWithout : undefined },
        { label: "Share of your sales", value: cur.revenue ? `${Math.round((cur.appRevenue / cur.revenue) * 100)}%` : "No data yet", note: "from offers and widgets" },
      ]
    : [];
  // The A/B test the Overview shows: a running one with results first, else the latest with results.
  const abTest = [...running, ...data.tests].find((t) => data.abResults[t.id]);
  const ab = abTest ? data.abResults[abTest.id] : null;

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
            <div className={css.tiles}>
              {kpis.map((k) => (
                <div key={k.label} className={css.tile}>
                  <span className={css.label}>{k.label}</span>
                  <span className={/\d/.test(k.value) ? css.value : css.valueText}>{k.value}</span>
                  <span className={k.good === undefined ? css.note : k.good ? css.up : css.down}>{k.note}</span>
                </div>
              ))}
            </div>
          </s-section>
        ) : null}

        {tab === "overview" && r ? (
          <div className={css.row2}>
            <s-section heading="Top offers · last 30 days">
              {data.topOffers.length ? (
                <s-stack gap="small-200">
                  <table className={css.table}>
                    <thead>
                      <tr><th>Offer</th><th>Type</th><th className={css.num}>Orders</th><th className={css.num}>Sales</th></tr>
                    </thead>
                    <tbody>
                      {data.topOffers.map((o) => (
                        <tr key={o.id}><td>{o.name}</td><td>{o.type}</td><td className={css.num}>{o.orders}</td><td className={css.num}>{fmt(o.revenue)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <s-stack direction="inline">
                    <Button variant="tertiary" onClick={() => setTab("offers")}>
                      See every offer and widget
                    </Button>
                  </s-stack>
                </s-stack>
              ) : (
                <s-paragraph>No orders with an offer&apos;s items in the last 30 days yet.</s-paragraph>
              )}
            </s-section>
            <s-section heading={abTest ? `A/B test · ${abTest.name}` : "A/B tests"}>
              {abTest && ab ? (
                <s-stack gap="small-200">
                  {(["A", "B"] as const).map((v) => {
                    const ahead = ab.leader === v && ab.verdict !== "wait" && ab.verdict !== "close";
                    const per = v === "A" ? ab.perView.a : ab.perView.b;
                    return (
                      <div key={v} className={`${css.version} ${ahead ? css.ahead : ""}`}>
                        <span>
                          {v === "A" ? "Version A · as saved" : "Version B"}
                          {ahead ? <span className={css.pill}>Ahead</span> : null}
                        </span>
                        <strong>{per === null ? "No shoppers yet" : `${money(per, r.currency)} per shopper`}</strong>
                      </div>
                    );
                  })}
                  <span className={css.note}>{`Shoppers split evenly · ${(ab.a.views + ab.b.views).toLocaleString()} shoppers so far`}</span>
                  <s-stack direction="inline">
                    <Button variant="tertiary" onClick={() => setTab("tests")}>
                      See the results
                    </Button>
                  </s-stack>
                </s-stack>
              ) : (
                <s-stack gap="small-200">
                  <s-paragraph>Show half of your shoppers a second version of an upsell or cross sell and see which one sells more.</s-paragraph>
                  <s-stack direction="inline">
                    <s-link href="/app/offers/tests">Start a test</s-link>
                  </s-stack>
                </s-stack>
              )}
            </s-section>
          </div>
        ) : null}

        {tab === "tests" ? (
          <s-stack gap="base">
            <s-text color="subdued">Half of the shoppers see the offer as saved (version A), half see version B. Orders are counted from your real orders. Tests are created and ended on the Offers page.</s-text>
            {data.tests.length ? (
              data.tests.map((t) => (
                <s-section key={t.id} heading={t.name}>
                  <s-stack gap="small-200">
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <Pill tone={t.status === "running" ? "ok" : undefined}>{t.status === "running" ? "Running" : t.status === "paused" ? "Paused (needs Pro)" : t.status === "applied" ? `Ended: version ${t.winner} chosen` : "Stopped"}</Pill>
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
          <s-section heading="Offers and widgets · last 60 days">
            {r.sources.rows.length ? (
              <s-stack gap="small-200">
                <table className={css.table}>
                  <thead><tr><th>Offer or widget</th><th className={css.num}>Revenue</th><th className={css.num}>Orders</th><th className={css.num}>Items</th></tr></thead>
                  <tbody>
                    {r.sources.rows.map((s) => (
                      <tr key={s.key}><td>{s.label}</td><td className={css.num}>{fmt(s.revenue)}</td><td className={css.num}>{s.orders}</td><td className={css.num}>{s.lines}</td></tr>
                    ))}
                  </tbody>
                </table>
                {teaser(r.sources.hidden, "offer or widget")}
              </s-stack>
            ) : (
              <s-paragraph>No orders with items from the app’s offers or widgets yet. New items are marked from now on.</s-paragraph>
            )}
          </s-section>
        ) : null}

        {tab === "bundles" && r ? (
          <s-section heading="Bundles · last 60 days">
            {r.bundles.rows.length ? (
              <s-stack gap="small-200">
                <table className={css.table}>
                  <thead><tr><th>Bundle</th><th className={css.num}>Bundles sold</th><th className={css.num}>Orders</th><th className={css.num}>Revenue</th><th className={css.num}>Average order</th></tr></thead>
                  <tbody>
                    {r.bundles.rows.map((b) => (
                      <tr key={b.key}><td>{b.name}</td><td className={css.num}>{b.units}</td><td className={css.num}>{b.orders}</td><td className={css.num}>{fmt(b.revenue)}</td><td className={css.num}>{fmt(b.aov)}</td></tr>
                    ))}
                  </tbody>
                </table>
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
              <div className={css.tiles3}>
                {[
                  { label: "Orders looked up", value: String(data.lookups), note: "On your Track page (counted from the day this card shipped)" },
                  { label: "Sales from recommendations", value: fmt(r.track.recs.revenue), note: `${r.track.recs.orders} order${r.track.recs.orders === 1 ? "" : "s"} with a recommended item` },
                  { label: "Sales from Track page offers", value: fmt(r.track.offers.revenue), note: `${r.track.offers.orders} order${r.track.offers.orders === 1 ? "" : "s"} with an offer's item` },
                  { label: "Buy again orders", value: String(r.track.buyAgain.orders), note: `${fmt(r.track.buyAgain.revenue)} from the Buy again button` },
                  { label: "Codes used", value: String(r.track.codes.orders), note: `${fmt(r.track.codes.revenue)} in orders · next order ${r.track.codes.byKind.next}, friend ${r.track.codes.byKind.friend}, late order ${r.track.codes.byKind.delay}, offers ${r.track.codes.byKind.offer}` },
                  { label: "Sales kept by return saving", value: data.kept ? `${(data.kept.credit + data.kept.exchanges).toFixed(2)} ${data.kept.currency}` : "No data yet", note: data.kept ? `${data.kept.count} return${data.kept.count === 1 ? "" : "s"} paid back as store credit or exchanged instead of refunded` : "Return saving rules (Pro)" },
                ].map((k) => (
                  <div key={k.label} className={css.tile}>
                    <span className={css.label}>{k.label}</span>
                    <span className={/\d/.test(k.value) ? css.value : css.valueText}>{k.value}</span>
                    <span className={css.note}>{k.note}</span>
                  </div>
                ))}
              </div>
              <s-text color="subdued">Real orders only. Items are counted when the page added them to a new cart (marked on the cart line); codes when an order used a code the Track page gave. An order that used a code and also has a marked item shows in both.</s-text>
            </s-stack>
          </s-section>
        ) : null}

        {tab === "holdout" ? (
        <s-section heading="Holdout test">
          <s-stack gap="base">
            <s-text color="subdued">A share of shoppers (picked at random, kept for their visits) see your store without the app’s widgets. Orders from each group are compared. It&apos;s the honest way to know what the app adds.</s-text>
            <s-text color="subdued">The loyalty program stays visible to both groups, so members always see their points.</s-text>
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
              <div className={css.tiles2}>
                <div className={css.tile}>
                  <span className={css.label}>See the app</span>
                  <span className={css.value}>{fmt(r.groups.app.revenue)}</span>
                  <span className={css.note}>{`${r.groups.app.orders} orders`}</span>
                </div>
                <div className={css.tile}>
                  <span className={css.label}>{`Holdout (${data.xp.holdout}%)`}</span>
                  <span className={css.value}>{fmt(r.groups.holdout.revenue)}</span>
                  <span className={css.note}>{`${r.groups.holdout.orders} orders`}</span>
                </div>
              </div>
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
