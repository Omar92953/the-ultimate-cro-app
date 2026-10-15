import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { deleteDeal, listDeals, setDealActive } from "../lib/deals.server";
import { checkLimit } from "../lib/billing.server";
import { LimitUpgrade } from "../components/Upgrade";
import { getDiscountStatus } from "../lib/cro.server";
import { DEAL_TYPES, describeDeal, isDealKind } from "../lib/deals";
import { Button } from "../components/fields";
import { Explainer } from "../components/ui";
import { dealFeature } from "../lib/catalog";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, redirect } = await authenticate.admin(request);
  const kind = params.kind;
  if (!isDealKind(kind)) throw new Response("Not found", { status: 404 });
  // Frequently bought together bundles are listed with every other bundle.
  if (kind === "fixed") throw redirect("/app/bundles?type=fixed");
  const [deals, discount] = await Promise.all([listDeals(admin), getDiscountStatus(admin).catch(() => null)]);
  return { kind, deals: deals.filter((d) => d.kind === kind), native: discount?.engine === "native" };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    // Only the id comes from the page: the deal itself is loaded fresh, so a stale tab can't
    // overwrite newer edits.
    const deal = (await listDeals(admin)).find((d) => d.id === String(form.get("id")));
    if (!deal) throw new Error("This bundle no longer exists. Reload the page.");
    if (form.get("intent") === "delete") await deleteDeal(admin, deal.id!);
    else {
      const active = form.get("active") === "true";
      const over = await checkLimit(admin, session.shop, "offerSlots", { ...deal, active });
      if (over) return { ok: false, error: over.error, intent: "active", upgrade: true };
      await setDealActive(admin, deal, active);
    }
    return { ok: true, error: null, intent: String(form.get("intent")), upgrade: false };
  } catch (e) {
    return { ok: false, error: errorMessage(e), intent: String(form.get("intent")), upgrade: false };
  }
};

export default function DealList() {
  const { kind, deals, native } = useLoaderData<typeof loader>();
  const t = DEAL_TYPES[kind];
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show(fetcher.data.intent === "delete" ? "Deleted" : "Saved");
    else shopify.toast.show(fetcher.data.error || "Something went wrong", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const featureKey = dealFeature(kind);
  return (
    <s-page heading={t.title} inlineSize="large">
      <CategoryCrumb feature={featureKey} />
      <DemoButton feature={featureKey} />
      <Button slot="primary-action" variant="primary" href={`/app/deals/${kind}/new`}>
        {t.addLabel}
      </Button>
      <s-stack gap="base">
        <FeatureTabs feature={featureKey} />
        {fetcher.data?.upgrade ? (
          <s-banner tone="warning" heading="Not switched on">
            <s-stack gap="small-200">
              {fetcher.data.error}
              <LimitUpgrade show />
            </s-stack>
          </s-banner>
        ) : null}
        <Explainer what={t.what} how={t.how} example={t.example} />
        {native ? (
          <s-banner tone="warning" heading="Not available with native discounts">
            This store uses Shopify&apos;s native discounts (Settings → Discounts), which can&apos;t apply this bundle type. Switch to the app&apos;s discount engine to use it.
          </s-banner>
        ) : null}
        <s-section heading={`Your ${t.title.toLowerCase()} (${deals.length})`} padding="none">
          {deals.length ? (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Name</s-table-header>
                <s-table-header>Status</s-table-header>
                <s-table-header>Offer</s-table-header>
                <s-table-header>Actions</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {deals.map((d) => (
                  <s-table-row key={d.id ?? d.name}>
                    <s-table-cell>
                      <s-link href={`/app/deals/${kind}/${d.handle}`}>{d.name}</s-link>
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone={d.active ? "success" : "neutral"}>{d.active ? "Active" : "Paused"}</s-badge>
                    </s-table-cell>
                    <s-table-cell>{describeDeal(d)}</s-table-cell>
                    <s-table-cell>
                      <s-stack direction="inline" gap="small-200" justifyContent="end">
                        <Button variant="tertiary" onClick={() => fetcher.submit({ intent: "active", active: String(!d.active), id: d.id ?? "" }, { method: "post" })}>
                          {d.active ? "Pause" : "Activate"}
                        </Button>
                        {confirming === d.id ? (
                          <>
                            <Button tone="critical" variant="primary" onClick={() => { setConfirming(null); fetcher.submit({ intent: "delete", id: d.id ?? "" }, { method: "post" }); }}>
                              Delete
                            </Button>
                            <Button variant="tertiary" onClick={() => setConfirming(null)}>
                              Keep
                            </Button>
                          </>
                        ) : (
                          <Button tone="critical" variant="tertiary" icon="delete" onClick={() => setConfirming(d.id)}>
                            Delete
                          </Button>
                        )}
                      </s-stack>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          ) : (
            <s-box padding="base">
              <s-stack gap="base" alignItems="center">
                <s-heading>{`No ${t.singular}s yet`}</s-heading>
                <s-paragraph>{t.example}</s-paragraph>
                <Button variant="primary" href={`/app/deals/${kind}/new`}>
                  {t.addLabel}
                </Button>
              </s-stack>
            </s-box>
          )}
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
