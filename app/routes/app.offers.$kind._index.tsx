import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { editorLinks, listRules } from "../lib/cro.server";
import { KINDS } from "../lib/kinds";
import { Button } from "../components/fields";
import { Explainer } from "../components/ui";
import { HELP } from "../lib/help";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { OFFER_FEATURE } from "../lib/catalog";


export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const meta = KINDS[params.kind ?? ""];
  if (!meta) throw new Response("Not found", { status: 404 });
  const rules = await listRules(admin, meta.kind);
  return { kindSlug: params.kind!, meta, rules, addBlock: editorLinks(session.shop)[meta.kind] };
};

export default function RuleList() {
  const { kindSlug, meta, rules, addBlock } = useLoaderData<typeof loader>();
  const featureKey = OFFER_FEATURE[kindSlug] ?? "upsell";

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
      <Button slot="primary-action" variant="primary" href={`/app/offers/${kindSlug}/new`}>
        Create {meta.singular}
      </Button>
      <Button slot="secondary-actions" href={addBlock} target="_top" icon="theme-edit">
        Add to theme
      </Button>

      <s-stack gap="base">
        <FeatureTabs feature={featureKey} />
        <Explainer {...HELP[meta.kind]} />

      <s-section heading={`Your offers (${rules.length})`} padding="none">
        {rules.length ? (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Name</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Shown on</s-table-header>
              <s-table-header>Offer</s-table-header>
              <s-table-header format="numeric">Priority</s-table-header>
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
                Create {meta.singular}
              </Button>
            </s-stack>
          </s-box>
        )}
      </s-section>

      </s-stack>
      <s-section slot="aside" heading="Which offer is shown?">
        <s-paragraph>
          If several active offers match the same product, the one with the lowest priority number is shown. The
          checkout discount follows the same order.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
