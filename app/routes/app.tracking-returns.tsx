/**
 * Tracking & Returns, in two tabs (?tab=returns). Each tab: the last 30 days in numbers, the shopper's page as it
 * looks now (with what it shows and a button to customise it), what the page sells or saves, and its own setup
 * steps. Tracking uses what Shopify knows about each shipment, or live tracking (app/lib/tracking); returns are
 * real Shopify returns (app/lib/shopify-returns.server.ts). Numbers come from the app's own tables (TrackStat,
 * TrackingCache, TrackCode, ReturnRequest) and Shopify's fulfillments. Plan: Growth (plans.ts).
 */
import { useEffect, type CSSProperties, type ReactNode } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getThemeStatus } from "../lib/cro.server";
import { errorMessage } from "../lib/admin.server";
import { createOrderPage, orderPageContext, pageAdminUrl, type OrderPageKind } from "../lib/order-page-setup.server";
import { planContext } from "../lib/rules.server";
import { atLeast } from "../lib/plans";
import { getTrackingConfig } from "../lib/tracking/tracking.server";
import { getTrackOffers } from "../lib/track-offers.server";
import { TRACK_OFFER_KINDS } from "../lib/track-offers";
import { listReturns, returnSavings, shipmentOverview } from "../lib/orders-lookup.server";
import { getReturnRules, grantedScopes, syncReturns } from "../lib/shopify-returns.server";
import { getTrackSell, lookupsSince } from "../lib/track-sell.server";
import { DEFAULT_TRACK_SELL } from "../lib/track-sell";
import { getOrderPage } from "../lib/designs.server";
import { ORDER_PAGE_PRESETS, applyOrderPagePreset } from "../lib/order-pages";
import { codeGroup } from "../lib/results.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { remember } from "../lib/short-cache.server";
import { timedLoader } from "../lib/timing.server";
import { RETURN_STATES, returnState } from "../lib/return-rules";
import { change, money } from "../lib/format";
import { Button } from "../components/fields";
import { HomeRow, HomeRows, LinkTiles, PageIntro, Panel, Pill, StatGrid, StatTile, Tabs } from "../components/ui";
import { DemoButton } from "../components/DemoButton";
import { OrderPagePreview, type PreviewSells } from "../components/OrderPagePreview";
import { ThemeLook } from "../components/ThemeStyle";
import { templateInUse } from "../components/LookPicker";
import css from "../components/TrackingHub.module.css";

const DAY = 86_400_000;

export const loader = timedLoader("app.tracking-returns", async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  await syncReturns(admin, shop).catch(() => null);
  const since = new Date(Date.now() - 30 * DAY);
  const [returns, theme, rules, scopes, shipments, savings, trackOffers, trackPage, returnsPage, sell, style, lookups, lookups60, tracked, codes] = await Promise.all([
    listReturns(shop).catch(() => []),
    getThemeStatus(admin, shop).catch(() => null),
    getReturnRules(admin).catch(() => null),
    grantedScopes(admin).catch(() => [] as string[]),
    remember(shop, "shipments", 5 * 60000, () => shipmentOverview(admin)).catch(() => null),
    returnSavings(shop).catch(() => null),
    getTrackOffers(admin).catch(() => ({ offers: [] })),
    getOrderPage(admin, "track"),
    getOrderPage(admin, "returns"),
    getTrackSell(admin).catch(() => ({ sell: DEFAULT_TRACK_SELL, saved: false })),
    getThemeStyle(admin, shop).catch(() => FALLBACK_STYLE),
    lookupsSince(shop, 30).catch(() => 0),
    lookupsSince(shop, 60).catch(() => 0),
    db.trackingCache.groupBy({ by: ["via"], where: { shop, createdAt: { gte: since } }, _count: { _all: true } }).catch(() => []),
    db.trackCode.groupBy({ by: ["kind"], where: { shop, createdAt: { gte: since }, NOT: { kind: "shared" } }, _count: { _all: true } }).catch(() => []),
  ]);
  const pctx = await planContext(admin, shop);
  const tracking = await getTrackingConfig(shop, pctx.plan).catch(() => null);
  const ctx = await orderPageContext(admin, shop, theme);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  // Returns asked for in the last 30 days, and the 30 days before (for the change).
  const recent = returns.filter((r) => Date.parse(r.createdAt) >= since.getTime());
  const before = returns.filter((r) => Date.parse(r.createdAt) >= since.getTime() - 30 * DAY && Date.parse(r.createdAt) < since.getTime());
  const viaCount = (v: string) => tracked.find((t) => t.via === v)?._count._all ?? 0;
  const codeCount = { next: 0, friend: 0, delay: 0, offer: 0 };
  for (const c of codes) {
    const g = codeGroup(c.kind);
    if (g) codeCount[g] += c._count._all;
  }
  const offers = trackOffers.offers.map((o) => ({ id: o.id, name: o.name, active: o.active, slot: o.slot, kind: o.kind, headline: o.headline, text: o.text, button: o.button }));
  return {
    shop,
    returns: returns.slice(0, 5),
    counts: {
      requested: returns.filter((r) => returnState(r.status) === "requested").length,
      approved: returns.filter((r) => returnState(r.status) === "approved").length,
      refunded: returns.filter((r) => r.refundedAt && Date.parse(r.refundedAt) >= monthStart.getTime()).length,
      asked: recent.length,
      askedBefore: before.length,
      declined: recent.filter((r) => returnState(r.status) === "declined").length,
    },
    track: {
      lookups,
      lookupsBefore: Math.max(0, lookups60 - lookups),
      // Shipments followed beyond Shopify's own data (Shopify's own answers aren't stored).
      tracked: { live: viaCount("live"), own: viaCount("own"), webhook: viaCount("webhook") },
      codes: codeCount,
    },
    shipments,
    savings,
    offers,
    sell: sell.sell,
    design: { track: trackPage.config, returns: returnsPage.config, trackSaved: trackPage.saved, returnsSaved: returnsPage.saved },
    style,
    css: storefrontCss("ucs-sections.css"),
    creditWhen: rules?.rules.saving.creditWhen ?? "received",
    saving: rules ? { credit: rules.rules.saving.credit?.on ?? false, exchange: rules.rules.saving.exchange?.on ?? false } : null,
    pro: atLeast(pctx.plan, "pro"),
    tracking: tracking ? { chosen: tracking.chosen, source: tracking.source, used: tracking.live.used, limit: tracking.live.limit } : null,
    inTheme: theme ? { track: ctx.inPageTemplate, returns: ctx.inPageTemplate } : null,
    pages: { track: ctx.pages.track ? { handle: ctx.pages.track.handle, admin: pageAdminUrl(shop, ctx.pages.track) } : null, returns: ctx.pages.returns ? { handle: ctx.pages.returns.handle, admin: pageAdminUrl(shop, ctx.pages.returns) } : null },
    links: { track: ctx.links.track, returns: ctx.links.returns },
    rulesSaved: !!rules?.saved,
    hasAddress: !!rules?.rules.address,
    scopes: { returns: scopes.includes("write_returns") && scopes.includes("read_returns"), allOrders: scopes.includes("read_all_orders") },
  };
});

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const which = String(form.get("which"));
    const kinds: OrderPageKind[] = which === "track" ? ["track"] : which === "returns" ? ["returns"] : ["track", "returns"];
    for (const k of kinds) await createOrderPage(admin, k);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
};

/** The two tabs show the same data: switching only changes the address. */
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl, formMethod, defaultShouldRevalidate }) =>
  !formMethod && currentUrl.pathname === nextUrl.pathname ? false : defaultShouldRevalidate;

type Data = ReturnType<typeof useLoaderData<typeof loader>>;
/** The two shopper pages this hub shows (the wishlist page lives in the Section library). */
type PageKind = "track" | "returns";
type Check = { done: boolean; title: string; text: string; action?: { label: string; href?: string; external?: boolean; onClick?: () => void; loading?: boolean } };

/** Numbered steps, in the order to do them; each turns green when the app can see it is done. */
function Checks({ checks }: { checks: Check[] }) {
  return (
    <div className={css.checks}>
      {checks.map((c, n) => (
        <div key={c.title} className={css.check}>
          <div className={css.checkMain}>
            <span className={`${css.num} ${c.done ? css.numDone : ""}`} aria-label={c.done ? "Done" : "To do"}>
              {c.done ? "✓" : n + 1}
            </span>
            <span className={css.checkText}>
              <strong>{c.title}</strong>
              {c.text}
            </span>
          </div>
          {c.action ? (
            <Button variant="secondary" href={c.action.href} onClick={c.action.onClick} loading={c.action.loading} target={c.action.external ? "_top" : undefined}>
              {c.action.label}
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** What a page shows, as on/off chips. */
function Shows({ items }: { items: [string, boolean][] }) {
  return (
    <div className={css.shows}>
      {items.map(([label, on]) => (
        <span key={label} className={`${css.chip} ${on ? "" : css.chipOff}`}>
          <span className={css.dot} aria-hidden="true" />
          {label}
          {on ? null : <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}> (off)</span>}
        </span>
      ))}
    </div>
  );
}

/** The shopper's page as it looks now, drawn small. */
function PageShot({ d, children }: { d: Data; children: ReactNode }) {
  return (
    <div className={css.shot} style={{ "--k": "0.58" } as CSSProperties}>
      <style dangerouslySetInnerHTML={{ __html: d.css }} />
      <div className={css.shotInner}>
        <ThemeLook style={d.style}>{children}</ThemeLook>
      </div>
      <span className={css.shotFade} aria-hidden="true" />
    </div>
  );
}

export default function TrackingReturns() {
  const d = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const tab = params.get("tab") === "returns" ? "returns" : "tracking";
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show("Pages ready");
    else shopify.toast.show(fetcher.data.error || "Could not make the pages", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const making = fetcher.state !== "idle";
  const make = (which: PageKind | "both") => fetcher.submit({ which }, { method: "post" });
  const pageStatus = (k: PageKind) => (!d.pages[k] ? { tone: "warn" as const, text: "Page not made yet" } : d.inTheme?.[k] ? { tone: "ok" as const, text: "On your store" } : { tone: "warn" as const, text: "Block not added yet" });
  const pageButton = (k: PageKind) =>
    d.pages[k] ? (
      <Button variant="tertiary" href={d.links[k]} target="_top" icon="theme-edit">
        {d.inTheme?.[k] ? "Open in theme editor" : "Add the block"}
      </Button>
    ) : (
      <Button variant="tertiary" loading={making} onClick={() => make(k)}>
        Make the page
      </Button>
    );
  const template = (k: PageKind) => {
    const i = templateInUse(ORDER_PAGE_PRESETS, d.design[k], applyOrderPagePreset);
    return i >= 0 ? ORDER_PAGE_PRESETS[i].title : "Your own style";
  };
  const pagesDone = !!d.pages.track && !!d.pages.returns;
  const pagesStep: Check = {
    done: pagesDone,
    title: "Make the two pages",
    text: pagesDone ? `Your pages are /pages/${d.pages.track!.handle} and /pages/${d.pages.returns!.handle}.` : "The app makes the “Track your order” and “Returns” pages in your store for you.",
    action: pagesDone ? undefined : { label: "Make the pages", onClick: () => make("both"), loading: making },
  };
  const blockStep: Check = {
    done: !!d.inTheme?.track,
    title: "Add the block to your page template",
    text: "One block does both pages: in the theme editor choose Add block, CRO Toolbox, Order & wishlist pages, and save. It shows only on these two pages, so your other pages stay as they are. Then add the pages to your menu or footer.",
    action: d.inTheme?.track ? undefined : { label: "Open the theme editor", href: d.links.track, external: true },
  };

  return (
    <s-page heading="Tracking & Returns" inlineSize="large">
      <DemoButton feature={tab === "returns" ? "returns" : "track"} />
      {tab === "returns" ? (
        <Button slot="primary-action" variant="primary" href="/app/returns">
          Open return requests
        </Button>
      ) : (
        <Button slot="primary-action" variant="primary" href="/app/pages/track">
          Customise the Track page
        </Button>
      )}
      <HomeRows>
        <Tabs
          items={[
            { label: "Tracking", to: "/app/tracking-returns" },
            { label: "Returns", to: "/app/tracking-returns?tab=returns" },
          ]}
        />
        {tab === "tracking" ? <TrackingTab d={d} pageStatus={pageStatus} pageButton={pageButton} template={template} steps={[pagesStep, blockStep]} /> : <ReturnsTab d={d} pageStatus={pageStatus} pageButton={pageButton} template={template} steps={[pagesStep, blockStep]} />}
      </HomeRows>
    </s-page>
  );
}

type TabProps = {
  d: Data;
  pageStatus: (k: PageKind) => { tone: "ok" | "warn"; text: string };
  pageButton: (k: PageKind) => ReactNode;
  template: (k: PageKind) => string;
  steps: Check[];
};

function TrackingTab({ d, pageStatus, pageButton, template, steps }: TabProps) {
  const t = d.track;
  const tracked = t.tracked.live + t.tracked.own + t.tracked.webhook;
  const viaNote = [
    t.tracked.live ? `${t.tracked.live} live` : "",
    t.tracked.own ? `${t.tracked.own} with your key` : "",
    t.tracked.webhook ? `${t.tracked.webhook} by webhook` : "",
  ].filter(Boolean).join(", ");
  const codesGiven = t.codes.next + t.codes.friend + t.codes.delay + t.codes.offer;
  const source = d.tracking?.source ?? "shopify";
  const sourceName = { shopify: "Shopify's tracking data", live: "Live tracking", own: "Your own tracking key", webhook: "A webhook link" }[source];
  const above = d.offers.find((o) => o.slot === "above" && o.active) ?? null;
  const below = d.offers.find((o) => o.slot === "below" && o.active) ?? null;
  const sells: PreviewSells = { next: d.sell.nextOrder.on, buyAgain: d.sell.buyAgain.on, after: d.sell.afterDelivery.on, late: d.sell.delay.on, offers: { above, below } };
  const status = pageStatus("track");
  const offerTile = (slot: "above" | "below") => {
    const live = slot === "above" ? above : below;
    const paused = d.offers.filter((o) => o.slot === slot && !o.active).length;
    return {
      key: `offer-${slot}`,
      title: slot === "above" ? "Offer above the tracking" : "Offer below the tracking",
      sub: live ? `${live.name} · ${TRACK_OFFER_KINDS[live.kind].title}` : paused ? `${paused} paused` : "A cross sell, free shipping, a free gift or a discount, with a real code that expires.",
      href: live ? `/app/offers/track/${live.id}` : "/app/offers/track/new",
      end: d.pro ? <Pill tone={live ? "ok" : undefined}>{live ? "On" : "Add one"}</Pill> : <Pill>Pro plan</Pill>,
    };
  };
  const sellTile = (key: string, title: string, sub: string, on: boolean) => ({ key, title, sub, href: "/app/pages/track?open=show", end: <Pill tone={on ? "ok" : undefined}>{on ? "On" : "Off"}</Pill> });

  return (
    <>
      <PageIntro
        text={
          <>
            <strong>Turn every order lookup into the next sale.</strong> Shoppers check their order on your Track page, and the page offers them a next order discount, buy again and products that go with what they bought.
          </>
        }
      />

      <HomeRow title="Last 30 days" subtitle="From your Track page and your orders." bare>
        <Panel>
          <StatGrid>
            <StatTile label="Order lookups" value={String(t.lookups)} change={change(t.lookups, t.lookupsBefore)} note="Times shoppers checked an order" />
            <StatTile
              label="Shipments"
              value={d.shipments ? String(d.shipments.total) : "No data yet"}
              note={d.shipments ? `${d.shipments.delivered} delivered, ${d.shipments.inTransit} on the way, ${d.shipments.delayed} past the expected date` : undefined}
            />
            <StatTile label="Tracked beyond Shopify" value={String(tracked)} note={viaNote || (source === "shopify" ? "Uses Shopify's data, which is free" : "None yet")} />
            {source === "live" && d.tracking ? (
              <StatTile label="Live tracking left this month" value={String(Math.max(0, d.tracking.limit - d.tracking.used))} note={`${d.tracking.used} of ${d.tracking.limit} shipments used`} />
            ) : null}
            <StatTile label="Codes given" value={String(codesGiven)} note={codesGiven ? `${t.codes.next} next order, ${t.codes.offer} from offers, ${t.codes.friend} for friends, ${t.codes.delay} for late orders` : "Next order, friend and late order codes"} />
          </StatGrid>
        </Panel>
      </HomeRow>

      <HomeRow title="Your Track page" subtitle="What shoppers see after they look up an order." bare>
        <Panel>
          <div className={css.design}>
            <PageShot d={d}>
              <OrderPagePreview config={d.design.track} step="result" sells={sells} />
            </PageShot>
            <div className={css.about}>
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <Pill tone={status.tone}>{status.text}</Pill>
                <s-text color="subdued">{`Style: ${template("track")}`}</s-text>
              </s-stack>
              <Shows
                items={[
                  ["Items", d.design.track.show.items],
                  ["Expected date", d.design.track.show.estimate],
                  ["Where the parcel is", d.design.track.show.place],
                  ["Tracking history", d.design.track.show.timeline],
                  ["Carrier link", d.design.track.show.link],
                  ["Prices", d.design.track.prices],
                  ["Recommendations", d.design.track.recs.like.on || d.design.track.recs.complete.on],
                  ["Next order discount", d.sell.nextOrder.on],
                  ["Buy again", d.sell.buyAgain.on],
                  ["After delivery message", d.sell.afterDelivery.on],
                  ["Late order apology", d.sell.delay.on],
                  ["Offers", !!(above || below)],
                ]}
              />
              <s-text color="subdued">{`Tracking comes from ${sourceName.toLowerCase()}.`}</s-text>
              <s-stack direction="inline" gap="small-200">
                <Button variant="primary" href="/app/pages/track">
                  Customise the page
                </Button>
                {pageButton("track")}
                <DemoButton feature="track" slot="" variant="tertiary" />
              </s-stack>
            </div>
          </div>
        </Panel>
      </HomeRow>

      <HomeRow title="What the page sells" subtitle="Each one is a real Shopify code or a real cart, with an end date where it matters.">
        <LinkTiles
          items={[
            sellTile("next", "Next order discount", d.sell.nextOrder.on ? `${d.sell.nextOrder.percent}% off, valid ${d.sell.nextOrder.days} days` : "A code for the next order, shown once the order is paid.", d.sell.nextOrder.on),
            sellTile("again", "Buy again", "Adds the same items to a new cart in one click.", d.sell.buyAgain.on),
            sellTile("after", "After delivery message", "A review request, a returns link and a code to share with a friend.", d.sell.afterDelivery.on),
            sellTile("late", "Late order apology", "An apology and a discount or free shipping when the order is late.", d.sell.delay.on),
            offerTile("above"),
            offerTile("below"),
          ]}
        />
      </HomeRow>

      <HomeRow title="Shipments" action={<Button variant="tertiary" href="/app/tracking-source">Where tracking comes from</Button>}>
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-text color="subdued">{`Every shipment of the last 30 days and what your Track page shows for it, with “Check now”. Tracking comes from ${sourceName.toLowerCase()}.`}</s-text>
          <Button href="/app/tracking-shipments">See your shipments</Button>
        </s-stack>
      </HomeRow>

      <HomeRow title="Set up tracking">
        <Checks
          checks={[
            {
              done: !!d.tracking?.chosen,
              title: "Where should tracking come from?",
              text: d.tracking?.chosen ? `In use: ${sourceName}${source === "live" ? ` (${d.tracking.used} of ${d.tracking.limit} shipments this month)` : ""}.` : "Basic tracking uses Shopify's data and is free. Advanced tracking on Pro adds live tracking, your own tracking service key or a webhook link from any carrier.",
              action: { label: d.tracking?.chosen ? "Change" : "Choose", href: "/app/tracking-source" },
            },
            ...steps,
            { done: d.scopes.allOrders, title: "Orders older than 60 days", text: "Shopify only lets the app see the last 60 days of orders until it approves access to all orders. Until then older orders can't be found on the page." },
          ]}
        />
      </HomeRow>
    </>
  );
}

function ReturnsTab({ d, pageStatus, pageButton, template, steps }: TabProps) {
  const s = d.savings;
  const cur = s?.currency || "USD";
  const kept = s ? s.credit.value + s.exchanges.value : 0;
  const keptRate = s && kept + s.refunds.value > 0 ? Math.round((kept / (kept + s.refunds.value)) * 100) : null;
  const status = pageStatus("returns");
  return (
    <>
      <PageIntro
        text={
          <>
            <strong>Keep the sale when a shopper returns.</strong> Your Returns page offers store credit with a bonus or an exchange before a refund, and every request becomes a real Shopify return you approve here.
          </>
        }
      />

      <HomeRow title="Last 30 days" subtitle="From your Returns page and Shopify returns." bare>
        <Panel>
          <StatGrid>
            <StatTile label="Return requests" value={String(d.counts.asked)} change={change(d.counts.asked, d.counts.askedBefore)} note={`${d.counts.requested} new, ${d.counts.approved} waiting for the items, ${d.counts.declined} declined`} />
            <StatTile label="Sales kept" value={s ? money(kept, cur) : "No data yet"} note={s ? `${s.credit.count} as store credit, ${s.exchanges.count} as exchanges` : undefined} />
            <StatTile label="Kept instead of refunded" value={keptRate === null ? "No data yet" : `${keptRate}%`} note="Of the money from returns" />
            <StatTile label="Store credit given" value={s ? money(s.credit.value, cur) : "No data yet"} note={s ? `${s.credit.bonus ? `${money(s.credit.bonus, cur)} of it bonus. ` : ""}${s.credit.waiting.count ? `${money(s.credit.waiting.value, cur)} waiting for the items` : "Stays in your store as a sale to come"}` : undefined} />
            <StatTile label="Refunded" value={s ? money(s.refunds.value, cur) : "No data yet"} note={s ? `${s.refunds.count} return${s.refunds.count === 1 ? "" : "s"}` : undefined} />
          </StatGrid>
        </Panel>
      </HomeRow>

      <HomeRow title="Your Returns page" subtitle="Where shoppers find their order and choose what to send back." bare>
        <Panel>
          <div className={css.design}>
            <PageShot d={d}>
              <OrderPagePreview config={d.design.returns} step="form" />
            </PageShot>
            <div className={css.about}>
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <Pill tone={status.tone}>{status.text}</Pill>
                <s-text color="subdued">{`Style: ${template("returns")}`}</s-text>
              </s-stack>
              <Shows
                items={[
                  ["Store credit instead of a refund", !!d.saving?.credit],
                  ["Exchange for another size or colour", !!d.saving?.exchange],
                  [`Return window: ${d.design.returns.rules.days ? `${d.design.returns.rules.days} days` : "any time"}`, true],
                ]}
              />
              <s-text color="subdued">{d.creditWhen === "received" ? "Credit is given when the items are received." : "Credit is given when a return is approved."}</s-text>
              <s-stack direction="inline" gap="small-200">
                <Button variant="primary" href="/app/pages/returns">
                  Customise the page
                </Button>
                {pageButton("returns")}
                <DemoButton feature="returns" slot="" variant="tertiary" />
              </s-stack>
            </div>
          </div>
        </Panel>
      </HomeRow>

      <HomeRow title="Keep the sale">
        <LinkTiles
          items={[
            { key: "saving", title: "Return saving rules", sub: "Store credit with a bonus or an exchange before a refund, approval by rule, items back in stock.", href: "/app/returns/saving", end: d.pro ? <Pill tone={d.saving?.credit || d.saving?.exchange ? "ok" : undefined}>{d.saving?.credit || d.saving?.exchange ? "On" : "Off"}</Pill> : <Pill>Pro plan</Pill> },
            { key: "rules", title: "Return rules", sub: "The return window, items that can't be returned and your return address.", href: "/app/returns/rules", end: <Pill tone={d.rulesSaved && d.hasAddress ? "ok" : "warn"}>{d.rulesSaved && d.hasAddress ? "Set" : "To do"}</Pill> },
          ]}
        />
      </HomeRow>

      <HomeRow title="Latest return requests" action={<Button variant="tertiary" href="/app/returns">See all</Button>}>
        {d.returns.length ? (
          <div className={css.list}>
            {d.returns.map((r) => {
              const meta = RETURN_STATES[returnState(r.status)];
              return (
                <div key={r.id} className={css.item}>
                  <span>
                    {r.orderName} · {r.items.map((i) => `${i.quantity} × ${i.title}`).join(", ")} · {r.reason}
                  </span>
                  <Pill tone={meta.tone}>{meta.text}</Pill>
                </div>
              );
            })}
          </div>
        ) : (
          <s-text color="subdued">No return requests yet. When a shopper sends one from your Returns page it shows here.</s-text>
        )}
      </HomeRow>

      <HomeRow title="Set up returns">
        <Checks
          checks={[
            { done: d.scopes.returns, title: "Approve the returns permission", text: "Open the app from Shopify's Apps list and approve the update. Returns need it to create, approve and refund Shopify returns.", action: d.scopes.returns ? undefined : { label: "Open Apps", href: `https://admin.shopify.com/store/${d.shop.replace(".myshopify.com", "")}/settings/apps`, external: true } },
            ...steps,
            { done: d.rulesSaved && d.hasAddress, title: "Set your return rules and address", text: "The return window, products that can't be returned and the address shoppers send items to.", action: d.rulesSaved && d.hasAddress ? undefined : { label: "Open rules", href: "/app/returns/rules" } },
            { done: d.scopes.allOrders, title: "Orders older than 60 days", text: "Shopify only lets the app see the last 60 days of orders until it approves access to all orders. Until then older orders can't be found on the page." },
          ]}
        />
        <s-box paddingBlockStart="base">
          <s-text color="subdued">Shoppers&apos; names, emails and orders are protected customer data: the app must be approved for it in the Partner Dashboard before these pages work on live stores.</s-text>
        </s-box>
      </HomeRow>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
