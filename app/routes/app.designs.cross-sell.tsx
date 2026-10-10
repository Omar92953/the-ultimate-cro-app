/* eslint-disable @typescript-eslint/no-explicit-any -- GraphQL node payloads */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage, gql } from "../lib/admin.server";
import { editorLinks, getThemeStatus, listRules } from "../lib/cro.server";
import { getCrossSellDesign, saveCrossSellDesign } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { firstProduct, productForRule } from "../lib/preview-products.server";
import { FALLBACK_STYLE, previewTheme } from "../lib/theme-style";
import { ThemeLook, ThemeStylePanel } from "../components/ThemeStyle";
import { applyCrossSellPreset, CROSS_SELL_PRESETS, matchCrossSellTheme, withCrossSellDefaults, type CrossSellDesign } from "../lib/cross-sell-design";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextField } from "../components/fields";
import { CrossSellDesignPreview, CrossSellDrawerPreview, SAMPLE_CROSS_SELL, type CrossSellOffer } from "../components/CrossSellDesignPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, rules, style] = await Promise.all([
    getCrossSellDesign(admin),
    getThemeStatus(admin, session.shop).catch(() => null),
    listRules(admin, "cross_sell").catch(() => []),
    getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE),
  ]);
  // The merchant's own offers with real product pictures and prices.
  const picked = rules
    .filter((r) => r.offeredProducts.length)
    .sort((a, b) => Number(b.active) - Number(a.active))
    .slice(0, 6);
  const ids = [...new Set(picked.flatMap((r) => r.offeredProducts.slice(0, 6).map((p) => p.id)))];
  const prices = new Map<string, number>();
  if (ids.length) {
    const d = await gql(admin, `#graphql\n query CroCrossPrices($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id priceRangeV2 { minVariantPrice { amount } } } } }`, { ids }).catch(() => null);
    for (const n of d?.nodes ?? []) if (n?.id) prices.set(n.id, Math.round(Number(n.priceRangeV2?.minVariantPrice?.amount ?? 0) * 100));
  }
  const offers: (CrossSellOffer & { name: string; handle: string | null })[] = await Promise.all(
    picked.map(async (r) => ({
      name: r.name,
      headline: r.headline,
      subheadline: r.subheadline,
      button: r.buttonLabel,
      pct: r.discountPercent,
      items: r.offeredProducts.slice(0, 6).map((p) => ({ title: p.title, image: p.image ?? null, cents: prices.get(p.id) ?? 0 })),
      handle: (await productForRule(admin, r))?.handle ?? null,
    })),
  );
  const sample = offers.length ? null : await firstProduct(admin).catch(() => null);
  return { config, saved, offers, sampleHandle: sample?.handle ?? null, currency: sample?.currency ?? "USD", style, shop: session.shop, css: storefrontCss("ucro.css"), inTheme: theme ? theme.installed.cross_sell : null, addLink: editorLinks(session.shop).cross_sell };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const draft = form.get("intent") === "draft";
    const config = await saveCrossSellDesign(admin, withCrossSellDefaults(JSON.parse(String(form.get("config")))), draft);
    return { ok: true, draft, error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type C = CrossSellDesign;

export default function CrossSellDesigner() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const [tab, setTab] = useState<DesignTab>("content");
  const [which, setWhich] = useState(0);
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
    else shopify.toast.show("Cross-sell design saved — live on your store");
  }, [fetcher.state, fetcher.data, shopify]);

  const part = <K extends Exclude<keyof C, "scheme">>(k: K) => (patch: Partial<C[K]>) => setCfg((c) => ({ ...c, [k]: { ...(c[k] as object), ...patch } }));
  const products = part("products"), heading = part("heading"), look = part("look"), space = part("space"), drawer = part("drawer");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });
  const offer = data.offers[which] ?? SAMPLE_CROSS_SELL;
  const handle = data.offers[which]?.handle ?? data.sampleHandle;
  const previewLink = `https://${data.shop}/admin/themes/current/editor?previewPath=${encodeURIComponent(handle ? `/products/${handle}` : "/collections/all")}`;
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" });
  const pageLook = previewTheme(data.style);
  const blockLook = cfg.scheme ? previewTheme(data.style, cfg.scheme) : null;

  return (
    <s-page heading="Cross-sell offers" inlineSize="large">
      <CategoryCrumb feature="cross_sell" />
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={previewLink} target="_blank" onClick={seeOnStore}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to product page"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="cross_sell" />
          <s-text color="subdued">
            Products, headline and discount come from your Cross-sell offers. Here you choose how they look. In the theme editor you only place the “Cross-sell offers” block (product or cart page).
          </s-text>
          {!data.saved ? (
            <s-banner tone="info" heading="Not saved yet">
              Your store uses the standard look until you save here.
            </s-banner>
          ) : null}
          {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs tabs={["looks", "content", "style", "display"]} value={tab} onChange={setTab} />
          <div className={ui.layout}>
            <s-stack gap="base">

          <Pane show={tab === "looks"}>
            <ThemeStylePanel style={data.style} scheme={cfg.scheme} onScheme={(id) => setCfg((c) => ({ ...c, scheme: id }))} onMatch={() => setCfg((c) => matchCrossSellTheme(c, c.scheme))} />
          </Pane>
          <Pane show={tab === "looks"}>
            <LookPicker
              presets={CROSS_SELL_PRESETS}
              config={cfg}
              apply={applyCrossSellPreset}
              onPick={(key) => setCfg((c) => applyCrossSellPreset(c, key))}
              render={(c) => <ThemeLook style={data.style}><CrossSellDesignPreview config={c} offer={offer} currency={data.currency} page={pageLook} block={c.scheme ? previewTheme(data.style, c.scheme) : null} /></ThemeLook>}
            />
          </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Products and button">
                  <s-stack gap="base">
                    <TextField label="Button text" details="Used when an offer doesn't set its own." value={cfg.products.button} onValue={(v) => products({ button: v })} />
                    <Select
                      label="When no offer matches the page"
                      value={cfg.products.fallback}
                      onValue={(v) => products({ fallback: v as C["products"]["fallback"] })}
                      options={[{ value: "none", label: "Show nothing" }, { value: "recommendations", label: "Show Shopify's product recommendations" }]}
                    />
                    {cfg.products.fallback === "recommendations" ? (
                      <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                        <TextField label="Recommendations heading" value={cfg.products.recHeading} onValue={(v) => products({ recHeading: v })} />
                        <NumberField label="How many" min={2} max={10} step={1} value={cfg.products.recLimit} onValue={(v) => products({ recLimit: v })} />
                      </s-grid>
                    ) : null}
                    <s-text color="subdued">Products are never ticked in advance: shoppers choose the extras themselves.</s-text>
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Cart drawer">
                  <s-stack gap="base">
                    <s-text color="subdued">For offers with “Cart drawer” ticked, shown inside your theme’s slide-out cart (turn on the “Cart drawer offers” embed in the theme editor).</s-text>
                    <TextField label="Heading" details="Used when an offer has no headline of its own." value={cfg.drawer.heading} onValue={(v) => drawer({ heading: v })} />
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <NumberField label="Products to show" min={1} max={4} step={1} value={cfg.drawer.max} onValue={(v) => drawer({ max: v })} />
                      <TextField label="Add button text" value={cfg.drawer.add} onValue={(v) => drawer({ add: v })} />
                    </s-grid>
                    <Checkbox label="Use the same colours and corners as the offers block" checked={cfg.drawer.matchLook} onValue={(v) => drawer({ matchLook: v })} />
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Heading">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Size" value={cfg.heading.size} onValue={(v) => heading({ size: v as C["heading"]["size"] })} options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} />
                    <Select label="Alignment" value={cfg.heading.align} onValue={(v) => heading({ align: v as C["heading"]["align"] })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
                  </s-grid>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Panel, colours and corners">
                  <s-stack gap="base">
                    <Switch label="Background panel" checked={cfg.look.panel} onValue={(v) => look({ panel: v })} />
                    {cfg.look.panel ? <Checkbox label="Panel edge to edge on phones" checked={cfg.look.edge} onValue={(v) => look({ edge: v })} /> : null}
                    <Checkbox label="Use my theme's colours" checked={cfg.look.themeColors} onValue={(v) => look({ themeColors: v })} />
                    {!cfg.look.themeColors ? (
                      <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                        <ColorField label="Tick" value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                        <ColorField label="Product border" value={cfg.look.border} onValue={(v) => look({ border: v })} />
                        {cfg.look.panel ? <ColorField label="Panel" value={cfg.look.panelColor} onValue={(v) => look({ panelColor: v })} /> : null}
                      </s-grid>
                    ) : null}
                    <Checkbox label="Match my theme's corners" checked={cfg.look.themeRadius} onValue={(v) => look({ themeRadius: v })} />
                    {!cfg.look.themeRadius ? <NumberField label="Corner radius" suffix="px" min={0} max={40} step={2} value={cfg.look.radius} onValue={(v) => look({ radius: v })} /> : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "display"}>
                <s-section heading="Spacing and devices">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <NumberField label="Space above" suffix="px" min={0} max={80} step={4} value={cfg.space.top} onValue={(v) => space({ top: v })} />
                    <NumberField label="Space below" suffix="px" min={0} max={80} step={4} value={cfg.space.bottom} onValue={(v) => space({ bottom: v })} />
                    <Select label="Show on" value={cfg.space.devices} onValue={(v) => space({ devices: v as C["space"]["devices"] })} options={[{ value: "all", label: "Desktop and mobile" }, { value: "desktop", label: "Desktop only" }, { value: "mobile", label: "Mobile only" }]} />
                  </s-grid>
                </s-section>
              </Pane>
            </s-stack>

            <PreviewFrame title={data.offers.length ? "Product page · your offer" : "Product page · example offer"}>
              {data.offers.length > 1 ? (
                <div style={{ padding: "10px 20px 0" }}>
                  <Select label="Offer to preview" value={String(which)} onValue={(v) => setWhich(Number(v))} options={data.offers.map((o, i) => ({ value: String(i), label: o.name || `Offer ${i + 1}` }))} />
                </div>
              ) : null}
              <ThemeLook style={data.style}>
                <CrossSellDesignPreview key={which} config={cfg} offer={offer} currency={data.currency} page={pageLook} block={blockLook} />
                <p style={{ margin: "8px 20px 6px", fontSize: 12, color: "#616161" }}>In the cart drawer</p>
                <CrossSellDrawerPreview config={cfg} offer={offer} currency={data.currency} page={pageLook} />
              </ThemeLook>
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
