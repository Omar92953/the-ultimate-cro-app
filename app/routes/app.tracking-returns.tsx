/**
 * Tracking & Returns: one place for the two pages shoppers use (track an order, ask for a return) and the
 * returns the merchant handles. A status overview, the two pages, a setup checklist and the latest
 * requests. Tracking uses what Shopify knows about each shipment (no carrier service); returns are real
 * Shopify returns (app/lib/shopify-returns.server.ts). Plan: Growth (plans.ts).
 */
import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
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
import { remember } from "../lib/short-cache.server";
import { timedLoader } from "../lib/timing.server";
import { RETURN_STATES, returnState } from "../lib/return-rules";
import { area } from "../lib/catalog";
import { Button } from "../components/fields";
import { Pill } from "../components/ui";
import { DemoButton } from "../components/DemoButton";

export const loader = timedLoader("app.tracking-returns", async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  await syncReturns(admin, session.shop).catch(() => null);
  const [returns, theme, rules, scopes, shipments, savings, trackOffers] = await Promise.all([
    listReturns(session.shop).catch(() => []),
    getThemeStatus(admin, session.shop).catch(() => null),
    getReturnRules(admin).catch(() => null),
    grantedScopes(admin).catch(() => [] as string[]),
    remember(session.shop, "shipments", 5 * 60000, () => shipmentOverview(admin)).catch(() => null),
    returnSavings(session.shop).catch(() => null),
    getTrackOffers(admin).catch(() => ({ offers: [] })),
  ]);
  const pctx = await planContext(admin, session.shop);
  const tracking = await getTrackingConfig(session.shop, pctx.plan).catch(() => null);
  const ctx = await orderPageContext(admin, session.shop, theme);
  const links = ctx.links;
  const inPageTemplate = ctx.inPageTemplate;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  return {
    shop: session.shop,
    returns: returns.slice(0, 5),
    counts: {
      requested: returns.filter((r) => returnState(r.status) === "requested").length,
      approved: returns.filter((r) => returnState(r.status) === "approved").length,
      refunded: returns.filter((r) => r.refundedAt && Date.parse(r.refundedAt) >= monthStart.getTime()).length,
    },
    shipments,
    savings,
    trackOffers: trackOffers.offers.map((o) => ({ id: o.id, name: o.name, active: o.active, slot: o.slot, kind: o.kind })),
    pro: atLeast(pctx.plan, "pro"),
    tracking: tracking ? { chosen: tracking.chosen, source: tracking.source, used: tracking.live.used, limit: tracking.live.limit } : null,
    inTheme: theme ? { track: inPageTemplate, returns: inPageTemplate } : null,
    pages: { track: ctx.pages.track ? { handle: ctx.pages.track.handle, admin: pageAdminUrl(session.shop, ctx.pages.track) } : null, returns: ctx.pages.returns ? { handle: ctx.pages.returns.handle, admin: pageAdminUrl(session.shop, ctx.pages.returns) } : null },
    links: { track: links.track, returns: links.returns },
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

function Tile({ label, value, note, href }: { label: string; value: number | string; note?: string; href?: string }) {
  const body = (
    <s-stack gap="small-100">
      <s-text color="subdued">{label}</s-text>
      <s-heading>{String(value)}</s-heading>
      {note ? <s-text color="subdued">{note}</s-text> : null}
    </s-stack>
  );
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      {href ? <s-link href={href}>{body}</s-link> : body}
    </s-box>
  );
}

export default function TrackingReturns() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show("Pages ready");
    else shopify.toast.show(fetcher.data.error || "Could not make the pages", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);
  const intro = area("tracking").intro;
  const pagesDone = !!d.pages.track && !!d.pages.returns;
  type Check = { done: boolean; title: string; text: string; action?: { label: string; href?: string; external?: boolean; onClick?: () => void; loading?: boolean } };
  // Numbered, in the order to do them; each turns green when the app can see it is done.
  const sourceName = { shopify: "Shopify's tracking data", live: "Live tracking", own: "Your own key", webhook: "Webhook link" }[d.tracking?.source ?? "shopify"];
  const checks: Check[] = [
    { done: !!d.tracking?.chosen, title: "Where should tracking come from?", text: d.tracking?.chosen ? `In use: ${sourceName}${d.tracking.source === "live" ? ` (${d.tracking.used} of ${d.tracking.limit} shipments this month)` : ""}.` : "Shopify's data is the default and is free. Pro stores can use live tracking, or you can use your own key or a webhook link.", action: { label: d.tracking?.chosen ? "Change" : "Choose", href: "/app/tracking-source" } },
    { done: d.scopes.returns, title: "Approve the returns permission", text: "Open the app from Shopify's Apps list and approve the update. Returns need it to create, approve and refund Shopify returns.", action: d.scopes.returns ? undefined : { label: "Open Apps", href: `https://admin.shopify.com/store/${d.shop.replace(".myshopify.com", "")}/settings/apps`, external: true } },
    { done: pagesDone, title: "Make the two pages", text: pagesDone ? `Your pages are /pages/${d.pages.track!.handle} and /pages/${d.pages.returns!.handle}.` : "The app makes the “Track your order” and “Returns” pages in your store for you.", action: pagesDone ? undefined : { label: "Make the pages", onClick: () => fetcher.submit({ which: "both" }, { method: "post" }), loading: fetcher.state !== "idle" } },
    { done: !!d.inTheme?.track, title: "Add the block to your page template", text: "One block does both pages: in the theme editor choose Add block, CRO Toolbox, Order & wishlist pages, and save. It shows only on the two pages above (Page: Automatic), so your other pages stay as they are. Then add the two pages to your menu or footer.", action: d.inTheme?.track ? undefined : { label: "Open the theme editor", href: d.links.track, external: true } },
    { done: d.rulesSaved && d.hasAddress, title: "Set your return rules and address", text: "The return window, products that can't be returned and the address shoppers send items to.", action: d.rulesSaved && d.hasAddress ? undefined : { label: "Open rules", href: "/app/returns/rules" } },
    { done: d.scopes.allOrders, title: "Orders older than 60 days", text: "Shopify only lets the app see the last 60 days of orders until it approves access to all orders (requested in the Partner Dashboard). Until then older orders can't be found on these pages." },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  return (
    <s-page heading="Tracking & Returns" inlineSize="large">
      <DemoButton feature="returns" />
      <Button slot="primary-action" variant="primary" href="/app/returns">
        Open returns
      </Button>
      <s-stack gap="base">
        <s-text color="subdued">{intro}</s-text>

        <s-section heading="Overview">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(190px, 1fr))" gap="base">
            <Tile label="New return requests" value={d.counts.requested} href="/app/returns" />
            <Tile label="Waiting for the items" value={d.counts.approved} href="/app/returns" />
            <Tile label="Refunded this month" value={d.counts.refunded} />
            <Tile label="Shipments in transit" value={d.shipments ? d.shipments.inTransit : "No data yet"} note={d.shipments ? `${d.shipments.delayed} past the expected date, ${d.shipments.delivered} delivered (last 30 days)` : undefined} />
          </s-grid>
        </s-section>

        {d.savings && (d.savings.credit.count || d.savings.refunds.count || d.savings.exchanges.count || d.pro) ? (
          <s-section heading="Return saving, last 30 days">
            <s-stack gap="small-200">
              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
                <Tile label="Kept as store credit" value={`${d.savings.credit.value.toFixed(2)} ${d.savings.currency}`} note={`${d.savings.credit.count} return${d.savings.credit.count === 1 ? "" : "s"}${d.savings.credit.bonus ? `, ${d.savings.credit.bonus.toFixed(2)} of it bonus` : ""}`} />
                <Tile label="Kept as exchanges" value={`${d.savings.exchanges.value.toFixed(2)} ${d.savings.currency}`} note={`${d.savings.exchanges.count} exchange${d.savings.exchanges.count === 1 ? "" : "s"}, price of the new items`} />
                <Tile label="Refunded" value={`${d.savings.refunds.value.toFixed(2)} ${d.savings.currency}`} note={`${d.savings.refunds.count} return${d.savings.refunds.count === 1 ? "" : "s"}, value of the items`} />
              </s-grid>
              <s-text color="subdued">Credit stays in your store as a sale to come. {d.pro ? "" : "Return saving rules are on the Pro plan."}</s-text>
              <s-stack direction="inline">
                <Button variant="tertiary" href="/app/returns/saving">Return saving rules</Button>
              </s-stack>
            </s-stack>
          </s-section>
        ) : null}

        <s-section heading="Track page offers">
          <s-stack gap="small-200">
            <s-text color="subdued">An offer above and one below the tracking on the Track page. The order is already paid, so an offer starts a new cart or gives a real Shopify code that really expires. Made in Offers.{d.pro ? "" : " Track page offers are on the Pro plan."}</s-text>
            {(["above", "below"] as const).map((slot) => {
              const mine = d.trackOffers.filter((o) => o.slot === slot);
              const live = mine.find((o) => o.active);
              return (
                <s-stack key={slot} direction="inline" gap="small-200" alignItems="center">
                  <s-text type="strong">{slot === "above" ? "Above the tracking:" : "Below the tracking:"}</s-text>
                  {live ? <s-link href={`/app/offers/track/${live.id}`}>{live.name}</s-link> : <s-text color="subdued">Nothing yet</s-text>}
                  {live ? <Pill tone="ok">{TRACK_OFFER_KINDS[live.kind].title}</Pill> : null}
                  {mine.filter((o) => !o.active).length ? <s-text color="subdued">{`(${mine.filter((o) => !o.active).length} paused)`}</s-text> : null}
                </s-stack>
              );
            })}
            <s-stack direction="inline">
              <Button href="/app/offers/track/new">Add an offer to the Track page</Button>
            </s-stack>
          </s-stack>
        </s-section>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap="base">
          <s-section heading="Track order page">
            <s-stack gap="small-200">
              <s-text color="subdued">Shoppers enter their order number and email and see its delivery status, tracking number and carrier link. It shows what Shopify knows about the shipment; live carrier updates are on the carrier&apos;s own page.</s-text>
              <Pill tone={d.pages.track && d.inTheme?.track ? "ok" : "warn"}>{!d.pages.track ? "Page not made yet" : d.inTheme?.track ? "On your store" : "Block not added yet"}</Pill>
              <s-stack direction="inline" gap="small-200">
                <Button href="/app/pages/track">Style the page</Button>
                {d.pages.track ? (
                  <Button variant="tertiary" href={d.links.track} target="_top" icon="theme-edit">
                    {d.inTheme?.track ? "Open in theme editor" : "Add the block"}
                  </Button>
                ) : (
                  <Button variant="tertiary" loading={fetcher.state !== "idle"} onClick={() => fetcher.submit({ which: "track" }, { method: "post" })}>
                    Make the page
                  </Button>
                )}
                <DemoButton feature="track" slot="" variant="tertiary" />
              </s-stack>
            </s-stack>
          </s-section>
          <s-section heading="Returns page">
            <s-stack gap="small-200">
              <s-text color="subdued">Shoppers choose the items and a reason. It becomes a Shopify return you approve (or approve automatically for the reasons you pick), add a label to and refund.</s-text>
              <Pill tone={d.pages.returns && d.inTheme?.returns ? "ok" : "warn"}>{!d.pages.returns ? "Page not made yet" : d.inTheme?.returns ? "On your store" : "Block not added yet"}</Pill>
              <s-stack direction="inline" gap="small-200">
                <Button href="/app/pages/returns">Style the page</Button>
                <Button variant="tertiary" href="/app/returns/rules">
                  Return rules
                </Button>
                {d.pages.returns ? (
                  <Button variant="tertiary" href={d.links.returns} target="_top" icon="theme-edit">
                    {d.inTheme?.returns ? "Open in theme editor" : "Add the block"}
                  </Button>
                ) : (
                  <Button variant="tertiary" loading={fetcher.state !== "idle"} onClick={() => fetcher.submit({ which: "returns" }, { method: "post" })}>
                    Make the page
                  </Button>
                )}
              </s-stack>
            </s-stack>
          </s-section>
        </s-grid>

        <s-section heading={`Setup: ${doneCount} of ${checks.length} done`}>
          <s-stack gap="base">
            {checks.map((c, n) => (
              <s-stack key={c.title} direction="inline" gap="small-200" alignItems="start" justifyContent="space-between">
                <s-stack gap="small-100">
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <Pill tone={c.done ? "ok" : "warn"}>{c.done ? "Done" : "To do"}</Pill>
                    <s-text type="strong">{`${n + 1}. ${c.title}`}</s-text>
                  </s-stack>
                  <s-text color="subdued">{c.text}</s-text>
                </s-stack>
                {c.action ? (
                  <Button variant="secondary" href={c.action.href} onClick={c.action.onClick} loading={c.action.loading} target={c.action.external ? "_top" : undefined}>
                    {c.action.label}
                  </Button>
                ) : null}
              </s-stack>
            ))}
            <s-text color="subdued">Shoppers&apos; names, emails and orders are protected customer data: the app must be approved for it in the Partner Dashboard before these pages work on live stores.</s-text>
          </s-stack>
        </s-section>

        <s-section heading="Latest return requests">
          {d.returns.length ? (
            <s-stack gap="small-200">
              {d.returns.map((r) => {
                const meta = RETURN_STATES[returnState(r.status)];
                return (
                  <s-stack key={r.id} direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
                    <s-text>
                      {r.orderName} · {r.items.map((i) => `${i.quantity} × ${i.title}`).join(", ")} · {r.reason}
                    </s-text>
                    <Pill tone={meta.tone}>{meta.text}</Pill>
                  </s-stack>
                );
              })}
              <s-stack direction="inline">
                <Button variant="tertiary" href="/app/returns">
                  See all requests
                </Button>
              </s-stack>
            </s-stack>
          ) : (
            <s-paragraph>No return requests yet. When a shopper sends one from your Returns page it shows here.</s-paragraph>
          )}
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
