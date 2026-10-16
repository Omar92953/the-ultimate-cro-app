/**
 * Bundles: every bundle in one list (mix & match, kits sold as one product, frequently bought
 * together), filtered by type, plus "Create bundle" (the recipe chooser, /app/bundles/create).
 */
import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { editorLinks, getThemeStatus, listBundles } from "../lib/cro.server";
import { listOffers } from "../lib/offers.server";
import { Button } from "../components/fields";
import { Segmented } from "../components/ui";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";
import { BundleRecipes } from "../components/BundleRecipes";

const TYPES = { bundle: "Mix & match", kit: "Kit (one product)", fixed: "Frequently bought together" } as const;
type BundleType = keyof typeof TYPES;
const isType = (v: unknown): v is BundleType => typeof v === "string" && v in TYPES;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const links = editorLinks(session.shop);
  const [offers, bundles, theme] = await Promise.all([listOffers(admin), listBundles(admin), getThemeStatus(admin, session.shop).catch(() => null)]);
  const type = new URL(request.url).searchParams.get("type");
  return {
    rows: offers.filter((o) => isType(o.type)).map((o) => ({ ...o, type: o.type as BundleType })),
    type: isType(type) ? type : "all",
    storeWide: bundles.some((b) => b.active && b.storeWide),
    anywhere: { tray: theme ? theme.installed.bundle_tray : null, button: theme ? theme.installed.bundle_button : null, trayLink: links.bundle_tray, buttonLink: links.bundle_button },
  };
};

export default function BundleList() {
  const { rows, type: initialType, storeWide, anywhere } = useLoaderData<typeof loader>();
  const [type, setType] = useState<"all" | BundleType>(initialType as "all" | BundleType);
  const shown = rows.filter((r) => type === "all" || r.type === type);
  return (
    <s-page heading="Bundles" inlineSize="large">
      <CategoryCrumb feature="bundles" />
      <DemoButton feature="bundles" />
      <Button slot="primary-action" variant="primary" href="/app/bundles/create">
        Create bundle offer
      </Button>

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

        {rows.length ? (
          <s-section padding="none">
            <s-box padding="small-300">
              <Segmented
                label="Bundle type"
                value={type}
                onChange={setType}
                options={[
                  { value: "all", label: "All", count: rows.length },
                  ...(Object.keys(TYPES) as BundleType[]).map((k) => ({ value: k, label: TYPES[k], count: rows.filter((r) => r.type === k).length })),
                ]}
              />
            </s-box>
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Name</s-table-header>
                <s-table-header>Type</s-table-header>
                <s-table-header>Status</s-table-header>
                <s-table-header>Where it shows</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {shown.map((r) => (
                  <s-table-row key={`${r.type}-${r.id}`}>
                    <s-table-cell>
                      <s-link href={r.href}>{r.name}</s-link>
                    </s-table-cell>
                    <s-table-cell>{TYPES[r.type]}</s-table-cell>
                    <s-table-cell>
                      <s-badge tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Paused"}</s-badge>
                    </s-table-cell>
                    <s-table-cell>{r.where}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
            {!shown.length ? (
              <s-box padding="base">
                <s-text color="subdued">No bundles of this type yet.</s-text>
              </s-box>
            ) : null}
          </s-section>
        ) : (
          <s-section heading="Create your first bundle">
            <s-stack gap="base">
              <s-text color="subdued">What do you want to sell? Pick a recipe; you can change everything in the next step.</s-text>
              <BundleRecipes />
            </s-stack>
          </s-section>
        )}
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
