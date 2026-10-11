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
import { getCartTools, saveCartTools } from "../lib/designs.server";
import { applyCartToolsPreset, CART_TOOLS_PRESETS, CART_TOOLS_SIZES, withCartToolsDefaults, type CartToolsDesign } from "../lib/cart-tools-design";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextField } from "../components/fields";
import { CartToolsPreview } from "../components/CartToolsPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { SizesSection } from "../components/SizesSection";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme] = await Promise.all([getCartTools(admin), getThemeStatus(admin, session.shop).catch(() => null)]);
  return { config, saved, domain: session.shop, css: storefrontCss("ucs-sections.css"), embedOn: theme ? theme.installed.cart_tools : null, embedLink: sectionLinks(session.shop).cart_tools, discountsLink: `https://${session.shop}/admin/discounts` };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveCartTools(admin, withCartToolsDefaults(JSON.parse(String(form.get("config")))), form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type C = CartToolsDesign;

export default function CartToolsDesigner() {
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
    else shopify.toast.show(data.embedOn ? "Saved — live on your store" : "Saved");
  }, [fetcher.state, fetcher.data, shopify, data.embedOn]);

  const part =
    <K extends "drawer" | "express" | "discount" | "share" | "look">(k: K) =>
    (patch: Partial<C[K]>) =>
      setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));
  const drawer = part("drawer"), express = part("express"), discount = part("discount"), share = part("share"), look = part("look");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" });

  return (
    <s-page heading="Cart drawer & checkout" inlineSize="large">
      <CategoryCrumb feature="cart_tools" />
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?context=apps`} target="_blank" onClick={seeOnStore}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.embedLink} target="_top" icon="theme-edit">
        {data.embedOn ? "Open in theme editor" : "Turn on in theme"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="cart_tools" />
          <s-text color="subdued">One app embed for the cart: a slide-out drawer that opens on add to cart and from the cart icon, express checkout buttons, the best discount applied automatically, and a link that rebuilds the cart on any device.</s-text>
          {data.embedOn === false ? (
            <s-banner tone="warning" heading="Turn on “Cart drawer & checkout” in App embeds">
              <s-link href={data.embedLink} target="_top">
                Open App embeds
              </s-link>
            </s-banner>
          ) : null}
          {!data.saved ? (
            <s-banner tone="info" heading="Not saved yet">
              It starts working after you save here and turn on the embed.
            </s-banner>
          ) : null}
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs tabs={["looks", "content", "design"]} value={tab} onChange={setTab} />
          <div className={ui.layout}>
            <s-stack gap="base">
              <Pane show={tab === "looks"}>
                <LookPicker width={600} presets={CART_TOOLS_PRESETS} config={cfg} apply={applyCartToolsPreset} onPick={(key) => setCfg((c) => applyCartToolsPreset(c, key))} render={(c) => <CartToolsPreview config={c} />} />
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Slide-out cart">
                  <s-stack gap="base">
                    <Switch label="Use the app's cart drawer" details="Opens on add to cart and from the cart icon, in place of the theme's cart page or drawer." checked={cfg.drawer.on} onValue={(v) => drawer({ on: v })} />
                    {cfg.drawer.on ? (
                      <>
                        <Checkbox label="Open it after add to cart" checked={cfg.drawer.openOnAdd} onValue={(v) => drawer({ openOnAdd: v })} />
                        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                          <TextField label="Title" value={cfg.drawer.title} onValue={(v) => drawer({ title: v })} />
                          <TextField label="Checkout button" value={cfg.drawer.checkout} onValue={(v) => drawer({ checkout: v })} />
                          <TextField label="“Subtotal”" value={cfg.drawer.subtotal} onValue={(v) => drawer({ subtotal: v })} />
                          <TextField label="Empty cart" value={cfg.drawer.empty} onValue={(v) => drawer({ empty: v })} />
                          <TextField label="Continue shopping" value={cfg.drawer.continueText} onValue={(v) => drawer({ continueText: v })} />
                        </s-grid>
                        <TextField label="Under the subtotal" value={cfg.drawer.taxes} onValue={(v) => drawer({ taxes: v })} />
                      </>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Express checkout">
                  <Switch label="Shop Pay, Apple Pay, Google Pay… in the drawer" details="Shopify shows the buttons your store has turned on in Settings → Payments." checked={cfg.express.on} onValue={(v) => express({ on: v })} />
                </s-section>
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Best discount">
                  <s-stack gap="base">
                    <Switch label="Apply the best discount code automatically" details="Tries each code on the cart and keeps the one that saves the most." checked={cfg.discount.on} onValue={(v) => discount({ on: v })} />
                    {cfg.discount.on ? (
                      <>
                        <TextField label="Discount codes" details="Codes from Shopify Discounts, separated by commas (up to 6)." value={cfg.discount.codes} onValue={(v) => discount({ codes: v })} />
                        <TextField label="Message" details="{code} = the code applied" value={cfg.discount.applied} onValue={(v) => discount({ applied: v })} />
                        <s-link href={data.discountsLink} target="_top">
                          Open Shopify Discounts
                        </s-link>
                      </>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Saved and shareable cart">
                  <s-stack gap="base">
                    <Switch label="“Share cart” link and remembering the cart" details="The link rebuilds the cart on any device; an emptied cart offers the last one back on this device." checked={cfg.share.on} onValue={(v) => share({ on: v })} />
                    {cfg.share.on ? (
                      <>
                        <TextField label="Button" value={cfg.share.button} onValue={(v) => share({ button: v })} />
                        <TextField label="After copying" value={cfg.share.copied} onValue={(v) => share({ copied: v })} />
                        <TextField label="Saved cart message" value={cfg.share.restore} onValue={(v) => share({ restore: v })} />
                      </>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <s-section heading="Look">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Slides in from" value={cfg.drawer.side} onValue={(v) => drawer({ side: v as C["drawer"]["side"] })} options={[{ value: "right", label: "Right" }, { value: "left", label: "Left" }]} />
                    <NumberField label="Width" suffix="px" min={320} max={640} step={10} value={cfg.drawer.width} onValue={(v) => drawer({ width: v })} />
                    <ColorField label="Background" value={cfg.look.bg} onValue={(v) => look({ bg: v })} />
                    <ColorField label="Text" value={cfg.look.fg} onValue={(v) => look({ fg: v })} />
                    <ColorField label="Button" value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                    <ColorField label="Button text" value={cfg.look.onAccent} onValue={(v) => look({ onAccent: v })} />
                    <NumberField label="Corners" suffix="px" min={0} max={30} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                    <NumberField label="Shade behind" suffix="%" min={0} max={90} step={5} value={cfg.look.overlay} onValue={(v) => look({ overlay: v })} />
                  </s-grid>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <SizesSection specs={CART_TOOLS_SIZES} value={cfg.sizes} onChange={(sizes) => setCfg((c) => ({ ...c, sizes }))} />
              </Pane>
            </s-stack>
            <PreviewFrame width={600} title="Cart drawer">
              <CartToolsPreview config={cfg} />
            </PreviewFrame>
          </div>
        </s-stack>
      </div>
    </s-page>
  );
}

export const shouldRevalidate: ShouldRevalidateFunction = ({ formData, defaultShouldRevalidate }) => (formData?.get("intent") === "draft" ? false : defaultShouldRevalidate);

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
