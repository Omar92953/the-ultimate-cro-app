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
import { getPersonalizeDesign, savePersonalizeDesign } from "../lib/designs.server";
import { firstProduct } from "../lib/preview-products.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook } from "../components/ThemeStyle";
import { applyPersonalizePreset, PERSONALIZE_PRESETS, PERSONALIZE_SIZES, withPersonalizeDefaults, type PersonalizeDesign } from "../lib/personalize-design";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextField } from "../components/fields";
import { PersonalizePreview } from "../components/PersonalizePreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker, templateInUse } from "../components/LookPicker";
import { PreviewFrame } from "../components/DesignTabs";
import { FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";
import { SizesSection } from "../components/SizesSection";
import { slottedRoute } from "../lib/design-slot.server";
import { DesignSlots, useDesignAction } from "../components/DesignSlots";
import { SaveControls, changed } from "../components/SaveControls";

export const loader = slottedRoute(["personalize"], async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, style, sample] = await Promise.all([
    getPersonalizeDesign(admin),
    getThemeStatus(admin, session.shop).catch(() => null),
    getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE),
    firstProduct(admin, session.shop).catch(() => null),
  ]);
  return { config, saved, style, image: (sample as { image?: string | null } | null)?.image ?? null, domain: session.shop, css: storefrontCss("ucs-sections.css"), inTheme: theme ? theme.installed.personalize : false, addLink: sectionLinks(session.shop).personalize };
});

export const action = slottedRoute(["personalize"], async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await savePersonalizeDesign(admin, withPersonalizeDefaults(JSON.parse(String(form.get("config")))), form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
});

type C = PersonalizeDesign;

export default function PersonalizeDesigner() {
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
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
    else if (fetcher.data.draft) shopify.toast.show("Your changes are in the theme editor preview (only you see them). Save here to put them live.");
    else shopify.toast.show("Saved and live");
  }, [fetcher.state, fetcher.data, shopify]);

  const part =
    <K extends "preview" | "look">(k: K) =>
    (patch: Partial<C[K]>) =>
      setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));
  const preview = part("preview"), look = part("look");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post", action: designAction });
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post", action: designAction });


  return (
    <s-page heading="Personalization style" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/styles/upsell">
        Style
      </s-link>
      <DemoButton feature="personalize" template={templateInUse(PERSONALIZE_PRESETS, cfg, applyPersonalizePreset)} />
      <SaveControls dirty={changed(cfg, data.config)} saving={fetcher.state !== "idle" && fetcher.formData?.get("intent") !== "draft"} saved={data.saved} onSave={save} onDiscard={() => setCfg(data.config)} />
      <Button slot="secondary-actions" href={data.inTheme ? `https://${data.domain}/admin/themes/current/editor?template=product` : data.addLink} target="_blank" onClick={seeOnStore}>
        Preview on store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to product page"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="personalize" />
          <DesignSlots base="personalize" blockName="Personalization" />
          <s-text color="subdued">Fields shoppers fill in before adding to cart (a name to engrave, initials, a colour). What they type is saved on the order line, so you see it on the order.</s-text>
          {!data.saved ? (
            <s-banner tone="info" heading="Not saved yet">
              Personalization shows on your store after you save here and add the block.
            </s-banner>
          ) : null}
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <div className={ui.layout}>
            <s-stack gap="base">
              <>
                <LookPicker width={720} presets={PERSONALIZE_PRESETS} config={cfg} apply={applyPersonalizePreset} onPick={(key) => setCfg((c) => applyPersonalizePreset(c, key))} render={(c) => <PersonalizePreview config={c} image={data.image} />} />
              </>




              <>
                <s-section heading="Preview on the picture">
                  <s-stack gap="base">
                    <Switch label="Show a live preview" checked={cfg.preview.on} onValue={(v) => preview({ on: v })} />
                    {cfg.preview.on ? (
                      <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                        <Select label="Font" value={cfg.preview.font} onValue={(v) => preview({ font: v as C["preview"]["font"] })} options={[{ value: "serif", label: "Serif" }, { value: "sans", label: "Sans" }, { value: "script", label: "Script" }, { value: "mono", label: "Typewriter" }]} />
                        <ColorField label="Text colour" value={cfg.preview.color} onValue={(v) => preview({ color: v })} />
                        <NumberField label="Text size" suffix="px" min={10} max={80} step={1} value={cfg.preview.size} onValue={(v) => preview({ size: v })} />
                        <TextField label="Label on the picture" value={cfg.preview.label} onValue={(v) => preview({ label: v })} />
                        <NumberField label="Across" suffix="%" min={0} max={100} step={1} value={cfg.preview.x} onValue={(v) => preview({ x: v })} />
                        <NumberField label="Down" suffix="%" min={0} max={100} step={1} value={cfg.preview.y} onValue={(v) => preview({ y: v })} />
                      </s-grid>
                    ) : null}
                    {cfg.preview.on ? <Checkbox label="Capital letters" checked={cfg.preview.upper} onValue={(v) => preview({ upper: v })} /> : null}
                  </s-stack>
                </s-section>
              </>
              <>
                <s-section heading="Look">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Style" value={cfg.look.style} onValue={(v) => look({ style: v as C["look"]["style"] })} options={[{ value: "box", label: "In a soft box" }, { value: "plain", label: "Plain" }]} />
                    {cfg.look.style === "box" ? <ColorField label="Box" value={cfg.look.bg} onValue={(v) => look({ bg: v })} /> : <span />}
                    <NumberField label="Corners" suffix="px" min={0} max={30} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                  </s-grid>
                </s-section>
              </>
              <>
                <SizesSection specs={PERSONALIZE_SIZES} value={cfg.sizes} onChange={(sizes) => setCfg((c) => ({ ...c, sizes }))} />
              </>
            </s-stack>

            <PreviewFrame width={720} title="Product page · try typing">
              <ThemeLook style={data.style}>
                <PersonalizePreview config={cfg} image={data.image} />
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
