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
import { getOrderPage, saveOrderPage } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook } from "../components/ThemeStyle";
import { applyOrderPagePreset, ORDER_PAGE_PRESETS, ORDER_PAGE_SIZES, TEXTS, withOrderPageDefaults, type OrderPageDesign, type OrderPageKind } from "../lib/order-pages";
import { Button, ColorField, NumberField, OptionalSetting, Select, TextArea, TextField } from "../components/fields";
import { OrderPagePreview } from "../components/OrderPagePreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { SizesSection } from "../components/SizesSection";
import { Segmented } from "../components/ui";
import { slottedRoute } from "../lib/design-slot.server";
import { DesignSlots, useDesignAction } from "../components/DesignSlots";
import { SaveControls, changed } from "../components/SaveControls";

/** This page serves both: Track order (/app/pages/track) and Returns (/app/pages/returns). */
const kindOf = (request: Request): OrderPageKind => (new URL(request.url).pathname.endsWith("/returns") ? "returns" : "track");

export const loader = slottedRoute(["track_page", "returns_page"], async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const kind = kindOf(request);
  const [{ config, saved }, theme, style] = await Promise.all([getOrderPage(admin, kind), getThemeStatus(admin, session.shop).catch(() => null), getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE)]);
  const links = sectionLinks(session.shop);
  return { kind, config, saved, style, domain: session.shop, css: storefrontCss("ucs-sections.css"), inTheme: theme ? theme.installed[kind === "track" ? "track" : "returns"] : false, addLink: kind === "track" ? links.track : links.returns };
});

export const action = slottedRoute(["track_page", "returns_page"], async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const kind = kindOf(request);
  const form = await request.formData();
  try {
    const config = await saveOrderPage(admin, kind, withOrderPageDefaults(JSON.parse(String(form.get("config"))), kind), form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
});

type C = OrderPageDesign;

export default function OrderPageDesigner() {
  const data = useLoaderData<typeof loader>();
  const isTrack = data.kind === "track";
  const feature = isTrack ? "track" : "returns";
  const title = isTrack ? "Track order page" : "Returns page";
  const [cfg, setCfg] = useState<C>(data.config);
  const [tab, setTab] = useState<DesignTab>("looks");
  const [step, setStep] = useState<"form" | "result">("form");
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

  const look = (patch: Partial<C["look"]>) => setCfg((c) => ({ ...c, scheme: "", look: { ...c.look, ...patch } }));
  const space = (patch: Partial<C["space"]>) => setCfg((c) => ({ ...c, space: { ...c.space, ...patch } }));
  const text = (key: string, v: string) => setCfg((c) => ({ ...c, text: { ...c.text, [key]: v } }));
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post", action: designAction });
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post", action: designAction });
  const groups = [...new Set(TEXTS[data.kind].map((t) => t.group))];

  return (
    <s-page heading={title} inlineSize="large">
      <CategoryCrumb feature={feature} />
      <SaveControls dirty={changed(cfg, data.config)} saving={fetcher.state !== "idle" && fetcher.formData?.get("intent") !== "draft"} saved={data.saved} onSave={save} onDiscard={() => setCfg(data.config)} />
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?template=page`} target="_blank" onClick={seeOnStore}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to a page"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature={feature} />
          <DesignSlots base={isTrack ? "track_page" : "returns_page"} blockName="Order & wishlist pages" />
          <s-text color="subdued">
            {isTrack
              ? "Shoppers enter their order number and email and see the order's status, items and tracking. Create a page (Online Store → Pages, e.g. “Track your order”) and add the “Order & wishlist pages” block to it (Page: Track order)."
              : "Shoppers find their order with its number and email, choose the items and a reason, and the request arrives in Returns here. Create a page (e.g. “Returns”) and add the “Order & wishlist pages” block to it (Page: Returns)."}
          </s-text>
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
                <LookPicker width={640} presets={ORDER_PAGE_PRESETS} config={cfg} apply={applyOrderPagePreset} onPick={(key) => setCfg((c) => applyOrderPagePreset(c, key))} render={(c) => <OrderPagePreview config={c} step="form" />} />
              </Pane>

              {groups.map((g) => (
                <Pane key={g} show={tab === "content"}>
                  <s-section heading={g}>
                    <s-stack gap="base">
                      {TEXTS[data.kind]
                        .filter((t) => t.group === g)
                        .map((t) => (t.long ? <TextArea key={t.key} label={t.label} rows={t.key === "reasons" ? 5 : 2} value={cfg.text[t.key] ?? ""} onValue={(v) => text(t.key, v)} /> : <TextField key={t.key} label={t.label} value={cfg.text[t.key] ?? ""} onValue={(v) => text(t.key, v)} />))}
                    </s-stack>
                  </s-section>
                </Pane>
              ))}

              {!isTrack ? (
                <Pane show={tab === "content"}>
                  <s-section heading="Return window">
                    <OptionalSetting label="Only recent orders can be returned" initiallyOn={cfg.rules.days > 0} onOn={() => setCfg((c) => ({ ...c, rules: { days: 30 } }))} onOff={() => setCfg((c) => ({ ...c, rules: { days: 0 } }))}>
<NumberField label="Days after the order" details="Older orders can't be returned here." suffix="days" min={1} max={365} step={1} value={cfg.rules.days} onValue={(v) => setCfg((c) => ({ ...c, rules: { days: Math.max(1, v) } }))} />
</OptionalSetting>
                  </s-section>
                </Pane>
              ) : null}

              <Pane show={tab === "design"}>
                <s-section heading="Look">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Alignment" value={cfg.look.align} onValue={(v) => look({ align: v as C["look"]["align"] })} options={[{ value: "center", label: "Centred" }, { value: "left", label: "Left" }]} />
                    <NumberField label="Width" suffix="px" min={360} max={1200} step={20} value={cfg.look.maxWidth} onValue={(v) => look({ maxWidth: v })} />
                    <ColorField label="Card" value={cfg.look.card} onValue={(v) => look({ card: v })} />
                    <NumberField label="Corners" suffix="px" min={0} max={40} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                    <ColorField label="Button" value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                    <ColorField label="Button text" value={cfg.look.onAccent} onValue={(v) => look({ onAccent: v })} />
                  </s-grid>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <SizesSection specs={ORDER_PAGE_SIZES} value={cfg.sizes} onChange={(sizes) => setCfg((c) => ({ ...c, sizes }))} />
              </Pane>
              <Pane show={tab === "design"}>
                <s-section heading="Spacing">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <NumberField label="Space above" suffix="px" min={0} max={120} step={2} value={cfg.space.top} onValue={(v) => space({ top: v })} />
                    <NumberField label="Space below" suffix="px" min={0} max={120} step={2} value={cfg.space.bottom} onValue={(v) => space({ bottom: v })} />
                  </s-grid>
                </s-section>
              </Pane>
            </s-stack>

            <PreviewFrame
              width={760}
              title={title}
              tools={<Segmented label="Show" value={step} options={[{ value: "form", label: "Form" }, { value: "result", label: isTrack ? "Order found" : "Choosing items" }]} onChange={setStep} />}
            >
              <ThemeLook style={data.style}>
                <OrderPagePreview config={cfg} step={step} />
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
