import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage } from "../lib/admin.server";
import { listItems, sectionLinks } from "../lib/sections.server";
import { firstProduct } from "../lib/preview-products.server";
import { getReviewsDesign, saveReviewsDesign } from "../lib/designs.server";
import { ICON_SOURCES, PRODUCT_REVIEW_PRESETS, REVIEW_PRESETS, applyReviewPreset, withReviewsDefaults, type ReviewsDesign, type ReviewsPlace } from "../lib/reviews-design";
import { SOURCES } from "../lib/sections";
import type { MediaRef, ProductRef } from "../lib/sections";
import { Button, Checkbox, ColorField, NumberField, OptionalSetting, Select, Switch, TextField } from "../components/fields";
import { MediaPicker } from "../components/MediaPicker";
import { ReviewsPreview, type PreviewReview } from "../components/ReviewsPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker } from "../components/LookPicker";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook, ThemeMatch } from "../components/ThemeStyle";
import { matchReviews } from "../lib/theme-match";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { slottedRoute } from "../lib/design-slot.server";
import { DesignSlots, useDesignAction } from "../components/DesignSlots";
import { SaveControls, changed } from "../components/SaveControls";

const fmtDate = (d: string) => {
  const t = Date.parse(`${d}T12:00:00Z`);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
};

/** This page serves both designs: Customer reviews (/app/designs/reviews) and Product page reviews (/app/designs/product-reviews). */
const placeOf = (request: Request): ReviewsPlace => (new URL(request.url).pathname.endsWith("/product-reviews") ? "product" : "home");

export const loader = slottedRoute(["reviews", "reviews_product"], async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const place = placeOf(request);
  const [{ config, saved }, items, sample] = await Promise.all([getReviewsDesign(admin, place), listItems(admin, "reviews").catch(() => []), place === "product" ? firstProduct(admin, session.shop).catch(() => null) : Promise.resolve(null)]);
  const reviews: PreviewReview[] = items
    .filter((i) => i.values.active !== false)
    .map((i) => {
      const v = i.values;
      const media = v.media as MediaRef | null;
      const product = v.product as ProductRef | null;
      return {
        name: String(v.name ?? ""),
        text: String(v.text ?? ""),
        rating: Number(v.rating) || 0,
        source: String(v.source ?? ""),
        location: String(v.location ?? ""),
        date: v.date ? fmtDate(String(v.date)) : "",
        verified: v.verified !== false,
        featured: v.featured === true,
        media: media?.url ? { kind: media.kind === "video" ? "video" : "image", url: media.url } : null,
        photoFit: String(v.photo_fit ?? ""),
        product: product ? { title: product.title, image: product.image } : null,
      };
    });
  return { place, sample, style: await getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE), domain: session.shop, config, saved, reviews, css: storefrontCss("ucs-sections.css"), addLink: place === "product" ? sectionLinks(session.shop).product_reviews : sectionLinks(session.shop).reviews };
});

export const action = slottedRoute(["reviews", "reviews_product"], async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const place = placeOf(request);
    const config = await saveReviewsDesign(admin, withReviewsDefaults(JSON.parse(String(form.get("config"))), place), form.get("intent") === "draft", place);
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
});

type C = ReviewsDesign;

export default function ReviewsDesigner() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const [tab, setTab] = useState<DesignTab>("looks");
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
    if (fetcher.data.ok && fetcher.data.draft) shopify.toast.show("Your changes are in the theme editor preview (only you see them). Save here to put them live.");
    else if (fetcher.data.ok) shopify.toast.show("Saved and live");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const part = <K extends keyof C>(k: K) => (patch: Partial<C[K]>) => setCfg((c) => ({ ...c, [k]: { ...(c[k] as object), ...patch } }));
  const text = part("text"), summary = part("summary"), which = part("which"), layout = part("layout"), card = part("card"), fill = part("fill"), look = part("look"), space = part("space"), icon = part("icon"), product = part("product"), sizes = part("sizes");
  const [iconFor, setIconFor] = useState<(typeof ICON_SOURCES)[number]>("whatsapp");
  const [ownFor, setOwnFor] = useState<Record<string, boolean>>({});
  const isProduct = data.place === "product";
  const feature = isProduct ? "product_reviews" : "reviews";
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post", action: designAction });
  const write = part("write"), list = part("list");
  const previewPath = data.place === "product" && data.sample ? `/products/${data.sample.handle}` : "/";

  return (
    <s-page heading={isProduct ? "Product page reviews" : "Customer reviews"} inlineSize="large">
      <CategoryCrumb feature={feature} />
      <SaveControls dirty={changed(cfg, data.config)} saving={fetcher.state !== "idle" && fetcher.formData?.get("intent") !== "draft"} saved={data.saved} onSave={save} onDiscard={() => setCfg(data.config)} />
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?previewPath=${encodeURIComponent(previewPath)}`} target="_blank" onClick={() => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post", action: designAction })}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        Add to a page
      </Button>
      <div className={ui.shell}>
      <s-stack gap="base">
        <FeatureTabs feature={feature} />
        <DesignSlots base={isProduct ? "reviews_product" : "reviews"} blockName={isProduct ? "Product page reviews" : "Customer reviews"} />
        <s-text color="subdued">
          {isProduct
            ? "A small reviews widget for the product page, next to the price and Add to cart: this product’s reviews in a card, or its star rating. In the theme editor, add the “Product page reviews” block inside the product information."
            : "Add, edit and order the reviews in the Reviews tab. Here you choose how the section looks. Place the “Customer reviews” section on any page (home, product, collection…), usually further down."}
        </s-text>
        {!data.saved ? (
          <s-banner tone="info" heading="Not saved yet">
            Your store uses the standard look until you save here.
          </s-banner>
        ) : null}
        {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}
        <style dangerouslySetInnerHTML={{ __html: data.css }} />
        <DesignTabs tabs={["looks", "content", "design"]} value={tab} onChange={setTab} />
        <div className={ui.layout}>
          <s-stack gap="base">
        <Pane show={tab === "looks"}>
          <ThemeMatch style={data.style} config={cfg} setConfig={setCfg} match={matchReviews} />
        </Pane>

        <Pane show={tab === "looks"}><LookPicker width={isProduct ? 480 : undefined} presets={isProduct ? PRODUCT_REVIEW_PRESETS : REVIEW_PRESETS} config={cfg} apply={applyReviewPreset} onPick={(key) => setCfg((c) => applyReviewPreset(c, key))} render={(c) => <ThemeLook style={data.style}><ReviewsPreview config={c} reviews={data.reviews} /></ThemeLook>} /></Pane>
            <Pane show={tab === "content"}><s-section heading="Heading and words">
              <s-stack gap="base">
                <TextField label="Heading" value={cfg.text.heading} onValue={(v) => text({ heading: v })} />
                <TextField label="Text under the heading" value={cfg.text.sub} onValue={(v) => text({ sub: v })} />
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <NumberField label="Heading size" suffix="px" min={16} max={60} step={1} value={cfg.text.headingSize} onValue={(v) => text({ headingSize: v })} />
                  <TextField label="Verified label" value={cfg.text.verified} onValue={(v) => text({ verified: v })} />
                  <TextField label="“Review for:” label" details="Before the product name (snippet and caption styles)." value={cfg.text.reviewFor} onValue={(v) => text({ reviewFor: v })} />
                  <TextField label="“Read more” button" value={cfg.text.readMore} onValue={(v) => text({ readMore: v })} />
                  <TextField label="“Show less” button" value={cfg.text.readLess} onValue={(v) => text({ readLess: v })} />
                </s-grid>
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "content"}><s-section heading="Rating summary">
              <s-stack gap="base">
                <Switch label="Show the rating summary" checked={cfg.summary.show} onValue={(v) => summary({ show: v })} />
                {cfg.summary.show ? (
                  <>
                    <Checkbox label="Average number (4.8)" checked={cfg.summary.average} onValue={(v) => summary({ average: v })} />
                    <Checkbox label="Stars" checked={cfg.summary.stars} onValue={(v) => summary({ stars: v })} />
                    <Checkbox label="Number of reviews" checked={cfg.summary.count} onValue={(v) => summary({ count: v })} />
                    {cfg.summary.count ? <TextField label="Number of reviews text" details="{count} shows the number." value={cfg.text.basedOn} onValue={(v) => text({ basedOn: v })} /> : null}
                  </>
                ) : null}
              </s-stack>
            </s-section></Pane>

            {isProduct ? null : <Pane show={tab === "content"}><s-section heading="Write a review">
              <s-stack gap="base">
                <Switch label="Let shoppers write a review" details="On product pages. New reviews wait in Reviews until you approve them." checked={cfg.write.on} onValue={(v) => write({ on: v })} />
                {cfg.write.on ? (
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <TextField label="Button" value={cfg.write.button} onValue={(v) => write({ button: v })} />
                    <TextField label="Form title" value={cfg.write.title} onValue={(v) => write({ title: v })} />
                    <TextField label="Name label" value={cfg.write.name} onValue={(v) => write({ name: v })} />
                    <TextField label="Review label" value={cfg.write.review} onValue={(v) => write({ review: v })} />
                    <TextField label="Send button" value={cfg.write.send} onValue={(v) => write({ send: v })} />
                    <TextField label="Thank-you message" value={cfg.write.thanks} onValue={(v) => write({ thanks: v })} />
                  </s-grid>
                ) : null}
              </s-stack>
            </s-section></Pane>}

            {!isProduct && cfg.layout.mode === "list" ? (
              <Pane show={tab === "content"}><s-section heading="List: sorting and more">
                <s-stack gap="base">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <NumberField label="Reviews at first" details="Then “Show more”." min={1} max={30} step={1} value={cfg.list.perPage} onValue={(v) => list({ perPage: v })} />
                    <TextField label="“Show more” button" value={cfg.list.more} onValue={(v) => list({ more: v })} />
                  </s-grid>
                  <Checkbox label="Star bars (how many 5★, 4★…)" checked={cfg.list.bars} onValue={(v) => list({ bars: v })} />
                  <Checkbox label="Sorting" checked={cfg.list.sort} onValue={(v) => list({ sort: v })} />
                  {cfg.list.sort ? (
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <TextField label="“Sort by”" value={cfg.list.sortBy} onValue={(v) => list({ sortBy: v })} />
                      <TextField label="Newest" value={cfg.list.newest} onValue={(v) => list({ newest: v })} />
                      <TextField label="Highest rating" value={cfg.list.highest} onValue={(v) => list({ highest: v })} />
                      <TextField label="Lowest rating" value={cfg.list.lowest} onValue={(v) => list({ lowest: v })} />
                      <TextField label="With photos" value={cfg.list.photos} onValue={(v) => list({ photos: v })} />
                    </s-grid>
                  ) : null}
                </s-stack>
              </s-section></Pane>
            ) : null}

            <Pane show={tab === "content"}><s-section heading="Which reviews">
              <s-stack gap="base">
                <Select
                  label="Show"
                  value={cfg.which.filter}
                  onValue={(v) => which({ filter: v as C["which"]["filter"] })}
                  options={[
                    { value: "all", label: "All reviews" },
                    { value: "featured", label: "Featured reviews only" },
                    { value: "product", label: "All, and a product's own reviews on its page" },
                  ]}
                />
                {cfg.which.filter === "product" ? (
                  <Checkbox label="On products without reviews, show all reviews" details="Off: the section is hidden on those products." checked={cfg.which.fallback} onValue={(v) => which({ fallback: v })} />
                ) : null}
                <NumberField label="Most reviews shown" min={1} max={60} step={1} value={cfg.which.limit} onValue={(v) => which({ limit: v })} />
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "design"}><s-section heading="Layout and scrolling">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <Select label="Layout" value={cfg.layout.mode} onValue={(v) => layout({ mode: v as C["layout"]["mode"] })} options={isProduct ? [{ value: "carousel", label: "Cards, one at a time" }, { value: "badge", label: "Star rating line" }] : [{ value: "carousel", label: "Carousel" }, { value: "grid", label: "Grid" }, { value: "masonry", label: "Masonry (different heights)" }, { value: "list", label: "List (full reviews, with sorting)" }]} />
                <NumberField label="Per row on desktop" min={1} max={6} step={1} value={cfg.layout.perDesktop} onValue={(v) => layout({ perDesktop: v })} />
                <Select label="Per row on phones" value={String(cfg.layout.perMobile)} onValue={(v) => layout({ perMobile: Number(v) === 2 ? 2 : 1 })} options={[{ value: "1", label: "1 (with a peek of the next)" }, { value: "2", label: "2" }]} />
                <OptionalSetting label="Fixed card width" details="Off: cards fill the row." initiallyOn={cfg.layout.cardWidth > 0} onOn={() => layout({ cardWidth: 300 })} onOff={() => layout({ cardWidth: 0 })}>
<NumberField label="Card width" suffix="px" min={160} max={600} step={10} value={cfg.layout.cardWidth} onValue={(v) => layout({ cardWidth: Math.max(160, v) })} />
</OptionalSetting>
                {cfg.layout.mode === "carousel" ? (
                  <>
                    <Select
                      label="Move it with"
                      value={cfg.layout.nav}
                      onValue={(v) => layout({ nav: v as C["layout"]["nav"] })}
                      options={[
                        { value: "arrows", label: "Arrows below" },
                        { value: "sides", label: "Arrows on the sides" },
                        { value: "dots", label: "Dots" },
                        { value: "both", label: "Arrows and dots" },
                        { value: "swipe", label: "Swipe or scroll only" },
                      ]}
                    />
                    {cfg.layout.nav === "arrows" || cfg.layout.nav === "sides" || cfg.layout.nav === "both" ? <NumberField label="Arrow size" suffix="px" min={24} max={64} step={2} value={cfg.layout.arrowSize} onValue={(v) => layout({ arrowSize: v })} /> : <span />}
                    <OptionalSetting label="Move by itself" initiallyOn={cfg.layout.autoplay > 0} onOn={() => layout({ autoplay: 5 })} onOff={() => layout({ autoplay: 0 })}>
<NumberField label="Move every" suffix="sec" min={1} max={15} step={1} value={cfg.layout.autoplay} onValue={(v) => layout({ autoplay: Math.max(1, v) })} />
</OptionalSetting>
                  </>
                ) : null}
              </s-grid>
            </s-section></Pane>

            <Pane show={tab === "design"}><s-section heading="Cards">
              <s-stack gap="base">
                <Select label="Card style" value={cfg.card.style} onValue={(v) => card({ style: v as C["card"]["style"] })} options={[{ value: "classic", label: "Classic" }, { value: "chat", label: "Chat screenshot" }, { value: "minimal", label: "Minimal" }, { value: "snippet", label: "Snippet (photo beside the text)" }]} />
                <s-grid gridTemplateColumns="1fr 1fr" gap="small-200">
                  <Checkbox label="Review text" checked={cfg.card.text} onValue={(v) => card({ text: v })} />
                  <Checkbox label="Photo or video" checked={cfg.card.media} onValue={(v) => card({ media: v })} />
                  <Checkbox label="Stars" checked={cfg.card.stars} onValue={(v) => card({ stars: v })} />
                  <Checkbox label="Where it came from (icon)" checked={cfg.card.source} onValue={(v) => card({ source: v })} />
                  <Checkbox label="Verified label" checked={cfg.card.verified} onValue={(v) => card({ verified: v })} />
                  <Checkbox label="Location" checked={cfg.card.location} onValue={(v) => card({ location: v })} />
                  <Checkbox label="Date" checked={cfg.card.date} onValue={(v) => card({ date: v })} />
                  <Checkbox label="Product" checked={cfg.card.product} onValue={(v) => card({ product: v })} />
                </s-grid>
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <OptionalSetting label="Shorten long reviews" initiallyOn={cfg.card.clamp > 0} onOn={() => card({ clamp: 4 })} onOff={() => card({ clamp: 0 })}>
<NumberField label="Lines shown" details="Then “Read more”." min={1} max={12} step={1} value={cfg.card.clamp} onValue={(v) => card({ clamp: Math.max(1, v) })} />
</OptionalSetting>
                  <NumberField label="Card corners" suffix="px" min={0} max={40} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                </s-grid>
                <Checkbox label="Videos play silently when on screen" checked={cfg.card.videoAutoplay} onValue={(v) => card({ videoAutoplay: v })} />
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <Select label="Text" value={cfg.card.align} onValue={(v) => card({ align: v as C["card"]["align"] })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centred" }]} />
                  <Select label="Order" value={cfg.card.textFirst ? "text" : "stars"} onValue={(v) => card({ textFirst: v === "text" })} options={[{ value: "stars", label: "Stars, then review" }, { value: "text", label: "Review, then stars" }]} />
                </s-grid>
              </s-stack>
            </s-section>
            <s-section heading="Photos">
              <s-stack gap="base">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <Select label="Photo fit" details="Each review can choose its own in its editor." value={cfg.card.photoFit} onValue={(v) => card({ photoFit: v as C["card"]["photoFit"] })} options={[{ value: "whole", label: "Show the whole photo" }, { value: "crop", label: "Crop to fill" }]} />
                  {cfg.card.photoFit === "crop" ? (
                    <Select label="Keep in view" value={cfg.card.photoFocus} onValue={(v) => card({ photoFocus: v as C["card"]["photoFocus"] })} options={[{ value: "center", label: "Middle" }, { value: "top", label: "Top" }, { value: "bottom", label: "Bottom" }]} />
                  ) : <span />}
                </s-grid>
                <Select label="Photo shape" value={cfg.card.photoShape} onValue={(v) => card({ photoShape: v as C["card"]["photoShape"] })} options={[{ value: "tallest", label: "Match the tallest photo" }, { value: "square", label: "Square" }, { value: "landscape", label: "Wide (4:3)" }, { value: "portrait", label: "Tall (4:5)" }]} />
                {cfg.card.photoFit === "whole" ? <s-text color="subdued">Whole photos sit on the fill chosen below in “Behind smaller pictures”.</s-text> : null}
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "design"}><s-section heading="Behind smaller pictures">
              <s-stack gap="base">
                <s-text color="subdued">Every picture is as tall as the tallest one; smaller ones sit on this fill.</s-text>
                <Select label="Fill" value={cfg.fill.kind} onValue={(v) => fill({ kind: v as C["fill"]["kind"] })} options={[{ value: "color", label: "A colour" }, { value: "pattern", label: "A pattern" }, { value: "image", label: "An image" }]} />
                <ColorField label={cfg.fill.kind === "pattern" ? "Pattern colour" : "Colour"} value={cfg.fill.color} onValue={(v) => fill({ color: v })} />
                {cfg.fill.kind === "pattern" ? <Select label="Pattern" value={cfg.fill.pattern} onValue={(v) => fill({ pattern: v as C["fill"]["pattern"] })} options={[{ value: "chat", label: "Chat wallpaper" }, { value: "dots", label: "Dots" }, { value: "grid", label: "Grid" }, { value: "lines", label: "Lines" }]} /> : null}
                {cfg.fill.kind === "image" ? <MediaPicker label="Fill image" accept="image" value={cfg.fill.image} onValue={(v) => fill({ image: v })} alt="Reviews background" /> : null}
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "design"}><s-section heading="Sizes">
              <s-stack gap="base">
                <Switch label="Choose my own sizes" details="Off: sizes that suit the layout and your theme." checked={cfg.sizes.own} onValue={(v) => sizes({ own: v })} />
                {cfg.sizes.own ? (
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <NumberField label="Text under heading" suffix="px" min={10} max={40} step={1} value={cfg.sizes.sub} onValue={(v) => sizes({ sub: v })} />
                    <NumberField label="Average (4.8)" suffix="px" min={12} max={64} step={1} value={cfg.sizes.avg} onValue={(v) => sizes({ avg: v })} />
                    <NumberField label="Stars by the average" suffix="px" min={10} max={48} step={1} value={cfg.sizes.summaryStars} onValue={(v) => sizes({ summaryStars: v })} />
                    <NumberField label="Number of reviews" suffix="px" min={10} max={32} step={1} value={cfg.sizes.count} onValue={(v) => sizes({ count: v })} />
                    <NumberField label="Review text" suffix="px" min={10} max={32} step={1} value={cfg.sizes.text} onValue={(v) => sizes({ text: v })} />
                    <NumberField label="Stars on cards" suffix="px" min={8} max={40} step={1} value={cfg.sizes.stars} onValue={(v) => sizes({ stars: v })} />
                    <NumberField label="Name" suffix="px" min={10} max={32} step={1} value={cfg.sizes.name} onValue={(v) => sizes({ name: v })} />
                    <NumberField label="Verified label" suffix="px" min={8} max={24} step={1} value={cfg.sizes.verified} onValue={(v) => sizes({ verified: v })} />
                    <NumberField label="Location and date" suffix="px" min={8} max={24} step={1} value={cfg.sizes.meta} onValue={(v) => sizes({ meta: v })} />
                  </s-grid>
                ) : null}
                <s-text color="subdued">The heading, product, icon and arrow sizes are in their own parts of this tab.</s-text>
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "design"}><s-section heading="Colours">
              <s-stack gap="base">
                <ColorField label="Stars" value={cfg.look.star} onValue={(v) => look({ star: v })} />
                <Checkbox label="Cards use your theme's colours" checked={cfg.look.defaultCard} onValue={(v) => look({ defaultCard: v })} />
                {!cfg.look.defaultCard ? (
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <ColorField label="Card background" value={cfg.look.cardBg} onValue={(v) => look({ cardBg: v })} />
                    <ColorField label="Card text" value={cfg.look.cardText} onValue={(v) => look({ cardText: v })} />
                  </s-grid>
                ) : null}
                <Checkbox label="Section background from your theme" checked={cfg.look.transparentBg} onValue={(v) => look({ transparentBg: v })} />
                {!cfg.look.transparentBg ? <ColorField label="Section background" value={cfg.look.bg} onValue={(v) => look({ bg: v })} /> : null}
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "design"}><s-section heading="Source icon (WhatsApp, Instagram…)">
              <s-stack gap="base">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <NumberField label="Size" suffix="px" min={18} max={48} step={1} value={cfg.icon.size} onValue={(v) => icon({ size: v })} />
                  <Select
                    label="Position"
                    value={cfg.icon.position}
                    onValue={(v) => icon({ position: v as C["icon"]["position"] })}
                    options={[
                      { value: "auto", label: "Automatic" },
                      { value: "tr", label: "Top right" },
                      { value: "tl", label: "Top left" },
                      { value: "br", label: "Bottom right" },
                      { value: "bl", label: "Bottom left" },
                    ]}
                  />
                  <Select
                    label="Colours"
                    value={cfg.icon.style}
                    onValue={(v) => icon({ style: v as C["icon"]["style"] })}
                    options={[
                      { value: "brand", label: "Brand colours" },
                      { value: "mono", label: "One colour" },
                      { value: "plain", label: "Icon only" },
                    ]}
                  />
                  <Select
                    label="Shape"
                    value={cfg.icon.shape}
                    onValue={(v) => icon({ shape: v as C["icon"]["shape"] })}
                    options={[
                      { value: "circle", label: "Circle" },
                      { value: "rounded", label: "Rounded square" },
                      { value: "square", label: "Square" },
                    ]}
                  />
                  {cfg.icon.style === "mono" ? <ColorField label="Background" value={cfg.icon.bg} onValue={(v) => icon({ bg: v })} /> : null}
                  {cfg.icon.style !== "brand" ? <ColorField label="Icon colour" value={cfg.icon.fg} onValue={(v) => icon({ fg: v })} /> : null}
                </s-grid>
                <s-text color="subdued">“Automatic”: in the top-right corner on cards with a picture, next to the stars on the others.</s-text>
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <Select label="Icon for" value={iconFor} onValue={(v) => setIconFor(v as (typeof ICON_SOURCES)[number])} options={ICON_SOURCES.map((k) => ({ value: k, label: `${SOURCES.find((x) => x.value === k)?.label ?? k}${cfg.icon.custom[k] ? " · own picture" : ""}` }))} />
                  <Select
                    label="Use"
                    value={cfg.icon.custom[iconFor] || ownFor[iconFor] ? "own" : "built"}
                    onValue={(v) => {
                      setOwnFor((o) => ({ ...o, [iconFor]: v === "own" }));
                      // Back to the built-in icon: forget the uploaded picture for this source.
                      if (v === "built")
                        setCfg((c) => {
                          const custom = { ...c.icon.custom };
                          delete custom[iconFor];
                          return { ...c, icon: { ...c.icon, custom } };
                        });
                    }}
                    options={[{ value: "built", label: "The built-in icon" }, { value: "own", label: "My own picture" }]}
                  />
                </s-grid>
                {cfg.icon.custom[iconFor] || ownFor[iconFor] ? (
                  <MediaPicker
                    label={`Your ${SOURCES.find((x) => x.value === iconFor)?.label ?? iconFor} picture`}
                    details="A square PNG or SVG. Until you add one, the built-in icon shows."
                    accept="image"
                    value={cfg.icon.custom[iconFor] ?? null}
                    onValue={(m) =>
                      setCfg((c) => {
                        const custom = { ...c.icon.custom };
                        if (m) custom[iconFor] = m;
                        else delete custom[iconFor];
                        return { ...c, icon: { ...c.icon, custom } };
                      })
                    }
                    alt={`${iconFor} icon`}
                  />
                ) : null}
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "design"}><s-section heading="Product on the card">
              <s-stack gap="base">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <Select
                    label="Style"
                    value={cfg.product.style}
                    onValue={(v) => product({ style: v as C["product"]["style"] })}
                    options={[
                      { value: "row", label: "Row with a line above" },
                      { value: "chip", label: "Pill" },
                      { value: "text", label: "Name only (link)" },
                      { value: "caption", label: "Small caption" },
                    ]}
                  />
                  <NumberField label="Text size" suffix="px" min={11} max={18} step={1} value={cfg.product.textSize} onValue={(v) => product({ textSize: v })} />
                  {cfg.product.style !== "text" && cfg.product.style !== "caption" && cfg.product.image ? (
                    <>
                      <NumberField label="Picture size" suffix="px" min={24} max={80} step={2} value={cfg.product.imageSize} onValue={(v) => product({ imageSize: v })} />
                      {cfg.product.style === "row" ? <NumberField label="Picture corners" suffix="px" min={0} max={40} step={1} value={cfg.product.radius} onValue={(v) => product({ radius: v })} /> : null}
                    </>
                  ) : null}
                </s-grid>
                {cfg.product.style !== "text" ? <Checkbox label="Show the product picture" checked={cfg.product.image} onValue={(v) => product({ image: v })} /> : null}
                <Switch label="Own colours" details="Off: the card's text colour." checked={cfg.product.ownColors} onValue={(v) => product({ ownColors: v })} />
                {cfg.product.ownColors ? (
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <ColorField label="Text" value={cfg.product.fg} onValue={(v) => product({ fg: v })} />
                    {cfg.product.style === "chip" ? <ColorField label="Pill" value={cfg.product.bg} onValue={(v) => product({ bg: v })} /> : null}
                  </s-grid>
                ) : null}
              </s-stack>
            </s-section></Pane>

            <Pane show={tab === "design"}><s-section heading="Spacing and more">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <NumberField label="Space above" suffix="px" min={0} max={120} step={4} value={cfg.space.top} onValue={(v) => space({ top: v })} />
                <NumberField label="Space below" suffix="px" min={0} max={120} step={4} value={cfg.space.bottom} onValue={(v) => space({ bottom: v })} />
                <Select label="Devices" value={cfg.space.devices} onValue={(v) => space({ devices: v as C["space"]["devices"] })} options={[{ value: "all", label: "Desktop and mobile" }, { value: "desktop", label: "Desktop only" }, { value: "mobile", label: "Mobile only" }]} />
              </s-grid>
              <s-box paddingBlockStart="base">
                <Checkbox label="Tell Google about a product's reviews (star ratings in search results)" details="Only turn this on if the reviews were written by real customers. Google doesn't allow it for reviews you typed in yourself." checked={cfg.space.schema} onValue={(v) => space({ schema: v })} />
              </s-box>
            </s-section></Pane>
          </s-stack>

          <PreviewFrame width={isProduct ? 480 : undefined} title={isProduct ? "Product page · next to the price" : "Your store · your real reviews"}>
            <ThemeLook style={data.style}><ReviewsPreview config={cfg} reviews={data.reviews} /></ThemeLook>
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
