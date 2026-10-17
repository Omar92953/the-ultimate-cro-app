/**
 * Tracking & Returns: one place for the two pages shoppers use (track an order, ask for a return) and the
 * returns the merchant handles. A status overview, the two pages, a setup checklist and the latest
 * requests. Tracking uses what Shopify knows about each shipment (no carrier service); returns are real
 * Shopify returns (app/lib/shopify-returns.server.ts). Plan: Growth (plans.ts).
 */
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { listReturns, shipmentOverview } from "../lib/orders-lookup.server";
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
  const [returns, theme, rules, scopes, shipments] = await Promise.all([
    listReturns(session.shop).catch(() => []),
    getThemeStatus(admin, session.shop).catch(() => null),
    getReturnRules(admin).catch(() => null),
    grantedScopes(admin).catch(() => [] as string[]),
    remember(session.shop, "shipments", 5 * 60000, () => shipmentOverview(admin)).catch(() => null),
  ]);
  const links = sectionLinks(session.shop);
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
    inTheme: theme ? { track: theme.installed.track, returns: theme.installed.returns } : null,
    links: { track: links.track, returns: links.returns },
    rulesSaved: !!rules?.saved,
    hasAddress: !!rules?.rules.address,
    scopes: { returns: scopes.includes("write_returns") && scopes.includes("read_returns"), allOrders: scopes.includes("read_all_orders") },
  };
});

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
  const intro = area("tracking").intro;
  const checks: { done: boolean; title: string; text: string; action?: { label: string; href: string; external?: boolean } }[] = [
    { done: d.scopes.returns, title: "Approve the returns permission", text: "Open the app from Shopify's Apps list and approve the update. Returns need it to create, approve and refund Shopify returns.", action: d.scopes.returns ? undefined : { label: "Open Apps", href: `https://admin.shopify.com/store/${d.shop.replace(".myshopify.com", "")}/settings/apps`, external: true } },
    { done: !!d.inTheme?.track, title: "Put the Track order page on a page", text: "In the theme editor, add the Track order block to a page and save.", action: d.inTheme?.track ? undefined : { label: "Add to a page", href: d.links.track, external: true } },
    { done: !!d.inTheme?.returns, title: "Put the Returns page on a page", text: "Add the Returns block to its own page and link it from your menu or footer.", action: d.inTheme?.returns ? undefined : { label: "Add to a page", href: d.links.returns, external: true } },
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

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap="base">
          <s-section heading="Track order page">
            <s-stack gap="small-200">
              <s-text color="subdued">Shoppers enter their order number and email and see its delivery status, tracking number and carrier link. It shows what Shopify knows about the shipment; live carrier updates are on the carrier&apos;s own page.</s-text>
              <Pill tone={d.inTheme?.track ? "ok" : "warn"}>{d.inTheme?.track ? "On your store" : "Not on a page yet"}</Pill>
              <s-stack direction="inline" gap="small-200">
                <Button href="/app/pages/track">Style the page</Button>
                <Button variant="tertiary" href={d.links.track} target="_top" icon="theme-edit">
                  {d.inTheme?.track ? "Open in theme editor" : "Add to a page"}
                </Button>
                <DemoButton feature="track" slot="" variant="tertiary" />
              </s-stack>
            </s-stack>
          </s-section>
          <s-section heading="Returns page">
            <s-stack gap="small-200">
              <s-text color="subdued">Shoppers choose the items and a reason. It becomes a Shopify return you approve (or approve automatically for the reasons you pick), add a label to and refund.</s-text>
              <Pill tone={d.inTheme?.returns ? "ok" : "warn"}>{d.inTheme?.returns ? "On your store" : "Not on a page yet"}</Pill>
              <s-stack direction="inline" gap="small-200">
                <Button href="/app/pages/returns">Style the page</Button>
                <Button variant="tertiary" href="/app/returns/rules">
                  Return rules
                </Button>
                <Button variant="tertiary" href={d.links.returns} target="_top" icon="theme-edit">
                  {d.inTheme?.returns ? "Open in theme editor" : "Add to a page"}
                </Button>
              </s-stack>
            </s-stack>
          </s-section>
        </s-grid>

        <s-section heading={`Setup: ${doneCount} of ${checks.length} done`}>
          <s-stack gap="base">
            {checks.map((c) => (
              <s-stack key={c.title} direction="inline" gap="small-200" alignItems="start" justifyContent="space-between">
                <s-stack gap="small-100">
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <Pill tone={c.done ? "ok" : "warn"}>{c.done ? "Done" : "To do"}</Pill>
                    <s-text type="strong">{c.title}</s-text>
                  </s-stack>
                  <s-text color="subdued">{c.text}</s-text>
                </s-stack>
                {c.action ? (
                  <Button variant="secondary" href={c.action.href} target={c.action.external ? "_top" : undefined}>
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
