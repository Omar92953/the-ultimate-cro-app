import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { getHero, saveHero } from "../lib/hero.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { matchHero } from "../lib/theme-match";
import { ThemeLook, ThemeMatch } from "../components/ThemeStyle";
import { applyHeroPreset, DEFAULT_HERO, HERO_PRESETS, withHeroDefaults, type HeroDesign, type HeroHeight } from "../lib/hero-design";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextArea, TextField } from "../components/fields";
import { MediaPicker } from "../components/MediaPicker";
import { HeroDesignPreview } from "../components/HeroDesignPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const isNew = params.handle === "new";
  const [item, theme, style] = await Promise.all([
    isNew ? null : getHero(admin, String(params.handle)),
    getThemeStatus(admin).catch(() => null),
    getThemeStyle(admin).catch(() => FALLBACK_STYLE),
  ]);
  if (!isNew && !item) throw new Response("Banner not found", { status: 404 });
  return {
    handle: item?.handle ?? null,
    live: item?.live ?? false,
    config: item?.config ?? DEFAULT_HERO,
    style,
    domain: session.shop,
    css: storefrontCss("ucs-sections.css"),
    inTheme: theme ? theme.installed.hero : null,
    addLink: sectionLinks(session.shop).hero,
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const draft = form.get("intent") === "draft";
    const handle = params.handle === "new" ? null : String(params.handle);
    const saved = await saveHero(admin, handle, withHeroDefaults(JSON.parse(String(form.get("config")))), draft);
    return { ok: true, draft, error: null, handle: saved.handle, created: !handle };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), handle: null, created: false };
  }
};

type C = HeroDesign;

const HEIGHT_OPTIONS: { value: HeroHeight; label: string }[] = [
  { value: "adapt", label: "Fit the image" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "full", label: "Full screen" },
];
const ROWS = [
  ["t", "Top"],
  ["m", "Middle"],
  ["b", "Bottom"],
] as const;
const COLS = [
  ["l", "left"],
  ["c", "centre"],
  ["r", "right"],
] as const;

/** Where the text sits on the image: a 3×3 (or 3×2 on phones) grid of buttons. */
function SpotPicker({ label, value, onValue, cols }: { label: string; value: string; onValue: (v: string) => void; cols: readonly (readonly [string, string])[] }) {
  return (
    <div role="group" aria-label={label}>
      <s-text>{label}</s-text>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, 40px)`, gap: 6, marginTop: 6, padding: 8, width: "fit-content", borderRadius: 8, background: "linear-gradient(135deg,#c9d6df,#8ea6b4)" }}>
        {ROWS.flatMap(([r, rl]) =>
          cols.map(([c, cl]) => {
            const v = r + c;
            const on = value === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                aria-label={`${rl} ${cl}`}
                title={`${rl} ${cl}`}
                onClick={() => onValue(v)}
                style={{ width: 40, height: 28, borderRadius: 6, border: on ? "2px solid #111" : "1px solid rgba(255,255,255,.7)", background: on ? "#fff" : "rgba(255,255,255,.35)", cursor: "pointer", display: "grid", placeItems: "center" }}
              >
                {on ? <span style={{ width: 18, height: 4, borderRadius: 2, background: "#111" }} /> : null}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

export default function HeroEditor() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const [tab, setTab] = useState<DesignTab>("content");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(data.config);
  if (loaded !== data.config) {
    setLoaded(data.config);
    setCfg(data.config);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const r = fetcher.data;
    if (!r.ok) shopify.toast.show(r.error || "Not saved", { isError: true });
    else if (r.draft) shopify.toast.show("Your changes are in the theme editor preview (only you see them). Pick this banner in a “Hero image” section, then Save here to put it live.");
    else shopify.toast.show("Banner saved — live on your store");
    // A new banner now has its own address: keep editing it there.
    if (r.ok && r.created && r.handle) navigate(`/app/designs/hero/${r.handle}`, { replace: true });
  }, [fetcher.state, fetcher.data, shopify, navigate]);

  const part = <K extends "images" | "text" | "layout" | "space">(k: K) => (patch: Partial<C[K]>) => setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));
  const images = part("images"), text = part("text"), layout = part("layout"), space = part("space");
  const look = (patch: Partial<C["look"]>) => setCfg((c) => ({ ...c, scheme: "", look: { ...c.look, ...patch } }));
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" });

  return (
    <s-page heading={data.handle ? cfg.name || "Hero banner" : "New hero banner"} inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/designs/hero">
        Hero banners
      </s-link>
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
          {data.handle && !data.live ? (
            <s-banner tone="info" heading="Not saved yet">
              Only you can see this banner, in the theme editor preview. Save to put it on your store.
            </s-banner>
          ) : null}
          {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs tabs={["looks", "content", "style", "display"]} value={tab} onChange={setTab} />

          <Pane show={tab === "looks"}>
            <ThemeMatch style={data.style} config={cfg} setConfig={setCfg} match={matchHero} />
          </Pane>
          <Pane show={tab === "looks"}>
            <LookPicker presets={HERO_PRESETS} config={cfg} apply={applyHeroPreset} onPick={(key) => setCfg((c) => applyHeroPreset(c, key))} swatch={(c) => ({ accent: c.look.buttonBg, radius: c.layout.radius, bg: c.layout.box ? c.look.boxBg : c.look.overlay })} />
          </Pane>

          <div className={ui.layout}>
            <s-stack gap="base">
              <Pane show={tab === "content"}>
                <s-section heading="Banner">
                  <s-stack gap="base">
                    <TextField label="Name" details="Only for you: it's how you pick this banner in the theme editor." value={cfg.name} onValue={(v) => setCfg((c) => ({ ...c, name: v }))} />
                    <MediaPicker label="Desktop image" details="Wide, about 2400 × 1000 px." accept="image" value={cfg.images.desktop} onValue={(v) => images({ desktop: v })} alt={cfg.text.heading || cfg.name} />
                    <MediaPicker label="Phone image" details="Tall, about 1000 × 1250 px. Empty = the desktop image." accept="image" value={cfg.images.mobile} onValue={(v) => images({ mobile: v })} alt={cfg.text.heading || cfg.name} />
                    <TextField label="Link for the whole image" details="Optional, e.g. /collections/summer." placeholder="/collections/all" value={cfg.images.link} onValue={(v) => images({ link: v })} />
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Text and buttons">
                  <s-stack gap="base">
                    <TextField label="Heading" value={cfg.text.heading} onValue={(v) => text({ heading: v })} />
                    <TextArea label="Text" rows={3} value={cfg.text.text} onValue={(v) => text({ text: v })} />
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <TextField label="First button" details="Empty = no button." value={cfg.text.b1} onValue={(v) => text({ b1: v })} />
                      <TextField label="First button link" placeholder="/collections/all" value={cfg.text.l1} onValue={(v) => text({ l1: v })} />
                      <TextField label="Second button" details="Shown as an outline." value={cfg.text.b2} onValue={(v) => text({ b2: v })} />
                      <TextField label="Second button link" placeholder="/" value={cfg.text.l2} onValue={(v) => text({ l2: v })} />
                    </s-grid>
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Text position and size">
                  <s-stack gap="base">
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <SpotPicker label="On desktop" value={cfg.layout.spotDesktop} onValue={(v) => layout({ spotDesktop: v as C["layout"]["spotDesktop"] })} cols={COLS} />
                      <SpotPicker label="On phones" value={cfg.layout.spotMobile} onValue={(v) => layout({ spotMobile: v as C["layout"]["spotMobile"] })} cols={COLS.slice(0, 2)} />
                      <NumberField label="Heading size" details="Phones get two thirds of it." suffix="px" min={20} max={88} step={2} value={cfg.text.headingSize} onValue={(v) => text({ headingSize: v })} />
                      <NumberField label="Text width" suffix="px" min={320} max={1000} step={20} value={cfg.layout.textWidth} onValue={(v) => layout({ textWidth: v })} />
                    </s-grid>
                    <Switch label="Put the text on a box" checked={cfg.layout.box} onValue={(v) => layout({ box: v })} />
                    {cfg.layout.box ? (
                      <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                        <ColorField label="Box colour" value={cfg.look.boxBg} onValue={(v) => look({ boxBg: v })} />
                        <NumberField label="Box strength" suffix="%" min={0} max={100} step={5} value={cfg.look.boxOpacity} onValue={(v) => look({ boxOpacity: v })} />
                      </s-grid>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Colours">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <ColorField label="Text" value={cfg.look.fg} onValue={(v) => look({ fg: v })} />
                    <ColorField label="Overlay" value={cfg.look.overlay} onValue={(v) => look({ overlay: v })} />
                    <NumberField label="Overlay strength" details="Darkens the image so text is easy to read." suffix="%" min={0} max={90} step={5} value={cfg.look.overlayOpacity} onValue={(v) => look({ overlayOpacity: v })} />
                    <ColorField label="Button" value={cfg.look.buttonBg} onValue={(v) => look({ buttonBg: v })} />
                    <ColorField label="Button text" value={cfg.look.buttonFg} onValue={(v) => look({ buttonFg: v })} />
                  </s-grid>
                  <s-box paddingBlockStart="base">
                    <s-stack gap="base">
                      <Checkbox label="Match my theme's button corners" checked={cfg.look.themeButtons} onValue={(v) => look({ themeButtons: v })} />
                      {!cfg.look.themeButtons ? <NumberField label="Button corners" details="99 = pill" suffix="px" min={0} max={99} step={1} value={Math.min(cfg.look.buttonRadius, 99)} onValue={(v) => look({ buttonRadius: v })} /> : null}
                    </s-stack>
                  </s-box>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Effects">
                  <s-stack gap="base">
                    <Switch label="Fade in the text" checked={cfg.look.animate} onValue={(v) => look({ animate: v })} />
                    <Switch label="Slow zoom on the image" checked={cfg.look.zoom} onValue={(v) => look({ zoom: v })} />
                    <s-text color="subdued">Both are off for shoppers who turned on “reduce motion” on their device.</s-text>
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "display"}>
                <s-section heading="Size">
                  <s-stack gap="base">
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <Select label="Height on desktop" value={cfg.layout.heightDesktop} onValue={(v) => layout({ heightDesktop: v as HeroHeight })} options={HEIGHT_OPTIONS} />
                      <Select label="Height on phones" value={cfg.layout.heightMobile} onValue={(v) => layout({ heightMobile: v as HeroHeight })} options={HEIGHT_OPTIONS} />
                    </s-grid>
                    <Switch label="Full width" checked={cfg.layout.fullWidth} onValue={(v) => layout({ fullWidth: v })} />
                    {!cfg.layout.fullWidth ? <NumberField label="Corners" suffix="px" min={0} max={40} step={2} value={cfg.layout.radius} onValue={(v) => layout({ radius: v })} /> : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "display"}>
                <s-section heading="Spacing and devices">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <NumberField label="Top padding" suffix="px" min={0} max={80} step={4} value={cfg.space.top} onValue={(v) => space({ top: v })} />
                    <NumberField label="Bottom padding" suffix="px" min={0} max={80} step={4} value={cfg.space.bottom} onValue={(v) => space({ bottom: v })} />
                    <Select label="Devices" value={cfg.space.devices} onValue={(v) => space({ devices: v as C["space"]["devices"] })} options={[{ value: "all", label: "Desktop and phones" }, { value: "desktop", label: "Desktop only" }, { value: "mobile", label: "Phones only" }]} />
                  </s-grid>
                  <s-box paddingBlockStart="base">
                    <s-text color="subdued">In the theme editor each “Hero image” section picks a banner and says whether it is at the top of the page (loads right away) or lower down.</s-text>
                  </s-box>
                </s-section>
              </Pane>
            </s-stack>

            <PreviewFrame title={device === "desktop" ? "Desktop" : "Phone"}>
              <div style={{ display: "flex", gap: 8, padding: "10px 12px 0" }}>
                <Button variant={device === "desktop" ? "primary" : "secondary"} onClick={() => setDevice("desktop")}>
                  Desktop
                </Button>
                <Button variant={device === "mobile" ? "primary" : "secondary"} onClick={() => setDevice("mobile")}>
                  Phone
                </Button>
              </div>
              <ThemeLook style={data.style}>
                <div style={{ padding: "12px 0", ...(device === "mobile" ? { width: 375, maxWidth: "100%", margin: "0 auto" } : {}) }}>
                  <HeroDesignPreview config={cfg} device={device} />
                </div>
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
