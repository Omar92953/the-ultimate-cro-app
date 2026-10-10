import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { editorLinks, getThemeStatus, listBundles } from "../lib/cro.server";
import { Button } from "../components/fields";
import { Explainer } from "../components/ui";
import { HELP } from "../lib/help";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const links = editorLinks(session.shop);
  const [bundles, theme] = await Promise.all([listBundles(admin), getThemeStatus(admin, session.shop).catch(() => null)]);
  return {
    bundles,
    addBlock: links.bundles,
    anywhere: { tray: theme ? theme.installed.bundle_tray : null, button: theme ? theme.installed.bundle_button : null, trayLink: links.bundle_tray, buttonLink: links.bundle_button },
  };
};

export default function BundleList() {
  const { bundles, addBlock, anywhere } = useLoaderData<typeof loader>();
  const storeWide = bundles.some((b) => b.active && b.storeWide);
  return (
    <s-page heading="Bundles" inlineSize="large">
      <CategoryCrumb feature="bundles" />
      <Button slot="primary-action" variant="primary" href="/app/bundles/new">
        Create mix & match bundle
      </Button>
      <Button slot="secondary-actions" href={addBlock} target="_top" icon="theme-edit">
        Add to theme
      </Button>

      <s-stack gap="base">
        <FeatureTabs feature="bundles" />
        <Explainer {...HELP.bundles} />

        {storeWide ? (
          <s-section heading="Build bundles anywhere in the store">
            <s-stack gap="base">
              <s-text color="subdued">
                Shoppers add items from product pages (“Add to bundle”) and from each step’s collection page (“+ Add to bundle” on every product card). A bundle tray follows them and checks out the bundle when it’s complete.
              </s-text>
              <s-stack direction="inline" gap="base" alignItems="center">
                <s-badge tone={anywhere.tray ? "success" : "warning"}>{anywhere.tray ? "Bundle tray on" : "Bundle tray off"}</s-badge>
                {!anywhere.tray ? (
                  <Button href={anywhere.trayLink} target="_top" variant="primary">
                    Turn on the bundle tray
                  </Button>
                ) : null}
                <s-badge tone={anywhere.button ? "success" : "neutral"}>{anywhere.button ? "Add to bundle button on product pages" : "No Add to bundle button yet"}</s-badge>
                {!anywhere.button ? (
                  <Button href={anywhere.buttonLink} target="_top">
                    Add the button to product pages
                  </Button>
                ) : null}
              </s-stack>
            </s-stack>
          </s-section>
        ) : null}

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
                Create mix & match bundle
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
