import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
  ShouldRevalidateFunction,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { listItems, sectionLinks } from "../lib/sections.server";
import { getFaqDesign, saveFaqDesign } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { matchFaq } from "../lib/theme-match";
import { ThemeLook, ThemeMatch } from "../components/ThemeStyle";
import {
  applyFaqPreset,
  FAQ_PRESETS,
  withFaqDefaults,
  type FaqDesign,
} from "../lib/faq-design";
import {
  Button,
  Checkbox,
  ColorField,
  NumberField,
  Select,
  Switch,
  TextField,
} from "../components/fields";
import {
  FaqDesignPreview,
  type PreviewQuestion,
} from "../components/FaqDesignPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker } from "../components/LookPicker";
import {
  DesignTabs,
  Pane,
  PreviewFrame,
  type DesignTab,
} from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, items, style] = await Promise.all([
    getFaqDesign(admin),
    getThemeStatus(admin).catch(() => null),
    listItems(admin, "faq").catch(() => []),
    getThemeStyle(admin).catch(() => FALLBACK_STYLE),
  ]);
  const questions: PreviewQuestion[] = items
    .filter((i) => i.values.active !== false && i.values.question)
    .map((i) => ({
      q: String(i.values.question),
      a: String(i.values.answer || ""),
      group: String(i.values.group || ""),
    }));
  return {
    config,
    saved,
    questions,
    style,
    domain: session.shop,
    css: storefrontCss("ucs-sections.css"),
    inTheme: theme ? theme.installed.faq : null,
    addLink: sectionLinks(session.shop).faq,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const draft = form.get("intent") === "draft";
    const config = await saveFaqDesign(
      admin,
      withFaqDefaults(JSON.parse(String(form.get("config")))),
      draft,
    );
    return { ok: true, draft, error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type C = FaqDesign;

export default function FaqDesigner() {
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
    if (!fetcher.data.ok)
      shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
    else if (fetcher.data.draft)
      shopify.toast.show(
        "Your changes are in the theme editor preview (only you see them). Save here to put them live.",
      );
    else shopify.toast.show("FAQ saved — live on your store");
  }, [fetcher.state, fetcher.data, shopify]);

  const part =
    <K extends Exclude<keyof C, "scheme">>(k: K) =>
    (patch: Partial<C[K]>) =>
      setCfg((c) => ({ ...c, [k]: { ...(c[k] as object), ...patch } }));
  const text = part("text"),
    questions = part("questions"),
    space = part("space");
  const look = (patch: Partial<C["look"]>) =>
    setCfg((c) => ({ ...c, scheme: "", look: { ...c.look, ...patch } }));
  const save = () =>
    fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });
  const seeOnStore = () =>
    fetcher.submit(
      { config: JSON.stringify(cfg), intent: "draft" },
      { method: "post" },
    );

  return (
    <s-page heading="FAQ" inlineSize="large">
      <CategoryCrumb feature="faq" />
      <Button
        slot="primary-action"
        variant="primary"
        loading={fetcher.state !== "idle"}
        onClick={save}
      >
        Save
      </Button>
      <Button
        slot="secondary-actions"
        href={`https://${data.domain}/admin/themes/current/editor?previewPath=%2F`}
        target="_blank"
        onClick={seeOnStore}
      >
        See it on my store
      </Button>
      <Button
        slot="secondary-actions"
        href={data.addLink}
        target="_top"
        icon="theme-edit"
      >
        {data.inTheme ? "Open in theme editor" : "Add to theme"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="faq" />
          <s-text color="subdued">
            Questions and groups are in the Questions tab. Here you choose how
            the FAQ looks and works; every copy of the section uses this design.
            In the theme editor each copy can still show only one group (e.g.
            Shipping) and have its own heading.
          </s-text>
          {!data.saved ? (
            <s-banner tone="info" heading="Not saved yet">
              Your store uses the standard look until you save here.
            </s-banner>
          ) : null}
          {fetcher.data?.error ? (
            <s-banner tone="critical">{fetcher.data.error}</s-banner>
          ) : null}
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs
            tabs={["looks", "content", "style", "display"]}
            value={tab}
            onChange={setTab}
          />
          <div className={ui.layout}>
            <s-stack gap="base">
              <Pane show={tab === "looks"}>
                <ThemeMatch
                  style={data.style}
                  config={cfg}
                  setConfig={setCfg}
                  match={matchFaq}
                />
              </Pane>
              <Pane show={tab === "looks"}>
                <LookPicker
                  presets={FAQ_PRESETS}
                  config={cfg}
                  apply={applyFaqPreset}
                  onPick={(key) => setCfg((c) => applyFaqPreset(c, key))}
                  render={(c) => (
                    <ThemeLook style={data.style}>
                      <FaqDesignPreview config={c} questions={data.questions} />
                    </ThemeLook>
                  )}
                />
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Heading">
                  <s-stack gap="base">
                    <TextField
                      label="Heading"
                      details="Leave empty for no heading."
                      value={cfg.text.heading}
                      onValue={(v) => text({ heading: v })}
                    />
                    <TextField
                      label="Text under the heading"
                      value={cfg.text.sub}
                      onValue={(v) => text({ sub: v })}
                    />
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <NumberField
                        label="Heading size"
                        suffix="px"
                        min={18}
                        max={56}
                        step={2}
                        value={cfg.text.headingSize}
                        onValue={(v) => text({ headingSize: v })}
                      />
                      <Select
                        label="Alignment"
                        value={cfg.text.align}
                        onValue={(v) =>
                          text({ align: v as C["text"]["align"] })
                        }
                        options={[
                          { value: "left", label: "Left" },
                          { value: "center", label: "Centre" },
                        ]}
                      />
                    </s-grid>
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="How it works">
                  <s-stack gap="base">
                    <Switch
                      label="Show a search box"
                      checked={cfg.questions.search}
                      onValue={(v) => questions({ search: v })}
                    />
                    <Switch
                      label="Show group buttons (All, Shipping, Returns…)"
                      details="Only when your questions have more than one group."
                      checked={cfg.questions.tabs}
                      onValue={(v) => questions({ tabs: v })}
                    />
                    <Switch
                      label="Open one answer at a time"
                      checked={cfg.questions.oneOpen}
                      onValue={(v) => questions({ oneOpen: v })}
                    />
                    <Switch
                      label="Open the first answer"
                      checked={cfg.questions.openFirst}
                      onValue={(v) => questions({ openFirst: v })}
                    />
                    <Select
                      label="Columns on desktop"
                      value={String(cfg.questions.columns)}
                      onValue={(v) => questions({ columns: v === "2" ? 2 : 1 })}
                      options={[
                        { value: "1", label: "One" },
                        { value: "2", label: "Two" },
                      ]}
                    />
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Help button">
                  <s-stack gap="base">
                    <Switch
                      label="Show a help button"
                      details="“Still have a question?” and a button under the questions."
                      checked={cfg.text.help}
                      onValue={(v) => text({ help: v })}
                    />
                    {cfg.text.help ? (
                      <>
                        <TextField
                          label="Text"
                          value={cfg.text.contactText}
                          onValue={(v) => text({ contactText: v })}
                        />
                        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                          <TextField
                            label="Button"
                            details="Empty = no button."
                            value={cfg.text.contactLabel}
                            onValue={(v) => text({ contactLabel: v })}
                          />
                          <TextField
                            label="Button link"
                            details="Empty = your contact page. A WhatsApp link works too: https://wa.me/201234567890"
                            placeholder="/pages/contact"
                            value={cfg.text.contactLink}
                            onValue={(v) => text({ contactLink: v })}
                          />
                        </s-grid>
                      </>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Questions">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select
                      label="Style"
                      value={cfg.look.style}
                      onValue={(v) => look({ style: v as C["look"]["style"] })}
                      options={[
                        { value: "lines", label: "Lines between questions" },
                        { value: "cards", label: "Cards" },
                      ]}
                    />
                    <Select
                      label="Icon"
                      value={cfg.look.icon}
                      onValue={(v) => look({ icon: v as C["look"]["icon"] })}
                      options={[
                        { value: "plus", label: "Plus" },
                        { value: "chevron", label: "Arrow" },
                      ]}
                    />
                    <NumberField
                      label="Question size"
                      suffix="px"
                      min={13}
                      max={24}
                      step={1}
                      value={cfg.look.questionSize}
                      onValue={(v) => look({ questionSize: v })}
                    />
                    <NumberField
                      label="Width"
                      suffix="px"
                      min={560}
                      max={1400}
                      step={20}
                      value={cfg.look.maxWidth}
                      onValue={(v) => look({ maxWidth: v })}
                    />
                    {cfg.look.style === "cards" ? (
                      <NumberField
                        label="Card corners"
                        suffix="px"
                        min={0}
                        max={24}
                        step={2}
                        value={cfg.look.radius}
                        onValue={(v) => look({ radius: v })}
                      />
                    ) : null}
                  </s-grid>
                  <s-box paddingBlockStart="base">
                    <Checkbox
                      label="Icon on the left of the question"
                      checked={cfg.look.iconLeft}
                      onValue={(v) => look({ iconLeft: v })}
                    />
                  </s-box>
                </s-section>
              </Pane>

              <Pane show={tab === "style"}>
                <s-section heading="Colours">
                  <s-stack gap="base">
                    <ColorField
                      label="Buttons (group buttons and help button)"
                      value={cfg.look.accent}
                      onValue={(v) => look({ accent: v })}
                    />
                    <Switch
                      label="Own background"
                      details="Off: the page's background shows through."
                      checked={cfg.look.ownBg}
                      onValue={(v) => look({ ownBg: v })}
                    />
                    {cfg.look.ownBg ? (
                      <ColorField
                        label="Background"
                        value={cfg.look.bg}
                        onValue={(v) => look({ bg: v })}
                      />
                    ) : null}
                    <Switch
                      label="Own text colour"
                      details="Off: uses your theme's text colour."
                      checked={cfg.look.ownText}
                      onValue={(v) => look({ ownText: v })}
                    />
                    {cfg.look.ownText ? (
                      <ColorField
                        label="Text"
                        value={cfg.look.fg}
                        onValue={(v) => look({ fg: v })}
                      />
                    ) : null}
                    {cfg.look.style === "cards" ? (
                      <>
                        <Switch
                          label="Own card colour"
                          details="Off: a soft tint of the text colour."
                          checked={cfg.look.ownCard}
                          onValue={(v) => look({ ownCard: v })}
                        />
                        {cfg.look.ownCard ? (
                          <ColorField
                            label="Card background"
                            value={cfg.look.cardBg}
                            onValue={(v) => look({ cardBg: v })}
                          />
                        ) : null}
                      </>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "display"}>
                <s-section heading="Spacing and devices">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <NumberField
                      label="Top padding"
                      suffix="px"
                      min={0}
                      max={100}
                      step={4}
                      value={cfg.space.top}
                      onValue={(v) => space({ top: v })}
                    />
                    <NumberField
                      label="Bottom padding"
                      suffix="px"
                      min={0}
                      max={100}
                      step={4}
                      value={cfg.space.bottom}
                      onValue={(v) => space({ bottom: v })}
                    />
                    <Select
                      label="Devices"
                      value={cfg.space.devices}
                      onValue={(v) =>
                        space({ devices: v as C["space"]["devices"] })
                      }
                      options={[
                        { value: "all", label: "Desktop and mobile" },
                        { value: "desktop", label: "Desktop only" },
                        { value: "mobile", label: "Mobile only" },
                      ]}
                    />
                  </s-grid>
                </s-section>
              </Pane>
              <Pane show={tab === "display"}>
                <s-section heading="Per page (theme editor)">
                  <s-text color="subdued">
                    Each copy of the FAQ section in the theme editor can show
                    only one group (e.g. Shipping on the shipping page), have
                    its own heading, and switch the Google structured data on or
                    off. Keep the structured data on one page only.
                  </s-text>
                </s-section>
              </Pane>
            </s-stack>

            <PreviewFrame
              title={
                data.questions.length
                  ? "Your store · your questions"
                  : "Your store · example questions"
              }
            >
              <ThemeLook style={data.style}>
                <FaqDesignPreview config={cfg} questions={data.questions} />
              </ThemeLook>
            </PreviewFrame>
          </div>
        </s-stack>
      </div>
    </s-page>
  );
}

/** Storing a draft for "See it on my store" must not reload the page (that would drop unsaved changes). */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formData,
  defaultShouldRevalidate,
}) => (formData?.get("intent") === "draft" ? false : defaultShouldRevalidate);

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
