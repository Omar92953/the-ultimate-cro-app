import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { getImageCarousel, saveImageCarousel } from "../lib/designs.server";
import { RATIOS, withImageCarouselDefaults, type ImageCarouselConfig, type ImageSlide } from "../lib/image-carousel";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextField } from "../components/fields";
import { MediaPicker } from "../components/MediaPicker";
import { Segmented } from "../components/ui";
import { ImageCarouselPreview } from "../components/ImageCarouselPreview";
import ui from "../components/PageEditor.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme] = await Promise.all([getImageCarousel(admin), getThemeStatus(admin).catch(() => null)]);
  return { config, saved, css: storefrontCss("ucs-sections.css"), inTheme: theme ? theme.installed.image_carousel : null, addLink: sectionLinks(session.shop).image_carousel };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const { config, missing } = await saveImageCarousel(admin, withImageCarouselDefaults(JSON.parse(String(form.get("config")))));
    return { ok: true, error: null, config, missing };
  } catch (e) {
    return { ok: false, error: errorMessage(e), config: null, missing: 0 };
  }
};

type C = ImageCarouselConfig;
const BLANK: ImageSlide = { image: null, alt: "", title: "", text: "", link: "", button: "" };

export default function ImageCarouselDesigner() {
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
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
    else if (fetcher.data.missing) shopify.toast.show(`Saved. ${fetcher.data.missing} image(s) are still processing — save again in a minute.`);
    else shopify.toast.show("Image carousel saved — live on your store");
  }, [fetcher.state, fetcher.data, shopify]);

  const part = <K extends "heading" | "layout" | "nav" | "look">(k: K) => (patch: Partial<C[K]>) => setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));
  const heading = part("heading"), layout = part("layout"), nav = part("nav"), look = part("look");
  const slide = (i: number, patch: Partial<ImageSlide>) => setCfg((c) => ({ ...c, slides: c.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const move = (i: number, dir: -1 | 1) =>
    setCfg((c) => {
      const j = i + dir;
      if (j < 0 || j >= c.slides.length) return c;
      const slides = [...c.slides];
      [slides[i], slides[j]] = [slides[j], slides[i]];
      return { ...c, slides };
    });
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });

  return (
    <s-page heading="Image carousel" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to theme"}
      </Button>
      <s-stack gap="base">
        {data.inTheme === false ? (
          <s-banner tone="info" heading="Place the carousel in your theme">
            Click “Add to theme”, drop the “Image carousel” section where you want it and save. Everything else is set here.
          </s-banner>
        ) : null}
        {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}

        <div className={ui.layout}>
          <s-stack gap="base">
            <s-section heading={`Images (${cfg.slides.length})`}>
              <s-stack gap="base">
                {cfg.slides.map((s, i) => (
                  <s-box key={i} padding="base" borderWidth="base" borderRadius="base">
                    <s-stack gap="base">
                      <MediaPicker label={`Image ${i + 1}`} accept="image" value={s.image} onValue={(v) => slide(i, { image: v })} alt={s.title || "Carousel image"} />
                      <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                        <TextField label="Title (optional)" value={s.title} onValue={(v) => slide(i, { title: v })} />
                        <TextField label="Button text (optional)" value={s.button} onValue={(v) => slide(i, { button: v })} />
                      </s-grid>
                      <TextField label="Text (optional)" value={s.text} onValue={(v) => slide(i, { text: v })} />
                      <TextField label="Link (optional)" details="A page in your store (/collections/summer) or a full link. The whole picture becomes clickable." value={s.link} onValue={(v) => slide(i, { link: v })} />
                      <TextField label="Image description for screen readers" details="Leave empty to use the title." value={s.alt} onValue={(v) => slide(i, { alt: v })} />
                      <s-stack direction="inline" gap="small-200">
                        <Button icon="arrow-up" disabled={i === 0} onClick={() => move(i, -1)}>
                          Up
                        </Button>
                        <Button icon="arrow-down" disabled={i === cfg.slides.length - 1} onClick={() => move(i, 1)}>
                          Down
                        </Button>
                        <Button tone="critical" variant="tertiary" icon="delete" onClick={() => setCfg((c) => ({ ...c, slides: c.slides.filter((_, j) => j !== i) }))}>
                          Remove
                        </Button>
                      </s-stack>
                    </s-stack>
                  </s-box>
                ))}
                <s-box>
                  <Button icon="plus" disabled={cfg.slides.length >= 30} onClick={() => setCfg((c) => ({ ...c, slides: [...c.slides, { ...BLANK }] }))}>
                    Add image
                  </Button>
                </s-box>
              </s-stack>
            </s-section>

            <s-section heading="Heading">
              <s-stack gap="base">
                <Switch label="Show a heading" checked={cfg.heading.show} onValue={(v) => heading({ show: v })} />
                {cfg.heading.show ? (
                  <>
                    <TextField label="Heading" value={cfg.heading.text} onValue={(v) => heading({ text: v })} />
                    <TextField label="Subheading (optional)" value={cfg.heading.sub} onValue={(v) => heading({ sub: v })} />
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <Select label="Alignment" value={cfg.heading.align} onValue={(v) => heading({ align: v as C["heading"]["align"] })} options={[{ value: "center", label: "Centre" }, { value: "left", label: "Left" }]} />
                      <NumberField label="Heading size" suffix="px" min={14} max={56} step={1} value={cfg.heading.size} onValue={(v) => heading({ size: v })} />
                    </s-grid>
                  </>
                ) : null}
              </s-stack>
            </s-section>

            <s-section heading="Layout">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <NumberField label="Images per row on desktop" min={1} max={6} step={1} value={cfg.layout.perDesktop} onValue={(v) => layout({ perDesktop: v })} />
                <NumberField label="Images per row on phones" details="A slice of the next one always peeks in." min={1} max={3} step={1} value={cfg.layout.perMobile} onValue={(v) => layout({ perMobile: v })} />
                <Select label="Image shape" value={cfg.layout.ratio} onValue={(v) => layout({ ratio: v as C["layout"]["ratio"] })} options={RATIOS} />
                <Select
                  label="Title and text"
                  value={cfg.layout.captions}
                  onValue={(v) => layout({ captions: v as C["layout"]["captions"] })}
                  options={[
                    { value: "below", label: "Under the picture" },
                    { value: "overlay", label: "On the picture" },
                    { value: "none", label: "Hidden" },
                  ]}
                />
                <NumberField label="Space between images" suffix="px" min={0} max={48} step={1} value={cfg.layout.gap} onValue={(v) => layout({ gap: v })} />
                <NumberField label="Corners" suffix="px" min={0} max={40} step={1} value={cfg.layout.radius} onValue={(v) => layout({ radius: v })} />
                <NumberField label="Space above" suffix="px" min={0} max={120} step={4} value={cfg.layout.paddingTop} onValue={(v) => layout({ paddingTop: v })} />
                <NumberField label="Space below" suffix="px" min={0} max={120} step={4} value={cfg.layout.paddingBottom} onValue={(v) => layout({ paddingBottom: v })} />
              </s-grid>
              <s-box paddingBlockStart="base">
                <Checkbox label="Full width (edge to edge)" checked={cfg.layout.fullWidth} onValue={(v) => layout({ fullWidth: v })} />
              </s-box>
            </s-section>

            <s-section heading="Scrolling">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <Select
                  label="Shoppers move it with"
                  value={cfg.nav.mode}
                  onValue={(v) => nav({ mode: v as C["nav"]["mode"] })}
                  options={[
                    { value: "both", label: "Arrows and dots" },
                    { value: "arrows", label: "Arrows only" },
                    { value: "dots", label: "Dots only" },
                    { value: "swipe", label: "Swipe or scroll only" },
                  ]}
                />
                {cfg.nav.mode === "both" || cfg.nav.mode === "arrows" ? (
                  <NumberField label="Arrow size" suffix="px" min={24} max={64} step={2} value={cfg.nav.arrowSize} onValue={(v) => nav({ arrowSize: v })} />
                ) : (
                  <span />
                )}
                <NumberField label="Move on its own every" details="0 = off. Pauses while shoppers hover or touch it." suffix="sec" min={0} max={15} step={1} value={cfg.nav.autoplay} onValue={(v) => nav({ autoplay: v })} />
              </s-grid>
            </s-section>

            <s-section heading="Colours and text sizes">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <ColorField label="Text" value={cfg.look.text} onValue={(v) => look({ text: v })} />
                <ColorField label="Shade behind text on pictures" value={cfg.look.overlay} onValue={(v) => look({ overlay: v })} />
                <ColorField label="Button" value={cfg.look.buttonBg} onValue={(v) => look({ buttonBg: v })} />
                <ColorField label="Button text" value={cfg.look.buttonText} onValue={(v) => look({ buttonText: v })} />
                <NumberField label="Title size" suffix="px" min={11} max={40} step={1} value={cfg.look.titleSize} onValue={(v) => look({ titleSize: v })} />
                <NumberField label="Text size" suffix="px" min={10} max={24} step={1} value={cfg.look.textSize} onValue={(v) => look({ textSize: v })} />
              </s-grid>
            </s-section>
          </s-stack>

          <div className={ui.preview}>
            <div className={ui.previewBar}>
              <span>Live preview</span>
              <Segmented label="Preview size" value={device} options={[{ value: "desktop", label: "Desktop" }, { value: "phone", label: "Phone" }]} onChange={setDevice} />
            </div>
            <style>{data.css}</style>
            <div className={ui.frame}>
              <div className={device === "phone" ? ui.phone : undefined}>
                <ImageCarouselPreview config={cfg} phone={device === "phone"} />
              </div>
            </div>
          </div>
        </div>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
