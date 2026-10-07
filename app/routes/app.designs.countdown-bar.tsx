import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LinksFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { getCountdownBar, saveCountdownBar } from "../lib/designs.server";
import { withCountdownBarDefaults, type CountdownBarConfig } from "../lib/designs";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextField } from "../components/fields";
import { Segmented } from "../components/ui";
import { CountdownBarPreview } from "../components/CountdownBarPreview";
import ui from "../components/PageEditor.module.css";
import sectionsCss from "../../extensions/cro-storefront/assets/ucs-sections.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: sectionsCss }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme] = await Promise.all([getCountdownBar(admin), getThemeStatus(admin).catch(() => null)]);
  return { config, saved, embedOn: theme ? theme.installed.countdown_bar : null, embedLink: sectionLinks(session.shop).countdown_bar };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveCountdownBar(admin, withCountdownBarDefaults(JSON.parse(String(form.get("config")))));
    return { ok: true, error: null, config };
  } catch (e) {
    return { ok: false, error: errorMessage(e), config: null };
  }
};

type C = CountdownBarConfig;
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
    if (fetcher.data.ok) shopify.toast.show("Countdown bar saved — live on your store");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const part = <K extends keyof C>(k: K) => (patch: Partial<C[K]>) => setCfg((c) => ({ ...c, [k]: { ...(c[k] as object), ...patch } }));
  const timer = part("timer"), text = part("text"), button = part("button"), layout = part("layout"), where = part("where"), look = part("look");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });
  const t = cfg.timer;

  return (
    <s-page heading="Countdown bar" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={data.embedLink} target="_top" icon="theme-edit">
        {data.embedOn ? "Open in theme editor" : "Turn on in theme"}
      </Button>
      <s-stack gap="base">
        {data.embedOn === false ? (
          <s-banner tone="info" heading="Turn the bar on in your theme">
            Click “Turn on in theme”, switch on “Countdown bar” in App embeds and save. Everything else is set here.
          </s-banner>
        ) : null}
        {!data.saved ? (
          <s-banner tone="warning" heading="Not saved yet">
            Your store shows the bar once you save here.
          </s-banner>
        ) : null}
        {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}

        <div className={ui.layout}>
          <s-stack gap="base">
            <s-section heading="Bar">
              <Switch label="Show the countdown bar" checked={cfg.on} onValue={(v) => setCfg((c) => ({ ...c, on: v }))} />
            </s-section>

            <s-section heading="Timer">
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
                <Select label="Numbers" value={t.style} onValue={(v) => timer({ style: v as C["timer"]["style"] })} options={[{ value: "boxes", label: "In boxes" }, { value: "plain", label: "Plain" }]} />
                <Checkbox label="Show days" details="Off: hours keep counting past 24." checked={t.showDays} onValue={(v) => timer({ showDays: v })} />
                <Checkbox label="Show Days / Hours / Min / Sec under the numbers" checked={t.labels} onValue={(v) => timer({ labels: v })} />
                {t.labels ? (
                  <s-grid gridTemplateColumns="1fr 1fr 1fr 1fr" gap="small-200">
                    <TextField label="Days" value={t.labelText.d} onValue={(v) => timer({ labelText: { ...t.labelText, d: v } })} />
                    <TextField label="Hours" value={t.labelText.h} onValue={(v) => timer({ labelText: { ...t.labelText, h: v } })} />
                    <TextField label="Minutes" value={t.labelText.m} onValue={(v) => timer({ labelText: { ...t.labelText, m: v } })} />
                    <TextField label="Seconds" value={t.labelText.s} onValue={(v) => timer({ labelText: { ...t.labelText, s: v } })} />
                  </s-grid>
                ) : null}
              </s-stack>
            </s-section>

            <s-section heading="Text and button">
              <s-stack gap="base">
                <Switch label="Show the text" checked={cfg.text.show} onValue={(v) => text({ show: v })} />
                {cfg.text.show ? <TextField label="Text" value={cfg.text.value} onValue={(v) => text({ value: v })} /> : null}
                <Switch label="Show the button" checked={cfg.button.show} onValue={(v) => button({ show: v })} />
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
            </s-section>

            <s-section heading="Layout and pages">
              <s-stack gap="base">
                <Select label="Position" value={cfg.layout.position} onValue={(v) => layout({ position: v as C["layout"]["position"] })} options={[{ value: "top", label: "Top of the page" }, { value: "bottom", label: "Bottom of the screen (always visible)" }]} />
                <Checkbox label="Slim: everything on one line" details="Also on phones; long text shortens with …" checked={cfg.layout.slim} onValue={(v) => layout({ slim: v })} />
                <Checkbox label="Customers can close it" checked={cfg.layout.dismissible} onValue={(v) => layout({ dismissible: v })} />
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
            </s-section>

            <s-section heading="Colours">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <ColorField label="Background" value={cfg.look.bg} onValue={(v) => look({ bg: v })} />
                <ColorField label="Text" value={cfg.look.text} onValue={(v) => look({ text: v })} />
                <ColorField label="Number boxes" value={cfg.look.boxBg} onValue={(v) => look({ boxBg: v })} />
                <ColorField label="Numbers" value={cfg.look.boxText} onValue={(v) => look({ boxText: v })} />
                <ColorField label="Button" value={cfg.look.buttonBg} onValue={(v) => look({ buttonBg: v })} />
                <ColorField label="Button text" value={cfg.look.buttonText} onValue={(v) => look({ buttonText: v })} />
              </s-grid>
            </s-section>

            <s-section heading="Sizes">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <NumberField label="Bar height (space above and below)" suffix="px" min={0} max={30} step={1} value={cfg.look.height} onValue={(v) => look({ height: v })} />
                <NumberField label="Text" suffix="px" min={10} max={24} step={1} value={cfg.look.textSize} onValue={(v) => look({ textSize: v })} />
                <NumberField label="Numbers" suffix="px" min={10} max={32} step={1} value={cfg.look.numberSize} onValue={(v) => look({ numberSize: v })} />
                <NumberField label="Labels under numbers" suffix="px" min={7} max={14} step={1} value={cfg.look.labelSize} onValue={(v) => look({ labelSize: v })} />
                <NumberField label="Button text" suffix="px" min={10} max={20} step={1} value={cfg.look.buttonSize} onValue={(v) => look({ buttonSize: v })} />
                <NumberField label="Corners" suffix="px" min={0} max={20} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
              </s-grid>
            </s-section>
          </s-stack>

          <div className={ui.preview}>
            <div className={ui.previewBar}>
              <span>Live preview</span>
              <Segmented label="Preview size" value={device} options={[{ value: "desktop", label: "Desktop" }, { value: "phone", label: "Phone" }]} onChange={setDevice} />
            </div>
            <div className={ui.frame} style={{ padding: 16 }}>
              <div className={device === "phone" ? ui.phone : undefined}>
                {cfg.on ? <CountdownBarPreview config={cfg} /> : <s-text color="subdued">The bar is switched off.</s-text>}
              </div>
            </div>
          </div>
        </div>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
