/**
 * The CRO sections' design pages (/app/designs/cro/<kind>): comparison table, benefits row, product tabs,
 * guarantee, before and after, shoppable image, recently viewed, how it works and the email pop up.
 * One page for all nine (lib/cro-sections.ts); Content and Style forms per kind in components/SecForms.tsx.
 * The preview runs the real storefront scripts (components/SecPreview.tsx).
 */
import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage, gql } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { getSec, saveSec } from "../lib/designs.server";
import { SEC_META, SEC_PRESETS, SEC_SIZES, applySecPreset, kindOfSlug, type SecConfig, type SecKind } from "../lib/cro-sections";
import { Button, Checkbox, ColorField, NumberField, Select, TextField } from "../components/fields";
import { Segmented } from "../components/ui";
import { SecContentForm, SecLayoutForm } from "../components/SecForms";
import { SecPreview } from "../components/SecPreview";
import ui from "../components/PageEditor.module.css";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook, ThemeMatch } from "../components/ThemeStyle";
import { matchSec } from "../lib/theme-match";
import { DesignTabs, Pane, type DesignTab, PreviewFrame } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";
import { LookPicker, templateInUse } from "../components/LookPicker";
import { SizesSection } from "../components/SizesSection";
import { slottedRoute } from "../lib/design-slot.server";
import { DesignSlots, useDesignAction } from "../components/DesignSlots";
import { SaveControls, changed } from "../components/SaveControls";

function kindOf(params: LoaderFunctionArgs["params"]): SecKind {
  const k = kindOfSlug(params.kind ?? "");
  if (!k) throw new Response("Not found", { status: 404 });
  return k;
}

/** Where each kind is added: inside the product's own section, below it, or as a home page section. */
const ADD: Record<SecKind, "cro_section" | "cro_section_product" | "cro_section_main" | "boosters"> = {
  compare_table: "cro_section_product",
  benefits: "cro_section",
  product_tabs: "cro_section_main",
  guarantee: "cro_section_main",
  before_after: "cro_section",
  shoppable: "cro_section",
  recently_viewed: "cro_section_product",
  how_it_works: "cro_section",
  email_popup: "boosters",
};

export const loader = async (args: LoaderFunctionArgs) => {
  const kind = kindOf(args.params);
  return slottedRoute([kind], async ({ request }: LoaderFunctionArgs) => {
    const { admin, session } = await authenticate.admin(request);
    const product = SEC_META[kind].page === "Product page";
    const [{ config, saved }, theme, style, first] = await Promise.all([
      getSec(admin, kind),
      getThemeStatus(admin, session.shop).catch(() => null),
      getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE),
      product ? gql(admin, `#graphql
        query CroSecFirstProduct { products(first: 1, sortKey: UPDATED_AT, reverse: true) { nodes { handle } } }`).catch(() => null) : Promise.resolve(null),
    ]);
    const handle: string | undefined = first?.products?.nodes?.[0]?.handle;
    const inTheme = theme ? (kind === "email_popup" ? theme.installed.boosters : theme.sections.includes(kind)) : null;
    return {
      kind,
      config: config as SecConfig,
      saved,
      style,
      domain: session.shop,
      previewPath: product && handle ? `/products/${handle}` : "/",
      runtime: { css: storefrontCss("ucs-sec.css") + storefrontCss(`ucs-sec-${kind}.css`), js: storefrontCss("ucs-sec.js") + "\n" + storefrontCss(`ucs-sec-${kind}.js`) },
      inTheme,
      addLink: sectionLinks(session.shop)[ADD[kind]],
    };
  })(args);
};

export const action = async (args: ActionFunctionArgs) => {
  const kind = kindOf(args.params);
  return slottedRoute([kind], async ({ request }: ActionFunctionArgs) => {
    const { admin } = await authenticate.admin(request);
    const form = await request.formData();
    const draft = form.get("intent") === "draft";
    try {
      const config = await saveSec(admin, kind, JSON.parse(String(form.get("config"))), draft);
      return { ok: true, draft, error: null, config: config as SecConfig };
    } catch (e) {
      return { ok: false, draft: false, error: errorMessage(e), config: null };
    }
  })(args);
};

type C = SecConfig;

export default function CroSectionDesigner() {
  const data = useLoaderData<typeof loader>();
  const kind = data.kind;
  const meta = SEC_META[kind];
  const [cfg, setCfg] = useState<C>(data.config);
  const [tab, setTab] = useState<DesignTab>("looks");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const fetcher = useFetcher<typeof action>();
  const designAction = useDesignAction();
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

  const look = (patch: Partial<C["look"]>) => setCfg((c) => ({ ...c, look: { ...c.look, ...patch } }));
  const layout = (patch: object) => setCfg((c) => ({ ...c, layout: { ...c.layout, ...patch } }) as C);
  const content = (patch: object) => setCfg((c) => ({ ...c, content: { ...c.content, ...patch } }) as C);
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post", action: designAction });
  const presets = SEC_PRESETS[kind] as { key: string; title: string }[];
  const apply = (c: C, key: string) => applySecPreset(c, key);
  const template = useMemo(() => templateInUse(presets, cfg, apply), [presets, cfg]);
  const popup = kind === "email_popup";
  const where = ADD[kind] === "cro_section_main" ? "inside the product information, under Add to cart" : meta.page === "Product page" ? "on the product page" : "on the home page (or any page)";

  return (
    <s-page heading={meta.title} inlineSize="large">
      <CategoryCrumb feature={kind} />
      <DemoButton feature={kind} template={template} />
      <SaveControls dirty={changed(cfg, data.config)} saving={fetcher.state !== "idle" && fetcher.formData?.get("intent") !== "draft"} saved={data.saved} onSave={save} onDiscard={() => setCfg(data.config)} />
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?previewPath=${encodeURIComponent(data.previewPath)}`} target="_blank" onClick={() => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post", action: designAction })}>
        Preview on store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : popup ? "Switch on in theme" : "Add to theme"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature={kind} />
          {popup ? null : <DesignSlots base={kind} blockName="CRO section" />}
          {data.inTheme === false ? (
            popup ? (
              <s-banner tone="info" heading="Switch on Conversion boosters">
                The pop up runs inside the Conversion boosters app embed. Click “Switch on in theme”, make sure Conversion boosters is on and save. Then turn the pop up on here.
              </s-banner>
            ) : (
              <s-banner tone="info" heading={`Place the ${meta.title.toLowerCase()} in your theme`}>
                Click “Add to theme”: a “CRO section” block is added {where}. In its settings choose Section: {meta.title}, drag it where you want it and save.
              </s-banner>
            )
          ) : null}
          {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}

          <div className={ui.layout}>
            <s-stack gap="base">
              <DesignTabs tabs={["looks", "content", "design"]} value={tab} onChange={setTab} />
              <Pane show={tab === "looks"}>
                <ThemeMatch style={data.style} config={cfg} setConfig={setCfg} match={matchSec} />
              </Pane>
              <Pane show={tab === "looks"}>
                <LookPicker
                  presets={presets}
                  config={cfg}
                  apply={apply}
                  onPick={(key) => setCfg((c) => apply(c, key))}
                  render={(c) => (
                    <ThemeLook style={data.style}>
                      <SecPreview config={c} runtime={data.runtime} />
                    </ThemeLook>
                  )}
                />
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading={popup ? "Heading" : "Heading (optional)"}>
                  <s-stack gap="base">
                    <TextField label="Heading" value={cfg.heading} onValue={(v) => setCfg((c) => ({ ...c, heading: v }))} />
                    <TextField label="Text under the heading" value={cfg.sub} onValue={(v) => setCfg((c) => ({ ...c, sub: v }))} />
                  </s-stack>
                </s-section>
              </Pane>
              <Pane show={tab === "content"}>
                <SecContentForm cfg={cfg} content={content} />
              </Pane>
              <Pane show={tab === "design"}>
                <s-section heading="Layout">
                  <SecLayoutForm cfg={cfg} layout={layout} />
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <s-section heading="Colours">
                  <s-stack gap="base">
                    {popup ? null : <Checkbox label="Own background colour" checked={cfg.look.ownBg} onValue={(v) => look({ ownBg: v })} details="Off: the page's own background." />}
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      {cfg.look.ownBg || popup ? <ColorField label="Background" value={cfg.look.bg} onValue={(v) => look({ bg: v })} /> : null}
                      <ColorField label="Text" value={cfg.look.text} onValue={(v) => look({ text: v })} />
                      <ColorField label="Buttons and markers" value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                      <ColorField label="Text on buttons" value={cfg.look.accentText} onValue={(v) => look({ accentText: v })} />
                      <ColorField label="Boxes" value={cfg.look.card} onValue={(v) => look({ card: v })} />
                      <ColorField label="Lines" value={cfg.look.line} onValue={(v) => look({ line: v })} />
                    </s-grid>
                  </s-stack>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <s-section heading="Size and spacing">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <NumberField label="Corners" suffix="px" min={0} max={40} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                    {popup ? null : <Select label="Alignment" value={cfg.look.align} onValue={(v) => look({ align: v as C["look"]["align"] })} options={[{ value: "center", label: "Centre" }, { value: "left", label: "Left" }]} />}
                    {popup ? null : <NumberField label="Widest" suffix="px" min={320} max={1600} step={20} value={cfg.look.width} onValue={(v) => look({ width: v })} />}
                    {popup ? null : <span />}
                    {popup ? null : <NumberField label="Space above" suffix="px" min={0} max={120} step={2} value={cfg.look.paddingTop} onValue={(v) => look({ paddingTop: v })} />}
                    {popup ? null : <NumberField label="Space below" suffix="px" min={0} max={120} step={2} value={cfg.look.paddingBottom} onValue={(v) => look({ paddingBottom: v })} />}
                  </s-grid>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <SizesSection specs={SEC_SIZES} value={cfg.sizes} onChange={(sizes) => setCfg((c) => ({ ...c, sizes }))} />
              </Pane>
            </s-stack>

            <PreviewFrame
              title={meta.page}
              width={device === "phone" ? 390 : 1000}
              tools={<Segmented label="Device" value={device} onChange={setDevice} options={[{ value: "desktop", label: "Computer" }, { value: "phone", label: "Phone" }]} />}
            >
              <ThemeLook style={data.style}>
                <SecPreview config={cfg} runtime={data.runtime} />
              </ThemeLook>
            </PreviewFrame>
          </div>
        </s-stack>
      </div>
    </s-page>
  );
}

/** Storing a draft for "Preview on store" must not reload the page (that would drop unsaved changes). */
export const shouldRevalidate: ShouldRevalidateFunction = ({ formData, defaultShouldRevalidate }) => (formData?.get("intent") === "draft" ? false : defaultShouldRevalidate);

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
