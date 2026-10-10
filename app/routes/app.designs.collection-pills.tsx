/* eslint-disable @typescript-eslint/no-explicit-any -- App Bridge resource picker payloads are untyped */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { getPills, savePills } from "../lib/designs.server";
import { withPillsDefaults, type CollectionPillsConfig, type PillItem } from "../lib/collection-pills";
import { Button, Checkbox, ColorField, NumberField, Select, TextField } from "../components/fields";
import { CollectionPillsPreview } from "../components/CollectionPillsPreview";
import ui from "../components/PageEditor.module.css";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook, ThemeMatch } from "../components/ThemeStyle";
import { matchPills } from "../lib/theme-match";
import { DesignTabs, Pane, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme] = await Promise.all([getPills(admin), getThemeStatus(admin).catch(() => null)]);
  return { style: await getThemeStyle(admin).catch(() => FALLBACK_STYLE), domain: session.shop, config, saved, css: storefrontCss("ucs-sections.css"), inTheme: theme ? theme.installed.collection_pills : null, addLink: sectionLinks(session.shop).collection_pills };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await savePills(admin, withPillsDefaults(JSON.parse(String(form.get("config")))), form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type C = CollectionPillsConfig;

export default function CollectionPillsDesigner() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const [tab, setTab] = useState<DesignTab>("content");
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
    else if (fetcher.data.ok) shopify.toast.show("Collection pills saved — live on your store");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const item = (i: number, patch: Partial<PillItem>) => setCfg((c) => ({ ...c, items: c.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const move = (i: number, dir: -1 | 1) =>
    setCfg((c) => {
      const j = i + dir;
      if (j < 0 || j >= c.items.length) return c;
      const items = [...c.items];
      [items[i], items[j]] = [items[j], items[i]];
      return { ...c, items };
    });
  const layout = (patch: Partial<C["layout"]>) => setCfg((c) => ({ ...c, layout: { ...c.layout, ...patch } }));
  const look = (patch: Partial<C["look"]>) => setCfg((c) => ({ ...c, look: { ...c.look, ...patch } }));
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });

  async function pick() {
    const selected: any = await shopify.resourcePicker({
      type: "collection",
      multiple: true,
      action: "select",
      selectionIds: cfg.items.filter((x) => x.id).map((x) => ({ id: x.id })),
    } as any);
    if (!selected) return;
    // Keep the order (and renamed labels) of collections already chosen; new ones go at the end.
    setCfg((c) => {
      const keep = c.items.filter((x) => selected.some((s: any) => s.id === x.id));
      const added = selected
        .filter((s: any) => !c.items.some((x) => x.id === s.id))
        .map((s: any) => ({ id: s.id, handle: s.handle, title: s.title, label: "", image: s.image?.originalSrc ?? s.image?.url ?? null }));
      return { ...c, items: [...keep, ...added].slice(0, 80) };
    });
  }

  return (
    <s-page heading="Collection pills" inlineSize="large">
      <CategoryCrumb feature="collection_pills" />
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?previewPath=${encodeURIComponent("/collections/all")}`} target="_blank" onClick={() => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" })}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to collection pages"}
      </Button>
      <div className={ui.shell}>
      <s-stack gap="base">
        <FeatureTabs feature="collection_pills" />
        {data.inTheme === false ? (
          <s-banner tone="info" heading="Place the pills on your collection pages">
            Click “Add to collection pages”, drag the “Collection pills” section under the collection title and save. You can also add it to any other page.
          </s-banner>
        ) : null}
        {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}

        <div className={ui.layout}>
          <s-stack gap="base">
        <DesignTabs tabs={["looks", "content", "layout", "style"]} value={tab} onChange={setTab} />
        <Pane show={tab === "looks"}>
          <ThemeMatch style={data.style} config={cfg} setConfig={setCfg} match={matchPills} />
        </Pane>
            <Pane show={tab === "content"}><s-section heading={`Collections (${cfg.items.length})`}>
              <s-stack gap="base">
                <s-text color="subdued">Each pill opens a collection. On a collection page, its own pill is highlighted.</s-text>
                {cfg.items.map((x, i) => (
                  <s-box key={x.id || x.handle} padding="small-200" borderWidth="base" borderRadius="base">
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-thumbnail src={x.image ?? undefined} alt={x.title} size="small" />
                      <s-box inlineSize="40%">
                        <TextField label={x.title} placeholder="Name on the pill" value={x.label} onValue={(v) => item(i, { label: v })} />
                      </s-box>
                      <Button icon="arrow-up" accessibilityLabel={`Move ${x.title} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                        Up
                      </Button>
                      <Button icon="arrow-down" accessibilityLabel={`Move ${x.title} down`} disabled={i === cfg.items.length - 1} onClick={() => move(i, 1)}>
                        Down
                      </Button>
                      <Button icon="delete" tone="critical" variant="tertiary" accessibilityLabel={`Remove ${x.title}`} onClick={() => setCfg((c) => ({ ...c, items: c.items.filter((_, j) => j !== i) }))}>
                        Remove
                      </Button>
                    </s-stack>
                  </s-box>
                ))}
                <s-box>
                  <Button icon="collection" onClick={pick}>
                    {cfg.items.length ? "Add or remove collections" : "Choose collections"}
                  </Button>
                </s-box>
                {cfg.items.length ? <s-text color="subdued">Type in a box to rename a pill (e.g. “All” for “All single stickers”).</s-text> : null}
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "layout"}><s-section heading="Layout">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <Select label="When there are many" value={cfg.layout.mode} onValue={(v) => layout({ mode: v as C["layout"]["mode"] })} options={[{ value: "scroll", label: "One line that scrolls" }, { value: "wrap", label: "Several lines" }]} />
                <Select label="Alignment" value={cfg.layout.align} onValue={(v) => layout({ align: v as C["layout"]["align"] })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }]} />
                <NumberField label="Space above" suffix="px" min={0} max={80} step={2} value={cfg.layout.paddingTop} onValue={(v) => layout({ paddingTop: v })} />
                <NumberField label="Space below" suffix="px" min={0} max={80} step={2} value={cfg.layout.paddingBottom} onValue={(v) => layout({ paddingBottom: v })} />
              </s-grid>
              <s-box paddingBlockStart="base">
                <s-stack gap="small-200">
                  <Checkbox label="Arrows on desktop" checked={cfg.layout.arrows} onValue={(v) => layout({ arrows: v })} />
                  <Checkbox label="Collection pictures inside the pills" checked={cfg.layout.images} onValue={(v) => layout({ images: v })} />
                </s-stack>
              </s-box>
              <s-box paddingBlockStart="base">
                <TextField label="Heading above the pills (optional)" value={cfg.heading} onValue={(v) => setCfg((c) => ({ ...c, heading: v }))} />
              </s-box>
            </s-section></Pane>

            <Pane show={tab === "style"}><s-section heading="Look">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <Select label="Style" value={cfg.look.style} onValue={(v) => look({ style: v as C["look"]["style"] })} options={[{ value: "outline", label: "Outline" }, { value: "filled", label: "Filled" }, { value: "soft", label: "Soft" }]} />
                <NumberField label="Corners" details="999 = pill" suffix="px" min={0} max={999} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                <NumberField label="Text size" suffix="px" min={10} max={24} step={1} value={cfg.look.size} onValue={(v) => look({ size: v })} />
                <Select label="Text weight" value={String(cfg.look.weight)} onValue={(v) => look({ weight: Number(v) })} options={[{ value: "400", label: "Regular" }, { value: "500", label: "Medium" }, { value: "600", label: "Semibold" }, { value: "700", label: "Bold" }]} />
                <NumberField label="Inside space, sides" suffix="px" min={6} max={48} step={1} value={cfg.look.padX} onValue={(v) => look({ padX: v })} />
                <NumberField label="Inside space, top and bottom" suffix="px" min={4} max={24} step={1} value={cfg.look.padY} onValue={(v) => look({ padY: v })} />
                <NumberField label="Space between pills" suffix="px" min={0} max={32} step={1} value={cfg.look.gap} onValue={(v) => look({ gap: v })} />
                <span />
                <ColorField label="Text" value={cfg.look.text} onValue={(v) => look({ text: v })} />
                <ColorField label="Background" value={cfg.look.bg} onValue={(v) => look({ bg: v })} />
                <ColorField label="Border" value={cfg.look.border} onValue={(v) => look({ border: v })} />
                <span />
                <ColorField label="Current collection: text" value={cfg.look.activeText} onValue={(v) => look({ activeText: v })} />
                <ColorField label="Current collection: background" value={cfg.look.activeBg} onValue={(v) => look({ activeBg: v })} />
              </s-grid>
              <s-box paddingBlockStart="base">
                <Checkbox label="CAPITAL LETTERS" checked={cfg.look.upper} onValue={(v) => look({ upper: v })} />
              </s-box>
            </s-section></Pane>
          </s-stack>

          <div className={ui.preview}>
            <div className={ui.previewBar}>
              <span>Live preview</span>
            </div>
            <style dangerouslySetInnerHTML={{ __html: data.css }} />
            <div className={ui.frame}>
              <ThemeLook style={data.style}><CollectionPillsPreview config={cfg} /></ThemeLook>
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
