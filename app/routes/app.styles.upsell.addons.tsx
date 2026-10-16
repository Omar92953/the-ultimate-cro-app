/* eslint-disable @typescript-eslint/no-explicit-any -- App Bridge resource picker payloads are untyped */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage } from "../lib/admin.server";
import { editorLinks, getThemeStatus } from "../lib/cro.server";
import { getAddons, saveAddons } from "../lib/designs.server";
import { withAddonsDefaults, type AddonsConfig } from "../lib/addons";
import { Button, ColorField, NumberField, Select, TextField } from "../components/fields";
import { AddonsPreview } from "../components/AddonsPreview";
import ui from "../components/PageEditor.module.css";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook, ThemeMatch } from "../components/ThemeStyle";
import { matchAddons } from "../lib/theme-match";
import { firstProduct } from "../lib/preview-products.server";
import { PreviewFrame } from "../components/DesignTabs";
import { FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";
import { slottedRoute } from "../lib/design-slot.server";
import { DesignSlots, useDesignAction } from "../components/DesignSlots";
import { SaveControls, changed } from "../components/SaveControls";

export const loader = slottedRoute(["addons"], async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme] = await Promise.all([getAddons(admin), getThemeStatus(admin, session.shop).catch(() => null)]);
  return { style: await getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE), domain: session.shop, sample: await firstProduct(admin, session.shop).catch(() => null), config, saved, css: storefrontCss("ucs-sections.css"), inTheme: theme ? theme.installed.addons : null, addLink: editorLinks(session.shop).addons, shop: session.shop };
});

export const action = slottedRoute(["addons"], async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveAddons(admin, withAddonsDefaults(JSON.parse(String(form.get("config")))), form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
});

type C = AddonsConfig;

export default function AddonsDesigner() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const fetcher = useFetcher<typeof action>();
  const designAction = useDesignAction();
  const shopify = useAppBridge();
  const [loaded, setLoaded] = useState(data.config);
  if (loaded !== data.config) {
    setLoaded(data.config);
    setCfg(data.config);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok && fetcher.data.draft) shopify.toast.show("Your changes are in the theme editor preview (only you see them). Save here to put them live.");
    else if (fetcher.data.ok) shopify.toast.show("Saved and live");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const look = (patch: Partial<C["look"]>) => setCfg((c) => ({ ...c, look: { ...c.look, ...patch } }));
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post", action: designAction });



  return (
    <s-page heading="Add-ons style" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/styles/upsell">
        Style
      </s-link>
      <DemoButton feature="addons" />
      <SaveControls dirty={changed(cfg, data.config)} saving={fetcher.state !== "idle" && fetcher.formData?.get("intent") !== "draft"} saved={data.saved} onSave={save} onDiscard={() => setCfg(data.config)} />
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?previewPath=${encodeURIComponent(data.sample ? `/products/${data.sample.handle}` : "/collections/all")}`} target="_blank" onClick={() => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post", action: designAction })}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to product page"}
      </Button>
      <div className={ui.shell}>
      <s-stack gap="base">
        <FeatureTabs feature="addons" />
        <DesignSlots base="addons" blockName="Add-ons" />
        {data.inTheme === false ? (
          <s-banner tone="info" heading="Place the add-ons on your product page">
            Click “Add to product page”, drag the “Add-ons” block under the Add to cart button and save. Everything else is set here.
          </s-banner>
        ) : null}
        {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}

        <div className={ui.layout}>
          <s-stack gap="base">
        <>
          <ThemeMatch style={data.style} config={cfg} setConfig={setCfg} match={matchAddons} />
        </>



            <><s-section heading="Look">
              <s-stack gap="base">
                <TextField label="Heading (optional)" value={cfg.heading} onValue={(v) => setCfg((c) => ({ ...c, heading: v }))} />
                <Select label="Layout" value={cfg.style} onValue={(v) => setCfg((c) => ({ ...c, style: v as C["style"] }))} options={[{ value: "list", label: "List" }, { value: "cards", label: "Cards side by side" }]} />
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <ColorField label="Ticked colour" value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                  <ColorField label="Background" value={cfg.look.bg} onValue={(v) => look({ bg: v })} />
                  <ColorField label="Border" value={cfg.look.border} onValue={(v) => look({ border: v })} />
                  <NumberField label="Corners" suffix="px" min={0} max={24} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                  <NumberField label="Name size" suffix="px" min={11} max={22} step={1} value={cfg.look.titleSize} onValue={(v) => look({ titleSize: v })} />
                  <NumberField label="Note size" suffix="px" min={10} max={18} step={1} value={cfg.look.textSize} onValue={(v) => look({ textSize: v })} />
                </s-grid>
              </s-stack>
            </s-section></>
          </s-stack>

          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <PreviewFrame title="Product page">
              <ThemeLook style={data.style}><AddonsPreview config={cfg} /></ThemeLook>
          </PreviewFrame>
        </div>
      </s-stack>
      </div>
    </s-page>
  );
}

/** Storing a draft for "See it on my store" must not reload the page (that would drop unsaved changes). */
export const shouldRevalidate: ShouldRevalidateFunction = ({ formData, defaultShouldRevalidate }) => (formData?.get("intent") === "draft" ? false : defaultShouldRevalidate);

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
