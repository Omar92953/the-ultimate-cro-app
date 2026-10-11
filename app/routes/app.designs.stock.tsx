import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { getStockDesign, saveStockDesign } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook } from "../components/ThemeStyle";
import { applyStockPreset, STOCK_PRESETS, STOCK_SIZES, withStockDefaults, type StockDesign } from "../lib/stock-design";
import { Button, ColorField, NumberField, Select, Switch, TextField } from "../components/fields";
import { StockPreview } from "../components/StockPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { SizesSection } from "../components/SizesSection";
import { Segmented } from "../components/ui";
import { slottedRoute } from "../lib/design-slot.server";
import { DesignSlots, useDesignAction } from "../components/DesignSlots";
import { SaveControls, changed } from "../components/SaveControls";

export const loader = slottedRoute(["stock"], async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, style] = await Promise.all([getStockDesign(admin), getThemeStatus(admin, session.shop).catch(() => null), getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE)]);
  return { config, saved, style, domain: session.shop, css: storefrontCss("ucs-sections.css"), inTheme: theme ? theme.installed.stock : false, addLink: sectionLinks(session.shop).stock };
});

export const action = slottedRoute(["stock"], async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveStockDesign(admin, withStockDefaults(JSON.parse(String(form.get("config")))), form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
});

type C = StockDesign;

export default function StockDesigner() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const [tab, setTab] = useState<DesignTab>("looks");
  const [mode, setMode] = useState<"soldout" | "preorder">("soldout");
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
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
    else if (fetcher.data.draft) shopify.toast.show("Your changes are in the theme editor preview (only you see them). Save here to put them live.");
    else shopify.toast.show("Saved and live");
  }, [fetcher.state, fetcher.data, shopify]);

  const part =
    <K extends "notify" | "preorder" | "look">(k: K) =>
    (patch: Partial<C[K]>) =>
      setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));
  const notify = part("notify"), preorder = part("preorder"), look = part("look");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post", action: designAction });
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post", action: designAction });

  return (
    <s-page heading="Back in stock & pre-order" inlineSize="large">
      <CategoryCrumb feature="stock" />
      <SaveControls dirty={changed(cfg, data.config)} saving={fetcher.state !== "idle" && fetcher.formData?.get("intent") !== "draft"} saved={data.saved} onSave={save} onDiscard={() => setCfg(data.config)} />
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?template=product`} target="_blank" onClick={seeOnStore}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to product page"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="stock" />
          <DesignSlots base="stock" blockName="Back in stock & pre-order" />
          {!data.saved ? (
            <s-banner tone="info" heading="Not saved yet">
              The standard words and look are used until you save here.
            </s-banner>
          ) : null}
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs tabs={["looks", "content", "design"]} value={tab} onChange={setTab} />
          <div className={ui.layout}>
            <s-stack gap="base">
              <Pane show={tab === "looks"}>
                <LookPicker width={640} presets={STOCK_PRESETS} config={cfg} apply={applyStockPreset} onPick={(key) => setCfg((c) => applyStockPreset(c, key))} render={(c) => <StockPreview config={c} mode="soldout" />} />
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Notify me when available">
                  <s-stack gap="base">
                    <Switch label="On sold-out products, let shoppers leave their email" details="Requests show in Back in stock & pre-order → Requests." checked={cfg.notify.on} onValue={(v) => notify({ on: v })} />
                    {cfg.notify.on ? (
                      <>
                        <TextField label="Heading" value={cfg.notify.heading} onValue={(v) => notify({ heading: v })} />
                        <TextField label="Text" value={cfg.notify.text} onValue={(v) => notify({ text: v })} />
                        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                          <TextField label="Email box" value={cfg.notify.placeholder} onValue={(v) => notify({ placeholder: v })} />
                          <TextField label="Button" value={cfg.notify.button} onValue={(v) => notify({ button: v })} />
                        </s-grid>
                        <TextField label="After sending" value={cfg.notify.thanks} onValue={(v) => notify({ thanks: v })} />
                        <TextField label="Small print" value={cfg.notify.privacy} onValue={(v) => notify({ privacy: v })} />
                      </>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Pre-order">
                  <s-stack gap="base">
                    <Switch label="Pre-order on products you still sell when out of stock" details="For variants with “Continue selling when out of stock” turned on in Shopify." checked={cfg.preorder.on} onValue={(v) => preorder({ on: v })} />
                    {cfg.preorder.on ? (
                      <>
                        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                          <TextField label="Button" value={cfg.preorder.button} onValue={(v) => preorder({ button: v })} />
                          <TextField label="Note under the button" value={cfg.preorder.note} onValue={(v) => preorder({ note: v })} />
                        </s-grid>
                        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                          <TextField label="On the order: name" details="Shown on the order line so you know it's a pre-order." value={cfg.preorder.label} onValue={(v) => preorder({ label: v })} />
                          <TextField label="On the order: value" value={cfg.preorder.value} onValue={(v) => preorder({ value: v })} />
                        </s-grid>
                      </>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "design"}>
                <s-section heading="Look">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Style" value={cfg.look.style} onValue={(v) => look({ style: v as C["look"]["style"] })} options={[{ value: "box", label: "In a soft box" }, { value: "plain", label: "Plain" }]} />
                    {cfg.look.style === "box" ? <ColorField label="Box" value={cfg.look.bg} onValue={(v) => look({ bg: v })} /> : <span />}
                    <ColorField label="Button" value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                    <ColorField label="Button text" value={cfg.look.onAccent} onValue={(v) => look({ onAccent: v })} />
                    <NumberField label="Corners" suffix="px" min={0} max={40} step={1} value={Math.min(cfg.look.radius, 40)} onValue={(v) => look({ radius: v })} />
                  </s-grid>
                </s-section>
              </Pane>

              <Pane show={tab === "design"}>
                <SizesSection specs={STOCK_SIZES} value={cfg.sizes} onChange={(sizes) => setCfg((c) => ({ ...c, sizes }))} />
              </Pane>
            </s-stack>

            <PreviewFrame
              width={640}
              title="Product page"
              tools={<Segmented label="Show" value={mode} options={[{ value: "soldout", label: "Sold out" }, { value: "preorder", label: "Pre-order" }]} onChange={setMode} />}
            >
              <ThemeLook style={data.style}>
                <StockPreview config={cfg} mode={mode} />
              </ThemeLook>
            </PreviewFrame>
          </div>
        </s-stack>
      </div>
    </s-page>
  );
}

export const shouldRevalidate: ShouldRevalidateFunction = ({ formData, defaultShouldRevalidate }) => (formData?.get("intent") === "draft" ? false : defaultShouldRevalidate);

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
