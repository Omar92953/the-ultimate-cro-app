import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage, gql } from "../lib/admin.server";
import { editorLinks, getSlides, getThemeStatus } from "../lib/cro.server";
import { getVideoCarouselDesign, saveDraft, saveVideoCarouselDesign } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE, previewTheme } from "../lib/theme-style";
import { ThemeLook, ThemeStylePanel } from "../components/ThemeStyle";
import { applyVideoCarouselPreset, matchVideoCarouselTheme, toStorefrontVideoCarousel, VC_PAGE_LABELS, VC_PAGES, VIDEO_CAROUSEL_PRESETS, withVideoCarouselDefaults, type VideoCarouselDesign } from "../lib/video-carousel-design";
import { Button, Checkbox, NumberField, Select, Switch, TextField } from "../components/fields";
import { Segmented } from "../components/ui";
import { VideoCarouselPreview, type PreviewSlide } from "../components/VideoCarouselPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";

/** Prices of the linked products, formatted in the shop's currency, for the preview. */
async function prices(admin: Parameters<typeof gql>[0], ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const data = await gql(
    admin,
    `#graphql
    query CroSlidePrices($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id priceRangeV2 { minVariantPrice { amount currencyCode } } } } }`,
    { ids },
  );
  const out = new Map<string, string>();
  for (const n of data.nodes ?? []) {
    const p = n?.priceRangeV2?.minVariantPrice;
    if (!p) continue;
    try {
      out.set(n.id, new Intl.NumberFormat("en", { style: "currency", currency: p.currencyCode }).format(Number(p.amount)));
    } catch {
      out.set(n.id, `${p.amount} ${p.currencyCode}`);
    }
  }
  return out;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, raw, style] = await Promise.all([getVideoCarouselDesign(admin), getThemeStatus(admin).catch(() => null), getSlides(admin).catch(() => []), getThemeStyle(admin).catch(() => FALLBACK_STYLE)]);
  const priceOf = await prices(admin, [...new Set(raw.flatMap((s) => (s.product ? [s.product.id] : [])))]).catch(() => new Map<string, string>());
  const slides: PreviewSlide[] = raw
    .filter((s) => s.video)
    .map((s) => ({
      kind: s.video!.kind,
      image: s.video!.image ?? null,
      caption: s.caption,
      product: s.product ? { title: s.product.title, price: priceOf.get(s.product.id) ?? "" } : null,
    }));
  return { config, saved, slides, style, shop: session.shop, css: storefrontCss("ucro.css"), inTheme: theme ? theme.installed.videos : null, addLink: editorLinks(session.shop).videos };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const clean = withVideoCarouselDefaults(JSON.parse(String(form.get("config"))));
    if (form.get("intent") === "draft") {
      await saveDraft(admin, "videos", toStorefrontVideoCarousel(clean));
      return { ok: true, draft: true, error: null, config: null };
    }
    const config = await saveVideoCarouselDesign(admin, clean);
    return { ok: true, draft: false, error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type C = VideoCarouselDesign;

export default function VideoCarouselDesigner() {
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
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
    else if (fetcher.data.draft) shopify.toast.show("Your changes are in the theme editor preview (only you see them). Save here to put them live.");
    else shopify.toast.show("Video carousel design saved — live on your store");
  }, [fetcher.state, fetcher.data, shopify]);

  const part = <K extends keyof C>(k: K) => (patch: Partial<C[K]>) => setCfg((c) => ({ ...c, [k]: { ...(c[k] as object), ...patch } }));
  const text = part("text"), videos = part("videos"), layout = part("layout"), display = part("display");
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });
  // The link opens the theme editor on the home page while the unsaved changes are stored as a draft.
  const previewLink = `https://${data.shop}/admin/themes/current/editor?previewPath=%2F`;
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" });
  const pageLook = previewTheme(data.style);
  const blockLook = cfg.layout.scheme ? previewTheme(data.style, cfg.layout.scheme) : null;

  return (
    <s-page heading="Video carousel" inlineSize="large">
      <CategoryCrumb feature="videos" />
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={previewLink} target="_blank" onClick={seeOnStore}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to a page"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="videos" />
          <s-text color="subdued">
            Add, order and link the videos in “Manage videos”. Here you choose how the carousel looks and where it shows. In the theme editor you only place the “Video carousel” section.
          </s-text>
          {!data.saved ? (
            <s-banner tone="info" heading="Not saved yet">
              Your store uses the standard look until you save here.
            </s-banner>
          ) : null}
          {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs tabs={["looks", "content", "layout", "display"]} value={tab} onChange={setTab} />

          <Pane show={tab === "looks"}>
            <ThemeStylePanel style={data.style} scheme={cfg.layout.scheme} onScheme={(id) => layout({ scheme: id })} onMatch={() => setCfg((c) => matchVideoCarouselTheme(c, c.layout.scheme))} />
          </Pane>
          <Pane show={tab === "looks"}>
            <LookPicker presets={VIDEO_CAROUSEL_PRESETS} config={cfg} apply={applyVideoCarouselPreset} onPick={(key) => setCfg((c) => applyVideoCarouselPreset(c, key))} swatch={(c) => ({ accent: pageLook.accent, radius: c.layout.corners === "theme" ? pageLook.radius : c.layout.corners === "round" ? 14 : 0, cards: c.layout.desktop, ratio: ({ "9 / 16": 1.78, "3 / 4": 1.33, "4 / 5": 1.25, "1 / 1": 1 } as Record<string, number>)[c.layout.ratio] })} />
          </Pane>

          <div className={ui.layout}>
            <s-stack gap="base">
              <Pane show={tab === "content"}>
                <s-section heading="Heading">
                  <s-stack gap="base">
                    <TextField label="Heading" value={cfg.text.heading} onValue={(v) => text({ heading: v })} />
                    <TextField label="Subheading" value={cfg.text.sub} onValue={(v) => text({ sub: v })} />
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <Select label="Size" value={cfg.text.size} onValue={(v) => text({ size: v as C["text"]["size"] })} options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} />
                      <Select label="Alignment" value={cfg.text.align} onValue={(v) => text({ align: v as C["text"]["align"] })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
                    </s-grid>
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Videos and products">
                  <s-stack gap="base">
                    <Switch label="Play videos while visible" details="Muted, and only while on screen." checked={cfg.videos.autoplay} onValue={(v) => videos({ autoplay: v })} />
                    <Switch label="Show product name and price" details="Under videos linked to a product." checked={cfg.videos.product} onValue={(v) => videos({ product: v })} />
                    {cfg.videos.product ? <Switch label="Show Add to cart button" checked={cfg.videos.add} onValue={(v) => videos({ add: v })} /> : null}
                    {cfg.videos.product && cfg.videos.add ? <TextField label="Button text" value={cfg.videos.addLabel} onValue={(v) => videos({ addLabel: v })} /> : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "layout"}>
                <s-section heading="Slides">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Shape" value={cfg.layout.ratio} onValue={(v) => layout({ ratio: v as C["layout"]["ratio"] })} options={[{ value: "9 / 16", label: "Tall (9:16)" }, { value: "3 / 4", label: "Portrait (3:4)" }, { value: "4 / 5", label: "Portrait (4:5)" }, { value: "1 / 1", label: "Square" }]} />
                    <Select label="Corners" value={cfg.layout.corners} onValue={(v) => layout({ corners: v as C["layout"]["corners"] })} options={[{ value: "theme", label: "Match my theme" }, { value: "square", label: "Square" }, { value: "round", label: "Round" }]} />
                    <NumberField label="Slides on desktop" min={2} max={6} step={1} value={cfg.layout.desktop} onValue={(v) => { layout({ desktop: v }); setDevice("desktop"); }} />
                    <Select label="Slides on mobile" value={cfg.layout.mobile} onValue={(v) => { layout({ mobile: v as C["layout"]["mobile"] }); setDevice("phone"); }} options={[{ value: "1.2", label: "1 and a peek" }, { value: "2", label: "2" }, { value: "2.2", label: "2 and a peek" }]} />
                    <NumberField label="Space between slides" suffix="px" min={0} max={40} step={2} value={cfg.layout.gap} onValue={(v) => layout({ gap: v })} />
                  </s-grid>
                  <s-box paddingBlockStart="base">
                    <Switch label="Show arrows and counter" checked={cfg.layout.arrows} onValue={(v) => layout({ arrows: v })} />
                  </s-box>
                </s-section>
              </Pane>

              <Pane show={tab === "display"}>
                <s-section heading="Where it shows">
                  <s-stack gap="base">
                    <Select
                      label="Pages"
                      value={cfg.display.showOn}
                      onValue={(v) => display({ showOn: v as C["display"]["showOn"] })}
                      options={[{ value: "everywhere", label: "Everywhere you place it" }, { value: "only", label: "Only on the pages below" }, { value: "except", label: "Everywhere except the pages below" }]}
                    />
                    {cfg.display.showOn !== "everywhere" ? (
                      <>
                        <s-stack gap="small-200">
                          {VC_PAGES.map((p) => (
                            <Checkbox key={p} label={VC_PAGE_LABELS[p]} checked={cfg.display.pages.includes(p)} onValue={(on) => display({ pages: on ? [...cfg.display.pages, p] : cfg.display.pages.filter((x) => x !== p) })} />
                          ))}
                        </s-stack>
                        <TextField label="Specific pages (handles)" details="Comma separated, e.g. summer-tee, about-us. The handle is the last part of the page address." value={cfg.display.handles} onValue={(v) => display({ handles: v })} />
                      </>
                    ) : null}
                    <s-text color="subdued">Tip: put the carousel in the footer and choose “Only on: All product pages” to show it under every product.</s-text>
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "display"}>
                <s-section heading="Spacing and devices">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <NumberField label="Space above" suffix="px" min={0} max={120} step={4} value={cfg.display.top} onValue={(v) => display({ top: v })} />
                    <NumberField label="Space below" suffix="px" min={0} max={120} step={4} value={cfg.display.bottom} onValue={(v) => display({ bottom: v })} />
                    <Select label="Show on" value={cfg.display.devices} onValue={(v) => display({ devices: v as C["display"]["devices"] })} options={[{ value: "all", label: "Desktop and mobile" }, { value: "desktop", label: "Desktop only" }, { value: "mobile", label: "Mobile only" }]} />
                  </s-grid>
                </s-section>
              </Pane>
            </s-stack>

            <PreviewFrame
              title={data.slides.length ? "Your videos" : "Example videos"}
              tools={<Segmented label="Device" value={device} options={[{ value: "desktop", label: "Desktop" }, { value: "phone", label: "Phone" }]} onChange={setDevice} />}
            >
              <div style={{ padding: "4px 0" }}>
                <ThemeLook style={data.style}>
                  <VideoCarouselPreview config={cfg} slides={data.slides} phone={device === "phone"} page={pageLook} block={blockLook} />
                </ThemeLook>
              </div>
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
