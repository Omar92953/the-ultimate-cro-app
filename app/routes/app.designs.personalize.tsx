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
import { getPersonalizeDesign, savePersonalizeDesign } from "../lib/designs.server";
import { firstProduct } from "../lib/preview-products.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook } from "../components/ThemeStyle";
import { applyPersonalizePreset, PERSONALIZE_PRESETS, PERSONALIZE_SIZES, withPersonalizeDefaults, type PersonalizeDesign, type PersonalizeField } from "../lib/personalize-design";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextArea, TextField } from "../components/fields";
import { PersonalizePreview } from "../components/PersonalizePreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker, templateInUse } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";
import { SizesSection } from "../components/SizesSection";
import { SortableList, arrayMove } from "../components/Sortable";
import { slottedRoute } from "../lib/design-slot.server";
import { DesignSlots, useDesignAction } from "../components/DesignSlots";
import { SaveControls, changed } from "../components/SaveControls";

export const loader = slottedRoute(["personalize"], async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, style, sample] = await Promise.all([
    getPersonalizeDesign(admin),
    getThemeStatus(admin, session.shop).catch(() => null),
    getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE),
    firstProduct(admin, session.shop).catch(() => null),
  ]);
  return { config, saved, style, image: (sample as { image?: string | null } | null)?.image ?? null, domain: session.shop, css: storefrontCss("ucs-sections.css"), inTheme: theme ? theme.installed.personalize : false, addLink: sectionLinks(session.shop).personalize };
});

export const action = slottedRoute(["personalize"], async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await savePersonalizeDesign(admin, withPersonalizeDefaults(JSON.parse(String(form.get("config")))), form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
});

type C = PersonalizeDesign;
const TYPES: { value: PersonalizeField["type"]; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Longer text" },
  { value: "select", label: "Choice from a list" },
  { value: "color", label: "Colour swatches" },
];

export default function PersonalizeDesigner() {
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
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
    else if (fetcher.data.draft) shopify.toast.show("Your changes are in the theme editor preview (only you see them). Save here to put them live.");
    else shopify.toast.show("Saved and live");
  }, [fetcher.state, fetcher.data, shopify]);

  const part =
    <K extends "preview" | "fee" | "where" | "look">(k: K) =>
    (patch: Partial<C[K]>) =>
      setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));
  const preview = part("preview"), fee = part("fee"), where = part("where"), look = part("look");
  const setField = (id: string, patch: Partial<PersonalizeField>) => setCfg((c) => ({ ...c, fields: c.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post", action: designAction });
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post", action: designAction });

  async function pickFee() {
    const sel = (await shopify.resourcePicker({ type: "variant", multiple: false, action: "select" } as never)) as { id: string; title: string; displayName?: string; price?: string; product?: { title?: string } }[] | undefined;
    if (!sel?.length) return;
    const v = sel[0];
    fee({ variantId: v.id.split("/").pop() ?? "", title: v.displayName ?? `${v.product?.title ?? ""} ${v.title}`.trim(), price: String(v.price ?? "") });
  }
  async function pickTargets(kind: "products" | "collections") {
    const sel = (await shopify.resourcePicker({ type: kind === "products" ? "product" : "collection", multiple: true, action: "select" } as never)) as { handle: string; title: string }[] | undefined;
    if (!sel) return;
    where({ [kind]: sel.map((x) => ({ handle: x.handle, title: x.title })) });
  }

  return (
    <s-page heading="Personalization" inlineSize="large">
      <CategoryCrumb feature="personalize" />
      <DemoButton feature="personalize" template={templateInUse(PERSONALIZE_PRESETS, cfg, applyPersonalizePreset)} />
      <SaveControls dirty={changed(cfg, data.config)} saving={fetcher.state !== "idle" && fetcher.formData?.get("intent") !== "draft"} saved={data.saved} onSave={save} onDiscard={() => setCfg(data.config)} />
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?template=product`} target="_blank" onClick={seeOnStore}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to product page"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="personalize" />
          <DesignSlots base="personalize" blockName="Personalization" />
          <s-text color="subdued">Fields shoppers fill in before adding to cart (a name to engrave, initials, a colour). What they type is saved on the order line, so you see it on the order.</s-text>
          {!data.saved ? (
            <s-banner tone="info" heading="Not saved yet">
              Personalization shows on your store after you save here and add the block.
            </s-banner>
          ) : null}
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs tabs={["looks", "content", "design"]} value={tab} onChange={setTab} />
          <div className={ui.layout}>
            <s-stack gap="base">
              <Pane show={tab === "looks"}>
                <LookPicker width={720} presets={PERSONALIZE_PRESETS} config={cfg} apply={applyPersonalizePreset} onPick={(key) => setCfg((c) => applyPersonalizePreset(c, key))} render={(c) => <PersonalizePreview config={c} image={data.image} />} />
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Fields">
                  <s-stack gap="base">
                    <TextField label="Heading" value={cfg.heading} onValue={(v) => setCfg((c) => ({ ...c, heading: v }))} />
                    <SortableList
                      items={cfg.fields}
                      keyOf={(f) => f.id}
                      labelOf={(f) => f.label}
                      onMove={(a, b) => setCfg((c) => ({ ...c, fields: arrayMove(c.fields, a, b) }))}
                      render={(f, _i, handle) => (
                        <s-box padding="small-300" borderWidth="base" borderRadius="base">
                          <s-stack direction="inline" gap="small-300" alignItems="start">
                            {handle}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <s-stack gap="small-300">
                                <s-grid gridTemplateColumns="1fr 1fr" gap="small-300">
                                  <TextField label="Label (also the name on the order)" value={f.label} onValue={(v) => setField(f.id, { label: v })} />
                                  <Select label="Type" value={f.type} onValue={(v) => setField(f.id, { type: v as PersonalizeField["type"] })} options={TYPES} />
                                </s-grid>
                                {f.type === "select" || f.type === "color" ? (
                                  <TextArea label={f.type === "color" ? "Colours (one per line, e.g. #d4af37)" : "Choices (one per line)"} rows={3} value={f.options} onValue={(v) => setField(f.id, { options: v })} />
                                ) : (
                                  <NumberField label="Most characters" min={1} max={500} step={1} value={f.max} onValue={(v) => setField(f.id, { max: v })} />
                                )}
                                <s-stack direction="inline" gap="base">
                                  <Checkbox label="Required" checked={f.required} onValue={(v) => setField(f.id, { required: v })} />
                                  {f.type !== "color" ? <Checkbox label="Show in the preview" checked={f.preview} onValue={(v) => setField(f.id, { preview: v })} /> : null}
                                </s-stack>
                                <Button variant="tertiary" tone="critical" icon="delete" onClick={() => setCfg((c) => ({ ...c, fields: c.fields.filter((x) => x.id !== f.id) }))}>
                                  Remove field
                                </Button>
                              </s-stack>
                            </div>
                          </s-stack>
                        </s-box>
                      )}
                    />
                    {cfg.fields.length < 6 ? (
                      <Button icon="plus" onClick={() => setCfg((c) => ({ ...c, fields: [...c.fields, { id: `f${Date.now().toString(36)}`, label: "Initials", type: "text", max: 3, required: false, options: "", preview: false }] }))}>
                        Add field
                      </Button>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Fee">
                  <s-stack gap="base">
                    <Switch label="Charge for personalization" details="Adds a product of your choice (e.g. “Engraving”, a hidden product with a price) to the cart with the item; removed with it." checked={cfg.fee.on} onValue={(v) => fee({ on: v })} />
                    {cfg.fee.on ? (
                      <>
                        <s-stack direction="inline" gap="small-200" alignItems="center">
                          <Button onClick={pickFee}>{cfg.fee.variantId ? "Change fee product" : "Choose fee product"}</Button>
                          {cfg.fee.variantId ? <s-text>{cfg.fee.title}{cfg.fee.price ? ` · ${cfg.fee.price}` : ""}</s-text> : <s-text tone="critical">No product chosen yet</s-text>}
                        </s-stack>
                        <TextField label="Note under the fields" value={cfg.fee.note} onValue={(v) => fee({ note: v })} />
                      </>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Which products">
                  <s-stack gap="base">
                    <Select label="Show on" value={cfg.where.mode} onValue={(v) => where({ mode: v as C["where"]["mode"] })} options={[{ value: "all", label: "Every product page with the block" }, { value: "products", label: "Chosen products" }, { value: "collections", label: "Products in chosen collections" }]} />
                    {cfg.where.mode !== "all" ? (
                      <s-stack direction="inline" gap="small-200" alignItems="center">
                        <Button onClick={() => pickTargets(cfg.where.mode as "products" | "collections")}>Choose {cfg.where.mode}</Button>
                        <s-text color="subdued">{(cfg.where.mode === "products" ? cfg.where.products : cfg.where.collections).map((x) => x.title).join(", ") || "None yet"}</s-text>
                      </s-stack>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>

              <Pane show={tab === "design"}>
                <s-section heading="Preview on the picture">
                  <s-stack gap="base">
                    <Switch label="Show a live preview" checked={cfg.preview.on} onValue={(v) => preview({ on: v })} />
                    {cfg.preview.on ? (
                      <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                        <Select label="Font" value={cfg.preview.font} onValue={(v) => preview({ font: v as C["preview"]["font"] })} options={[{ value: "serif", label: "Serif" }, { value: "sans", label: "Sans" }, { value: "script", label: "Script" }, { value: "mono", label: "Typewriter" }]} />
                        <ColorField label="Text colour" value={cfg.preview.color} onValue={(v) => preview({ color: v })} />
                        <NumberField label="Text size" suffix="px" min={10} max={80} step={1} value={cfg.preview.size} onValue={(v) => preview({ size: v })} />
                        <TextField label="Label on the picture" value={cfg.preview.label} onValue={(v) => preview({ label: v })} />
                        <NumberField label="Across" suffix="%" min={0} max={100} step={1} value={cfg.preview.x} onValue={(v) => preview({ x: v })} />
                        <NumberField label="Down" suffix="%" min={0} max={100} step={1} value={cfg.preview.y} onValue={(v) => preview({ y: v })} />
                      </s-grid>
                    ) : null}
                    {cfg.preview.on ? <Checkbox label="Capital letters" checked={cfg.preview.upper} onValue={(v) => preview({ upper: v })} /> : null}
                  </s-stack>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <s-section heading="Look">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Style" value={cfg.look.style} onValue={(v) => look({ style: v as C["look"]["style"] })} options={[{ value: "box", label: "In a soft box" }, { value: "plain", label: "Plain" }]} />
                    {cfg.look.style === "box" ? <ColorField label="Box" value={cfg.look.bg} onValue={(v) => look({ bg: v })} /> : <span />}
                    <NumberField label="Corners" suffix="px" min={0} max={30} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                  </s-grid>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <SizesSection specs={PERSONALIZE_SIZES} value={cfg.sizes} onChange={(sizes) => setCfg((c) => ({ ...c, sizes }))} />
              </Pane>
            </s-stack>

            <PreviewFrame width={720} title="Product page · try typing">
              <ThemeLook style={data.style}>
                <PersonalizePreview config={cfg} image={data.image} />
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
