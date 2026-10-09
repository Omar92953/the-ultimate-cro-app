/* eslint-disable @typescript-eslint/no-explicit-any -- GraphQL node payloads */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage, gql, type AdminClient } from "../lib/admin.server";
import { editorLinks, getThemeStatus, listBundles } from "../lib/cro.server";
import { getBundleDesign, saveBundleDesign, saveDraft } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE, previewTheme } from "../lib/theme-style";
import { ThemeLook, ThemeStylePanel } from "../components/ThemeStyle";
import { applyBundlePreset, BUNDLE_PRESETS, matchBundleTheme, toStorefrontBundle, withBundleDesignDefaults, type BundleDesign } from "../lib/bundle-design";
import type { Bundle } from "../lib/types";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextField } from "../components/fields";
import { Segmented } from "../components/ui";
import { BundlePreview, type PreviewBundle, type PreviewItem } from "../components/BundlePreview";
import { BundleCollectionPreview } from "../components/BundleCollectionPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";

/** The merchant's bundles with prices and pictures (collection steps: their first 8 products). */
async function previewBundles(admin: AdminClient, bundles: Bundle[]): Promise<{ list: PreviewBundle[]; currency: string }> {
  const ids = [...new Set(bundles.flatMap((b) => [...(b.product ? [b.product.id] : []), ...b.steps.flatMap((s) => (s.products.length ? s.products.map((p) => p.id) : s.collection ? [s.collection.id] : []))]))];
  if (!ids.length) return { list: [], currency: "USD" };
  const PRODUCT = `id title handle featuredMedia { preview { image { url } } } priceRangeV2 { minVariantPrice { amount currencyCode } }`;
  const data = await gql(
    admin,
    `#graphql
    query CroBundlePreview($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product { ${PRODUCT} }
        ... on Collection { id products(first: 8) { nodes { ${PRODUCT} } } }
      }
    }`,
    { ids },
  );
  let currency = "USD";
  const item = (p: any): PreviewItem => {
    const m = p?.priceRangeV2?.minVariantPrice;
    if (m?.currencyCode) currency = m.currencyCode;
    return { title: p?.title ?? "", image: p?.featuredMedia?.preview?.image?.url ?? null, cents: Math.round(Number(m?.amount ?? 0) * 100) };
  };
  const byId = new Map<string, any>((data.nodes ?? []).filter(Boolean).map((n: any) => [n.id, n]));
  const list = bundles
    .filter((b) => b.steps.length)
    .sort((a, b) => Number(b.active) - Number(a.active))
    .slice(0, 10)
    .map((b) => ({
      name: b.name,
      handle: b.product ? (byId.get(b.product.id)?.handle as string | undefined) : undefined,
      pricing: { kind: b.pricing, percent: b.percentOff },
      price: b.product ? item(byId.get(b.product.id)).cents : 0,
      steps: b.steps.map((s) => ({
        label: s.label,
        min: s.required ? Math.max(1, s.min) : 0,
        max: Math.max(1, s.max),
        items: (s.products.length ? s.products.map((p) => byId.get(p.id)) : s.collection ? (byId.get(s.collection.id)?.products?.nodes ?? []) : []).filter(Boolean).slice(0, 8).map(item),
      })),
    }));
  return { list, currency };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, bundles, style] = await Promise.all([getBundleDesign(admin), getThemeStatus(admin).catch(() => null), listBundles(admin).catch(() => []), getThemeStyle(admin).catch(() => FALLBACK_STYLE)]);
  const { list, currency } = await previewBundles(admin, bundles).catch(() => ({ list: [] as PreviewBundle[], currency: "USD" }));
  return { config, saved, bundles: list, currency, style, shop: session.shop, css: storefrontCss("ucro.css") + storefrontCss("ucro-bundle-tray.css"), inTheme: theme ? theme.installed.bundles : null, addLink: editorLinks(session.shop).bundles };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const clean = withBundleDesignDefaults(JSON.parse(String(form.get("config"))));
    if (form.get("intent") === "draft") {
      await saveDraft(admin, "bundles", toStorefrontBundle(clean));
      return { ok: true, draft: true, error: null, config: null };
    }
    const config = await saveBundleDesign(admin, clean);
    return { ok: true, draft: false, error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type C = BundleDesign;

export default function BundleDesigner() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const [tab, setTab] = useState<DesignTab>("content");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [view, setView] = useState<"page" | "collection">("page");
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
    else shopify.toast.show("Bundle builder design saved — live on your store");
  }, [fetcher.state, fetcher.data, shopify]);

  const part = <K extends keyof C>(k: K) => (patch: Partial<C[K]>) => setCfg((c) => ({ ...c, [k]: { ...(c[k] as object), ...patch } }));
  const text = part("text"), products = part("products"), summary = part("summary"), button = part("button"), look = part("look"), tray = part("tray");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });
  const bundle = data.bundles[which];
  // The link opens the theme editor on the bundle's page while the unsaved changes are stored as a draft.
  const previewLink = `https://${data.shop}/admin/themes/current/editor?previewPath=${encodeURIComponent(bundle?.handle ? `/products/${bundle.handle}` : "/collections/all")}`;
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" });
  const pageLook = previewTheme(data.style);
  const blockLook = cfg.look.scheme ? previewTheme(data.style, cfg.look.scheme) : null;

  return (
    <s-page heading="Bundle builder design" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/bundles">
        Bundles
      </s-link>
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={previewLink} target="_blank" onClick={seeOnStore}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href="/app/bundles">
        Manage bundles
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to product page"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <s-text color="subdued">
            Create bundles, their steps and products in “Manage bundles”. Here you choose how the builder looks on the bundle product’s page. One design for all your bundles. In the theme editor you only place the “Bundle builder” block.
          </s-text>
          {!data.saved ? (
            <s-banner tone="info" heading="Not saved yet">
              Your store uses the standard look until you save here.
            </s-banner>
          ) : null}
          {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs tabs={["looks", "content", "layout", "style"]} value={tab} onChange={setTab} />

          <Pane show={tab === "looks"}>
            <ThemeStylePanel style={data.style} scheme={cfg.look.scheme} onScheme={(id) => look({ scheme: id })} onMatch={() => setCfg((c) => matchBundleTheme(c, c.look.scheme))} />
          </Pane>
          <Pane show={tab === "looks"}>
            <LookPicker presets={BUNDLE_PRESETS} config={cfg} apply={applyBundlePreset} onPick={(key) => setCfg((c) => applyBundlePreset(c, key))} swatch={(c) => ({ accent: c.look.themeAccent ? pageLook.accent : c.look.accent, radius: c.look.themeRadius ? pageLook.radius : c.look.radius, cards: c.products.desktop })} />
          </Pane>

          <div className={ui.layout}>
            <s-stack gap="base">
              <Pane show={tab === "content"}>
                <s-section heading="Heading">
                  <s-stack gap="base">
                    <TextField label="Heading" value={cfg.text.heading} onValue={(v) => text({ heading: v })} />
                    <TextField label="Subheading" value={cfg.text.sub} onValue={(v) => text({ sub: v })} />
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Words">
                  <s-stack gap="base">
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <TextField label="Pick button" value={cfg.products.pick} onValue={(v) => products({ pick: v })} />
                      <TextField label="Picked button" value={cfg.products.picked} onValue={(v) => products({ picked: v })} />
                    </s-grid>
                    <TextField label="Value text" details="[amount] is the total of the separate prices." value={cfg.summary.value} onValue={(v) => summary({ value: v })} />
                    <TextField label="Saving text" details="[amount] and [percent] become the saving." value={cfg.summary.save} onValue={(v) => summary({ save: v })} />
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Building it anywhere in the store">
                  <s-stack gap="base">
                    <s-text color="subdued">For bundles with “Let shoppers build it anywhere”: the Add to bundle buttons and the bundle tray.</s-text>
                    <TextField label="Add to bundle button" value={cfg.tray.add} onValue={(v) => tray({ add: v })} />
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <TextField label="Tray: add to cart" value={cfg.tray.cart} onValue={(v) => { tray({ cart: v }); setView("collection"); }} />
                      <TextField label="Tray: checkout" value={cfg.tray.checkout} onValue={(v) => { tray({ checkout: v }); setView("collection"); }} />
                    </s-grid>
                    <Select label="Tray position" value={cfg.tray.position} onValue={(v) => { tray({ position: v as C["tray"]["position"] }); setView("collection"); }} options={[{ value: "bottom", label: "Bottom centre" }, { value: "right", label: "Bottom right" }]} />
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Add to cart">
                  <s-stack gap="base">
                    <Switch label="Use my theme's Add to cart button" details="Hides the builder's button; your theme's button adds the bundle once it's complete. Express checkout buttons are hidden on that page." checked={cfg.button.theme} onValue={(v) => button({ theme: v })} />
                    {!cfg.button.theme ? (
                      <>
                        <TextField label="Button text" value={cfg.button.label} onValue={(v) => button({ label: v })} />
                        <TextField label="Button text while choosing" details="[remaining] becomes the number still to choose." value={cfg.button.remaining} onValue={(v) => button({ remaining: v })} />
                      </>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "layout"}>
                <s-section heading="Products and summary">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <NumberField label="Columns on desktop" min={2} max={6} step={1} value={cfg.products.desktop} onValue={(v) => { products({ desktop: v }); setDevice("desktop"); }} />
                    <NumberField label="Columns on mobile" min={1} max={3} step={1} value={cfg.products.mobile} onValue={(v) => { products({ mobile: v }); setDevice("phone"); }} />
                    <NumberField label="Space above" suffix="px" min={0} max={80} step={4} value={cfg.look.top} onValue={(v) => look({ top: v })} />
                    <NumberField label="Space below" suffix="px" min={0} max={80} step={4} value={cfg.look.bottom} onValue={(v) => look({ bottom: v })} />
                  </s-grid>
                  <s-box paddingBlockStart="base">
                    <s-stack gap="base">
                      <Switch label="Show the summary and saving" checked={cfg.summary.show} onValue={(v) => summary({ show: v })} />
                      <Switch label="Keep the summary visible while scrolling" checked={cfg.summary.sticky} onValue={(v) => summary({ sticky: v })} />
                    </s-stack>
                  </s-box>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Heading">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Size" value={cfg.text.size} onValue={(v) => text({ size: v as C["text"]["size"] })} options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} />
                    <Select label="Alignment" value={cfg.text.align} onValue={(v) => text({ align: v as C["text"]["align"] })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
                  </s-grid>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Colour and corners">
                  <s-stack gap="base">
                    <Checkbox label="Picked items use my theme's button colour" checked={cfg.look.themeAccent} onValue={(v) => look({ themeAccent: v })} />
                    {!cfg.look.themeAccent ? <ColorField label="Picked item colour" value={cfg.look.accent} onValue={(v) => look({ accent: v })} /> : null}
                    <Checkbox label="Match my theme's corners" checked={cfg.look.themeRadius} onValue={(v) => look({ themeRadius: v })} />
                    {!cfg.look.themeRadius ? <NumberField label="Corner radius" suffix="px" min={0} max={40} step={2} value={cfg.look.radius} onValue={(v) => look({ radius: v })} /> : null}
                  </s-stack>
                </s-section>
              </Pane>
            </s-stack>

            <PreviewFrame
              title={bundle ? `Bundle page · ${bundle.name}` : "Bundle page · example"}
              tools={
                <span style={{ display: "inline-flex", gap: 6 }}>
                  <Segmented label="Page" value={view} options={[{ value: "page", label: "Bundle page" }, { value: "collection", label: "Collection page" }]} onChange={setView} />
                  {view === "page" ? <Segmented label="Device" value={device} options={[{ value: "desktop", label: "Desktop" }, { value: "phone", label: "Phone" }]} onChange={setDevice} /> : null}
                </span>
              }
            >
              {data.bundles.length > 1 ? (
                <div style={{ padding: "10px 16px 0" }}>
                  <Select label="Bundle to preview" value={String(which)} onValue={(v) => setWhich(Number(v))} options={data.bundles.map((b, i) => ({ value: String(i), label: b.name || `Bundle ${i + 1}` }))} />
                </div>
              ) : null}
              <ThemeLook style={data.style}>
{view === "collection" ? (
                  <BundleCollectionPreview key={`c${which}`} config={cfg} bundle={bundle} currency={data.currency} page={pageLook} block={blockLook} pricing={bundle?.pricing} />
                ) : (
                  <BundlePreview key={which} config={cfg} bundle={bundle} currency={data.currency} phone={device === "phone"} page={pageLook} block={blockLook} />
                )}
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
