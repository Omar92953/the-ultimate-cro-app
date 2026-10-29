/**
 * Offers hub: an Overview first (this month's numbers and every offer in one list with its own sales), then the
 * four groups as cards (catalog.ts OFFER_GROUPS) and A/B tests. "Create offer" opens the type picker
 * (/app/offers/new). Sales per offer come from the order results (results.server.ts byOffer).
 */
import { withScheduleLabels } from "../lib/schedule.server";
import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { listOffers } from "../lib/offers.server";
import { cachedResults } from "../lib/value.server";
import { OFFER_TYPES } from "../lib/offer-types";
import { recipe } from "../lib/bundle-recipes";
import { OFFER_GROUPS, area, type OfferGroupKey } from "../lib/catalog";
import { PLANS, limitOf, planAbove } from "../lib/plans";
import { change, money } from "../lib/format";
import { Button, Select, TextField } from "../components/fields";
import { GroupCards, HomeRow, HomeRows, PageIntro, Panel, Pill, StatGrid, StatTile } from "../components/ui";
import { OfferList, offerStats } from "../components/OfferList";
import { UpgradeButton, usePlan } from "../components/Upgrade";
import { isLocked } from "../lib/plan-gate";
import { DemoButton } from "../components/DemoButton";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [offers, results] = await Promise.all([listOffers(admin).then((rows) => withScheduleLabels(admin, session.shop, rows)), cachedResults(admin, session.shop)]);
  return { offers, results: results ? { currency: results.currency, byOffer: results.byOffer, offers: results.offers } : null };
};

export default function OffersHub() {
  const { offers, results } = useLoaderData<typeof loader>();
  const { plan, trial } = usePlan();
  const [group, setGroup] = useState<"all" | OfferGroupKey>("all");
  const [status, setStatus] = useState<"all" | "on" | "off">("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = offers.filter(
    (o) => (group === "all" || OFFER_TYPES[o.type].group === group) && (status === "all" || (status === "on") === o.active) && (!q || o.name.toLowerCase().includes(q)),
  );
  const onIn = (g: OfferGroupKey) => offers.filter((o) => o.active && OFFER_TYPES[o.type].group === g).length;
  const on = offers.filter((o) => o.active).length;
  const slots = limitOf(plan, "offerSlots");
  const next = slots === null ? null : planAbove("offerSlots", slots, plan);
  const cur = results?.offers.current;
  const prev = results?.offers.previous;
  const currency = results?.currency ?? "USD";
  const aovWith = cur && cur.appOrders ? cur.appOrdersTotal / cur.appOrders : null;
  const aovWithout = cur && cur.orders - cur.appOrders > 0 ? (cur.revenue - cur.appOrdersTotal) / (cur.orders - cur.appOrders) : null;

  return (
    <s-page heading="Offers" inlineSize="large">
      <Button slot="primary-action" variant="primary" href="/app/offers/new">
        Create offer
      </Button>
      <HomeRows>
        <PageIntro text={area("offers").intro} />

        <HomeRow
          title="Overview"
          subtitle="Last 30 days, from your real orders."
          action={next ? <UpgradeButton to={next} variant={slots !== null && on >= slots ? "primary" : "secondary"} /> : null}
          bare
        >
          <s-stack gap="base">
              <Panel>
              <StatGrid>
                <StatTile
                  label="Offers on"
                  value={slots === null ? String(on) : `${Math.min(on, slots)} of ${slots}`}
                  note={slots === null ? "Unlimited offers on your plan" : `Offer slots used${next ? `. ${PLANS[next].name} has unlimited offers.` : ""}`}
                />
                <StatTile label="Sales from offers" value={cur ? money(cur.appRevenue, currency) : "No data yet"} change={cur && prev ? change(cur.appRevenue, prev.appRevenue) : null} />
                <StatTile label="Orders with offers" value={cur ? String(cur.appOrders) : "No data yet"} change={cur && prev ? change(cur.appOrders, prev.appOrders) : null} />
                <StatTile
                  label="Average order with offers"
                  value={aovWith !== null ? money(aovWith, currency) : "No data yet"}
                  note={aovWithout !== null ? `${money(aovWithout, currency)} without` : undefined}
                />
              </StatGrid>
              </Panel>
            <OfferList
              title="All offers"
              currency={currency}
              measured={!!results}
              create={{ href: "/app/offers/new", label: "Create offer" }}
              empty={{ title: "Create your first offer", text: "Pick any kind of offer: upsell, cross sell, bundle or discount. It shows in this list with its sales." }}
              noMatch={offers.length && !shown.length ? "No offers match these filters." : undefined}
              filters={
                offers.length ? (
                  <s-grid gridTemplateColumns="minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)" gap="base" alignItems="end">
                    <TextField label="Search" placeholder="Search offers" value={query} onValue={setQuery} />
                    <Select
                      label="Group"
                      value={group}
                      onValue={(v) => setGroup(v as typeof group)}
                      options={[{ value: "all", label: "All groups" }, ...OFFER_GROUPS.map((g) => ({ value: g.key, label: g.title }))]}
                    />
                    <Select
                      label="Status"
                      value={status}
                      onValue={(v) => setStatus(v as typeof status)}
                      options={[
                        { value: "all", label: "All" },
                        { value: "on", label: "On" },
                        { value: "off", label: "Off" },
                      ]}
                    />
                  </s-grid>
                ) : undefined
              }
              rows={(offers.length ? shown : []).map((o) => ({
                key: `${o.type}-${o.id}`,
                name: o.name,
                href: o.href,
                active: o.active,
                type: o.recipe ? recipe(o.recipe).short : OFFER_TYPES[o.type].title,
                detail: o.where,
                stats: o.statKeys === null ? null : offerStats(results?.byOffer, o.statKeys),
              }))}
            />
          </s-stack>
        </HomeRow>

        <HomeRow title="Offer types" subtitle="Every kind of offer, grouped." bare>
          <GroupCards
            items={OFFER_GROUPS.map((g) => {
              const n = onIn(g.key);
              return {
                key: g.key,
                title: g.title,
                about: g.about,
                href: g.tabs[0].href,
                locked: g.features.every((f) => isLocked(plan, f, trial)),
                action: <DemoButton feature={g.key === "cross_sell" ? "cross_sell" : g.key} slot="" variant="tertiary" />,
                status: n ? <Pill tone="ok">{`${n} on`}</Pill> : <Pill>Not set up</Pill>,
                chips: g.chips ?? g.tabs.filter((t) => t.label !== "Style").map((t) => t.label),
              };
            })}
          />
        </HomeRow>

        <HomeRow title="A/B tests" action={isLocked(plan, "ab_tests", trial) ? <Pill>Pro plan</Pill> : null}>
          <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
            <s-text color="subdued">Show half of your shoppers another version of an upsell or cross sell and see which earns more.</s-text>
            <Button href="/app/offers/tests">{isLocked(plan, "ab_tests", trial) ? "See how it works" : "Open A/B tests"}</Button>
          </s-stack>
        </HomeRow>
      </HomeRows>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
