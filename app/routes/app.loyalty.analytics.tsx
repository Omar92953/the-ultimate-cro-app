/**
 * Loyalty (Pro) → Analytics: members over time, points earned and spent, rewards redeemed and the orders that used
 * their codes, referral sales, and the repeat purchase rate of members against other customers, for 30 or 90 days.
 * Data: lib/loyalty/analytics.server.ts.
 */
import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { gql } from "../lib/admin.server";
import { getProgram } from "../lib/loyalty/program.server";
import { loyaltyAnalytics, type Period } from "../lib/loyalty/analytics.server";
import { HomeRow, HomeRows, PageIntro, Panel, Segmented, StatGrid, StatTile } from "../components/ui";
import { FeatureTabs } from "../components/FeatureNav";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [data, program, shop] = await Promise.all([
    loyaltyAnalytics(admin, session.shop),
    getProgram(session.shop),
    gql(admin, `#graphql query CroLoyaltyCurrency { shop { currencyCode } }`).catch(() => null),
  ]);
  return { ...data, unit: program.config.unit.many, currency: (shop?.shop?.currencyCode as string) ?? "USD" };
};

const pct = (n: number | null) => (n === null ? "No orders yet" : `${n.toFixed(n % 1 ? 1 : 0)}%`);

export default function LoyaltyAnalytics() {
  const d = useLoaderData<typeof loader>();
  const [days, setDays] = useState<`${Period}`>("30");
  const s = d.periods[Number(days) as Period];
  const money = (v: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: d.currency, maximumFractionDigits: 0 }).format(v);
    } catch {
      return `${v.toFixed(0)} ${d.currency}`;
    }
  };
  const Unit = `${d.unit[0].toUpperCase()}${d.unit.slice(1)}`;
  const peak = Math.max(1, ...s.members.growth.map((g) => g.total));
  const lift = s.repeat.members !== null && s.repeat.others !== null ? Math.round((s.repeat.members - s.repeat.others) * 10) / 10 : null;

  return (
    <s-page heading="Loyalty program" inlineSize="large">
      <HomeRows>
        <FeatureTabs feature="loyalty" />
        <PageIntro text="What the program does for your store: members, points, rewards, referrals, and whether members come back more often than other customers." />
        <Segmented<`${Period}`>
          label="Period"
          value={days}
          onChange={setDays}
          options={[
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 90 days" },
          ]}
        />
        {d.ordersError ? (
          <s-banner tone="warning" heading="Orders could not be read">
            Members, points and rewards are shown; orders with reward codes and the repeat purchase rate need the store&apos;s orders. {d.ordersError}
          </s-banner>
        ) : null}

        <HomeRow title="Members" bare>
          <Panel>
            <StatGrid>
              <StatTile label="Members" value={s.members.total.toLocaleString()} note={`${s.members.joined.toLocaleString()} joined in the period`} />
              <StatTile label="Repeat purchase rate, members" value={pct(s.repeat.members)} note={`${s.repeat.memberCustomers.toLocaleString()} members ordered in the period`} />
              <StatTile label="Repeat purchase rate, others" value={pct(s.repeat.others)} note={`${s.repeat.otherCustomers.toLocaleString()} other customers ordered`} />
              <StatTile label="Difference" value={lift === null ? "Not enough orders" : `${lift >= 0 ? "+" : ""}${lift} points`} note="Members against other customers" />
            </StatGrid>
          </Panel>
        </HomeRow>

        <HomeRow title="Members over time" subtitle="Members at the end of each week, and how many joined that week.">
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Week ending</s-table-header>
              <s-table-header format="numeric">Joined</s-table-header>
              <s-table-header format="numeric">Members</s-table-header>
              <s-table-header> </s-table-header>
            </s-table-header-row>
            <s-table-body>
              {s.members.growth.map((g) => (
                <s-table-row key={g.end}>
                  <s-table-cell>{new Date(g.end).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</s-table-cell>
                  <s-table-cell>{g.joined.toLocaleString()}</s-table-cell>
                  <s-table-cell>{g.total.toLocaleString()}</s-table-cell>
                  <s-table-cell>
                    <span aria-hidden style={{ display: "block", height: 8, minWidth: 2, width: `${Math.round((g.total / peak) * 100)}%`, borderRadius: 4, background: "var(--s-color-bg-fill-brand, #303030)" }} />
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </HomeRow>

        <HomeRow title={Unit} bare>
          <Panel>
            <StatGrid>
              <StatTile label="Earned" value={s.points.earned.toLocaleString()} note="Orders, accounts, referrals, reviews and other ways to earn" />
              <StatTile label="Spent on rewards" value={s.points.spent.toLocaleString()} note={`${s.rewards.redeemed.toLocaleString()} rewards redeemed`} />
              <StatTile label="Expired" value={s.points.expired.toLocaleString()} note={s.points.takenBack ? `${s.points.takenBack.toLocaleString()} taken back after refunds` : "Nothing taken back after refunds"} />
              <StatTile label="Changed by the store" value={Math.abs(s.points.byStore).toLocaleString()} note={`${s.points.byStore < 0 ? "Taken away" : "Added"} by hand and by CSV import`} />
            </StatGrid>
          </Panel>
        </HomeRow>

        <HomeRow title="Rewards and referrals" bare>
          <Panel>
            <StatGrid>
              <StatTile label="Orders with a reward code" value={s.rewards.orders.toLocaleString()} note={`${money(s.rewards.revenue)} in sales`} />
              <StatTile label="Referral sales" value={money(s.referrals.sales)} note={`${s.referrals.orders.toLocaleString()} first orders from referred friends`} />
              <StatTile label="Affiliate sales" value={money(s.referrals.affiliateSales)} note={`${s.referrals.affiliateOrders.toLocaleString()} orders with an affiliate code`} />
              <StatTile label="Rewards given" value={money(s.rewards.value)} note="Store credit and amounts off redeemed in the period" />
            </StatGrid>
          </Panel>
        </HomeRow>

        {s.rewards.top.length ? (
          <HomeRow title="Rewards redeemed most">
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Reward</s-table-header>
                <s-table-header format="numeric">Redeemed</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {s.rewards.top.map((r) => (
                  <s-table-row key={r.title}>
                    <s-table-cell>{r.title}</s-table-cell>
                    <s-table-cell>{r.count.toLocaleString()}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          </HomeRow>
        ) : null}

        <s-text color="subdued">
          {`Repeat purchase rate: of the customers who ordered in the period, the share who ordered at least twice. Orders with a reward code are orders that used a code the program gave (tag cro-loyalty). Real orders only, not cancelled, not test orders.${d.capped ? " This store has many orders: the newest 10,000 are counted." : ""}`}
        </s-text>
      </HomeRows>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
