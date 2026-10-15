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
import { getCartExtras, saveCartExtras } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook } from "../components/ThemeStyle";
import { applyCartExtrasPreset, CART_EXTRAS_PRESETS, CART_EXTRAS_SIZES, withCartExtrasDefaults, type CartExtrasDesign } from "../lib/cart-extras-design";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextArea, TextField } from "../components/fields";
import { CartExtrasPreview } from "../components/CartExtrasPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker, templateInUse } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";
import { SizesSection } from "../components/SizesSection";
import { SaveControls, changed } from "../components/SaveControls";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, style] = await Promise.all([getCartExtras(admin), getThemeStatus(admin, session.shop).catch(() => null), getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE)]);
  const links = sectionLinks(session.shop);
  return { config, saved, style, domain: session.shop, css: storefrontCss("ucs-sections.css"), inTheme: theme ? theme.installed.cart_extras : false, boostersOn: theme ? theme.installed.boosters : null, addLink: links.cart_extras, boostersLink: links.boosters };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveCartExtras(admin, withCartExtrasDefaults(JSON.parse(String(form.get("config")))), form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type C = CartExtrasDesign;

export default function CartExtrasDesigner() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const [tab, setTab] = useState<DesignTab>("looks");
  const fetcher = useFetcher<typeof action>();
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
    <K extends "gift" | "note" | "date" | "where" | "look">(k: K) =>
    (patch: Partial<C[K]>) =>
      setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));
  const gift = part("gift"), note = part("note"), date = part("date"), where = part("where"), look = part("look");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" });

  return (
    <s-page heading="Gift note & delivery date" inlineSize="large">
      <CategoryCrumb feature="cart_extras" />
      <DemoButton feature="cart_extras" template={templateInUse(CART_EXTRAS_PRESETS, cfg, applyCartExtrasPreset)} />
      <SaveControls dirty={changed(cfg, data.config)} saving={fetcher.state !== "idle" && fetcher.formData?.get("intent") !== "draft"} saved={data.saved} onSave={save} onDiscard={() => setCfg(data.config)} />
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?template=cart`} target="_blank" onClick={seeOnStore}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to cart page"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="cart_extras" />
          <s-text color="subdued">Shoppers tick “This is a gift”, write a message and choose a delivery date in the cart. It’s all saved on the order: the message as the order note, the rest as order details (“Gift: Yes”, “Delivery date: 2026-10-15”).</s-text>
          {cfg.where.drawer && data.boostersOn === false ? (
            <s-banner tone="warning" heading="For the cart drawer, turn on the Conversion boosters embed">
              <s-link href={data.boostersLink} target="_top">
                Turn it on in the theme editor
              </s-link>
            </s-banner>
          ) : null}
          {!data.saved ? (
            <s-banner tone="info" heading="Not saved yet">
              It shows in your cart after you save here.
            </s-banner>
          ) : null}
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs tabs={["looks", "content", "design"]} value={tab} onChange={setTab} />
          <div className={ui.layout}>
            <s-stack gap="base">
              <Pane show={tab === "looks"}>
                <LookPicker width={480} presets={CART_EXTRAS_PRESETS} config={cfg} apply={applyCartExtrasPreset} onPick={(key) => setCfg((c) => applyCartExtrasPreset(c, key))} render={(c) => <CartExtrasPreview config={c} />} />
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Gift">
                  <s-stack gap="base">
                    <TextField label="Heading" value={cfg.heading} onValue={(v) => setCfg((c) => ({ ...c, heading: v }))} />
                    <Switch label="“This is a gift” tick box" checked={cfg.gift.on} onValue={(v) => gift({ on: v })} />
                    {cfg.gift.on ? <TextField label="Tick box text" value={cfg.gift.label} onValue={(v) => gift({ label: v })} /> : null}
                    <Switch label="Gift message" details="Saved as the order note." checked={cfg.note.on} onValue={(v) => note({ on: v })} />
                    {cfg.note.on ? (
                      <>
                        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                          <TextField label="Label" value={cfg.note.label} onValue={(v) => note({ label: v })} />
                          <NumberField label="Most characters" min={20} max={1000} step={10} value={cfg.note.max} onValue={(v) => note({ max: v })} />
                        </s-grid>
                        <TextField label="Hint in the box" value={cfg.note.placeholder} onValue={(v) => note({ placeholder: v })} />
                        {cfg.gift.on ? <Checkbox label="Only when “This is a gift” is ticked" checked={cfg.note.onlyGift} onValue={(v) => note({ onlyGift: v })} /> : null}
                      </>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Delivery date">
                  <s-stack gap="base">
                    <Switch label="Let shoppers pick a delivery date" checked={cfg.date.on} onValue={(v) => date({ on: v })} />
                    {cfg.date.on ? (
                      <>
                        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                          <TextField label="Label" value={cfg.date.label} onValue={(v) => date({ label: v })} />
                          <span />
                          <NumberField label="Earliest" suffix="days from today" min={0} max={60} step={1} value={cfg.date.minDays} onValue={(v) => date({ minDays: v })} />
                          <NumberField label="Latest" suffix="days from today" min={1} max={365} step={1} value={cfg.date.maxDays} onValue={(v) => date({ maxDays: v })} />
                        </s-grid>
                        <s-text>No deliveries on</s-text>
                        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="small-200">
                          {DAYS.map((d, i) => (
                            <Checkbox key={d} label={d} checked={cfg.date.daysOff.includes(i)} onValue={(v) => date({ daysOff: v ? [...cfg.date.daysOff, i] : cfg.date.daysOff.filter((x) => x !== i) })} />
                          ))}
                        </s-grid>
                        <TextArea label="Time slots (optional, one per line)" rows={3} value={cfg.date.slots} onValue={(v) => date({ slots: v })} />
                        <Checkbox label="Required before checkout" checked={cfg.date.required} onValue={(v) => date({ required: v })} />
                        {cfg.date.required ? <TextField label="Message when missing" value={cfg.date.requiredText} onValue={(v) => date({ requiredText: v })} /> : null}
                      </>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Where">
                  <s-stack direction="inline" gap="base">
                    <Checkbox label="Cart page (the block)" checked={cfg.where.page} onValue={(v) => where({ page: v })} />
                    <Checkbox label="Cart drawer" checked={cfg.where.drawer} onValue={(v) => where({ drawer: v })} />
                  </s-stack>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <s-section heading="Look">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Style" value={cfg.look.style} onValue={(v) => look({ style: v as C["look"]["style"] })} options={[{ value: "box", label: "In a soft box" }, { value: "plain", label: "Plain" }]} />
                    {cfg.look.style === "box" ? <ColorField label="Box" value={cfg.look.bg} onValue={(v) => look({ bg: v })} /> : <span />}
                    <ColorField label="Tick box" value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                    <NumberField label="Corners" suffix="px" min={0} max={30} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                  </s-grid>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <SizesSection specs={CART_EXTRAS_SIZES} value={cfg.sizes} onChange={(sizes) => setCfg((c) => ({ ...c, sizes }))} />
              </Pane>
            </s-stack>
            <PreviewFrame width={480} title="Cart">
              <ThemeLook style={data.style}>
                <CartExtrasPreview config={cfg} />
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
