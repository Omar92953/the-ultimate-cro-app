/**
 * Loyalty (Pro) home: the program switch, the last 30 days, the setup steps and the latest points changes.
 * Earning rules are on /app/loyalty/earn, members on /app/loyalty/members. Data: lib/loyalty/program.server.ts.
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { errorMessage } from "../lib/admin.server";
import { area } from "../lib/catalog";
import { getProgram, programStats, setProgramOn } from "../lib/loyalty/program.server";
import { syncShop } from "../lib/loyalty/sync.server";
import { syncReferralDiscounts } from "../lib/loyalty/referrals.server";
import { loyaltyAccess, planned } from "../lib/loyalty/plan.server";
import { publishLoyalty } from "../lib/loyalty/storefront.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { pointsLabel } from "../lib/loyalty/config";
import { eventLabel } from "../lib/loyalty/labels";
import { Button, Switch } from "../components/fields";
import { HomeRow, HomeRows, PageIntro, Panel, Pill, Segmented, StatGrid, StatTile } from "../components/ui";
import { FeatureTabs } from "../components/FeatureNav";
import { useEmailsReady } from "../components/Upgrade";
import { UsageBars } from "../components/UsageBars";
import css from "../components/TrackingHub.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const [program, stats, latest, theme] = await Promise.all([
    getProgram(shop),
    programStats(shop),
    db.loyaltyEvent.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, kind: true, points: true, note: true, status: true, createdAt: true, memberId: true } }),
    getThemeStatus(admin, shop).catch(() => null),
  ]);
  const members = await db.loyaltyMember.findMany({ where: { id: { in: [...new Set(latest.map((e) => e.memberId))] } }, select: { id: true, email: true } });
  return {
    on: program.on,
    saved: program.saved,
    syncedAt: program.syncedAt?.toISOString() ?? null,
    config: program.config,
    embedOn: theme ? theme.installed.boosters : null,
    embedLink: sectionLinks(shop).boosters,
    stats,
    latest: latest.map((e) => ({ ...e, createdAt: e.createdAt.toISOString(), email: members.find((m) => m.id === e.memberId)?.email ?? "" })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const intent = String(form.get("intent"));
    if (intent === "on") {
      const on = form.get("on") === "true";
      await setProgramOn(session.shop, on, Number(form.get("past") ?? 0));
      await publishLoyalty(admin, session.shop);
      // Referral and affiliate codes work only while the program is on.
      const access = await loyaltyAccess(admin, session.shop);
      const errors = await syncReferralDiscounts(admin, session.shop, planned((await getProgram(session.shop)).config, access), on && access.on);
      if (errors.length) return { ok: false, error: errors.join(" "), intent };
    }
    else if (intent === "sync") await syncShop(session.shop, admin);
    return { ok: true, error: null, intent };
  } catch (e) {
    return { ok: false, error: errorMessage(e), intent: "" };
  }
};

const day = (s: string) => new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function LoyaltyHome() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const emails = useEmailsReady();
  const shopify = useAppBridge();
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
    else shopify.toast.show(fetcher.data.intent === "sync" ? "Orders checked" : "Saved");
  }, [fetcher.state, fetcher.data, shopify]);
  const c = d.config;
  const s = d.stats;
  const on = fetcher.formData?.get("intent") === "on" ? fetcher.formData.get("on") === "true" : d.on;
  const [past, setPast] = useState("0");

  return (
    <s-page heading="Loyalty program" inlineSize="large">
      <Button slot="primary-action" variant="primary" href="/app/loyalty/earn">
        Earning rules
      </Button>
      <HomeRows>
        <FeatureTabs feature="loyalty" />
        <PageIntro text={area("loyalty").intro} />

        <HomeRow title="Program">
          <s-stack gap="small-200">
            <Switch
              label="Loyalty program is on"
              details={on ? "Paid orders and new accounts earn points. Turning it off stops earning; members keep their points." : "Off: nothing is earned. Turning it on, orders paid from now on earn points."}
              checked={on}
              onValue={(v) => fetcher.submit({ intent: "on", on: String(v), past }, { method: "post" })}
            />
            {!d.on && !d.syncedAt ? (
              <s-stack gap="small-200">
                <s-text>Which orders earn points when it starts</s-text>
                <Segmented
                  label="Which orders earn points when it starts"
                  value={past}
                  onChange={setPast}
                  options={[
                    { value: "0", label: "From now on" },
                    { value: "30", label: "Also the last 30 days" },
                    { value: "90", label: "Also the last 90 days" },
                  ]}
                />
              </s-stack>
            ) : null}
            {on && d.syncedAt ? (
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-text color="subdued">{`New orders and accounts are checked every 10 minutes. Last check: ${new Date(d.syncedAt).toLocaleString()}.`}</s-text>
                <Button variant="tertiary" loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "sync"} onClick={() => fetcher.submit({ intent: "sync" }, { method: "post" })}>
                  Check now
                </Button>
              </s-stack>
            ) : null}
          </s-stack>
        </HomeRow>

        <HomeRow title="This month's limits">
          <UsageBars only={["loyaltyOrders", "loyaltyEmails"]} />
        </HomeRow>

        <HomeRow title="Last 30 days" bare>
          <Panel>
            <StatGrid>
              <StatTile label="Members" value={s.members.toLocaleString()} note={`${s.newMembers} joined in the last 30 days`} />
              <StatTile label={`${c.unit.many[0].toUpperCase()}${c.unit.many.slice(1)} earned`} value={s.earned.toLocaleString()} note={s.takenBack ? `${s.takenBack.toLocaleString()} taken back after refunds` : "From orders, first orders and accounts"} />
              <StatTile label="Ready to use" value={s.points.toLocaleString()} note={s.pending ? `${s.pending.toLocaleString()} more after the pending days` : "Held by all members"} />
              <StatTile label="Expired" value={s.expired.toLocaleString()} note={c.expiry.on ? `After ${c.expiry.days} days without activity` : "Points don't expire"} />
            </StatGrid>
          </Panel>
        </HomeRow>

        <HomeRow title="Set up">
          <div className={css.checks}>
            {[
              { done: d.saved, title: "Choose how members earn", text: `Now: ${pointsLabel(c, Math.max(1, Math.round(c.earn.order.perUnit)))} per 1 of your currency on paid orders${c.earn.signup.on ? `, ${pointsLabel(c, c.earn.signup.points)} for a new account` : ""}${c.pendingDays ? `, usable after ${c.pendingDays} days` : ""}.`, href: "/app/loyalty/earn", label: "Earning rules" },
              { done: c.rewards.some((r) => r.on), title: "Choose the rewards", text: c.rewards.filter((r) => r.on).map((r) => `${r.title} for ${pointsLabel(c, r.points)}`).join(", ") || "Nothing members can spend points on yet.", href: "/app/loyalty/rewards", label: "Rewards" },
              { done: d.embedOn === true, title: "Show the widget on your store", text: "Turn on the Conversion boosters embed in your theme (App embeds). The rewards button shows on every page.", href: d.embedOn === true ? undefined : d.embedLink, label: "Open the theme editor", external: true },
              ...(emails ? [{ done: c.emails.on, title: "Turn on emails", text: c.emails.on ? `Members get their emails${c.emails.sender.email ? ` from ${c.emails.sender.email}` : ""}.` : "Tell members what they earned and when a reward is ready. Send from your own address for better inbox placement.", href: "/app/loyalty/emails", label: "Emails" }] : []),
              { done: on, title: "Turn the program on", text: "Choose which orders earn above and switch it on.", href: undefined, label: "" },
            ].map((x, n) => (
              <div key={x.title} className={css.check}>
                <div className={css.checkMain}>
                  <span className={`${css.num} ${x.done ? css.numDone : ""}`}>{x.done ? "✓" : n + 1}</span>
                  <span className={css.checkText}>
                    <strong>{x.title}</strong>
                    {x.text}
                  </span>
                </div>
                {x.href ? (
                  <Button href={x.href} target={"external" in x && x.external ? "_top" : undefined}>
                    {x.label}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </HomeRow>

        <HomeRow title="Latest changes" action={<Button variant="tertiary" href="/app/loyalty/members">All members</Button>}>
          {d.latest.length ? (
            <div className={css.list}>
              {d.latest.map((e) => (
                <div key={e.id} className={css.item}>
                  <span>{`${e.email || "A member"} · ${eventLabel(e.kind, e.note)} · ${day(e.createdAt)}`}</span>
                  <Pill tone={e.points >= 0 ? "ok" : undefined}>{`${e.points > 0 ? "+" : ""}${e.points.toLocaleString()}${e.status === "pending" ? " pending" : ""}`}</Pill>
                </div>
              ))}
            </div>
          ) : (
            <s-text color="subdued">No points yet. When a member&apos;s order is paid, its points show here.</s-text>
          )}
        </HomeRow>
      </HomeRows>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
