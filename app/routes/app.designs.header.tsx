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
import { getHeader, saveHeader } from "../lib/designs.server";
import { PRESETS, applyPreset, withHeaderDefaults, type HeaderConfig } from "../lib/header";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextField } from "../components/fields";
import { MediaPicker } from "../components/MediaPicker";
import { Segmented } from "../components/ui";
import { HeaderPreview } from "../components/HeaderPreview";
import ui from "../components/PageEditor.module.css";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeMatch } from "../components/ThemeStyle";
import { matchHeader } from "../lib/theme-match";
import { DesignTabs, Pane, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, shopName] = await Promise.all([
    getHeader(admin),
    getThemeStatus(admin, session.shop).catch(() => null),
    gql(admin, `#graphql
      query CroShopName { shop { name } }`)
      .then((d) => d.shop.name as string)
      .catch(() => session.shop.replace(".myshopify.com", "")),
  ]);
  return {
    style: await getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE), domain: session.shop,
    config,
    saved,
    css: storefrontCss("ucs-header.css"),
    js: storefrontCss("ucs-header.js"),
    embedOn: theme ? theme.installed.header : null,
    embedLink: sectionLinks(session.shop).header,
    shop: shopName,
    navLink: `https://${session.shop}/admin/menus`,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveHeader(admin, withHeaderDefaults(JSON.parse(String(form.get("config")))), form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type C = HeaderConfig;

export default function HeaderDesigner() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const [tab, setTab] = useState<DesignTab>("content");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
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
    else if (fetcher.data.ok) shopify.toast.show(data.embedOn ? "Header saved — live on your store" : "Header saved");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify, data.embedOn]);

  const part = <K extends "logo" | "layout" | "menu" | "icons" | "button" | "look" | "mobile">(k: K) => (patch: Partial<C[K]>) => setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));
  const logo = part("logo"), layout = part("layout"), menu = part("menu"), icons = part("icons"), button = part("button"), look = part("look"), mobile = part("mobile");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });

  return (
    <s-page heading="Header" inlineSize="large">
      <CategoryCrumb feature="header" />
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?previewPath=${encodeURIComponent("/")}`} target="_blank" onClick={() => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" })}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.embedLink} target="_top" icon="theme-edit">
        {data.embedOn ? "Open in theme editor" : "Add to header"}
      </Button>
      <div className={ui.shell}>
      <s-stack gap="base">
        <FeatureTabs feature="header" />
        {data.embedOn === false ? (
          <s-banner tone="info" heading="Add the header to your theme">
            Design it here and click Save, then click “Add to header”: it’s added to your theme’s Header area. Save there. Your theme’s own header is hidden while it’s on, and comes back if you switch it off.
          </s-banner>
        ) : null}
        {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}

        <DesignTabs tabs={["looks", "content", "layout", "style", "display"]} value={tab} onChange={setTab} />
        <div className={ui.layout}>
          <s-stack gap="base">
        <Pane show={tab === "looks"}>
          <ThemeMatch style={data.style} config={cfg} setConfig={setCfg} match={matchHeader} />
        </Pane>
        <Pane show={tab === "looks"}><s-section heading="Start from a look">
          <s-grid gridTemplateColumns="repeat(auto-fill, minmax(180px, 1fr))" gap="small-200">
            {PRESETS.map((p) => (
              <s-clickable
                key={p.key}
                onClick={() => setCfg((c) => applyPreset(c, p.key))}
                borderWidth="base"
                borderRadius="base"
                padding="small-200"
                background={cfg.preset === p.key ? "subdued" : undefined}
                accessibilityLabel={`Use the ${p.title} look`}
              >
                <s-stack gap="small-100">
                  <s-text type="strong">
                    {cfg.preset === p.key ? "✓ " : ""}
                    {p.title}
                  </s-text>
                  <s-text color="subdued">{p.text}</s-text>
                </s-stack>
              </s-clickable>
            ))}
          </s-grid>
        </s-section></Pane>
            <Pane show={tab === "content"}><s-section heading="Header">
              <Switch label="Use this header on my store" details="Off: your theme's own header comes back." checked={cfg.on} onValue={(v) => setCfg((c) => ({ ...c, on: v }))} />
            </s-section></Pane>

            <Pane show={tab === "content"}><s-section heading="Logo">
              <s-stack gap="base">
                <MediaPicker label="Logo image" details="A PNG or SVG with a transparent background. Leave empty to show your store name." accept="image" value={cfg.logo.image} onValue={(v) => logo({ image: v })} alt="Logo" />
                {!cfg.logo.image ? <TextField label="Text instead of a logo" placeholder="Your store name" value={cfg.logo.text} onValue={(v) => logo({ text: v })} /> : null}
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <NumberField label="Logo width (desktop)" suffix="px" min={40} max={320} step={2} value={cfg.logo.width} onValue={(v) => logo({ width: v })} />
                  <NumberField label="Logo width on phones" suffix="px" min={30} max={220} step={2} value={cfg.logo.mobileWidth} onValue={(v) => logo({ mobileWidth: v })} />
                </s-grid>
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "layout"}><s-section heading="Layout">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <Select label="Logo" value={cfg.layout.logo} onValue={(v) => layout({ logo: v as C["layout"]["logo"] })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }]} />
                <Select
                  label="Menu"
                  value={cfg.layout.menu}
                  onValue={(v) => layout({ menu: v as C["layout"]["menu"] })}
                  options={[
                    { value: "left", label: cfg.layout.logo === "center" ? "Left of the logo" : "Next to the logo" },
                    { value: "center", label: "Centre" },
                    { value: "right", label: "Right, before the icons" },
                    { value: "below", label: "On a second line" },
                  ]}
                />
                <Select label="Width" value={cfg.layout.width} onValue={(v) => layout({ width: v as C["layout"]["width"] })} options={[{ value: "full", label: "Full width" }, { value: "contained", label: "Page width" }]} />
                <NumberField label="Height" suffix="px" min={44} max={120} step={2} value={cfg.layout.height} onValue={(v) => layout({ height: v })} />
                <Select
                  label="When scrolling"
                  value={cfg.layout.sticky}
                  onValue={(v) => layout({ sticky: v as C["layout"]["sticky"] })}
                  options={[
                    { value: "always", label: "Always stays on top" },
                    { value: "up", label: "Comes back when scrolling up" },
                    { value: "none", label: "Scrolls away" },
                  ]}
                />
                <Select
                  label="Over first section"
                  details="See-through headers look best over a big image."
                  value={cfg.layout.overlay}
                  onValue={(v) => layout({ overlay: v as C["layout"]["overlay"] })}
                  options={[
                    { value: "none", label: "No, above it" },
                    { value: "home", label: "On the home page" },
                    { value: "all", label: "On every page" },
                  ]}
                />
              </s-grid>
              <s-box paddingBlockStart="base">
                <s-stack gap="base">
                  <Checkbox label="Floating (space around the bar)" checked={cfg.layout.float} onValue={(v) => layout({ float: v })} />
                  {cfg.layout.float || cfg.layout.width === "contained" ? (
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      {cfg.layout.float ? <NumberField label="Space around" suffix="px" min={0} max={40} step={1} value={cfg.layout.margin} onValue={(v) => layout({ margin: v })} /> : <span />}
                      <NumberField label="Corners" details="999 = pill" suffix="px" min={0} max={999} step={1} value={cfg.layout.radius} onValue={(v) => layout({ radius: v })} />
                    </s-grid>
                  ) : null}
                </s-stack>
              </s-box>
            </s-section></Pane>

            <Pane show={tab === "content"}><s-section heading="Menu">
              <s-stack gap="base">
                <TextField
                  label="Menu"
                  details="The handle of a menu in Online Store → Navigation (main-menu is your main menu)."
                  value={cfg.menu.handle}
                  onValue={(v) => menu({ handle: v })}
                />
                <s-link href={data.navLink} target="_top">
                  Edit menus in Navigation
                </s-link>
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <Select label="Sub-menus open as" value={cfg.menu.dropdown} onValue={(v) => menu({ dropdown: v as C["menu"]["dropdown"] })} options={[{ value: "mega", label: "Mega menu (wide panel)" }, { value: "dropdown", label: "Small dropdown" }]} />
                  <NumberField label="Text size" suffix="px" min={11} max={22} step={1} value={cfg.menu.size} onValue={(v) => menu({ size: v })} />
                  <Select label="Text weight" value={String(cfg.menu.weight)} onValue={(v) => menu({ weight: Number(v) })} options={[{ value: "400", label: "Regular" }, { value: "500", label: "Medium" }, { value: "600", label: "Semibold" }, { value: "700", label: "Bold" }]} />
                  <NumberField label="Space between links" suffix="px" min={8} max={60} step={2} value={cfg.menu.gap} onValue={(v) => menu({ gap: v })} />
                </s-grid>
                <Checkbox label="Show collection pictures in sub-menus" checked={cfg.menu.images} onValue={(v) => menu({ images: v })} />
                <Checkbox label="Highlight links as pills" checked={cfg.menu.pill} onValue={(v) => menu({ pill: v })} />
                <Checkbox label="CAPITAL LETTERS" checked={cfg.menu.upper} onValue={(v) => menu({ upper: v })} />
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "content"}><s-section heading="Icons and button">
              <s-stack gap="base">
                <Checkbox label="Search (with live results)" checked={cfg.icons.search} onValue={(v) => icons({ search: v })} />
                <Checkbox label="Account" checked={cfg.icons.account} onValue={(v) => icons({ account: v })} />
                <Checkbox label="Cart" checked={cfg.icons.cart} onValue={(v) => icons({ cart: v })} />
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <Select label="Cart shows" value={cfg.icons.cartStyle} onValue={(v) => icons({ cartStyle: v as C["icons"]["cartStyle"] })} options={[{ value: "count", label: "Icon and number" }, { value: "icon", label: "Icon only" }, { value: "text", label: "The word Cart" }]} />
                  <NumberField label="Icon size" suffix="px" min={14} max={32} step={1} value={cfg.icons.size} onValue={(v) => icons({ size: v })} />
                </s-grid>
                <Checkbox label="Words instead of icons (SEARCH, ACCOUNT, CART)" checked={cfg.icons.labels} onValue={(v) => icons({ labels: v })} />
                <Switch label="Show a button" checked={cfg.button.show} onValue={(v) => button({ show: v })} />
                {cfg.button.show ? (
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <TextField label="Button text" value={cfg.button.text} onValue={(v) => button({ text: v })} />
                    <TextField label="Button link" details="/collections/sale or a full link" value={cfg.button.link} onValue={(v) => button({ link: v })} />
                  </s-grid>
                ) : null}
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "style"}><s-section heading="Colours and glass">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <ColorField label="Bar" value={cfg.look.bg} onValue={(v) => look({ bg: v })} />
                <NumberField label="Bar see-through" details="100 = solid" suffix="%" min={0} max={100} step={5} value={cfg.look.opacity} onValue={(v) => look({ opacity: v })} />
                <NumberField label="Glass blur" suffix="px" min={0} max={40} step={1} value={cfg.look.blur} onValue={(v) => look({ blur: v })} />
                <ColorField label="Text and icons" value={cfg.look.text} onValue={(v) => look({ text: v })} />
                <ColorField label="Border" value={cfg.look.border} onValue={(v) => look({ border: v })} />
                <NumberField label="Border strength" suffix="%" min={0} max={100} step={5} value={cfg.look.borderOpacity} onValue={(v) => look({ borderOpacity: v })} />
                <ColorField label="Highlight colour" details="Active link, cart number and button." value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                <ColorField label="Text on highlight" value={cfg.look.accentText} onValue={(v) => look({ accentText: v })} />
                <ColorField label="Sub-menu panel" value={cfg.look.panelBg} onValue={(v) => look({ panelBg: v })} />
                <NumberField label="Panel see-through" suffix="%" min={0} max={100} step={5} value={cfg.look.panelOpacity} onValue={(v) => look({ panelOpacity: v })} />
                <ColorField label="Panel text" value={cfg.look.panelText} onValue={(v) => look({ panelText: v })} />
              </s-grid>
              <s-box paddingBlockStart="base">
                <Checkbox label="Soft shadow" checked={cfg.look.shadow} onValue={(v) => look({ shadow: v })} />
              </s-box>
            </s-section></Pane>

            <Pane show={tab === "layout"}><s-section heading="Phones">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <Select
                  label="Menu on phones"
                  value={cfg.mobile.menu}
                  onValue={(v) => mobile({ menu: v as C["mobile"]["menu"] })}
                  options={[
                    { value: "drawer", label: "Side drawer" },
                    { value: "full", label: "Full screen" },
                    { value: "pills", label: "Pills under the bar" },
                  ]}
                />
                <Select label="Logo on phones" value={cfg.mobile.logo} onValue={(v) => mobile({ logo: v as C["mobile"]["logo"] })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }]} />
                <NumberField label="Height on phones" suffix="px" min={44} max={90} step={2} value={cfg.mobile.height} onValue={(v) => mobile({ height: v })} />
              </s-grid>
            </s-section></Pane>

            <Pane show={tab === "display"}><s-section heading="Advanced">
              <TextField
                label="Your theme's header (CSS selector)"
                details="Only if your theme's own header still shows: the selector of its header bar, e.g. .site-header. Most themes are found automatically."
                value={cfg.hideTheme}
                onValue={(v) => setCfg((c) => ({ ...c, hideTheme: v }))}
              />
            </s-section></Pane>
          </s-stack>

          <div className={ui.preview}>
            <div className={ui.previewBar}>
              <span>Live preview · hover the menu</span>
              <Segmented label="Preview size" value={device} options={[{ value: "desktop", label: "Desktop" }, { value: "phone", label: "Phone" }]} onChange={setDevice} />
            </div>
            <div className={ui.frame}>
              <HeaderPreview config={cfg} css={data.css} js={data.js} shop={data.shop} phone={device === "phone"} />
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
