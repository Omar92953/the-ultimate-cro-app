import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage, gql } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { getShippingBar, saveShippingBar } from "../lib/designs.server";
import { FREE_SHIPPING_TITLE, getFreeShippingDiscount, syncFreeShippingDiscount } from "../lib/shipping-discount.server";
import { SHIPPING_BAR_PRESETS, withShippingBarDefaults, type ShippingBarConfig } from "../lib/shipping-bar";
import { Checkbox, ColorField, NumberField, Select, Switch, TextField, Button } from "../components/fields";
import { ShippingBarCartPreview, ShippingBarPreview } from "../components/ShippingBarPreview";
import { Segmented } from "../components/ui";
import ui from "../components/PageEditor.module.css";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook, ThemeMatch } from "../components/ThemeStyle";
import { matchShippingBar } from "../lib/theme-match";
import { DesignTabs, Pane, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";

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
  const discount = await getFreeShippingDiscount(admin).catch(() => null);
  return { style: await getThemeStyle(admin).catch(() => FALLBACK_STYLE), domain: session.shop, discount, discountTitle: FREE_SHIPPING_TITLE, config, saved, currency, css: storefrontCss("ucs-shipping-bar.css"), inTheme: theme ? theme.installed.shipping_bar : null, addLink: sectionLinks(session.shop).shipping_bar };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const draft = form.get("intent") === "draft";
    const config = await saveShippingBar(admin, withShippingBarDefaults(JSON.parse(String(form.get("config")))), draft);
    // The goal also becomes a real free shipping discount (the design is saved even if this fails).
    let discountError: string | null = null;
    if (!draft) await syncFreeShippingDiscount(admin, { on: config.on && config.autoDiscount, goal: config.goal }).catch((e) => (discountError = errorMessage(e)));
    return { ok: true, draft, error: null, discountError, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), discountError: null, config: null };
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
  const [tab, setTab] = useState<DesignTab>("content");
  const [cart, setCart] = useState(Math.round(data.config.goal * 0.6));
  const [view, setView] = useState<"cart" | "top">("cart");
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [loaded, setLoaded] = useState(data.config);
  if (loaded !== data.config) {
    setLoaded(data.config);
    setCfg(data.config);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok && fetcher.data.draft) shopify.toast.show("Your changes are in the theme editor preview (only you see them). Save here to put them live.");
    else if (fetcher.data.ok) shopify.toast.show("Free shipping bar saved — live on your store");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const part = <K extends "text" | "show" | "where" | "look">(k: K) => (patch: Partial<C[K]>) => setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));
  const text = part("text"), show = part("show"), where = part("where"), look = part("look");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });

  return (
    <s-page heading="Free shipping bar" inlineSize="large">
      <CategoryCrumb feature="shipping_bar" />
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?previewPath=${encodeURIComponent("/")}`} target="_blank" onClick={() => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" })}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to header"}
      </Button>
      <div className={ui.shell}>
      <s-stack gap="base">
        <FeatureTabs feature="shipping_bar" />
        {data.inTheme === false ? (
          <s-banner tone="info" heading="Place the bar in your theme">
            Click “Add to header” and save there. You can also add the “Free shipping bar” block to product or cart pages from the theme editor. Everything else is set here.
          </s-banner>
        ) : null}
        {cfg.autoDiscount ? (
          <s-banner tone="success">
            Free shipping is automatic: saving keeps the “{data.discountTitle}” discount (Shopify → Discounts) at your goal amount
            {data.discount?.on && data.discount.goal ? ` — now active from ${data.discount.goal} ${data.currency}` : ""}.
          </s-banner>
        ) : (
          <s-banner tone="warning">
            The bar only shows the goal. Give free shipping yourself (a free shipping rate in Settings → Shipping and delivery, or a discount), or switch on “Give free shipping automatically”.
          </s-banner>
        )}
        {fetcher.data && "discountError" in fetcher.data && fetcher.data.discountError ? <s-banner tone="critical" heading="The free shipping discount was not updated">{fetcher.data.discountError}</s-banner> : null}
        {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}
        <style dangerouslySetInnerHTML={{ __html: data.css }} />

        <DesignTabs tabs={["looks", "content", "style", "display"]} value={tab} onChange={setTab} />
        <div className={ui.layout}>
          <s-stack gap="base">
        <Pane show={tab === "looks"}>
          <ThemeMatch style={data.style} config={cfg} setConfig={setCfg} match={matchShippingBar} />
        </Pane>
        <Pane show={tab === "looks"}><s-section heading="Start from a look">
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
        </s-section></Pane>
            <Pane show={tab === "content"}><s-section heading="Goal and messages">
              <s-stack gap="base">
                <NumberField label="Free shipping from" suffix={data.currency} min={1} max={1000000} step={1} value={cfg.goal} onValue={(v) => setCfg((c) => ({ ...c, goal: v }))} />
                <Switch label="Give free shipping automatically" details={`Creates and updates the “${data.discountTitle}” automatic discount in Shopify: free shipping on orders from this amount. Off: the bar only shows the goal.`} checked={cfg.autoDiscount} onValue={(v) => setCfg((c) => ({ ...c, autoDiscount: v }))} />
                <TextField label="Empty cart" details="{goal} shows the amount." value={cfg.text.empty} onValue={(v) => text({ empty: v })} />
                <TextField label="On the way" details="{left} shows what's still needed." value={cfg.text.progress} onValue={(v) => text({ progress: v })} />
                <TextField label="Goal reached" value={cfg.text.done} onValue={(v) => text({ done: v })} />
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "content"}><s-section heading="What shows">
              <s-stack gap="base">
                <Switch label="Free shipping bar" details="Off: it disappears from your store." checked={cfg.on} onValue={(v) => setCfg((c) => ({ ...c, on: v }))} />
                <Switch label="Bar at the top of the store" details="Where you placed the block (e.g. the Header area). Off: it only shows inside the cart." checked={cfg.show.top} onValue={(v) => show({ top: v })} />
                <Switch label="Progress line" checked={cfg.show.bar} onValue={(v) => show({ bar: v })} />
                <Switch label="Show when the cart is empty" checked={cfg.show.whenEmpty} onValue={(v) => show({ whenEmpty: v })} />
                <Switch label="Little celebration when the goal is reached" checked={cfg.show.celebrate} onValue={(v) => show({ celebrate: v })} />
                <Select label="Icon" value={cfg.show.icon} onValue={(v) => show({ icon: v as C["show"]["icon"] })} options={[{ value: "truck", label: "Delivery truck" }, { value: "gift", label: "Gift" }, { value: "none", label: "No icon" }]} />
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "content"}><s-section heading="Inside the cart">
              <s-stack gap="base">
                <Switch label="In the cart drawer" details="Works with Dawn and most themes made by Shopify." checked={cfg.show.drawer} onValue={(v) => { show({ drawer: v }); setView("cart"); }} />
                <Switch label="On the cart page" checked={cfg.show.cartPage} onValue={(v) => show({ cartPage: v })} />
                {cfg.show.drawer || cfg.show.cartPage ? (
                  <Select label="Position in the cart" value={cfg.show.cartPos} onValue={(v) => { show({ cartPos: v as C["show"]["cartPos"] }); setView("cart"); }} options={[{ value: "top", label: "Above the products" }, { value: "bottom", label: "Above the checkout button" }]} />
                ) : null}
                <s-text color="subdued">Needs the “Conversion boosters” app embed switched on in the theme editor (it is on for most stores), or the bar block placed in your header.</s-text>
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "display"}><s-section heading="Where it shows">
              <s-stack gap="base">
                <s-text color="subdued">Pages for the bar at the top of the store. The cart copies follow “Inside the cart”.</s-text>
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
            </s-section></Pane>

            <Pane show={tab === "style"}><s-section heading="Look">
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
            </s-section></Pane>
          </s-stack>

          <div className={ui.preview}>
            <div className={ui.previewBar}>
              <span>Live preview</span>
              <Segmented label="Preview" value={view} options={[{ value: "cart", label: "In the cart" }, { value: "top", label: "Top of store" }]} onChange={(v) => setView(v as "cart" | "top")} />
            </div>
            <div className={ui.frame} style={{ padding: view === "cart" ? 0 : 16 }}>
              {view === "cart" ? (
                cfg.show.drawer ? (
                  <ThemeLook style={data.style}><ShippingBarCartPreview config={cfg} total={cart} currency={data.currency} /></ThemeLook>
                ) : (
                  <p style={{ padding: 24, textAlign: "center", color: "#616161" }}>Switch on “In the cart drawer” (Content tab) to show the bar in the cart.</p>
                )
              ) : cfg.show.top ? (
                <ThemeLook style={data.style}><ShippingBarPreview config={cfg} total={cart} currency={data.currency} /></ThemeLook>
              ) : (
                <p style={{ padding: 16, textAlign: "center", color: "#616161" }}>The bar at the top of the store is off.</p>
              )}
            </div>
            <div style={{ padding: "12px 16px" }}>
              <NumberField label="Try a cart total" suffix={data.currency} min={0} max={1000000} step={5} value={cart} onValue={setCart} />
            </div>
          </div>
        </div>
      </s-stack>
      </div>
    </s-page>
  );
}

/** Storing a draft for "See it on my store" must not reload the page (that would drop unsaved changes). */
export const shouldRevalidate: ShouldRevalidateFunction = ({ formData, defaultShouldRevalidate }) => (formData?.get("intent") === "draft" ? false : defaultShouldRevalidate);

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
