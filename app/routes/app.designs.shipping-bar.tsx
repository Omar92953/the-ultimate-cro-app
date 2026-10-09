import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage, gql } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { getShippingBar, saveShippingBar } from "../lib/designs.server";
import { SHIPPING_BAR_PRESETS, withShippingBarDefaults, type ShippingBarConfig } from "../lib/shipping-bar";
import { Checkbox, ColorField, NumberField, Select, Switch, TextField, Button } from "../components/fields";
import { ShippingBarPreview } from "../components/ShippingBarPreview";
import ui from "../components/PageEditor.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, currency] = await Promise.all([
    getShippingBar(admin),
    getThemeStatus(admin).catch(() => null),
    gql(admin, `#graphql
      query CroShopCurrency { shop { currencyCode } }`)
      .then((d) => d.shop.currencyCode as string)
      .catch(() => "USD"),
  ]);
  return { config, saved, currency, css: storefrontCss("ucs-sections.css"), inTheme: theme ? theme.installed.shipping_bar : null, addLink: sectionLinks(session.shop).shipping_bar };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveShippingBar(admin, withShippingBarDefaults(JSON.parse(String(form.get("config")))));
    return { ok: true, error: null, config };
  } catch (e) {
    return { ok: false, error: errorMessage(e), config: null };
  }
};

type C = ShippingBarConfig;
const LOOK: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, padding: 8, font: "inherit", textAlign: "left", cursor: "pointer", background: "#fff", border: "1px solid #e3e3e3", borderRadius: 10, minWidth: 0, overflow: "hidden" };
const PAGES: { value: C["where"]["pages"][number]; label: string }[] = [
  { value: "home", label: "Home page" },
  { value: "product", label: "Product pages" },
  { value: "collection", label: "Collection pages" },
  { value: "cart", label: "Cart page" },
  { value: "other", label: "All other pages" },
];

export default function ShippingBarDesigner() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const [cart, setCart] = useState(Math.round(data.config.goal * 0.6));
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [loaded, setLoaded] = useState(data.config);
  if (loaded !== data.config) {
    setLoaded(data.config);
    setCfg(data.config);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show("Free shipping bar saved — live on your store");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const part = <K extends "text" | "show" | "where" | "look">(k: K) => (patch: Partial<C[K]>) => setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));
  const text = part("text"), show = part("show"), where = part("where"), look = part("look");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });

  return (
    <s-page heading="Free shipping bar" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to header"}
      </Button>
      <s-stack gap="base">
        {data.inTheme === false ? (
          <s-banner tone="info" heading="Place the bar in your theme">
            Click “Add to header” and save there. You can also add the “Free shipping bar” block to product or cart pages from the theme editor. Everything else is set here.
          </s-banner>
        ) : null}
        <s-banner tone="warning">
          Set the same amount as your free shipping rate in Settings → Shipping and delivery. The bar shows the goal; Shopify’s shipping rates give the free shipping.
        </s-banner>
        {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}
        <style dangerouslySetInnerHTML={{ __html: data.css }} />

        <s-section heading="Start from a look">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
            {SHIPPING_BAR_PRESETS.map((p) => (
              <button key={p.key} type="button" style={LOOK} aria-label={`Use the ${p.title} look`} onClick={() => setCfg((c) => ({ ...c, look: { ...c.look, ...p.look } }))}>
                <span style={{ display: "block", overflow: "hidden", borderRadius: 6, pointerEvents: "none" }} aria-hidden="true">
                  <ShippingBarPreview config={{ ...cfg, look: { ...cfg.look, ...p.look, size: 12 } }} total={cart} currency={data.currency} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#303030" }}>{p.title}</span>
              </button>
            ))}
          </div>
        </s-section>

        <div className={ui.layout}>
          <s-stack gap="base">
            <s-section heading="Goal and messages">
              <s-stack gap="base">
                <NumberField label="Free shipping from" suffix={data.currency} min={1} max={1000000} step={1} value={cfg.goal} onValue={(v) => setCfg((c) => ({ ...c, goal: v }))} />
                <TextField label="Empty cart" details="{goal} shows the amount." value={cfg.text.empty} onValue={(v) => text({ empty: v })} />
                <TextField label="On the way" details="{left} shows what's still needed." value={cfg.text.progress} onValue={(v) => text({ progress: v })} />
                <TextField label="Goal reached" value={cfg.text.done} onValue={(v) => text({ done: v })} />
              </s-stack>
            </s-section>

            <s-section heading="What shows">
              <s-stack gap="base">
                <Switch label="Free shipping bar" details="Off: it disappears from your store." checked={cfg.on} onValue={(v) => setCfg((c) => ({ ...c, on: v }))} />
                <Switch label="Progress line" checked={cfg.show.bar} onValue={(v) => show({ bar: v })} />
                <Switch label="Also inside the cart drawer" details="Works with Dawn and most themes made by Shopify." checked={cfg.show.drawer} onValue={(v) => show({ drawer: v })} />
                <Switch label="Show when the cart is empty" checked={cfg.show.whenEmpty} onValue={(v) => show({ whenEmpty: v })} />
                <Switch label="Little celebration when the goal is reached" checked={cfg.show.celebrate} onValue={(v) => show({ celebrate: v })} />
                <Select label="Icon" value={cfg.show.icon} onValue={(v) => show({ icon: v as C["show"]["icon"] })} options={[{ value: "truck", label: "Delivery truck" }, { value: "gift", label: "Gift" }, { value: "none", label: "No icon" }]} />
              </s-stack>
            </s-section>

            <s-section heading="Where it shows">
              <s-stack gap="base">
                <Checkbox label="On all pages" checked={cfg.where.all} onValue={(v) => where({ all: v })} />
                {!cfg.where.all ? (
                  <s-stack gap="small-200">
                    {PAGES.map((p) => (
                      <Checkbox key={p.value} label={p.label} checked={cfg.where.pages.includes(p.value)} onValue={(on) => where({ pages: on ? [...cfg.where.pages, p.value] : cfg.where.pages.filter((x) => x !== p.value) })} />
                    ))}
                  </s-stack>
                ) : null}
                <Select label="Devices" value={cfg.where.devices} onValue={(v) => where({ devices: v as C["where"]["devices"] })} options={[{ value: "all", label: "Desktop and mobile" }, { value: "desktop", label: "Desktop only" }, { value: "mobile", label: "Mobile only" }]} />
              </s-stack>
            </s-section>

            <s-section heading="Look">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <Select label="Shape" value={cfg.look.style} onValue={(v) => look({ style: v as C["look"]["style"] })} options={[{ value: "bar", label: "Full-width bar" }, { value: "card", label: "Rounded card" }]} />
                <NumberField label="Corners (card)" details="999 = pill" suffix="px" min={0} max={999} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                <ColorField label="Background" value={cfg.look.bg} onValue={(v) => look({ bg: v })} />
                <ColorField label="Text" value={cfg.look.text} onValue={(v) => look({ text: v })} />
                <ColorField label="Progress line" value={cfg.look.fill} onValue={(v) => look({ fill: v })} />
                <ColorField label="Line when reached" value={cfg.look.done} onValue={(v) => look({ done: v })} />
                <ColorField label="Line background" value={cfg.look.track} onValue={(v) => look({ track: v })} />
                <NumberField label="Line thickness" suffix="px" min={2} max={14} step={1} value={cfg.look.barHeight} onValue={(v) => look({ barHeight: v })} />
                <NumberField label="Text size" suffix="px" min={10} max={22} step={1} value={cfg.look.size} onValue={(v) => look({ size: v })} />
                <Select label="Text weight" value={String(cfg.look.weight)} onValue={(v) => look({ weight: Number(v) })} options={[{ value: "400", label: "Regular" }, { value: "500", label: "Medium" }, { value: "600", label: "Semibold" }, { value: "700", label: "Bold" }]} />
                <NumberField label="Space above and below" suffix="px" min={2} max={30} step={1} value={cfg.look.height} onValue={(v) => look({ height: v })} />
              </s-grid>
              <s-box paddingBlockStart="base">
                <Checkbox label="CAPITAL LETTERS" checked={cfg.look.upper} onValue={(v) => look({ upper: v })} />
              </s-box>
            </s-section>
          </s-stack>

          <div className={ui.preview}>
            <div className={ui.previewBar}>
              <span>Live preview</span>
            </div>
            <div className={ui.frame} style={{ padding: 16 }}>
              <s-stack gap="base">
                <ShippingBarPreview config={cfg} total={cart} currency={data.currency} />
                <NumberField label="Try a cart total" suffix={data.currency} min={0} max={1000000} step={5} value={cart} onValue={setCart} />
              </s-stack>
            </div>
          </div>
        </div>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
