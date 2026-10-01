import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { editorLinks, listBundles } from "../lib/cro.server";
import { Button } from "../components/fields";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  return { bundles: await listBundles(admin), addBlock: editorLinks(session.shop).bundles };
};

export default function BundleList() {
  const { bundles, addBlock } = useLoaderData<typeof loader>();
  return (
    <s-page heading="Bundles">
      <Button slot="primary-action" variant="primary" href="/app/bundles/new">
        Create bundle
      </Button>
      <Button slot="secondary-actions" href={addBlock} target="_top">
        Add block to theme
      </Button>

      <s-section>
        <s-paragraph>
          A bundle is sold as its own product at its own price (for example “Any 3 posters — LE 399”). Shoppers build it
          step by step on that product’s page. At checkout the bundle is split into the items they picked, so each item’s
          stock goes down and shows on the order.
        </s-paragraph>
      </s-section>

      <s-section heading={`Bundles (${bundles.length})`} padding="none">
        {bundles.length ? (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Name</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Bundle product</s-table-header>
              <s-table-header>Steps</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {bundles.map((b) => (
                <s-table-row key={b.handle}>
                  <s-table-cell>
                    <s-link href={`/app/bundles/${b.handle}`}>{b.name}</s-link>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={b.active ? "success" : "neutral"}>{b.active ? "Active" : "Paused"}</s-badge>
                  </s-table-cell>
                  <s-table-cell>{b.product?.title ?? "—"}</s-table-cell>
                  <s-table-cell>{b.steps.map((s) => s.label).join(" → ")}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-box padding="base">
            <s-stack gap="base" alignItems="center">
              <s-heading>No bundles yet</s-heading>
              <s-paragraph>First create the product you’ll sell as the bundle (with its bundle price) in Products.</s-paragraph>
              <Button variant="primary" href="/app/bundles/new">
                Create bundle
              </Button>
            </s-stack>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
