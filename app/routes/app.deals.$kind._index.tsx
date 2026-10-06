import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { deleteDeal, listDeals, setDealActive } from "../lib/deals.server";
import { getDiscountStatus } from "../lib/cro.server";
import { DEAL_TYPES, describeDeal, isDealKind } from "../lib/deals";
import { Button } from "../components/fields";
import { Explainer, Pill } from "../components/ui";
import { BundleTabs } from "../components/BundleTabs";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const kind = params.kind;
  if (!isDealKind(kind)) throw new Response("Not found", { status: 404 });
  const [deals, discount] = await Promise.all([listDeals(admin), getDiscountStatus(admin).catch(() => null)]);
  return { kind, deals: deals.filter((d) => d.kind === kind), native: discount?.engine === "native" };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    // Only the id comes from the page: the deal itself is loaded fresh, so a stale tab can't
    // overwrite newer edits.
    const deal = (await listDeals(admin)).find((d) => d.id === String(form.get("id")));
    if (!deal) throw new Error("This bundle no longer exists. Reload the page.");
    if (form.get("intent") === "delete") await deleteDeal(admin, deal.id!);
    else await setDealActive(admin, deal, form.get("active") === "true");
    return { ok: true, error: null, intent: String(form.get("intent")) };
  } catch (e) {
    return { ok: false, error: errorMessage(e), intent: String(form.get("intent")) };
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

  return (
    <s-page heading="Bundles" inlineSize="large">
      <Button slot="primary-action" variant="primary" href={`/app/deals/${kind}/new`}>
        {t.addLabel}
      </Button>
      <s-stack gap="base">
        <BundleTabs />
        <Explainer what={t.what} how={t.how} example={t.example} />
        {native ? (
          <s-banner tone="warning" heading="Not available with native discounts">
            This store uses Shopify&apos;s native discounts (Settings → Discounts), which can&apos;t apply this bundle type. Switch to the app&apos;s discount engine to use it.
          </s-banner>
        ) : null}
        <s-section heading={deals.length ? `${t.title} (${deals.length})` : `No ${t.singular}s yet`}>
          {deals.length ? (
            <s-stack gap="small-200">
              {deals.map((d) => (
                <s-box key={d.id ?? d.name} padding="small-300" borderWidth="base" borderRadius="base">
                  <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                    <s-stack gap="small-100">
                      <s-stack direction="inline" gap="small-200" alignItems="center">
                        <s-link href={`/app/deals/${kind}/${d.handle}`}>{d.name}</s-link>
                        <Pill tone={d.active ? "ok" : "muted"}>{d.active ? "Active" : "Paused"}</Pill>
                      </s-stack>
                      <s-text color="subdued">{describeDeal(d)}</s-text>
                    </s-stack>
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <Button variant="tertiary" icon={d.active ? "pause-circle" : "play-circle"} onClick={() => fetcher.submit({ intent: "active", active: String(!d.active), id: d.id ?? "" }, { method: "post" })}>
                        {d.active ? "Pause" : "Activate"}
                      </Button>
                      <Button href={`/app/deals/${kind}/${d.handle}`} icon="edit">
                        Edit
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
                  </s-stack>
                </s-box>
              ))}
            </s-stack>
          ) : (
            <s-stack gap="base" alignItems="start">
              <s-paragraph>{t.example}</s-paragraph>
              <Button variant="primary" href={`/app/deals/${kind}/new`} icon="plus">
                {t.addLabel}
              </Button>
            </s-stack>
          )}
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
