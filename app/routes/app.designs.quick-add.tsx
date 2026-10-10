/* eslint-disable @typescript-eslint/no-explicit-any -- GraphQL node payloads */
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
import { getQuickAddDesign, saveQuickAddDesign } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { matchQuickAdd } from "../lib/theme-match";
import { ThemeLook, ThemeMatch } from "../components/ThemeStyle";
import { applyQuickAddPreset, QUICK_ADD_PRESETS, withQuickAddDefaults, type QuickAddDesign } from "../lib/quick-add-design";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextField } from "../components/fields";
import { QuickAddDesignPreview, type QuickAddProduct } from "../components/QuickAddDesignPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, style, products] = await Promise.all([
    getQuickAddDesign(admin),
    getThemeStatus(admin, session.shop).catch(() => null),
    getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE),
    gql(admin, `#graphql\n query CroQaProducts { products(first: 3, query: "status:active") { nodes { title featuredMedia { preview { image { url } } } priceRangeV2 { minVariantPrice { amount currencyCode } } } } }`)
      .then((d) =>
        (d.products?.nodes ?? []).map((p: any): QuickAddProduct => {
          const m = p.priceRangeV2?.minVariantPrice;
          let price = "";
          try {
            price = new Intl.NumberFormat("en", { style: "currency", currency: m?.currencyCode ?? "USD" }).format(Number(m?.amount ?? 0));
          } catch {
            price = String(m?.amount ?? "");
          }
          return { title: p.title, image: p.featuredMedia?.preview?.image?.url ?? null, price };
        }),
      )
      .catch(() => [] as QuickAddProduct[]),
  ]);
  return { config, saved, products, style, domain: session.shop, css: storefrontCss("ucs-quick-add.css"), inTheme: theme ? theme.installed.quick_add : null, addLink: sectionLinks(session.shop).quick_add };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const draft = form.get("intent") === "draft";
    const config = await saveQuickAddDesign(admin, withQuickAddDefaults(JSON.parse(String(form.get("config")))), draft);
    return { ok: true, draft, error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type C = QuickAddDesign;

export default function QuickAddDesigner() {
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
    else shopify.toast.show("Quick add saved — live on your store");
  }, [fetcher.state, fetcher.data, shopify]);

  const part = <K extends Exclude<keyof C, "scheme">>(k: K) => (patch: Partial<C[K]>) => setCfg((c) => ({ ...c, [k]: { ...(c[k] as object), ...patch } }));
  const button = part("button"), after = part("after"), popup = part("popup"), advanced = part("advanced");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" });

  return (
    <s-page heading="Quick add to cart" inlineSize="large">
      <CategoryCrumb feature="quick_add" />
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?previewPath=%2Fcollections%2Fall`} target="_blank" onClick={seeOnStore}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Turn on in theme"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="quick_add" />
          <s-text color="subdued">A button on every product card (collections, home, search, recommendations). Products with sizes or colours open a small picker. In the theme editor you only switch the “Quick add to cart” embed on.</s-text>
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
            <ThemeMatch style={data.style} config={cfg} setConfig={setCfg} match={matchQuickAdd} />
          </Pane>
          <Pane show={tab === "looks"}>
            <LookPicker presets={QUICK_ADD_PRESETS} config={cfg} apply={applyQuickAddPreset} onPick={(key) => setCfg((c) => applyQuickAddPreset(c, key))} render={(c) => <ThemeLook style={data.style}><QuickAddDesignPreview config={c} products={data.products} /></ThemeLook>} />
          </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="After adding">
                  <s-stack gap="base">
                    <Select
                      label="Then"
                      value={cfg.after.mode}
                      onValue={(v) => after({ mode: v as C["after"]["mode"] })}
                      options={[
                        { value: "toast", label: "Show the “Added to your cart” popup" },
                        { value: "theme", label: "Open my theme's cart drawer" },
                        { value: "cart", label: "Go to the cart page" },
                      ]}
                    />
                    {cfg.after.mode === "toast" ? (
                      <>
                        <TextField label="Popup message" value={cfg.after.added} onValue={(v) => after({ added: v })} />
                        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                          <TextField label="View cart button" value={cfg.after.viewCart} onValue={(v) => after({ viewCart: v })} />
                          <TextField label="Checkout button" value={cfg.after.checkoutText} onValue={(v) => after({ checkoutText: v })} />
                          <NumberField label="Hide the popup after" details="0 = stays until closed" suffix="sec" min={0} max={10} step={1} value={cfg.after.autohide} onValue={(v) => after({ autohide: v })} />
                        </s-grid>
                        <Switch label="Show a Checkout button in the popup" checked={cfg.after.checkout} onValue={(v) => after({ checkout: v })} />
                      </>
                    ) : null}
                    <TextField label="Add button in the size picker" value={cfg.after.add} onValue={(v) => after({ add: v })} />
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Button on the card">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Icon" value={cfg.button.icon} onValue={(v) => button({ icon: v as C["button"]["icon"] })} options={[{ value: "bag", label: "Bag" }, { value: "plus", label: "Plus" }, { value: "cart", label: "Cart" }]} />
                    <Select label="Shape" value={cfg.button.shape} onValue={(v) => button({ shape: v as C["button"]["shape"] })} options={[{ value: "circle", label: "Circle" }, { value: "square", label: "Rounded square" }]} />
                    <NumberField label="Size" suffix="px" min={28} max={60} step={1} value={cfg.button.size} onValue={(v) => button({ size: v })} />
                    <Select label="Position on image" value={cfg.button.position} onValue={(v) => button({ position: v as C["button"]["position"] })} options={[{ value: "br", label: "Bottom right" }, { value: "bl", label: "Bottom left" }, { value: "tr", label: "Top right" }, { value: "tl", label: "Top left" }]} />
                    <ColorField label="Button colour" value={cfg.button.bg} onValue={(v) => button({ bg: v })} />
                    <ColorField label="Icon colour" value={cfg.button.fg} onValue={(v) => button({ fg: v })} />
                  </s-grid>
                  <s-box paddingBlockStart="base">
                    <Checkbox label="Show a tick after adding" checked={cfg.button.addedState} onValue={(v) => button({ addedState: v })} />
                  </s-box>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Popup buttons">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <ColorField label="View cart background" value={cfg.popup.vcBg} onValue={(v) => popup({ vcBg: v })} />
                    <ColorField label="View cart text" value={cfg.popup.vcText} onValue={(v) => popup({ vcText: v })} />
                    <ColorField label="View cart border" value={cfg.popup.vcBorder} onValue={(v) => popup({ vcBorder: v })} />
                    <ColorField label="Checkout background" value={cfg.popup.coBg} onValue={(v) => popup({ coBg: v })} />
                    <ColorField label="Checkout text" value={cfg.popup.coText} onValue={(v) => popup({ coText: v })} />
                    <ColorField label="Checkout border" value={cfg.popup.coBorder} onValue={(v) => popup({ coBorder: v })} />
                    <NumberField label="Border width" suffix="px" min={0} max={4} step={1} value={cfg.popup.border} onValue={(v) => popup({ border: v })} />
                    <NumberField label="Corners" details="99 = pill" suffix="px" min={0} max={99} step={1} value={cfg.popup.radius} onValue={(v) => popup({ radius: v })} />
                  </s-grid>
                </s-section>
              </Pane>

              <Pane show={tab === "display"}>
                <s-section heading="Where it shows">
                  <s-stack gap="base">
                    <Select label="Show the button" value={cfg.button.show} onValue={(v) => button({ show: v as C["button"]["show"] })} options={[{ value: "always", label: "Always" }, { value: "hover", label: "When the mouse is over the card (desktop)" }]} />
                    <TextField label="Product card selector (advanced)" details="Only if the button doesn't appear on your theme's cards, e.g. .product-card. Leave empty to detect them." value={cfg.advanced.selector} onValue={(v) => advanced({ selector: v })} />
                  </s-stack>
                </s-section>
              </Pane>
            </s-stack>

            <PreviewFrame title={data.products.length ? "Collection page · your products" : "Collection page · example"}>
              <ThemeLook style={data.style}>
                <QuickAddDesignPreview config={cfg} products={data.products} />
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
