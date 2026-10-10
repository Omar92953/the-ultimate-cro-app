import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage } from "../lib/admin.server";
import { editorLinks, getThemeStatus, listRules } from "../lib/cro.server";
import { getUpsellDesign, saveDraft, saveUpsellDesign } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { firstProduct, productForRule } from "../lib/preview-products.server";
import { FALLBACK_STYLE, previewTheme } from "../lib/theme-style";
import { ThemeLook, ThemeStylePanel } from "../components/ThemeStyle";
import { applyUpsellPreset, matchUpsellTheme, toStorefrontUpsell, UPSELL_PRESETS, withUpsellDefaults, type UpsellDesign } from "../lib/upsell-design";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextField } from "../components/fields";
import { SAMPLE_OFFER, UpsellDesignPreview, type PreviewOffer } from "../components/UpsellDesignPreview";
import type { PreviewProduct } from "../lib/preview-products.server";
import ui from "../components/PageEditor.module.css";
import { LookPicker } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, rules, style] = await Promise.all([
    getUpsellDesign(admin),
    getThemeStatus(admin, session.shop).catch(() => null),
    listRules(admin, "upsell").catch(() => []),
    getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE),
  ]);
  // The merchant's own offers, each on a real product it shows on, so the preview matches the store.
  const picked = rules
    .filter((r) => r.tiers.length)
    .sort((a, b) => Number(b.active) - Number(a.active))
    .slice(0, 6);
  const products = await Promise.all(picked.map((r) => productForRule(admin, r)));
  const fallback = picked.length ? null : await firstProduct(admin).catch(() => null);
  const offers: (PreviewOffer & { name: string; product: PreviewProduct | null })[] = picked.map((r, i) => ({
    name: r.name,
    headline: r.headline,
    subheadline: r.subheadline,
    variant: r.upsellType === "variant",
    optionName: r.optionName,
    tiers: r.tiers,
    product: products[i],
  }));
  return { config, saved, offers, fallback, style, shop: session.shop, css: storefrontCss("ucro.css"), inTheme: theme ? theme.installed.upsell : null, addLink: editorLinks(session.shop).upsell };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const clean = withUpsellDefaults(JSON.parse(String(form.get("config"))));
    if (form.get("intent") === "draft") {
      await saveDraft(admin, "upsell", toStorefrontUpsell(clean));
      return { ok: true, draft: true, error: null, config: null };
    }
    const config = await saveUpsellDesign(admin, clean);
    return { ok: true, draft: false, error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type C = UpsellDesign;
const DEVICES = [
  { value: "all", label: "Desktop and mobile" },
  { value: "desktop", label: "Desktop only" },
  { value: "mobile", label: "Mobile only" },
];

const editorPreviewLinkFor = (shop: string, handle?: string) => `https://${shop}/admin/themes/current/editor?previewPath=${encodeURIComponent(handle ? `/products/${handle}` : "/collections/all")}`;

export default function UpsellDesigner() {
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
    else shopify.toast.show("Upsell design saved — live on your store");
  }, [fetcher.state, fetcher.data, shopify]);

  const part = <K extends keyof C>(k: K) => (patch: Partial<C[K]>) => setCfg((c) => ({ ...c, [k]: { ...(c[k] as object), ...patch } }));
  const offers = part("offers"), heading = part("heading"), look = part("look"), space = part("space");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });
  const offer = data.offers[which] ?? SAMPLE_OFFER;
  const product = data.offers[which]?.product ?? data.fallback;
  const previewLink = editorPreviewLinkFor(data.shop, product?.handle);
  // The link opens the theme editor in a new tab while the unsaved changes are stored as a draft.
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" });
  const pageLook = previewTheme(data.style);
  const blockLook = cfg.look.scheme ? previewTheme(data.style, cfg.look.scheme) : null;

  return (
    <s-page heading="Upsell offers" inlineSize="large">
      <CategoryCrumb feature="upsell" />
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
          <FeatureTabs feature="upsell" />
          <s-text color="subdued">
            The offers, prices and discounts come from your Upsell offers. Here you choose how they look on the product page. In the theme editor you only place the “Upsell offers” block.
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
            <ThemeStylePanel style={data.style} scheme={cfg.look.scheme} onScheme={(id) => look({ scheme: id })} onMatch={() => setCfg((c) => matchUpsellTheme(c, c.look.scheme))} />
          </Pane>
          <Pane show={tab === "looks"}>
            <LookPicker presets={UPSELL_PRESETS} config={cfg} apply={applyUpsellPreset} onPick={(key) => setCfg((c) => applyUpsellPreset(c, key))} render={(c) => <ThemeLook style={data.style}><UpsellDesignPreview config={c} offer={offer} product={product} currency={product?.currency} page={pageLook} block={c.look.scheme ? previewTheme(data.style, c.look.scheme) : null} /></ThemeLook>} />
          </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Offers">
                  <s-stack gap="base">
                    <Select label="Style" details="Cards: one box per offer. Grouped list: one box with a row per offer." value={cfg.offers.style} onValue={(v) => offers({ style: v as C["offers"]["style"] })} options={[{ value: "cards", label: "Cards" }, { value: "list", label: "Grouped list" }]} />
                    <TextField label="Offer name" details="[quantity] becomes the number, e.g. Buy 2. Size offers show the size instead." value={cfg.offers.label} onValue={(v) => offers({ label: v })} />
                    <Switch label="Show the saving" checked={cfg.offers.showSaving} onValue={(v) => offers({ showSaving: v })} />
                    {cfg.offers.showSaving ? <TextField label="Saving text" details="[percent] becomes the discount, e.g. Save 10%." value={cfg.offers.saving} onValue={(v) => offers({ saving: v })} /> : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Sizes and button">
                  <s-stack gap="base">
                    <Switch label="Let shoppers pick a size for each item" details="For products with sizes: choosing Buy 2 shows two size pickers." checked={cfg.offers.perItem} onValue={(v) => offers({ perItem: v })} />
                    {cfg.offers.perItem ? <TextField label="Item picker label" details="[n] becomes the item number." value={cfg.offers.itemLabel} onValue={(v) => offers({ itemLabel: v })} /> : null}
                    <Switch label="Show a separate Add to cart button" details="Off: shoppers use your theme's normal Add to cart button." checked={cfg.offers.ownButton} onValue={(v) => offers({ ownButton: v })} />
                    {cfg.offers.ownButton ? <TextField label="Button text" value={cfg.offers.button} onValue={(v) => offers({ button: v })} /> : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Heading">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Style" value={cfg.heading.style} onValue={(v) => heading({ style: v as C["heading"]["style"] })} options={[{ value: "heading", label: "Heading" }, { value: "label", label: "Small caps label" }]} />
                    {cfg.heading.style === "heading" ? (
                      <Select label="Size" value={cfg.heading.size} onValue={(v) => heading({ size: v as C["heading"]["size"] })} options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} />
                    ) : null}
                    <Select label="Alignment" value={cfg.heading.align} onValue={(v) => heading({ align: v as C["heading"]["align"] })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
                  </s-grid>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Colours and corners">
                  <s-stack gap="base">
                    <Checkbox label="Use my theme's colours" checked={cfg.look.themeColors} onValue={(v) => look({ themeColors: v })} />
                    {!cfg.look.themeColors ? (
                      <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                        <ColorField label="Selected offer" value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                        <ColorField label="Offer border" value={cfg.look.border} onValue={(v) => look({ border: v })} />
                        <ColorField label="Badge background" value={cfg.look.badgeBg} onValue={(v) => look({ badgeBg: v })} />
                        <ColorField label="Badge text" value={cfg.look.badgeText} onValue={(v) => look({ badgeText: v })} />
                        {cfg.offers.style === "cards" ? <ColorField label="Saving tag colour" value={cfg.look.saveBg} onValue={(v) => look({ saveBg: v })} /> : null}
                        <ColorField label="Saving text" value={cfg.look.saveText} onValue={(v) => look({ saveText: v })} />
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
                    {cfg.offers.style === "cards" ? <NumberField label="Space between offers" suffix="px" min={0} max={40} step={2} value={cfg.space.gap} onValue={(v) => space({ gap: v })} /> : null}
                    <NumberField label="Space above" suffix="px" min={0} max={80} step={4} value={cfg.space.top} onValue={(v) => space({ top: v })} />
                    <NumberField label="Space below" suffix="px" min={0} max={80} step={4} value={cfg.space.bottom} onValue={(v) => space({ bottom: v })} />
                    <Select label="Show on" value={cfg.space.devices} onValue={(v) => space({ devices: v as C["space"]["devices"] })} options={DEVICES} />
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
                <UpsellDesignPreview config={cfg} offer={offer} product={product} currency={product?.currency} page={pageLook} block={blockLook} />
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
