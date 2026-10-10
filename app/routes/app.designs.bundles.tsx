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
import { FONTS } from "../lib/designs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";

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
  const [{ config, saved }, theme, bundles, style] = await Promise.all([getBundleDesign(admin), getThemeStatus(admin, session.shop).catch(() => null), listBundles(admin).catch(() => []), getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE)]);
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
const WEIGHTS = [300, 400, 500, 600, 700, 800].map((w) => ({ value: String(w), label: { 300: "Light", 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold", 800: "Extra bold" }[w] as string }));

/** A colour that can follow the theme ("") or be set. */
function MaybeColor({ label, value, fallback, onValue }: { label: string; value: string; fallback: string; onValue: (v: string) => void }) {
  return (
    <s-stack gap="small-200">
      {value ? <ColorField label={label} value={value} onValue={onValue} /> : <s-text type="strong">{label}</s-text>}
      <Checkbox label="From my theme" checked={!value} onValue={(on) => onValue(on ? "" : fallback)} />
    </s-stack>
  );
}

export default function BundleDesigner() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const [tab, setTab] = useState<DesignTab>("content");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [view, setView] = useState<"page" | "collection">("page");
  const [group, setGroup] = useState<"text" | "cards" | "images" | "buttons" | "summary" | "colours">("cards");
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
  const card = part("card"), image = part("image"), type = part("type"), pickButton = part("pickButton"), summaryLook = part("summaryLook"), layout = part("layout");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });
  const bundle = data.bundles[which];
  // The link opens the theme editor on the bundle's page while the unsaved changes are stored as a draft.
  const previewLink = `https://${data.shop}/admin/themes/current/editor?previewPath=${encodeURIComponent(bundle?.handle ? `/products/${bundle.handle}` : "/collections/all")}`;
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" });
  const pageLook = previewTheme(data.style);
  const blockLook = cfg.look.scheme ? previewTheme(data.style, cfg.look.scheme) : null;

  return (
    <s-page heading="Bundles" inlineSize="large">
      <CategoryCrumb feature="bundles" />
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
          <FeatureTabs feature="bundles" />
          <s-text color="subdued">
            Create bundles, their steps and products in the Mix & match tab. Here you choose how the builder looks on the bundle product’s page. One design for all your bundles. In the theme editor you only place the “Bundle builder” block.
          </s-text>
          {!data.saved ? (
            <s-banner tone="info" heading="Not saved yet">
              Your store uses the standard look until you save here.
            </s-banner>
          ) : null}
          {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs tabs={["looks", "content", "layout", "style"]} value={tab} onChange={setTab} />
          <div className={ui.layout}>
            <s-stack gap="base">

          <Pane show={tab === "looks"}>
            <ThemeStylePanel style={data.style} scheme={cfg.look.scheme} onScheme={(id) => look({ scheme: id })} onMatch={() => setCfg((c) => matchBundleTheme(c, c.look.scheme))} />
          </Pane>
          <Pane show={tab === "looks"}>
            <LookPicker presets={BUNDLE_PRESETS} config={cfg} apply={applyBundlePreset} onPick={(key) => setCfg((c) => applyBundlePreset(c, key))} render={(c) => <ThemeLook style={data.style}><BundlePreview config={c} bundle={bundle} currency={data.currency} phone={false} page={pageLook} block={c.look.scheme ? previewTheme(data.style, c.look.scheme) : null} /></ThemeLook>} />
          </Pane>
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
                    <NumberField label="Space between cards" suffix="px" min={0} max={40} step={1} value={cfg.card.gap} onValue={(v) => card({ gap: v })} />
                    <Select label="On phones" value={cfg.layout.mobile} onValue={(v) => { layout({ mobile: v as C["layout"]["mobile"] }); setDevice("phone"); }} options={[{ value: "grid", label: "Grid (rows of cards)" }, { value: "swipe", label: "One row you swipe" }]} />
                    <NumberField label="Maximum width" details="0 = as wide as the page" suffix="px" min={0} max={1600} step={20} value={cfg.layout.maxWidth} onValue={(v) => layout({ maxWidth: v })} />
                    <span />
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
                <Segmented
                  label="Style group"
                  value={group}
                  onChange={setGroup}
                  options={[
                    { value: "cards", label: "Cards" },
                    { value: "buttons", label: "Buttons" },
                    { value: "text", label: "Text" },
                    { value: "images", label: "Images" },
                    { value: "summary", label: "Summary" },
                    { value: "colours", label: "Colours" },
                  ]}
                />
              </Pane>

              <Pane show={tab === "style" && group === "text"}>
                <s-section heading="Heading">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Size" value={cfg.text.size} onValue={(v) => text({ size: v as C["text"]["size"] })} options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} />
                    <Select label="Alignment" value={cfg.text.align} onValue={(v) => text({ align: v as C["text"]["align"] })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
                  </s-grid>
                </s-section>
              </Pane>

              <Pane show={tab === "style" && group === "text"}>
                <s-section heading="Text">
                  <s-stack gap="base">
                    <Select label="Font" value={cfg.type.font} onValue={(v) => type({ font: v as C["type"]["font"] })} options={FONTS.map((f) => ({ value: f.value, label: f.label }))} />
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <NumberField label="Product name size" suffix="px" min={11} max={28} step={1} value={cfg.type.nameSize} onValue={(v) => type({ nameSize: v })} />
                      <Select label="Product name weight" value={String(cfg.type.nameWeight)} onValue={(v) => type({ nameWeight: Number(v) })} options={WEIGHTS} />
                      <NumberField label="Price size" suffix="px" min={11} max={28} step={1} value={cfg.type.priceSize} onValue={(v) => type({ priceSize: v })} />
                      <Select label="Price weight" value={String(cfg.type.priceWeight)} onValue={(v) => type({ priceWeight: Number(v) })} options={WEIGHTS} />
                      <MaybeColor label="Product name colour" value={cfg.type.nameColor} fallback="#121212" onValue={(v) => type({ nameColor: v })} />
                      <MaybeColor label="Price colour" value={cfg.type.priceColor} fallback="#121212" onValue={(v) => type({ priceColor: v })} />
                      <NumberField label="Step title size" suffix="px" min={12} max={32} step={1} value={cfg.type.stepSize} onValue={(v) => type({ stepSize: v })} />
                      <Select label="Step counter (1 / 2)" value={cfg.type.counter} onValue={(v) => type({ counter: v as C["type"]["counter"] })} options={[{ value: "text", label: "Plain text" }, { value: "pill", label: "Coloured pill" }]} />
                    </s-grid>
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "style" && group === "cards"}>
                <s-section heading="Product cards">
                  <s-stack gap="base">
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <Select label="Card style" value={cfg.card.style} onValue={(v) => card({ style: v as C["card"]["style"] })} options={[{ value: "outline", label: "Outline" }, { value: "filled", label: "Filled" }, { value: "shadow", label: "Shadow" }, { value: "plain", label: "Plain (no box)" }]} />
                      <Select label="Text alignment" value={cfg.card.align} onValue={(v) => card({ align: v as C["card"]["align"] })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }]} />
                      <NumberField label="Border width" suffix="px" min={0} max={4} step={1} value={cfg.card.borderWidth} onValue={(v) => card({ borderWidth: v })} />
                      <NumberField label="Inner spacing" suffix="px" min={0} max={24} step={1} value={cfg.card.padding} onValue={(v) => card({ padding: v })} />
                      <MaybeColor label="Card background" value={cfg.card.bg} fallback="#ffffff" onValue={(v) => card({ bg: v })} />
                      <MaybeColor label="Border colour" value={cfg.card.border} fallback="#dddddd" onValue={(v) => card({ border: v })} />
                      <MaybeColor label="Picked card border" value={cfg.card.pickedBorder} fallback="#111111" onValue={(v) => card({ pickedBorder: v })} />
                    </s-grid>
                    <Checkbox label="Tint the picked card" checked={cfg.card.pickedTint} onValue={(v) => card({ pickedTint: v })} />
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "style" && group === "images"}>
                <s-section heading="Product images">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Shape" value={cfg.image.ratio} onValue={(v) => image({ ratio: v as C["image"]["ratio"] })} options={[{ value: "1 / 1", label: "Square" }, { value: "4 / 5", label: "Portrait (4:5)" }, { value: "3 / 4", label: "Tall (3:4)" }, { value: "16 / 9", label: "Wide (16:9)" }]} />
                    <Select label="Fit" value={cfg.image.fit} onValue={(v) => image({ fit: v as C["image"]["fit"] })} options={[{ value: "cover", label: "Fill the shape" }, { value: "contain", label: "Show the whole picture" }]} />
                    <Checkbox label="Image corners follow the card" checked={cfg.image.radius < 0} onValue={(v) => image({ radius: v ? -1 : 8 })} />
                    {cfg.image.radius >= 0 ? <NumberField label="Image corners" suffix="px" min={0} max={40} step={1} value={cfg.image.radius} onValue={(v) => image({ radius: v })} /> : <span />}
                  </s-grid>
                </s-section>
              </Pane>

              <Pane show={tab === "style" && group === "buttons"}>
                <s-section heading="Add buttons">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Button style" value={cfg.pickButton.style} onValue={(v) => pickButton({ style: v as C["pickButton"]["style"] })} options={[{ value: "outline", label: "Outline" }, { value: "filled", label: "Filled" }, { value: "text", label: "Text link" }]} />
                    <NumberField label="Corners" details="99 = pill" suffix="px" min={0} max={99} step={1} value={cfg.pickButton.radius} onValue={(v) => pickButton({ radius: v })} />
                    <NumberField label="Height" suffix="px" min={28} max={56} step={1} value={cfg.pickButton.height} onValue={(v) => pickButton({ height: v })} />
                    <NumberField label="Text size" suffix="px" min={11} max={20} step={1} value={cfg.pickButton.size} onValue={(v) => pickButton({ size: v })} />
                    <Select label="Text weight" value={String(cfg.pickButton.weight)} onValue={(v) => pickButton({ weight: Number(v) })} options={WEIGHTS} />
                    <Checkbox label="CAPITAL LETTERS" checked={cfg.pickButton.upper} onValue={(v) => pickButton({ upper: v })} />
                    <MaybeColor label="Background" value={cfg.pickButton.bg} fallback="#ffffff" onValue={(v) => pickButton({ bg: v })} />
                    <MaybeColor label="Text" value={cfg.pickButton.text} fallback="#121212" onValue={(v) => pickButton({ text: v })} />
                    <MaybeColor label="Border" value={cfg.pickButton.border} fallback="#dddddd" onValue={(v) => pickButton({ border: v })} />
                    <span />
                    <MaybeColor label="Picked: background" value={cfg.pickButton.pickedBg} fallback="#111111" onValue={(v) => pickButton({ pickedBg: v })} />
                    <MaybeColor label="Picked: text" value={cfg.pickButton.pickedText} fallback="#ffffff" onValue={(v) => pickButton({ pickedText: v })} />
                  </s-grid>
                </s-section>
              </Pane>

              <Pane show={tab === "style" && group === "summary"}>
                <s-section heading="Summary and main button">
                  <s-stack gap="base">
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <MaybeColor label="Summary background" value={cfg.summaryLook.bg} fallback="#f5f5f5" onValue={(v) => summaryLook({ bg: v })} />
                      <MaybeColor label="Summary text" value={cfg.summaryLook.text} fallback="#121212" onValue={(v) => summaryLook({ text: v })} />
                      <Checkbox label="Summary corners follow the cards" checked={cfg.summaryLook.radius < 0} onValue={(v) => summaryLook({ radius: v ? -1 : 12 })} />
                      {cfg.summaryLook.radius >= 0 ? <NumberField label="Summary corners" suffix="px" min={0} max={40} step={1} value={cfg.summaryLook.radius} onValue={(v) => summaryLook({ radius: v })} /> : <span />}
                    </s-grid>
                    <Switch label="My own colours for the Add bundle to cart button" details="Off: it looks like your theme's Add to cart button." checked={cfg.summaryLook.customButton} onValue={(v) => summaryLook({ customButton: v })} />
                    {cfg.summaryLook.customButton ? (
                      <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                        <ColorField label="Button background" value={cfg.summaryLook.btnBg} onValue={(v) => summaryLook({ btnBg: v })} />
                        <ColorField label="Button text" value={cfg.summaryLook.btnText} onValue={(v) => summaryLook({ btnText: v })} />
                        <NumberField label="Button corners" details="99 = pill" suffix="px" min={0} max={99} step={1} value={cfg.summaryLook.btnRadius} onValue={(v) => summaryLook({ btnRadius: v })} />
                      </s-grid>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "style" && group === "colours"}>
                <s-section heading="Picked colour and card corners">
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
