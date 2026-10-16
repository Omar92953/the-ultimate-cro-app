/**
 * Bundles: one tab per recipe (bundle-recipes.ts), like Upsell. Each tab lists that type's bundles
 * (active first), then its "Create ... offer" button, and the recipe row while the list is empty.
 * The old ?type=kit|fixed|bundle links still work (they redirect to ?tab=).
 */
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { editorLinks, getThemeStatus, listBundles } from "../lib/cro.server";
import { listOffers } from "../lib/offers.server";
import { DeletedToast } from "../components/DeleteOffer";
import { Button } from "../components/fields";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";
import { BundleRecipes } from "../components/BundleRecipes";
import { isRecipe, recipe, type RecipeKey } from "../lib/bundle-recipes";

/** Links from before the tabs: ?type=bundle|kit|fixed (and a recipe key) → the matching tab. */
const LEGACY: Record<string, RecipeKey> = { bundle: "mixmatch", kit: "kit", fixed: "fbt" };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const old = url.searchParams.get("type");
  if (old && (LEGACY[old] || isRecipe(old))) throw redirect(`/app/bundles?tab=${LEGACY[old] ?? old}`);
  const asked = url.searchParams.get("tab");
  const tab: RecipeKey = isRecipe(asked) ? asked : "fbt";
  const links = editorLinks(session.shop);
  const [offers, bundles, theme] = await Promise.all([listOffers(admin), listBundles(admin), getThemeStatus(admin, session.shop).catch(() => null)]);
  return {
    rows: offers.filter((o) => o.recipe).map((o) => ({ ...o, recipe: o.recipe as RecipeKey })),
    tab,
    storeWide: bundles.some((b) => b.active && b.storeWide),
    anywhere: { tray: theme ? theme.installed.bundle_tray : null, button: theme ? theme.installed.bundle_button : null, trayLink: links.bundle_tray, buttonLink: links.bundle_button },
  };
};

export default function BundleList() {
  const { rows, tab, storeWide, anywhere } = useLoaderData<typeof loader>();
  const r = recipe(tab);
  // Active ones first, then the rest.
  const shown = rows.filter((o) => o.recipe === tab).sort((x, y) => Number(y.active) - Number(x.active));
  return (
    <s-page heading="Bundles" inlineSize="large">
      <CategoryCrumb feature="bundles" />
      <DemoButton feature="bundles" recipe={tab} />
      <Button slot="primary-action" variant="primary" href="/app/bundles/create">
        Create bundle offer
      </Button>

      <DeletedToast />
      <s-stack gap="base">
        <FeatureTabs feature="bundles" />

        {storeWide ? (
          <s-section heading="Build bundles while browsing">
            <s-stack gap="base">
              <s-text color="subdued">Shoppers add items from product pages and collection pages, and a bundle tray follows them until the bundle is complete.</s-text>
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

        <s-section heading={r.title} padding="none">
          <s-box padding="base">
            <s-text color="subdued">{`${r.about} ${r.best}.`}</s-text>
          </s-box>
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Name</s-table-header>
              <s-table-header listSlot="inline">Status</s-table-header>
              <s-table-header>Where it shows</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {shown.map((o) => (
                <s-table-row key={`${o.type}-${o.id}`}>
                  <s-table-cell>
                    <s-link href={o.href}>{o.name}</s-link>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={o.active ? "success" : "neutral"}>{o.active ? "Active" : "Paused"}</s-badge>
                  </s-table-cell>
                  <s-table-cell>{o.where}</s-table-cell>
                  <s-table-cell>
                    <s-link href={o.href}>Edit</s-link>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
          {!shown.length ? (
            <s-box padding="base">
              <s-text color="subdued">No bundles of this type yet.</s-text>
            </s-box>
          ) : null}
          <s-box padding="base">
            <Button variant="primary" href={r.href}>
              {r.create}
            </Button>
          </s-box>
        </s-section>

        {!shown.length ? (
          <s-section heading="Start from this recipe">
            <BundleRecipes only={tab} />
          </s-section>
        ) : null}
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
