/**
 * Tracking & Returns → Shipments: the last 30 days of shipments, what Shopify knows and what the Track page shows
 * for each, so the merchant can see tracking works. "Check now" looks an order up the way the Track page does
 * (lib/tracking/shipments.server.ts).
 */
import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { planContext } from "../lib/rules.server";
import { TRACK_STATUS_LABEL, type TrackStatus } from "../lib/tracking";
import { getTrackingConfig } from "../lib/tracking/tracking.server";
import { checkOrderTracking, recentShipments } from "../lib/tracking/shipments.server";
import { Button } from "../components/fields";
import { HomeRow, HomeRows, PageIntro, Pill } from "../components/ui";
import css from "../components/OfferList.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { plan } = await planContext(admin, session.shop);
  const [shipments, cfg] = await Promise.all([recentShipments(admin, session.shop).catch(() => null), getTrackingConfig(session.shop, plan)]);
  return { shipments, source: cfg.source, advanced: cfg.advanced };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const { plan } = await planContext(admin, session.shop);
    const checked = await checkOrderTracking(admin, session.shop, plan, String(form.get("order")));
    return { ok: true, error: null, checked };
  } catch (e) {
    return { ok: false, error: errorMessage(e), checked: [] };
  }
};

const SOURCE_NAME: Record<string, string> = { shopify: "Shopify's data", live: "Live tracking", own: "Your tracking service", webhook: "Webhook updates" };
const tone = (s: TrackStatus | null) => (s === "delivered" ? "ok" : s === "problem" ? "warn" : undefined);
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");

export default function Shipments() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (!fetcher.data.ok) return void shopify.toast.show(fetcher.data.error || "Could not check this order", { isError: true });
    const c = fetcher.data.checked;
    shopify.toast.show(c.length ? c.map((x) => `${x.number}: ${x.status ? TRACK_STATUS_LABEL[x.status] : "no updates yet"} (${SOURCE_NAME[x.via] ?? x.via})`).join(" · ") : "This order has no tracking number");
  }, [fetcher.state, fetcher.data, shopify]);
  const checking = (orderId: string) => fetcher.state !== "idle" && fetcher.formData?.get("order") === orderId;
  const list = d.shipments ?? [];

  return (
    <s-page heading="Shipments" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/tracking-returns">
        Tracking &amp; Returns
      </s-link>
      <Button slot="primary-action" href="/app/tracking-source">
        Where tracking comes from
      </Button>
      <HomeRows>
        <PageIntro text={`Every shipment of the last 30 days and what your Track page shows for it. Tracking comes from ${SOURCE_NAME[d.source].toLowerCase()}${d.source === "shopify" ? "" : ", then Shopify's data"}.`} />
        <HomeRow title="Last 30 days" subtitle="“Check now” looks the order up the way your Track page does." bare>
          <section className={css.list}>
            {d.shipments === null ? (
              <p className={css.noMatch}>Shipments could not be loaded. Refresh to try again.</p>
            ) : list.length ? (
              <div className={css.table} role="table" aria-label="Shipments">
                <div className={`${css.row} ${css.header} ${css.withActions}`} role="row">
                  <span role="columnheader">Order and tracking number</span>
                  <span role="columnheader">Shopify</span>
                  <span role="columnheader">Track page</span>
                  <span role="columnheader">Updates</span>
                  <span role="columnheader" className={css.end}>
                    Check
                  </span>
                </div>
                {list.map((r, i) => (
                  <div key={`${r.orderId}-${r.number}-${i}`} className={`${css.row} ${css.withActions}`} role="row">
                    <span className={css.main} role="cell">
                      <span className={css.name}>{`${r.orderName} · ${day(r.createdAt)}`}</span>
                      <span className={css.sub}>
                        {r.company ? <span className={css.type}>{r.company}</span> : null}
                        <span className={css.detail}>{r.number || "No tracking number"}</span>
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noreferrer">
                            Carrier page
                          </a>
                        ) : r.number ? (
                          <span>No carrier link</span>
                        ) : null}
                      </span>
                    </span>
                    <span role="cell" className={css.stat} data-label="Shopify">
                      {r.shopify.status ? <Pill tone={tone(r.shopify.status)}>{TRACK_STATUS_LABEL[r.shopify.status]}</Pill> : <span className={css.muted}>Nothing yet</span>}
                    </span>
                    <span role="cell" className={css.stat} data-label="Track page">
                      {r.page ? (
                        <s-stack gap="small-100">
                          <Pill tone={tone(r.page.status)}>{TRACK_STATUS_LABEL[r.page.status]}</Pill>
                          <span className={css.muted}>{[SOURCE_NAME[r.page.via] ?? r.page.via, r.page.place].filter(Boolean).join(" · ")}</span>
                        </s-stack>
                      ) : (
                        <span className={css.muted}>{r.shopify.status ? "Same as Shopify" : "Not looked up yet"}</span>
                      )}
                    </span>
                    <span role="cell" className={`${css.num} ${css.stat}`} data-label="Updates">
                      {r.page ? r.page.events : r.shopify.events}
                    </span>
                    <span role="cell" className={css.end}>
                      {r.number ? (
                        <Button variant="tertiary" loading={checking(r.orderId)} onClick={() => fetcher.submit({ order: r.orderId }, { method: "post" })}>
                          Check now
                        </Button>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={css.empty}>
                <strong>No shipments in the last 30 days</strong>
                <span>When you fulfill an order with a tracking number in Shopify, it shows here with its tracking.</span>
              </div>
            )}
          </section>
        </HomeRow>
        {list.some((r) => r.number && !r.url) ? (
          <HomeRow title="Some carriers have no link">
            <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
              <s-text color="subdued">Add the tracking page of those carriers once, and the Track page links every shipment to it.</s-text>
              <Button href="/app/tracking-source">Add carrier links</Button>
            </s-stack>
          </HomeRow>
        ) : null}
      </HomeRows>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
