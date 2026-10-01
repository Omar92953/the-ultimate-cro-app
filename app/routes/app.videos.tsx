/* eslint-disable @typescript-eslint/no-explicit-any -- App Bridge resource picker payloads are untyped */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { editorLinks, getSlides, listProductVideos, listVideoFiles, saveSlides } from "../lib/cro.server";
import { errorMessage } from "../lib/admin.server";
import type { Ref, Slide } from "../lib/types";
import { Button, Select, TextField } from "../components/fields";

type VideoOption = { id: string; title: string; image: string | null; duration: number | null };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const productId = url.searchParams.get("productVideos");
  if (productId) {
    return { mode: "product" as const, videos: await listProductVideos(admin, productId) };
  }
  const [slides, files] = await Promise.all([getSlides(admin), listVideoFiles(admin)]);
  return {
    mode: "page" as const,
    slides,
    files,
    shop: session.shop,
    addBlock: editorLinks(session.shop).videos,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const slides = JSON.parse(String(form.get("slides"))) as Slide[];
    if (slides.length > 50) throw new Error("A carousel can hold up to 50 videos.");
    await saveSlides(admin, slides);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
};

export default function Videos() {
  const data = useLoaderData<typeof loader>();
  if (data.mode !== "page") return null;
  return <VideoManager {...data} />;
}

function VideoManager(props: { slides: Slide[]; files: VideoOption[]; shop: string; addBlock: string }) {
  const [slides, setSlides] = useState<Slide[]>(props.slides);
  const [source, setSource] = useState<"files" | "product">("files");
  const [sourceProduct, setSourceProduct] = useState<Ref | null>(null);
  const save = useFetcher<typeof action>();
  const productVideos = useFetcher<{ mode: "product"; videos: VideoOption[] }>();
  const shopify = useAppBridge();
  const busy = save.state !== "idle";

  // Reset the list when the loader returns fresh data (after a save).
  const [loaded, setLoaded] = useState(props.slides);
  if (loaded !== props.slides) {
    setLoaded(props.slides);
    setSlides(props.slides);
  }
  useEffect(() => {
    if (save.state !== "idle" || !save.data) return;
    if (save.data.ok) shopify.toast.show("Carousel saved");
    else shopify.toast.show("Could not save — see the message at the top", { isError: true });
  }, [save.state, save.data, shopify]);

  const inCarousel = new Set(slides.map((s) => s.video?.id));
  const available: VideoOption[] =
    source === "files" ? props.files : productVideos.data?.mode === "product" ? productVideos.data.videos : [];

  const update = (i: number, patch: Partial<Slide>) => setSlides((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) =>
    setSlides((all) => {
      const next = [...all];
      const j = i + dir;
      if (j < 0 || j >= next.length) return all;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const add = (v: VideoOption) =>
    setSlides((all) => [
      ...all,
      { video: { id: v.id, title: v.title, image: v.image, kind: "video" }, product: source === "product" ? sourceProduct : null, caption: "" },
    ]);

  async function pickProduct(forSlide?: number) {
    const selected: any = await shopify.resourcePicker({ type: "product", multiple: false, action: "select" } as any);
    const p = selected?.[0];
    if (!p) return;
    const ref: Ref = { id: p.id, title: p.title, image: p.images?.[0]?.originalSrc ?? null };
    if (forSlide === undefined) {
      setSourceProduct(ref);
      productVideos.load(`/app/videos?productVideos=${encodeURIComponent(p.id)}`);
    } else {
      update(forSlide, { product: ref });
    }
  }

  return (
    <s-page heading="Video carousel">
      <Button slot="primary-action" variant="primary" loading={busy} onClick={() => save.submit({ slides: JSON.stringify(slides) }, { method: "post" })}>
        Save
      </Button>
      <Button slot="secondary-actions" href={props.addBlock} target="_top">
        Add block to theme
      </Button>

      {save.data?.error ? (
        <s-banner tone="critical" heading="The carousel was not saved">
          {save.data.error}
        </s-banner>
      ) : null}

      <s-section heading={`In the carousel (${slides.length})`}>
        {slides.length ? (
          <s-stack gap="base">
            {slides.map((s, i) => (
              <s-box key={`${s.video?.id}-${i}`} padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="inline" gap="base" alignItems="start">
                  <s-thumbnail src={s.video?.image ?? undefined} alt={s.video?.title ?? "Video"} size="large" />
                  <s-stack gap="small-200">
                    <s-text type="strong">
                      {i + 1}. {s.video?.title}
                    </s-text>
                    <TextField label="Caption (optional)" value={s.caption} onValue={(v) => update(i, { caption: v })} />
                    <s-text>Linked product: {s.product ? s.product.title : "none"}</s-text>
                    <s-stack direction="inline" gap="small-200">
                      <Button icon="product" onClick={() => pickProduct(i)}>
                        {s.product ? "Change product" : "Link a product"}
                      </Button>
                      {s.product ? (
                        <Button variant="tertiary" onClick={() => update(i, { product: null })}>
                          Unlink
                        </Button>
                      ) : null}
                      <Button icon="arrow-up" accessibilityLabel="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                        Up
                      </Button>
                      <Button icon="arrow-down" accessibilityLabel="Move down" disabled={i === slides.length - 1} onClick={() => move(i, 1)}>
                        Down
                      </Button>
                      <Button tone="critical" variant="tertiary" icon="delete" onClick={() => setSlides((all) => all.filter((_, j) => j !== i))}>
                        Remove
                      </Button>
                    </s-stack>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        ) : (
          <s-paragraph>No videos yet. Add some from the list below, then click Save.</s-paragraph>
        )}
      </s-section>

      <s-section heading="Add videos">
        <s-stack gap="base">
          <Select
            label="Show videos from"
            value={source}
            onValue={(v) => setSource(v as "files" | "product")}
            options={[
              { value: "files", label: "Content → Files" },
              { value: "product", label: "A product’s media" },
            ]}
          />
          {source === "product" ? (
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <Button icon="product" onClick={() => pickProduct()}>
                {sourceProduct ? "Choose another product" : "Choose a product"}
              </Button>
              {sourceProduct ? <s-text>Videos of {sourceProduct.title} (they will be linked to it)</s-text> : null}
            </s-stack>
          ) : (
            <s-text color="subdued">
              Upload new videos in{" "}
              <s-link href={`https://${props.shop}/admin/content/files?media_type=VIDEO`} target="_top">
                Content → Files
              </s-link>
              , then come back and refresh this page.
            </s-text>
          )}
          {productVideos.state === "loading" ? <s-spinner accessibilityLabel="Loading videos" /> : null}
          {available.length ? (
            <s-grid gridTemplateColumns="repeat(auto-fill, minmax(150px, 1fr))" gap="base">
              {available.map((v) => (
                <s-box key={v.id} padding="small-200" borderWidth="base" borderRadius="base">
                  <s-stack gap="small-200">
                    <s-thumbnail src={v.image ?? undefined} alt={v.title} size="large" />
                    <s-text>{v.title}</s-text>
                    <Button disabled={inCarousel.has(v.id)} onClick={() => add(v)} icon="plus">
                      {inCarousel.has(v.id) ? "Added" : "Add"}
                    </Button>
                  </s-stack>
                </s-box>
              ))}
            </s-grid>
          ) : source === "files" || sourceProduct ? (
            <s-text color="subdued">No videos found here.</s-text>
          ) : null}
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Tips">
        <s-unordered-list>
          <s-list-item>Vertical (9:16) videos under 30 seconds work best.</s-list-item>
          <s-list-item>Videos play muted and only while on screen, and never autoplay for shoppers who prefer reduced motion.</s-list-item>
          <s-list-item>Linking a product shows its name, price and an Add to cart button under the video.</s-list-item>
          <s-list-item>Choose which pages show the carousel in the theme editor block settings.</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
