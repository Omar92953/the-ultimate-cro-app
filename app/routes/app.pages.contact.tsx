import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage } from "../lib/admin.server";
import { editorLinks, getThemeStatus } from "../lib/cro.server";
import { getContact, saveContact } from "../lib/pages.server";
import { FIELD_META, withContactDefaults, type ContactConfig, type ContactField } from "../lib/pages";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextArea, TextField } from "../components/fields";
import { Segmented } from "../components/ui";
import { ContactPreview } from "../components/ContactPreview";
import ui from "../components/PageEditor.module.css";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook, ThemeMatch } from "../components/ThemeStyle";
import { matchContact } from "../lib/theme-match";
import { DesignTabs, Pane, type DesignTab } from "../components/DesignTabs";
// The storefront's own stylesheet, so the preview matches the store exactly.


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme] = await Promise.all([getContact(admin), getThemeStatus(admin).catch(() => null)]);
  return { style: await getThemeStyle(admin).catch(() => FALLBACK_STYLE), domain: session.shop, config, saved, css: storefrontCss("ucs-contact.css"), inTheme: theme ? theme.installed.contact : null, themeLink: editorLinks(session.shop).contact };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveContact(admin, withContactDefaults(JSON.parse(String(form.get("config")))), form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type Look = ContactConfig["look"];
type Info = ContactConfig["info"];
type Layout = ContactConfig["layout"];

export default function ContactPage() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<ContactConfig>(data.config);
  const [tab, setTab] = useState<DesignTab>("content");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const busy = fetcher.state !== "idle";

  const [loaded, setLoaded] = useState(data.config);
  if (loaded !== data.config) {
    setLoaded(data.config);
    setCfg(data.config);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok && fetcher.data.draft) shopify.toast.show("Your changes are in the theme editor preview (only you see them). Save here to put them live.");
    else if (fetcher.data.ok) shopify.toast.show("Contact page saved — live on your store");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const set = (patch: Partial<ContactConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const look = (patch: Partial<Look>) => setCfg((c) => ({ ...c, look: { ...c.look, ...patch } }));
  const info = (patch: Partial<Info>) => setCfg((c) => ({ ...c, info: { ...c.info, ...patch } }));
  const layout = (patch: Partial<Layout>) => setCfg((c) => ({ ...c, layout: { ...c.layout, ...patch } }));
  const field = (i: number, patch: Partial<ContactField>) => setCfg((c) => ({ ...c, fields: c.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));
  const move = (i: number, dir: -1 | 1) =>
    setCfg((c) => {
      const fields = [...c.fields];
      const j = i + dir;
      if (j < 0 || j >= fields.length) return c;
      [fields[i], fields[j]] = [fields[j], fields[i]];
      return { ...c, fields };
    });
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });

  return (
    <s-page heading="Contact page" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/pages">
        Pages
      </s-link>
      <Button slot="primary-action" variant="primary" loading={busy} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?previewPath=${encodeURIComponent("/pages/contact")}`} target="_blank" onClick={() => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" })}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.themeLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to Contact page"}
      </Button>
      <div className={ui.shell}>
      <s-stack gap="base">
        {data.inTheme === false ? (
          <s-banner tone="info" heading="Add the form to your Contact page">
            Click “Add to Contact page” above: it opens the theme editor on your Contact page with the form added. Then
            hide the theme&apos;s own “Contact form” section there and click Save.
          </s-banner>
        ) : null}
        {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}

        <div className={ui.layout}>
          <s-stack gap="base">
        <DesignTabs tabs={["looks", "content", "layout", "style"]} value={tab} onChange={setTab} />
        <Pane show={tab === "looks"}>
          <ThemeMatch style={data.style} config={cfg} setConfig={setCfg} match={matchContact} />
        </Pane>
            <Pane show={tab === "content"}><s-section heading="Text">
              <s-stack gap="base">
                <TextField label="Heading" value={cfg.heading} maxLength={160} onValue={(v) => set({ heading: v })} />
                <TextArea label="Text under the heading" rows={3} value={cfg.text} onValue={(v) => set({ text: v })} />
                <TextField label="Button text" value={cfg.button} maxLength={60} onValue={(v) => set({ button: v })} />
                <TextField label="Message after sending" value={cfg.success} onValue={(v) => set({ success: v })} />
                <TextArea label="Note under the fields (optional)" rows={2} details="For example how you use their details." value={cfg.privacy} onValue={(v) => set({ privacy: v })} />
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "content"}><s-section heading="Fields">
              <s-stack gap="small-200">
                {cfg.fields.map((f, i) => {
                  const isEmail = f.key === "email";
                  return (
                    <div key={f.key} className={ui.fieldRow}>
                      <div className={ui.fieldHead}>
                        <span className={ui.fieldTitle}>{FIELD_META[f.key].title}</span>
                        <span className={ui.fieldMoves}>
                          <Button variant="tertiary" icon="arrow-up" accessibilityLabel={`Move ${f.label} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                            Up
                          </Button>
                          <Button variant="tertiary" icon="arrow-down" accessibilityLabel={`Move ${f.label} down`} disabled={i === cfg.fields.length - 1} onClick={() => move(i, 1)}>
                            Down
                          </Button>
                        </span>
                      </div>
                      <s-stack direction="inline" gap="base">
                        <Switch label="Show" checked={f.on} disabled={isEmail} onValue={(v) => field(i, { on: v })} />
                        <Checkbox label="Required" checked={f.required} disabled={isEmail || !f.on} onValue={(v) => field(i, { required: v })} />
                        <Checkbox label="Half width" checked={f.half} disabled={!f.on} onValue={(v) => field(i, { half: v })} />
                      </s-stack>
                      {f.on ? (
                        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                          <TextField label="Label" value={f.label} maxLength={80} onValue={(v) => field(i, { label: v })} />
                          <TextField label="Hint inside the field" value={f.placeholder} maxLength={120} onValue={(v) => field(i, { placeholder: v })} />
                        </s-grid>
                      ) : null}
                      {isEmail ? <s-text color="subdued">Always shown: Shopify needs it to send you the message.</s-text> : null}
                    </div>
                  );
                })}
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "layout"}><s-section heading="Layout">
              <s-stack gap="base">
                <Select label="Width" value={cfg.layout.width} onValue={(v) => layout({ width: v as Layout["width"] })} options={[{ value: "narrow", label: "Narrow" }, { value: "medium", label: "Medium" }, { value: "wide", label: "Wide" }]} />
                <Select label="Heading alignment" value={cfg.layout.align} onValue={(v) => layout({ align: v as Layout["align"] })} options={[{ value: "center", label: "Centre" }, { value: "left", label: "Left" }]} />
                <Select label="Style" value={cfg.layout.style} onValue={(v) => layout({ style: v as Layout["style"] })} options={[{ value: "card", label: "Form on a card" }, { value: "plain", label: "Plain (no card)" }]} />
                <Select label="Labels" value={cfg.layout.labels} onValue={(v) => layout({ labels: v as Layout["labels"] })} options={[{ value: "above", label: "Above each field" }, { value: "inside", label: "Inside the field" }]} />
                <Select label="Field style" value={cfg.look.fieldStyle} onValue={(v) => look({ fieldStyle: v as Look["fieldStyle"] })} options={[{ value: "outlined", label: "Outlined" }, { value: "filled", label: "Filled" }, { value: "underline", label: "Underline only" }]} />
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "content"}><s-section heading="Contact details next to the form">
              <s-stack gap="base">
                <Switch label="Show your contact details" checked={cfg.info.show} onValue={(v) => info({ show: v })} />
                {cfg.info.show ? (
                  <>
                    <Select label="Side" value={cfg.info.side} onValue={(v) => info({ side: v as Info["side"] })} options={[{ value: "left", label: "Left of the form" }, { value: "right", label: "Right of the form" }]} />
                    <TextField label="Title" value={cfg.info.title} onValue={(v) => info({ title: v })} />
                    <TextArea label="Text" rows={2} value={cfg.info.text} onValue={(v) => info({ text: v })} />
                    <TextField label="Email" value={cfg.info.email} onValue={(v) => info({ email: v })} />
                    <TextField label="Phone" value={cfg.info.phone} onValue={(v) => info({ phone: v })} />
                    <TextField label="WhatsApp number" details="With country code, e.g. +20 100 123 4567" value={cfg.info.whatsapp} onValue={(v) => info({ whatsapp: v })} />
                    <TextArea label="Address" rows={2} value={cfg.info.address} onValue={(v) => info({ address: v })} />
                    <TextArea label="Opening hours" rows={2} value={cfg.info.hours} onValue={(v) => info({ hours: v })} />
                  </>
                ) : null}
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "style"}><s-section heading="Colours">
              <s-stack gap="base">
                <Select label="Page background" value={cfg.look.bgType} onValue={(v) => look({ bgType: v as Look["bgType"] })} options={[{ value: "color", label: "One colour" }, { value: "gradient", label: "Gradient (two colours)" }]} />
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <ColorField label={cfg.look.bgType === "gradient" ? "Background from" : "Background"} value={cfg.look.bg} onValue={(v) => look({ bg: v })} />
                  {cfg.look.bgType === "gradient" ? <ColorField label="Background to" value={cfg.look.bg2} onValue={(v) => look({ bg2: v })} /> : null}
                  <ColorField label="Card" value={cfg.look.card} disabled={cfg.layout.style === "plain"} onValue={(v) => look({ card: v })} />
                  <ColorField label="Text" value={cfg.look.text} onValue={(v) => look({ text: v })} />
                  <ColorField label="Fields" value={cfg.look.fieldBg} onValue={(v) => look({ fieldBg: v })} />
                  <ColorField label="Field border" value={cfg.look.fieldBorder} onValue={(v) => look({ fieldBorder: v })} />
                  <ColorField label="Button" value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                  <ColorField label="Button text" value={cfg.look.accentText} onValue={(v) => look({ accentText: v })} />
                </s-grid>
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "style"}><s-section heading="Sizes">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <NumberField label="Heading" suffix="px" min={16} max={64} step={1} value={cfg.look.headingSize} onValue={(v) => look({ headingSize: v })} />
                <NumberField label="Text" suffix="px" min={12} max={22} step={1} value={cfg.look.textSize} onValue={(v) => look({ textSize: v })} />
                <NumberField label="Field height" suffix="px" min={34} max={70} step={1} value={cfg.look.fieldHeight} onValue={(v) => look({ fieldHeight: v })} />
                <NumberField label="Button text" suffix="px" min={12} max={22} step={1} value={cfg.look.buttonSize} onValue={(v) => look({ buttonSize: v })} />
                <NumberField label="Corners" suffix="px" min={0} max={32} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                <NumberField label="Space above and below" suffix="px" min={0} max={120} step={4} value={cfg.look.padding} onValue={(v) => look({ padding: v })} />
              </s-grid>
            </s-section></Pane>
          </s-stack>

          <div className={ui.preview}>
            <div className={ui.previewBar}>
              <span>Live preview</span>
              <Segmented
                label="Preview size"
                value={device}
                options={[
                  { value: "desktop", label: "Desktop" },
                  { value: "phone", label: "Phone" },
                ]}
                onChange={setDevice}
              />
            </div>
            <style dangerouslySetInnerHTML={{ __html: data.css }} />
            <div className={ui.frame}>
              <div className={device === "phone" ? ui.phone : undefined}>
                <ThemeLook style={data.style}><ContactPreview config={cfg} /></ThemeLook>
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
