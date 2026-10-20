import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks, shopOffset } from "../lib/sections.server";
import { getDeliveryDesign, saveDeliveryDesign } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook } from "../components/ThemeStyle";
import { applyDeliveryPreset, DELIVERY_PRESETS, DELIVERY_SIZES, withDeliveryDefaults, type DeliveryDesign } from "../lib/delivery-design";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextField } from "../components/fields";
import { DeliveryPreview } from "../components/DeliveryPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker, templateInUse } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";
import { SizesSection } from "../components/SizesSection";
import { slottedRoute } from "../lib/design-slot.server";
import { DesignSlots, useDesignAction } from "../components/DesignSlots";
import { SetupSteps } from "../components/SetupSteps";
import { SaveControls, changed } from "../components/SaveControls";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const loader = slottedRoute(["delivery"], async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, style, offset] = await Promise.all([
    getDeliveryDesign(admin),
    getThemeStatus(admin, session.shop).catch(() => null),
    getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE),
    shopOffset(admin).catch(() => ({ iso: "+00:00", minutes: 0 })),
  ]);
  return { config, saved, style, offset: offset.minutes, tz: offset.iso, domain: session.shop, css: storefrontCss("ucs-sections.css"), inTheme: theme ? theme.installed.delivery : false, addLink: sectionLinks(session.shop).delivery };
});

export const action = slottedRoute(["delivery"], async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveDeliveryDesign(admin, withDeliveryDefaults(JSON.parse(String(form.get("config")))), form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
});

type C = DeliveryDesign;

export default function DeliveryDesigner() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const [tab, setTab] = useState<DesignTab>("looks");
  const [country, setCountry] = useState("");
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

  const part =
    <K extends "rules" | "text" | "look" | "where">(k: K) =>
    (patch: Partial<C[K]>) =>
      setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));
  const rules = part("rules"), text = part("text"), look = part("look"), where = part("where");
  const setZone = (id: string, patch: Partial<C["rules"]["zones"][number]>) => rules({ zones: cfg.rules.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)) });
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post", action: designAction });
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post", action: designAction });
  const zoneCountries = [...new Set(cfg.rules.zones.flatMap((z) => z.countries.split(/,\s*/).filter(Boolean)))];

  return (
    <s-page heading="Delivery estimate" inlineSize="large">
      <CategoryCrumb feature="delivery" />
      <DemoButton feature="delivery" template={templateInUse(DELIVERY_PRESETS, cfg, applyDeliveryPreset)} />
      <SaveControls dirty={changed(cfg, data.config)} saving={fetcher.state !== "idle" && fetcher.formData?.get("intent") !== "draft"} saved={data.saved} onSave={save} onDiscard={() => setCfg(data.config)} />
      <Button slot="secondary-actions" href={data.inTheme ? `https://${data.domain}/admin/themes/current/editor?template=product` : data.addLink} target="_blank" onClick={seeOnStore}>
        Preview on store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to product page"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="delivery" />
          <DesignSlots base="delivery" blockName="Delivery estimate" />
          <SetupSteps saved={data.saved} dirty={changed(cfg, data.config)} inTheme={data.inTheme} addLink={data.addLink} onStyles={() => setTab("looks")} preview={{ href: data.inTheme ? `https://${data.domain}/admin/themes/current/editor?template=product` : data.addLink, onClick: seeOnStore }} />
          <s-text color="subdued">
            Shows when an order placed now will arrive, with a countdown to your daily cut-off. Times use your shop’s time zone (UTC{data.tz}). Add the “Delivery estimate” block under the price or Add to cart, and on the cart page if you like.
          </s-text>
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs tabs={["looks", "content", "design"]} value={tab} onChange={setTab} />
          <div className={ui.layout}>
            <s-stack gap="base">
              <Pane show={tab === "looks"}>
                <LookPicker width={480} presets={DELIVERY_PRESETS} config={cfg} apply={applyDeliveryPreset} onPick={(key) => setCfg((c) => applyDeliveryPreset(c, key))} render={(c) => <DeliveryPreview config={c} offsetMinutes={data.offset} country="" />} />
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Dates">
                  <s-stack gap="base">
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <TextField label="Daily cut-off" details="Orders after this ship the next working day. 24-hour time, e.g. 14:00." value={cfg.rules.cutoff} onValue={(v) => rules({ cutoff: v })} />
                      <NumberField label="Processing" details="Working days before it ships." suffix="days" min={0} max={30} step={1} value={cfg.rules.processing} onValue={(v) => rules({ processing: v })} />
                      <NumberField label="Shipping, fastest" suffix="days" min={0} max={60} step={1} value={cfg.rules.min} onValue={(v) => rules({ min: v, max: Math.max(v, cfg.rules.max) })} />
                      <NumberField label="Shipping, slowest" suffix="days" min={0} max={60} step={1} value={cfg.rules.max} onValue={(v) => rules({ max: Math.max(v, cfg.rules.min) })} />
                    </s-grid>
                    <s-text>Days off (no processing or delivery)</s-text>
                    <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="small-200">
                      {DAYS.map((d, i) => (
                        <Checkbox key={d} label={d} checked={cfg.rules.daysOff.includes(i)} onValue={(v) => rules({ daysOff: v ? [...cfg.rules.daysOff, i] : cfg.rules.daysOff.filter((x) => x !== i) })} />
                      ))}
                    </s-grid>
                    <TextField label="Holidays" details="Dates like 2026-12-25, separated by commas." value={cfg.rules.holidays} onValue={(v) => rules({ holidays: v })} />
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Different shipping times by country">
                  <s-stack gap="base">
                    <s-text color="subdued">Countries not listed use the shipping days above. Use two-letter codes, e.g. SA, AE, KW.</s-text>
                    {cfg.rules.zones.map((z) => (
                      <s-grid key={z.id} gridTemplateColumns="2fr 1fr 1fr auto" gap="small-200" alignItems="end">
                        <TextField label="Countries" value={z.countries} onValue={(v) => setZone(z.id, { countries: v })} />
                        <NumberField label="Fastest" suffix="days" min={0} max={60} step={1} value={z.min} onValue={(v) => setZone(z.id, { min: v, max: Math.max(v, z.max) })} />
                        <NumberField label="Slowest" suffix="days" min={0} max={60} step={1} value={z.max} onValue={(v) => setZone(z.id, { max: Math.max(v, z.min) })} />
                        <Button variant="tertiary" tone="critical" icon="delete" accessibilityLabel="Remove" onClick={() => rules({ zones: cfg.rules.zones.filter((x) => x.id !== z.id) })}>
                          Remove
                        </Button>
                      </s-grid>
                    ))}
                    {cfg.rules.zones.length < 12 ? (
                      <Button icon="plus" onClick={() => rules({ zones: [...cfg.rules.zones, { id: `z${Date.now().toString(36)}`, countries: "", min: cfg.rules.min + 2, max: cfg.rules.max + 3 }] })}>
                        Add countries
                      </Button>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Words">
                  <s-stack gap="base">
                    <TextField label="Line" details="{countdown} and {arrives} are the two parts below." value={cfg.text.line} onValue={(v) => text({ line: v })} />
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <TextField label="Countdown part" details="{time} = time left, e.g. 2h 15m" value={cfg.text.countdown} onValue={(v) => text({ countdown: v })} />
                      <TextField label="Arrival part" details="{dates} = the dates" value={cfg.text.arrives} onValue={(v) => text({ arrives: v })} />
                      <TextField label="Date range" details="{from} and {to}" value={cfg.text.range} onValue={(v) => text({ range: v })} />
                    </s-grid>
                    <Checkbox label="Hide the countdown after today's cut-off" checked={cfg.text.hideAfterCutoff} onValue={(v) => text({ hideAfterCutoff: v })} />
                    <s-text>Show it on</s-text>
                    <s-stack direction="inline" gap="base">
                      <Checkbox label="Product pages" checked={cfg.where.product} onValue={(v) => where({ product: v })} />
                      <Checkbox label="Cart page" checked={cfg.where.cart} onValue={(v) => where({ cart: v })} />
                    </s-stack>
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "design"}>
                <s-section heading="Look">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Style" value={cfg.look.style} onValue={(v) => look({ style: v as C["look"]["style"] })} options={[{ value: "box", label: "In a soft box" }, { value: "line", label: "Simple line" }]} />
                    <Select label="Icon" value={cfg.look.icon} onValue={(v) => look({ icon: v as C["look"]["icon"] })} options={[{ value: "truck", label: "Truck" }, { value: "clock", label: "Clock" }, { value: "box", label: "Parcel" }, { value: "none", label: "None" }]} />
                    <ColorField label="Icon and time" value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                    {cfg.look.style === "box" ? <ColorField label="Box" value={cfg.look.bg} onValue={(v) => look({ bg: v })} /> : <span />}
                    {cfg.look.style === "box" ? <NumberField label="Corners" suffix="px" min={0} max={30} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} /> : <span />}
                  </s-grid>
                  <Switch label="Countdown in colour and bold" checked={cfg.look.countdownBold} onValue={(v) => look({ countdownBold: v })} />
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <SizesSection specs={DELIVERY_SIZES} value={cfg.sizes} onChange={(sizes) => setCfg((c) => ({ ...c, sizes }))} />
              </Pane>
            </s-stack>

            <PreviewFrame
              width={480}
              title="Product page · live dates"
              tools={zoneCountries.length ? <Select label="Shopper in" value={country} onValue={setCountry} options={[{ value: "", label: "Other countries" }, ...zoneCountries.map((c) => ({ value: c, label: c }))]} /> : undefined}
            >
              <ThemeLook style={data.style}>
                <DeliveryPreview config={cfg} offsetMinutes={data.offset} country={country} />
              </ThemeLook>
            </PreviewFrame>
          </div>
        </s-stack>
      </div>
    </s-page>
  );
}

export const shouldRevalidate: ShouldRevalidateFunction = ({ formData, defaultShouldRevalidate }) => (formData?.get("intent") === "draft" ? false : defaultShouldRevalidate);

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
