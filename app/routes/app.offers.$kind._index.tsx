import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { deleteRule, editorLinks, listRules } from "../lib/cro.server";
import { errorMessage } from "../lib/admin.server";
import { KINDS } from "../lib/kinds";
import { Button } from "../components/fields";
import { PageIntro } from "../components/ui";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";
import { OFFER_FEATURE } from "../lib/catalog";
import { DeletedToast } from "../components/DeleteOffer";


export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const meta = KINDS[params.kind ?? ""];
  if (!meta) throw new Response("Not found", { status: 404 });
  const rules = await listRules(admin, meta.kind);
  return { kindSlug: params.kind!, meta, rules, addBlock: editorLinks(session.shop)[meta.kind] };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const meta = KINDS[params.kind ?? ""];
  if (!meta) throw new Response("Not found", { status: 404 });
  const form = await request.formData();
  try {
    // Only the id comes from the page; it must be one of this kind's offers.
    const rule = (await listRules(admin, meta.kind)).find((r) => r.id === String(form.get("id")));
    if (!rule?.id) throw new Error("This offer no longer exists. Reload the page.");
    const done = await deleteRule(admin, rule.id);
    return { ok: true, error: null, warn: done === "warn" };
  } catch (e) {
    return { ok: false, error: errorMessage(e), warn: false };
  }
};

const INTRO: Record<string, string> = {
  upsell: "Offers on the product page that reward buying more or picking a bigger size.",
  cross_sell: "Products that go well together, added in one click on the product page or in the cart.",
};

export default function RuleList() {
  const { kindSlug, meta, rules, addBlock } = useLoaderData<typeof loader>();
  const featureKey = OFFER_FEATURE[kindSlug] ?? "upsell";
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Something went wrong", { isError: true });
    else if (fetcher.data.warn) shopify.toast.show("Deleted, but the checkout discounts could not be updated. Save any offer to try again.", { isError: true, duration: 8000 });
    else shopify.toast.show("Deleted");
  }, [fetcher.state, fetcher.data, shopify]);

  const trigger = (r: (typeof rules)[number]) =>
    r.triggerType === "all"
      ? "All products"
      : r.triggerType === "products"
        ? r.triggerProducts.map((p) => p.title).join(", ")
        : `Collections: ${r.triggerCollections.map((c) => c.title).join(", ")}`;

  const offer = (r: (typeof rules)[number]) =>
    r.kind === "upsell"
      ? r.upsellType === "variant"
        ? `${r.optionName}: ` + r.tiers.map((t) => `${t.value}${t.pct ? ` −${t.pct}%` : ""}`).join(" · ")
        : r.tiers.map((t) => `${t.qty}× ${t.pct ? `−${t.pct}%` : "full price"}`).join(" · ")
      : `${r.offeredProducts.length} product${r.offeredProducts.length === 1 ? "" : "s"}${r.discountPercent ? ` · −${r.discountPercent}%` : ""}`;

  return (
    <s-page heading={meta.title} inlineSize="large">
      <CategoryCrumb feature={featureKey} />
      <DemoButton feature={featureKey} />
      <Button slot="primary-action" variant="primary" href={`/app/offers/${kindSlug}/new`}>
        {meta.addLabel}
      </Button>
      <Button slot="secondary-actions" href={addBlock} target="_top" icon="theme-edit">
        Add to theme
      </Button>

      <DeletedToast />
      <s-stack gap="base">
        <FeatureTabs feature={featureKey} />
        <PageIntro text={INTRO[meta.kind]} />

      <s-section heading={`Your offers (${rules.length})`} padding="none">
        {rules.length ? (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Name</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Shown on</s-table-header>
              <s-table-header>Offer</s-table-header>
              <s-table-header format="numeric">Show order</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rules.map((r) => (
                <s-table-row key={r.handle}>
                  <s-table-cell>
                    <s-link href={`/app/offers/${kindSlug}/${r.handle}`}>{r.name}</s-link>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Paused"}</s-badge>
                  </s-table-cell>
                  <s-table-cell>{trigger(r)}</s-table-cell>
                  <s-table-cell>{offer(r)}</s-table-cell>
                  <s-table-cell>{r.priority}</s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200" justifyContent="end">
                      {confirming === r.id ? (
                        <>
                          <Button tone="critical" variant="primary" onClick={() => { setConfirming(null); fetcher.submit({ id: r.id ?? "" }, { method: "post" }); }}>
                            Delete
                          </Button>
                          <Button variant="tertiary" onClick={() => setConfirming(null)}>
                            Keep
                          </Button>
                        </>
                      ) : (
                        <Button tone="critical" variant="tertiary" icon="delete" onClick={() => setConfirming(r.id ?? null)}>
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
              <s-heading>No {meta.singular}s yet</s-heading>
              <s-paragraph>Create your first offer, then add the block to your theme.</s-paragraph>
              <Button variant="primary" href={`/app/offers/${kindSlug}/new`}>
                {meta.addLabel}
              </Button>
            </s-stack>
          </s-box>
        )}
      </s-section>

      <s-section heading="Which offer is shown?">
        <s-paragraph>
          If several active offers match the same product, the one with the lowest show order number is shown. The
          checkout discount follows the same order.
        </s-paragraph>
      </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
