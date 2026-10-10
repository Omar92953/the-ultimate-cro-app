import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks, shopOffset } from "../lib/sections.server";
import { getCountdownBar, saveCountdownBar } from "../lib/designs.server";
import { COUNTDOWN_BAR_PRESETS, COUNTDOWN_PLACES, FONTS, NUMBER_STYLES, applyCountdownBarPreset, isCountdownPlace, withCountdownBarDefaults, type CountdownBarConfig, type CountdownPlace } from "../lib/designs";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextField } from "../components/fields";
import { Segmented } from "../components/ui";
import { CountdownBarPreview } from "../components/CountdownBarPreview";
import ui from "../components/PageEditor.module.css";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook, ThemeMatch } from "../components/ThemeStyle";
import { matchCountdown } from "../lib/theme-match";
import { firstProduct } from "../lib/preview-products.server";
import { DesignTabs, Pane, type DesignTab } from "../components/DesignTabs";


const placeFrom = (url: string): CountdownPlace => {
  const p = new URL(url).searchParams.get("place");
  return isCountdownPlace(p) ? p : "header";
};

/** Is the Countdown block already in this place (home template, header / footer group, a product template)? */
const placedIn = (files: string[], place: CountdownPlace) =>
  files.some((f) => ({ home: f === "templates/index.json", header: f === "sections/header-group.json", footer: f === "sections/footer-group.json", product: /^templates\/product[.\w-]*\.json$/.test(f), cart: f === "templates/cart.json" })[place]);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const place = placeFrom(request.url);
  const [{ config, saved }, theme, offset] = await Promise.all([getCountdownBar(admin, place), getThemeStatus(admin).catch(() => null), shopOffset(admin).catch(() => ({ iso: "+00:00", minutes: 0 }))]);
  const links = sectionLinks(session.shop);
  const addLink = { header: links.countdown_bar, footer: links.countdown_footer, home: links.countdown_home, product: links.countdown_product, cart: links.countdown_cart }[place];
  return { style: await getThemeStyle(admin).catch(() => FALLBACK_STYLE), domain: session.shop, sample: await firstProduct(admin).catch(() => null), place, config, saved, css: storefrontCss("ucs-sections.css"), offset: offset.minutes, embedOn: theme ? theme.installed.countdown_bar : null, placed: theme ? placedIn(theme.files.countdown_bar, place) : false, addLink, editorLink: links.editor };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const place = placeFrom(request.url);
    const config = await saveCountdownBar(admin, withCountdownBarDefaults(JSON.parse(String(form.get("config"))), place), place, form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type C = CountdownBarConfig;
const LOOK: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, padding: 8, font: "inherit", textAlign: "left", cursor: "pointer", background: "#fff", border: "1px solid #e3e3e3", borderRadius: 10, minWidth: 0, overflow: "hidden" };
const PAGE_OPTIONS: { value: C["where"]["pages"][number]; label: string }[] = [
  { value: "home", label: "Home page" },
  { value: "product", label: "Product pages" },
  { value: "collection", label: "Collection pages" },
  { value: "cart", label: "Cart page" },
  { value: "other", label: "All other pages" },
];

export default function CountdownBarDesigner() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const [tab, setTab] = useState<DesignTab>("content");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const placeInfo = COUNTDOWN_PLACES.find((p) => p.key === data.place)!;
  const addLabel = { header: "Add to header", footer: "Add to footer", home: "Add to home page", product: "Add to product page", cart: "Add to cart page" }[data.place];
  const [loaded, setLoaded] = useState(data.config);
  if (loaded !== data.config) {
    setLoaded(data.config);
    setCfg(data.config);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok && fetcher.data.draft) shopify.toast.show("Your changes are in the theme editor preview (only you see them). Save here to put them live.");
    else if (fetcher.data.ok) shopify.toast.show(`${placeInfo.title} countdown saved — live on your store`);
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify, placeInfo.title]);

  const part = <K extends keyof C>(k: K) => (patch: Partial<C[K]>) => setCfg((c) => ({ ...c, [k]: { ...(c[k] as object), ...patch } }));
  const timer = part("timer"), text = part("text"), button = part("button"), layout = part("layout"), where = part("where"), look = part("look");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post", action: `?place=${data.place}` });
  const t = cfg.timer;

  return (
    <s-page heading="Countdown timers" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?previewPath=${encodeURIComponent(data.place === "product" && data.sample ? `/products/${data.sample.handle}` : data.place === "cart" ? "/cart" : "/")}`} target="_blank" onClick={() => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post", action: `?place=${data.place}` })}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.placed ? "Open in theme editor" : addLabel}
      </Button>
      <div className={ui.shell}>
      <s-stack gap="base">
        <Segmented
          label="Where the countdown is"
          value={data.place}
          options={COUNTDOWN_PLACES.map((p) => ({ value: p.key, label: p.title }))}
          onChange={(v) => navigate(`/app/designs/countdown-bar?place=${v}`)}
        />
        <s-text color="subdued">
          {placeInfo.hint} Each place has its own design.{" "}
          {data.placed ? "The “Countdown” block is already there in your theme; the same block shows the right design wherever it is." : <>In your theme, add the “Countdown” block there with “{addLabel}”; the same block shows the right design wherever it is.</>}
        </s-text>
        {!data.saved ? (
          <s-banner tone="warning" heading="Not saved yet">
            This countdown shows on your store once you switch it on and save.
          </s-banner>
        ) : null}
        {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}

        <style dangerouslySetInnerHTML={{ __html: data.css }} />
        <DesignTabs tabs={["looks", "content", "layout", "style"]} value={tab} onChange={setTab} />
        <Pane show={tab === "looks"}>
          <ThemeMatch style={data.style} config={cfg} setConfig={setCfg} match={matchCountdown} />
        </Pane>
        <Pane show={tab === "looks"}><s-section heading="Start from a look">
          <div className={ui.looks} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
            {COUNTDOWN_BAR_PRESETS.map((p) => (
              <button key={p.key} type="button" className={ui.look} style={LOOK} onClick={() => setCfg((c) => applyCountdownBarPreset(c, p.key))} aria-label={`Use the ${p.title} look`}>
                <span className={ui.lookBar} style={{ display: "block", overflow: "hidden", borderRadius: 6, pointerEvents: "none" }} aria-hidden="true">
                  <CountdownBarPreview offset={data.offset} config={{ ...applyCountdownBarPreset(cfg, p.key), text: { ...cfg.text, show: false }, layout: { ...cfg.layout, slim: true, dismissible: false } }} />
                </span>
                <span className={ui.lookName} style={{ fontSize: 13, fontWeight: 600, color: "#303030" }}>{p.title}</span>
              </button>
            ))}
          </div>
        </s-section></Pane>

        <div className={ui.layout}>
          <s-stack gap="base">
            <Pane show={tab === "content"}><s-section heading="What shows">
              <s-stack gap="base">
                <Switch label={`${placeInfo.title} countdown`} details="Off: it disappears from this place on your store." checked={cfg.on} onValue={(v) => setCfg((c) => ({ ...c, on: v }))} />
                <Select
                  label="Shape"
                  value={cfg.kind}
                  onValue={(v) => setCfg((c) => ({ ...c, kind: v as C["kind"] }))}
                  options={[
                    { value: "bar", label: "Slim bar (header and footer)" },
                    { value: "section", label: "Big section with a heading" },
                    { value: "inline", label: "Compact box (product or cart page)" },
                  ]}
                />
                <Switch label="Text" checked={cfg.text.show} onValue={(v) => text({ show: v })} />
                <Switch label="Button (Shop now)" checked={cfg.button.show} onValue={(v) => button({ show: v })} />
                {cfg.kind === "bar" ? <Switch label="Close (X) button" details="Shoppers can hide the bar for the rest of their visit." checked={cfg.layout.dismissible} onValue={(v) => layout({ dismissible: v })} /> : null}
                <Switch label="Days / Hours / Min / Sec under the numbers" checked={cfg.timer.labels} onValue={(v) => timer({ labels: v })} />
              </s-stack>
            </s-section></Pane>

            {cfg.kind === "section" ? (
              <Pane show={tab === "content"}><s-section heading="Heading">
                <s-stack gap="base">
                  <TextField label="Heading" value={cfg.section.heading} onValue={(v) => setCfg((c) => ({ ...c, section: { ...c.section, heading: v } }))} />
                  <TextField label="Text under the heading" value={cfg.section.sub} onValue={(v) => setCfg((c) => ({ ...c, section: { ...c.section, sub: v } }))} />
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Layout" value={cfg.section.layout} onValue={(v) => setCfg((c) => ({ ...c, section: { ...c.section, layout: v as C["section"]["layout"] } }))} options={[{ value: "stack", label: "Centred" }, { value: "row", label: "In one row" }]} />
                    <NumberField label="Heading size" suffix="px" min={14} max={60} step={1} value={cfg.section.headingSize} onValue={(v) => setCfg((c) => ({ ...c, section: { ...c.section, headingSize: v } }))} />
                    <NumberField label="Space above" suffix="px" min={0} max={120} step={4} value={cfg.section.paddingTop} onValue={(v) => setCfg((c) => ({ ...c, section: { ...c.section, paddingTop: v } }))} />
                    <NumberField label="Space below" suffix="px" min={0} max={120} step={4} value={cfg.section.paddingBottom} onValue={(v) => setCfg((c) => ({ ...c, section: { ...c.section, paddingBottom: v } }))} />
                  </s-grid>
                </s-stack>
              </s-section></Pane>
            ) : null}

            <Pane show={tab === "content"}><s-section heading="Timer">
              <s-stack gap="base">
                <Select
                  label="Count down to"
                  value={t.mode}
                  onValue={(v) => timer({ mode: v as C["timer"]["mode"] })}
                  options={[
                    { value: "fixed", label: "A date and time" },
                    { value: "daily", label: "A cut-off time every day" },
                    { value: "evergreen", label: "A fresh timer for each visitor" },
                  ]}
                />
                {t.mode === "fixed" ? (
                  <TextField label="Ends on" details="Your store's time zone. Format: 2026-12-31T23:59" value={t.end} onValue={(v) => timer({ end: v })} />
                ) : null}
                {t.mode === "daily" ? <TextField label="Cut-off time" details="24-hour clock, e.g. 17:00" value={t.cutoff} onValue={(v) => timer({ cutoff: v })} /> : null}
                {t.mode === "evergreen" ? <NumberField label="Each visitor gets" suffix="hours" min={1} max={168} step={1} value={t.hours} onValue={(v) => timer({ hours: v })} /> : null}
                <Select
                  label="When it ends"
                  value={t.ended}
                  onValue={(v) => timer({ ended: v as C["timer"]["ended"] })}
                  options={[
                    { value: "hide", label: "Hide the bar" },
                    { value: "message", label: "Show a message" },
                    { value: "restart", label: "Start again (visitor timer)" },
                  ]}
                />
                {t.ended === "message" ? <TextField label="Message" value={t.endedText} onValue={(v) => timer({ endedText: v })} /> : null}
                <Checkbox label="Show days" details="Off: hours keep counting past 24." checked={t.showDays} onValue={(v) => timer({ showDays: v })} />
                {t.labels ? (
                  <s-grid gridTemplateColumns="1fr 1fr 1fr 1fr" gap="small-200">
                    <TextField label="Days" value={t.labelText.d} onValue={(v) => timer({ labelText: { ...t.labelText, d: v } })} />
                    <TextField label="Hours" value={t.labelText.h} onValue={(v) => timer({ labelText: { ...t.labelText, h: v } })} />
                    <TextField label="Minutes" value={t.labelText.m} onValue={(v) => timer({ labelText: { ...t.labelText, m: v } })} />
                    <TextField label="Seconds" value={t.labelText.s} onValue={(v) => timer({ labelText: { ...t.labelText, s: v } })} />
                  </s-grid>
                ) : null}
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "content"}><s-section heading="Text and button">
              <s-stack gap="base">
                {cfg.text.show ? <TextField label="Text" value={cfg.text.value} onValue={(v) => text({ value: v })} /> : <s-text color="subdued">The text is switched off above.</s-text>}
                {cfg.button.show ? (
                  <>
                    <TextField label="Button text" value={cfg.button.text} onValue={(v) => button({ text: v })} />
                    <Select
                      label="When clicked"
                      value={cfg.button.action}
                      onValue={(v) => button({ action: v as C["button"]["action"] })}
                      options={[
                        { value: "link", label: "Go to a page" },
                        { value: "scroll", label: "Scroll down the page" },
                      ]}
                    />
                    {cfg.button.action === "link" ? (
                      <TextField label="Page" details="A page in your store (/collections/sale), a full link, or #section-id" value={cfg.button.link} onValue={(v) => button({ link: v })} />
                    ) : null}
                  </>
                ) : null}
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "layout"}><s-section heading="Layout and pages">
              <s-stack gap="base">
                {cfg.kind === "bar" && data.place === "header" ? <Select label="Position" value={cfg.layout.position} onValue={(v) => layout({ position: v as C["layout"]["position"] })} options={[{ value: "top", label: "Top of the page" }, { value: "bottom", label: "Bottom of the screen (always visible)" }]} /> : null}
                {cfg.kind === "bar" ? <Checkbox label="Slim: everything on one line" details="Also on phones; long text shortens with …" checked={cfg.layout.slim} onValue={(v) => layout({ slim: v })} /> : null}
                <Checkbox label="Show on all pages" checked={cfg.where.all} onValue={(v) => where({ all: v })} />
                {!cfg.where.all ? (
                  <s-stack gap="small-200">
                    {PAGE_OPTIONS.map((p) => (
                      <Checkbox
                        key={p.value}
                        label={p.label}
                        checked={cfg.where.pages.includes(p.value)}
                        onValue={(on) => where({ pages: on ? [...cfg.where.pages, p.value] : cfg.where.pages.filter((x) => x !== p.value) })}
                      />
                    ))}
                  </s-stack>
                ) : null}
                <TextField label="Only these products or collections (optional)" details="Handles from the page address, separated by commas, e.g. summer-dress, sale" value={cfg.where.handles} onValue={(v) => where({ handles: v })} />
                <Select label="Devices" value={cfg.where.devices} onValue={(v) => where({ devices: v as C["where"]["devices"] })} options={[{ value: "all", label: "Desktop and mobile" }, { value: "desktop", label: "Desktop only" }, { value: "mobile", label: "Mobile only" }]} />
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "style"}><s-section heading="Design">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <Select label="Numbers" value={t.style} onValue={(v) => timer({ style: v as C["timer"]["style"] })} options={NUMBER_STYLES} />
                <Select label="Font" value={cfg.look.font} onValue={(v) => look({ font: v as C["look"]["font"] })} options={FONTS.map((f) => ({ value: f.value, label: f.label }))} />
                <Select label="Text weight" value={String(cfg.look.textWeight)} onValue={(v) => look({ textWeight: Number(v) })} options={[{ value: "400", label: "Regular" }, { value: "500", label: "Medium" }, { value: "600", label: "Semibold" }, { value: "700", label: "Bold" }, { value: "800", label: "Extra bold" }]} />
                <Select label="Number weight" value={String(cfg.look.numberWeight)} onValue={(v) => look({ numberWeight: Number(v) })} options={[{ value: "400", label: "Regular" }, { value: "600", label: "Semibold" }, { value: "700", label: "Bold" }, { value: "800", label: "Extra bold" }, { value: "900", label: "Black" }]} />
                <Select label="Button style" value={cfg.look.buttonStyle} onValue={(v) => look({ buttonStyle: v as C["look"]["buttonStyle"] })} options={[{ value: "filled", label: "Filled" }, { value: "outline", label: "Outline" }]} />
                <NumberField label="Button corners" details="999 = pill" suffix="px" min={0} max={999} step={1} value={cfg.look.buttonRadius} onValue={(v) => look({ buttonRadius: v })} />
              </s-grid>
              <s-box paddingBlockStart="base">
                <Checkbox label="CAPITAL LETTERS" checked={cfg.look.upper} onValue={(v) => look({ upper: v })} />
              </s-box>
            </s-section></Pane>

            <Pane show={tab === "style"}><s-section heading="Colours">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <ColorField label="Background" value={cfg.look.bg} onValue={(v) => look({ bg: v })} />
                <ColorField label="Text" value={cfg.look.text} onValue={(v) => look({ text: v })} />
                <ColorField label="Number boxes" value={cfg.look.boxBg} onValue={(v) => look({ boxBg: v })} />
                <ColorField label="Numbers" value={cfg.look.boxText} onValue={(v) => look({ boxText: v })} />
                <ColorField label="Button" value={cfg.look.buttonBg} onValue={(v) => look({ buttonBg: v })} />
                <ColorField label="Button text" value={cfg.look.buttonText} onValue={(v) => look({ buttonText: v })} />
              </s-grid>
            </s-section></Pane>

            <Pane show={tab === "style"}><s-section heading="Sizes">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <NumberField label="Bar height (space above and below)" suffix="px" min={0} max={30} step={1} value={cfg.look.height} onValue={(v) => look({ height: v })} />
                <NumberField label="Text" suffix="px" min={10} max={24} step={1} value={cfg.look.textSize} onValue={(v) => look({ textSize: v })} />
                <NumberField label="Numbers" suffix="px" min={10} max={32} step={1} value={cfg.look.numberSize} onValue={(v) => look({ numberSize: v })} />
                <NumberField label="Labels under numbers" suffix="px" min={7} max={14} step={1} value={cfg.look.labelSize} onValue={(v) => look({ labelSize: v })} />
                <NumberField label="Button text" suffix="px" min={10} max={20} step={1} value={cfg.look.buttonSize} onValue={(v) => look({ buttonSize: v })} />
                <NumberField label="Number box corners" details="999 = round" suffix="px" min={0} max={999} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
              </s-grid>
            </s-section></Pane>
          </s-stack>

          <div className={ui.preview}>
            <div className={ui.previewBar}>
              <span>Live preview</span>
              <Segmented label="Preview size" value={device} options={[{ value: "desktop", label: "Desktop" }, { value: "phone", label: "Phone" }]} onChange={setDevice} />
            </div>
            <div className={ui.frame} style={{ padding: 16 }}>
              <div className={device === "phone" ? ui.phone : undefined}>
                <ThemeLook style={data.style}>{cfg.on ? <CountdownBarPreview offset={data.offset} config={cfg} /> : <s-text color="subdued">The bar is switched off.</s-text>}</ThemeLook>
              </div>
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
