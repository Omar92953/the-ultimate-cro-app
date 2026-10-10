import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage, gql } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { listItems, sectionLinks } from "../lib/sections.server";
import { getAnnouncementDesign, getShippingBar, saveAnnouncementDesign } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { matchAnnouncement } from "../lib/theme-match";
import { ThemeLook, ThemeMatch } from "../components/ThemeStyle";
import { ANNOUNCEMENT_PRESETS, applyAnnouncementPreset, withAnnouncementDefaults, type AnnouncementDesign } from "../lib/announcement-design";
import { Button, Checkbox, ColorField, NumberField, Select, Switch } from "../components/fields";
import { AnnouncementDesignPreview, type AnnouncementMessage } from "../components/AnnouncementDesignPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, items, ship, currency, style] = await Promise.all([
    getAnnouncementDesign(admin),
    getThemeStatus(admin, session.shop).catch(() => null),
    listItems(admin, "announcements").catch(() => []),
    getShippingBar(admin).catch(() => null),
    gql(admin, `#graphql\n query CroShopCurrencyAb { shop { currencyCode } }`)
      .then((d) => d.shop.currencyCode as string)
      .catch(() => "USD"),
    getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE),
  ]);
  const messages: AnnouncementMessage[] = items
    .filter((i) => i.values.active !== false && i.values.message)
    .map((i) => ({ text: String(i.values.message), link: !!i.values.link, icon: String(i.values.icon || "none") }));
  return {
    config,
    saved,
    messages,
    freeShipping: ship?.saved ? { goal: ship.config.goal, empty: ship.config.text.empty, progress: ship.config.text.progress, done: ship.config.text.done, currency } : null,
    style,
    domain: session.shop,
    css: storefrontCss("ucs-sections.css"),
    inTheme: theme ? theme.installed.announcements : null,
    addLink: sectionLinks(session.shop).announcements,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const draft = form.get("intent") === "draft";
    const config = await saveAnnouncementDesign(admin, withAnnouncementDefaults(JSON.parse(String(form.get("config")))), draft);
    return { ok: true, draft, error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type C = AnnouncementDesign;

export default function AnnouncementDesigner() {
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
    else shopify.toast.show("Announcement bar saved — live on your store");
  }, [fetcher.state, fetcher.data, shopify]);

  const part = <K extends Exclude<keyof C, "scheme">>(k: K) => (patch: Partial<C[K]>) => setCfg((c) => ({ ...c, [k]: { ...(c[k] as object), ...patch } }));
  const look = part("look"), behaviour = part("behaviour"), freeShipping = part("freeShipping"), display = part("display");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" });

  return (
    <s-page heading="Announcement bar" inlineSize="large">
      <CategoryCrumb feature="announcements" />
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?previewPath=%2F`} target="_blank" onClick={seeOnStore}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Turn on in theme"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="announcements" />
          <s-text color="subdued">Messages, icons and dates are in the Messages tab. Here you choose how the bar looks and behaves. In the theme editor you only switch the “Announcement bar” embed on.</s-text>
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
            <ThemeMatch style={data.style} config={cfg} setConfig={setCfg} match={matchAnnouncement} />
          </Pane>
          <Pane show={tab === "looks"}>
            <LookPicker presets={ANNOUNCEMENT_PRESETS} config={cfg} apply={applyAnnouncementPreset} onPick={(key) => setCfg((c) => applyAnnouncementPreset(c, key))} render={(c) => <ThemeLook style={data.style}><AnnouncementDesignPreview config={c} messages={data.messages} freeShipping={data.freeShipping} /></ThemeLook>} />
          </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Free-shipping message">
                  <s-stack gap="base">
                    <Switch label="Show how much more to spend for free shipping" details="Uses the goal and words from Boosters → Free shipping bar, so your store has one goal." checked={cfg.freeShipping.on} onValue={(v) => freeShipping({ on: v })} />
                    {cfg.freeShipping.on && !data.freeShipping ? (
                      <s-banner tone="warning">
                        Set the goal first in{" "}
                        <s-link href="/app/designs/shipping-bar">Free shipping bar</s-link>.
                      </s-banner>
                    ) : null}
                    {cfg.freeShipping.on ? <Checkbox label="Progress line along the bottom" checked={cfg.freeShipping.bar} onValue={(v) => freeShipping({ bar: v })} /> : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Behaviour">
                  <s-stack gap="base">
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <Select label="Change messages with" value={cfg.behaviour.animation} onValue={(v) => behaviour({ animation: v as C["behaviour"]["animation"] })} options={[{ value: "fade", label: "Fade" }, { value: "slide", label: "Slide up" }]} />
                      <NumberField label="Time per message" suffix="sec" min={2} max={12} step={1} value={cfg.behaviour.interval} onValue={(v) => behaviour({ interval: v })} />
                    </s-grid>
                    <Switch label="Arrows" checked={cfg.behaviour.arrows} onValue={(v) => behaviour({ arrows: v })} />
                    <Switch label="Customers can close it" checked={cfg.behaviour.dismissible} onValue={(v) => behaviour({ dismissible: v })} />
                    <Switch label="Stay at the top while scrolling" checked={cfg.behaviour.sticky} onValue={(v) => behaviour({ sticky: v })} />
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Look">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <ColorField label="Background" value={cfg.look.bg} onValue={(v) => setCfg((c) => ({ ...c, scheme: "", look: { ...c.look, bg: v } }))} />
                    <ColorField label="Text" value={cfg.look.fg} onValue={(v) => setCfg((c) => ({ ...c, scheme: "", look: { ...c.look, fg: v } }))} />
                    <NumberField label="Text size" suffix="px" min={11} max={18} step={1} value={cfg.look.size} onValue={(v) => look({ size: v })} />
                    <NumberField label="Height" details="Space above and below the text" suffix="px" min={4} max={18} step={1} value={cfg.look.padding} onValue={(v) => look({ padding: v })} />
                    <Checkbox label="CAPITAL LETTERS" checked={cfg.look.upper} onValue={(v) => look({ upper: v })} />
                  </s-grid>
                </s-section>
              </Pane>

              <Pane show={tab === "display"}>
                <s-section heading="Where it shows">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Pages" value={cfg.display.pages} onValue={(v) => display({ pages: v as C["display"]["pages"] })} options={[{ value: "all", label: "All pages" }, { value: "home", label: "Home page only" }]} />
                    <Select label="Devices" value={cfg.display.devices} onValue={(v) => display({ devices: v as C["display"]["devices"] })} options={[{ value: "all", label: "Desktop and mobile" }, { value: "desktop", label: "Desktop only" }, { value: "mobile", label: "Mobile only" }]} />
                  </s-grid>
                </s-section>
              </Pane>
            </s-stack>

            <PreviewFrame title={data.messages.length ? "Top of your store · your messages" : "Top of your store"}>
              <ThemeLook style={data.style}>
                <AnnouncementDesignPreview config={cfg} messages={data.messages} freeShipping={data.freeShipping} />
                <div aria-hidden="true" style={{ height: 120, background: "repeating-linear-gradient(180deg,#f3f3f3 0 10px,transparent 10px 24px)", margin: 16, opacity: 0.6 }} />
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
