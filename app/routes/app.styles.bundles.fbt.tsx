/**
 * Style of the "Frequently bought together" box (Bundles → Style): layout, pictures, heading, button
 * and how the saving reads. One look shared by every box on the store. The items and the discount are
 * in the offer's own editor (Bundles → Frequently bought together).
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { getFbtDesign, saveFbtDesign, syncDiscounts } from "../lib/cro.server";
import { listDeals } from "../lib/deals.server";
import { blankDeal, normalizeFbt, type Deal, type FbtDesign } from "../lib/deals";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { storefrontCss } from "../lib/storefront-css.server";
import { Checkbox, TextField } from "../components/fields";
import { Segmented } from "../components/ui";
import { DealPreview } from "../components/DealPreview";
import { PreviewFrame } from "../components/DesignTabs";
import { ThemeLook } from "../components/ThemeStyle";
import { FeatureTabs } from "../components/FeatureNav";
import { SaveControls, changed } from "../components/SaveControls";
import type { PreviewItem } from "../components/BundlePreview";
import ui from "../components/PageEditor.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [fbt, deals, style] = await Promise.all([
    getFbtDesign(admin).catch(() => normalizeFbt(null)),
    listDeals(admin).catch(() => []),
    getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE),
  ]);
  // Preview with the first real box when there is one.
  const deal = deals.find((d) => d.kind === "fixed" && active(d)) ?? deals.find((d) => d.kind === "fixed") ?? null;
  return { fbt, deal, style, css: storefrontCss("ucs-boosters.css") };
};
const active = (d: Deal) => d.active;

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const fbt = normalizeFbt(JSON.parse(String(form.get("fbt"))));
    await saveFbtDesign(admin, fbt);
    // The look is sent to the store with the deals.
    await syncDiscounts(admin);
    return { ok: true, error: null, fbt };
  } catch (e) {
    return { ok: false, error: errorMessage(e), fbt: null };
  }
};

export default function FbtStyle() {
  const data = useLoaderData<typeof loader>();
  const [fbt, setFbt] = useState<FbtDesign>(data.fbt);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [loaded, setLoaded] = useState(data.fbt);
  if (loaded !== data.fbt) {
    setLoaded(data.fbt);
    setFbt(data.fbt);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show("Saved and live");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const deal: Deal = data.deal ?? blankDeal("fixed");
  const prices = useFetcher<{ items: Record<string, PreviewItem[]>; currency: string }>();
  const idsKey = deal.kind === "fixed" ? (deal.config as { items: { product: { id: string } }[] }).items.map((i) => i.product.id).sort().join(",") : "";
  useEffect(() => {
    if (idsKey) prices.load(`/app/bundles/preview-items?ids=${encodeURIComponent(idsKey)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the products change
  }, [idsKey]);

  return (
    <s-page heading="Frequently bought together style" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/styles/bundles">
        Style
      </s-link>
      <SaveControls dirty={changed(fbt, data.fbt)} saving={fetcher.state !== "idle"} saved onSave={() => fetcher.submit({ fbt: JSON.stringify(fbt) }, { method: "post" })} onDiscard={() => setFbt(data.fbt)} />
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="bundles" />
          <s-text color="subdued">The look of the Frequently bought together box, the same on every product page that shows one. The items and the discount are in each offer.</s-text>
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <div className={ui.layout}>
            <s-section heading="Box look">
              <s-stack gap="base">
                  <s-stack gap="small-200">
                    <s-text>Layout</s-text>
                    <Segmented
                      label="Layout"
                      value={fbt.layout}
                      onChange={(v) => setFbt({ ...fbt, layout: v })}
                      options={[
                        { value: "row" as const, label: "Pictures in a row" },
                        { value: "list" as const, label: "List" },
                      ]}
                    />
                  </s-stack>
                  {fbt.layout === "row" ? (
                    <s-stack gap="small-200">
                      <s-text>Pictures</s-text>
                      <Segmented
                        label="Pictures"
                        value={fbt.align}
                        onChange={(v) => setFbt({ ...fbt, align: v })}
                        options={[
                          { value: "start" as const, label: "Left" },
                          { value: "center" as const, label: "Centered" },
                          { value: "end" as const, label: "Right" },
                        ]}
                      />
                    </s-stack>
                  ) : null}
                  {fbt.layout === "row" ? <Checkbox label="Boxes around the pictures" checked={fbt.tiles} onValue={(v) => setFbt({ ...fbt, tiles: v })} /> : null}
                  <Checkbox label="Border around the box" checked={fbt.border} onValue={(v) => setFbt({ ...fbt, border: v })} />
                  <TextField label="Heading" value={fbt.heading} maxLength={80} onValue={(v) => setFbt({ ...fbt, heading: v })} />
                  <TextField label="Button" details="[count] is the number of items and [price] the bundle price, e.g. Buy all [count]: [price]" value={fbt.button} maxLength={40} onValue={(v) => setFbt({ ...fbt, button: v })} />
                  <Checkbox label="Show product pictures" checked={fbt.images} onValue={(v) => setFbt({ ...fbt, images: v })} />
                  <s-stack gap="small-200">
                    <s-text>Show the saving as</s-text>
                    <Segmented
                      label="Show the saving as"
                      value={fbt.saving}
                      onChange={(v) => setFbt({ ...fbt, saving: v })}
                      options={[
                        { value: "amount" as const, label: "An amount (Save $12)" },
                        { value: "pct" as const, label: "A percentage (15% off)" },
                      ]}
                    />
                  </s-stack>
                </s-stack>
            </s-section>
            <PreviewFrame title="Product page" width={600}>
              <ThemeLook style={data.style} pad={20}>
                <DealPreview deal={deal} fbt={fbt} found={prices.data?.items ?? {}} currency={prices.data?.currency ?? "USD"} />
              </ThemeLook>
            </PreviewFrame>
          </div>
        </s-stack>
      </div>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
