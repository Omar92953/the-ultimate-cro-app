/**
 * Bundle products ("kits"): bundles sold as their own product. See lib/kits.server.ts.
 */
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { productNumber } from "../lib/kits";
import { listKits } from "../lib/kits.server";
import { Button } from "../components/fields";
import { Explainer } from "../components/ui";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  try {
    return { kits: await listKits(admin), error: null, shop: session.shop };
  } catch (e) {
    // Most likely the store hasn't approved the new products permission yet.
    return { kits: [], error: errorMessage(e), shop: session.shop };
  }
};

const range = (prices: string[]) => {
  const n = prices.map(Number).filter((x) => Number.isFinite(x));
  if (!n.length) return "—";
  const lo = Math.min(...n);
  const hi = Math.max(...n);
  return lo === hi ? lo.toFixed(2) : `${lo.toFixed(2)} – ${hi.toFixed(2)}`;
};

export default function KitList() {
  const { kits, error } = useLoaderData<typeof loader>();
  return (
    <s-page heading="Bundles" inlineSize="large">
      <CategoryCrumb feature="bundles" />
      <Button slot="primary-action" variant="primary" href="/app/kits/new">
        Create bundle product
      </Button>
      <s-stack gap="base">
        <FeatureTabs feature="bundles" />
        <Explainer
          what="A bundle sold as its own product, with its own page, photos, price and SKU. It shows in collections, search and Google Shopping like any product."
          how="Shopify works out its stock from its items, so it shows sold out when one runs out. The order lists the real items, so stock goes down on each and you know what to pack. Each item's sizes and colours become options on the bundle's page."
          example="“Camera kit”: camera + case + 2 films. 10% off the items' total; a bigger case makes the kit cost more. Shown as “was 120, now 108”."
        />
        {error ? (
          <s-banner tone="warning" heading="Bundle products need one more permission">
            Open the app again and approve the new permission (edit products). Shopify asks for it once. ({error})
          </s-banner>
        ) : null}
        <s-section heading={`Bundle products (${kits.length})`} padding="none">
          {kits.length ? (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Name</s-table-header>
                <s-table-header>Status in Shopify</s-table-header>
                <s-table-header>Items</s-table-header>
                <s-table-header format="numeric">Price</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {kits.map((k) => (
                  <s-table-row key={k.productId}>
                    <s-table-cell>
                      <s-link href={`/app/kits/${productNumber(k.productId)}`}>{k.title}</s-link>
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone={k.status === "ACTIVE" ? "success" : "warning"}>{k.status === "ACTIVE" ? "Active" : k.status === "DRAFT" ? "Draft: publish it in Products" : (k.status ?? "—")}</s-badge>
                    </s-table-cell>
                    <s-table-cell>{k.items.map((i) => (i.qty > 1 ? `${i.qty}× ` : "") + i.title).join(" + ")}</s-table-cell>
                    <s-table-cell>{range(k.variants.map((v) => v.price))}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          ) : (
            <s-box padding="base">
              <s-stack gap="base" alignItems="center">
                <s-heading>No bundle products yet</s-heading>
                <s-paragraph>Pick the items and the price. The app creates the product in Shopify for you.</s-paragraph>
                <Button variant="primary" href="/app/kits/new">
                  Create bundle product
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
