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
import { getFooter, listMenus, saveFooter } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook } from "../components/ThemeStyle";
import { applyFooterPreset, FOOTER_PRESETS, FOOTER_SIZES, SOCIALS, withFooterDefaults, type FooterColumn, type FooterColumnKind, type FooterDesign } from "../lib/footer-design";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextArea, TextField } from "../components/fields";
import { MediaPicker } from "../components/MediaPicker";
import { FooterPreview } from "../components/FooterPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker, templateInUse } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";
import { SizesSection } from "../components/SizesSection";
import { SortableList, arrayMove } from "../components/Sortable";
import { SaveControls, changed } from "../components/SaveControls";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, menus, style, shopName] = await Promise.all([
    getFooter(admin),
    getThemeStatus(admin, session.shop).catch(() => null),
    listMenus(admin).catch(() => []),
    getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE),
    gql(admin, `#graphql
      query CroFooterShop { shop { name } }`)
      .then((d) => d.shop.name as string)
      .catch(() => session.shop.replace(".myshopify.com", "")),
  ]);
  return {
    config,
    saved,
    menus,
    style,
    shop: shopName,
    domain: session.shop,
    css: storefrontCss("ucs-sections.css"),
    inTheme: theme ? theme.installed.footer : false,
    addLink: sectionLinks(session.shop).footer,
    navLink: `https://${session.shop}/admin/menus`,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveFooter(admin, withFooterDefaults(JSON.parse(String(form.get("config")))), form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type C = FooterDesign;
const KINDS: { value: FooterColumnKind; label: string }[] = [
  { value: "menu", label: "Menu (links)" },
  { value: "text", label: "Text" },
  { value: "newsletter", label: "Newsletter sign-up" },
  { value: "social", label: "Social icons" },
  { value: "logo", label: "Logo" },
];
const SOCIAL_LABELS: Record<(typeof SOCIALS)[number], string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", x: "X", youtube: "YouTube", whatsapp: "WhatsApp", snapchat: "Snapchat" };

export default function FooterDesigner() {
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
    else shopify.toast.show(data.inTheme ? "Footer saved and live on your store" : "Footer saved");
  }, [fetcher.state, fetcher.data, shopify, data.inTheme]);

  const part =
    <K extends "logo" | "social" | "newsletter" | "bottom" | "layout" | "look" | "space">(k: K) =>
    (patch: Partial<C[K]>) =>
      setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));
  const logo = part("logo"), social = part("social"), newsletter = part("newsletter"), bottom = part("bottom"), layout = part("layout"), space = part("space");
  const look = (patch: Partial<C["look"]>) => setCfg((c) => ({ ...c, scheme: "", look: { ...c.look, ...patch } }));
  const setCol = (id: string, patch: Partial<FooterColumn>) => setCfg((c) => ({ ...c, columns: c.columns.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const addCol = () => setCfg((c) => ({ ...c, columns: [...c.columns, { id: `c${Date.now().toString(36)}`, kind: "menu", title: "Links", menu: data.menus[0]?.handle ?? "footer", text: "" }] }));
  const removeCol = (id: string) => setCfg((c) => ({ ...c, columns: c.columns.filter((x) => x.id !== id) }));
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" });
  const menuOptions = data.menus.length ? data.menus.map((m) => ({ value: m.handle, label: m.title })) : [{ value: "footer", label: "Footer menu" }, { value: "main-menu", label: "Main menu" }];

  return (
    <s-page heading="Footer" inlineSize="large">
      <CategoryCrumb feature="footer" />
      <DemoButton feature="footer" template={templateInUse(FOOTER_PRESETS, cfg, applyFooterPreset)} />
      <SaveControls dirty={changed(cfg, data.config)} saving={fetcher.state !== "idle" && fetcher.formData?.get("intent") !== "draft"} saved={data.saved} onSave={save} onDiscard={() => setCfg(data.config)} />
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?previewPath=%2F`} target="_blank" onClick={seeOnStore}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to footer"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="footer" />
          <s-text color="subdued">
            Design your store’s footer here; in the theme editor you only place the “Footer” block in the Footer area. Menus come from{" "}
            <s-link href={data.navLink} target="_top">
              Online Store → Navigation
            </s-link>
            .
          </s-text>
          {!data.saved ? (
            <s-banner tone="info" heading="Not saved yet">
              The footer shows on your store after you save here and add the “Footer” block.
            </s-banner>
          ) : null}
          {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs tabs={["looks", "content", "design"]} value={tab} onChange={setTab} />
          <div className={ui.layout}>
            <s-stack gap="base">
              <Pane show={tab === "looks"}>
                <LookPicker
                  presets={FOOTER_PRESETS}
                  config={cfg}
                  apply={applyFooterPreset}
                  onPick={(key) => setCfg((c) => applyFooterPreset(c, key))}
                  render={(c) => (
                    <ThemeLook style={data.style}>
                      <FooterPreview config={c} menus={data.menus} shop={data.shop} />
                    </ThemeLook>
                  )}
                />
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Columns">
                  <s-stack gap="base">
                    <SortableList
                      items={cfg.columns}
                      keyOf={(x) => x.id}
                      labelOf={(x) => x.title || KINDS.find((k) => k.value === x.kind)!.label}
                      onMove={(from, to) => setCfg((c) => ({ ...c, columns: arrayMove(c.columns, from, to) }))}
                      render={(col, _i, handle) => (
                        <s-box padding="small-300" borderWidth="base" borderRadius="base">
                          <s-stack direction="inline" gap="small-300" alignItems="start">
                            {handle}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <s-stack gap="small-300">
                                <s-grid gridTemplateColumns="1fr 1fr" gap="small-300">
                                  <Select label="Shows" value={col.kind} onValue={(v) => setCol(col.id, { kind: v as FooterColumnKind })} options={KINDS} />
                                  <TextField label="Title" value={col.title} onValue={(v) => setCol(col.id, { title: v })} />
                                </s-grid>
                                {col.kind === "menu" ? (
                                  <Select label="Menu" value={col.menu} onValue={(v) => setCol(col.id, { menu: v })} options={menuOptions.some((o) => o.value === col.menu) ? menuOptions : [...menuOptions, { value: col.menu, label: `${col.menu} (not found)` }]} />
                                ) : (
                                  <TextArea label="Text" rows={3} value={col.text} onValue={(v) => setCol(col.id, { text: v })} />
                                )}
                                <Button variant="tertiary" tone="critical" icon="delete" onClick={() => removeCol(col.id)}>
                                  Remove column
                                </Button>
                              </s-stack>
                            </div>
                          </s-stack>
                        </s-box>
                      )}
                    />
                    {cfg.columns.length < 6 ? (
                      <Button icon="plus" onClick={addCol}>
                        Add column
                      </Button>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Logo">
                  <s-stack gap="base">
                    <MediaPicker label="Logo" details="Shown in a “Logo” column. Empty = your shop's name." accept="image" value={cfg.logo.image} onValue={(m) => logo({ image: m })} alt={data.shop} />
                    <NumberField label="Logo width" suffix="px" min={40} max={320} step={4} value={cfg.logo.width} onValue={(v) => logo({ width: v })} />
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Social links">
                  <s-stack gap="base">
                    <s-text color="subdued">Shown in a “Social icons” column. Leave empty to hide one.</s-text>
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      {SOCIALS.map((s) => (
                        <TextField key={s} label={SOCIAL_LABELS[s]} placeholder={s === "whatsapp" ? "https://wa.me/20…" : `https://${s === "x" ? "x" : s}.com/…`} value={cfg.social[s]} onValue={(v) => social({ [s]: v } as Partial<C["social"]>)} />
                      ))}
                    </s-grid>
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Newsletter sign-up">
                  <s-stack gap="base">
                    <s-text color="subdued">Emails go to Customers in Shopify (subscribed to marketing).</s-text>
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <TextField label="Email box" value={cfg.newsletter.placeholder} onValue={(v) => newsletter({ placeholder: v })} />
                      <TextField label="Button" value={cfg.newsletter.button} onValue={(v) => newsletter({ button: v })} />
                    </s-grid>
                    <TextField label="After signing up" value={cfg.newsletter.thanks} onValue={(v) => newsletter({ thanks: v })} />
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Bottom line">
                  <s-stack gap="base">
                    <TextField label="Copyright" details="{year} = this year, {shop} = your shop's name." value={cfg.bottom.copyright} onValue={(v) => bottom({ copyright: v })} />
                    <Checkbox label="Policy links (refund, privacy, terms)" checked={cfg.bottom.policies} onValue={(v) => bottom({ policies: v })} />
                    <Checkbox label="Payment icons" checked={cfg.bottom.payments} onValue={(v) => bottom({ payments: v })} />
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "design"}>
                <s-section heading="Layout">
                  <s-stack gap="base">
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <Select label="Alignment" value={cfg.layout.align} onValue={(v) => layout({ align: v as C["layout"]["align"] })} options={[{ value: "left", label: "Columns, left" }, { value: "center", label: "Centred, stacked" }]} />
                      <NumberField label="Width" suffix="px" min={600} max={1800} step={20} value={cfg.layout.maxWidth} onValue={(v) => layout({ maxWidth: v })} />
                      <NumberField label="Space between columns" suffix="px" min={8} max={80} step={2} value={cfg.layout.gap} onValue={(v) => layout({ gap: v })} />
                      <NumberField label="Button corners" suffix="px" min={0} max={40} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                    </s-grid>
                    <Checkbox label="Line above the bottom line" checked={cfg.layout.divider} onValue={(v) => layout({ divider: v })} />
                    <Switch label="Hide the theme's own footer" details="Keeps only this footer in the Footer area." checked={cfg.layout.hideTheme} onValue={(v) => layout({ hideTheme: v })} />
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "design"}>
                <s-section heading="Colours">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <ColorField label="Background" value={cfg.look.bg} onValue={(v) => look({ bg: v })} />
                    <ColorField label="Text" value={cfg.look.fg} onValue={(v) => look({ fg: v })} />
                    <ColorField label="Button" value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                    <ColorField label="Button text" value={cfg.look.onAccent} onValue={(v) => look({ onAccent: v })} />
                  </s-grid>
                </s-section>
              </Pane>

              <Pane show={tab === "design"}>
                <SizesSection specs={FOOTER_SIZES} value={cfg.sizes} onChange={(sizes) => setCfg((c) => ({ ...c, sizes }))} note="The logo width is under Content → Logo." />
              </Pane>

              <Pane show={tab === "design"}>
                <s-section heading="Spacing and devices">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <NumberField label="Space above" suffix="px" min={0} max={120} step={2} value={cfg.space.top} onValue={(v) => space({ top: v })} />
                    <NumberField label="Space below" suffix="px" min={0} max={120} step={2} value={cfg.space.bottom} onValue={(v) => space({ bottom: v })} />
                    <Select label="Devices" value={cfg.space.devices} onValue={(v) => space({ devices: v as C["space"]["devices"] })} options={[{ value: "all", label: "Desktop and mobile" }, { value: "desktop", label: "Desktop only" }, { value: "mobile", label: "Mobile only" }]} />
                  </s-grid>
                </s-section>
              </Pane>
            </s-stack>

            <PreviewFrame title="Your store · footer">
              <ThemeLook style={data.style}>
                <FooterPreview config={cfg} menus={data.menus} shop={data.shop} />
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
