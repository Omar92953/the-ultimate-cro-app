import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { listItems, sectionLinks } from "../lib/sections.server";
import type { MediaRef } from "../lib/sections";
import { getLogosDesign, saveLogosDesign } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { matchLogos } from "../lib/theme-match";
import { ThemeLook, ThemeMatch } from "../components/ThemeStyle";
import { applyLogosPreset, LOGOS_PRESETS, withLogosDefaults, type LogosDesign } from "../lib/logos-design";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextField } from "../components/fields";
import { LogosDesignPreview, type PreviewLogo } from "../components/LogosDesignPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, items, style] = await Promise.all([
    getLogosDesign(admin),
    getThemeStatus(admin).catch(() => null),
    listItems(admin, "logos").catch(() => []),
    getThemeStyle(admin).catch(() => FALLBACK_STYLE),
  ]);
  const logos: PreviewLogo[] = items.map((i) => ({ name: String(i.values.name || ""), url: (i.values.image as MediaRef | null)?.url ?? null }));
  return { config, saved, logos, style, domain: session.shop, css: storefrontCss("ucs-sections.css"), inTheme: theme ? theme.installed.logos : null, addLink: sectionLinks(session.shop).logos };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const draft = form.get("intent") === "draft";
    const config = await saveLogosDesign(admin, withLogosDefaults(JSON.parse(String(form.get("config")))), draft);
    return { ok: true, draft, error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type C = LogosDesign;

export default function LogosDesigner() {
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
    else shopify.toast.show("Logos saved — live on your store");
  }, [fetcher.state, fetcher.data, shopify]);

  const part = <K extends Exclude<keyof C, "scheme">>(k: K) => (patch: Partial<C[K]>) => setCfg((c) => ({ ...c, [k]: { ...(c[k] as object), ...patch } }));
  const text = part("text"), layout = part("layout"), logos = part("logos"), space = part("space");
  const look = (patch: Partial<C["look"]>) => setCfg((c) => ({ ...c, scheme: "", look: { ...c.look, ...patch } }));
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" });
  const marquee = cfg.layout.mode === "marquee";

  return (
    <s-page heading="Scrolling logos and text" inlineSize="large">
      <CategoryCrumb feature="logos" />
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?previewPath=%2F`} target="_blank" onClick={seeOnStore}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to theme"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="logos" />
          <s-text color="subdued">Logos and texts are in the Logos tab. Here you choose how the strip looks and moves. In the theme editor you only place the “Scrolling logos and text” section; every copy of it uses this design.</s-text>
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
            <ThemeMatch style={data.style} config={cfg} setConfig={setCfg} match={matchLogos} />
          </Pane>
          <Pane show={tab === "looks"}>
            <LookPicker presets={LOGOS_PRESETS} config={cfg} apply={applyLogosPreset} onPick={(key) => setCfg((c) => applyLogosPreset(c, key))} render={(c) => <ThemeLook style={data.style}><LogosDesignPreview config={c} logos={data.logos} /></ThemeLook>} />
          </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Heading">
                  <s-grid gridTemplateColumns="2fr 1fr" gap="base">
                    <TextField label="Heading" details="Leave empty for no heading." value={cfg.text.heading} onValue={(v) => text({ heading: v })} />
                    <NumberField label="Size" suffix="px" min={14} max={48} step={2} value={cfg.text.headingSize} onValue={(v) => text({ headingSize: v })} />
                  </s-grid>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Layout">
                  <s-stack gap="base">
                    <Select label="Show logos" value={cfg.layout.mode} onValue={(v) => layout({ mode: v as C["layout"]["mode"] })} options={[{ value: "marquee", label: "Scrolling strip" }, { value: "grid", label: "Grid" }]} />
                    {marquee ? (
                      <>
                        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                          <Select label="Lines" value={String(cfg.layout.lines)} onValue={(v) => layout({ lines: v === "2" ? 2 : 1 })} options={[{ value: "1", label: "One line" }, { value: "2", label: "Two lines" }]} />
                          <Select label="Direction" value={cfg.layout.direction} onValue={(v) => layout({ direction: v as C["layout"]["direction"] })} options={[{ value: "left", label: "Right to left" }, { value: "right", label: "Left to right" }]} />
                          <NumberField label="Speed" details="1 = slow, 10 = fast" min={1} max={10} step={1} value={cfg.layout.speed} onValue={(v) => layout({ speed: v })} />
                        </s-grid>
                        {cfg.layout.lines === 2 ? <Checkbox label="Second line moves the other way" checked={cfg.layout.opposite} onValue={(v) => layout({ opposite: v })} /> : null}
                        <Switch label="Pause when the mouse is over it" checked={cfg.layout.pause} onValue={(v) => layout({ pause: v })} />
                        <Switch label="Fade the edges" checked={cfg.layout.fade} onValue={(v) => layout({ fade: v })} />
                        <Switch label="Full width" checked={cfg.layout.fullWidth} onValue={(v) => layout({ fullWidth: v })} />
                      </>
                    ) : (
                      <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                        <NumberField label="Logos per row on desktop" min={2} max={8} step={1} value={cfg.layout.colsDesktop} onValue={(v) => layout({ colsDesktop: v })} />
                        <NumberField label="Logos per row on mobile" min={2} max={4} step={1} value={cfg.layout.colsMobile} onValue={(v) => layout({ colsMobile: v })} />
                      </s-grid>
                    )}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Logos">
                  <s-stack gap="base">
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <NumberField label="Logo height" suffix="px" min={16} max={120} step={2} value={cfg.logos.height} onValue={(v) => logos({ height: v })} />
                      <NumberField label="Space between logos" suffix="px" min={16} max={120} step={4} value={cfg.logos.gap} onValue={(v) => logos({ gap: v })} />
                      <NumberField label="Logo strength" details="Lower = softer" suffix="%" min={30} max={100} step={5} value={cfg.logos.opacity} onValue={(v) => logos({ opacity: v })} />
                    </s-grid>
                    <Select
                      label="Logo colour"
                      details="All white and all black work best with dark logos on a see-through or light background."
                      value={cfg.logos.tint !== "none" ? cfg.logos.tint : cfg.logos.grayscale ? "grey" : "original"}
                      onValue={(v) => logos(v === "white" || v === "black" ? { tint: v } : { tint: "none", grayscale: v === "grey" })}
                      options={[
                        { value: "original", label: "Original colours" },
                        { value: "grey", label: "Grey until the mouse is over them" },
                        { value: "white", label: "All white (for dark backgrounds)" },
                        { value: "black", label: "All black" },
                      ]}
                    />
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Text instead of a logo">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Weight" value={String(cfg.logos.textWeight)} onValue={(v) => logos({ textWeight: Number(v) as C["logos"]["textWeight"] })} options={[{ value: "400", label: "Regular" }, { value: "600", label: "Semi-bold" }, { value: "800", label: "Extra bold" }]} />
                    <Checkbox label="CAPITAL LETTERS" checked={cfg.logos.textUpper} onValue={(v) => logos({ textUpper: v })} />
                  </s-grid>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Colours">
                  <s-stack gap="base">
                    <Switch label="Own background" details="Off: the page's background shows through." checked={cfg.look.ownBg} onValue={(v) => look({ ownBg: v })} />
                    {cfg.look.ownBg ? <ColorField label="Background" value={cfg.look.bg} onValue={(v) => look({ bg: v })} /> : null}
                    <Switch label="Own text colour" details="Off: uses your theme's text colour." checked={cfg.look.ownText} onValue={(v) => look({ ownText: v })} />
                    {cfg.look.ownText ? <ColorField label="Heading and text logos" value={cfg.look.fg} onValue={(v) => look({ fg: v })} /> : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "display"}>
                <s-section heading="Spacing and devices">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <NumberField label="Top padding" suffix="px" min={0} max={100} step={4} value={cfg.space.top} onValue={(v) => space({ top: v })} />
                    <NumberField label="Bottom padding" suffix="px" min={0} max={100} step={4} value={cfg.space.bottom} onValue={(v) => space({ bottom: v })} />
                    <Select label="Devices" value={cfg.space.devices} onValue={(v) => space({ devices: v as C["space"]["devices"] })} options={[{ value: "all", label: "Desktop and mobile" }, { value: "desktop", label: "Desktop only" }, { value: "mobile", label: "Mobile only" }]} />
                  </s-grid>
                </s-section>
              </Pane>
            </s-stack>

            <PreviewFrame title={data.logos.length ? "Your store · your logos" : "Your store · example logos"}>
              <ThemeLook style={data.style}>
                <LogosDesignPreview config={cfg} logos={data.logos} />
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
