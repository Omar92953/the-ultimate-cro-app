/**
 * Size guide (Section library → Size guide): size charts and a size recommendation for the product page.
 * Charts (columns like chest and waist, a row per size, unit, a drawing or your own picture), who each
 * chart is for (all products, or chosen products, collections or tags), and the height and weight range of
 * each size for the recommendation. Stored in $app:cro_design "size_guide" (lib/size-guide.ts).
 */
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
import { getSizeGuide, saveSizeGuide } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook } from "../components/ThemeStyle";
import {
  applySizeGuidePreset, MAX_CHARTS, MAX_COLUMNS, MAX_ROWS, OUTLINE_LABEL, OUTLINES, SAMPLE_CHART, SIZE_GUIDE_PRESETS, SIZE_GUIDE_SIZES,
  withSizeGuideDefaults, type Chart, type SizeGuideDesign, type SizeRow,
} from "../lib/size-guide";
import { Button, Checkbox, ColorField, NumberField, Select, Switch, TextArea, TextField } from "../components/fields";
import { requireSizeGuide } from "../lib/rules";
import { MediaPicker } from "../components/MediaPicker";
import { SizeGuidePreview } from "../components/SizeGuidePreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker, templateInUse } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";
import { SizesSection } from "../components/SizesSection";
import { SaveControls, changed } from "../components/SaveControls";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, style] = await Promise.all([
    getSizeGuide(admin),
    getThemeStatus(admin, session.shop).catch(() => null),
    getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE),
  ]);
  return { config, saved, style, domain: session.shop, css: storefrontCss("ucs-sections.css") + storefrontCss("ucs-size-guide.css"), inTheme: theme ? theme.installed.size_guide : false, addLink: sectionLinks(session.shop).size_guide };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const draft = form.get("intent") === "draft";
    const raw = JSON.parse(String(form.get("config")));
    requireSizeGuide(raw);
    const config = await saveSizeGuide(admin, withSizeGuideDefaults(raw), draft);
    return { ok: true, draft, error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
};

type C = SizeGuideDesign;
const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const show = (n: number | null) => (n === null ? "" : String(n));

export default function SizeGuideDesigner() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const [tab, setTab] = useState<DesignTab>("looks");
  const [at, setAt] = useState(0);
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
    else shopify.toast.show("Saved and live");
  }, [fetcher.state, fetcher.data, shopify]);

  const index = Math.min(at, cfg.charts.length - 1);
  const chart: Chart | undefined = cfg.charts[index];
  const setChart = (patch: Partial<Chart>) => setCfg((c) => ({ ...c, charts: c.charts.map((x, i) => (i === index ? { ...x, ...patch } : x)) }));
  const setRow = (r: number, patch: Partial<SizeRow>) => chart && setChart({ rows: chart.rows.map((x, i) => (i === r ? { ...x, ...patch } : x)) });
  const text = (patch: Partial<C["text"]>) => setCfg((c) => ({ ...c, text: { ...c.text, ...patch } }));
  const look = (patch: Partial<C["look"]>) => setCfg((c) => ({ ...c, look: { ...c.look, ...patch } }));
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post" });

  const addChart = () => {
    const id = `c${Date.now().toString(36)}`;
    setCfg((c) => ({ ...c, charts: [...c.charts, { ...SAMPLE_CHART, id, name: `Chart ${c.charts.length + 1}`, match: { all: false, products: [], collections: [], tags: "" } }] }));
    setAt(cfg.charts.length);
  };
  const removeChart = () => {
    setCfg((c) => ({ ...c, charts: c.charts.filter((_, i) => i !== index) }));
    setAt(0);
  };
  const addColumn = () => chart && chart.columns.length < MAX_COLUMNS && setChart({ columns: [...chart.columns, `Column ${chart.columns.length + 1}`], rows: chart.rows.map((r) => ({ ...r, values: [...r.values, ""] })) });
  const removeColumn = (i: number) => chart && setChart({ columns: chart.columns.filter((_, j) => j !== i), rows: chart.rows.map((r) => ({ ...r, values: r.values.filter((_, j) => j !== i) })) });
  const addRow = () => chart && chart.rows.length < MAX_ROWS && setChart({ rows: [...chart.rows, { size: "", values: chart.columns.map(() => ""), height: [null, null], weight: [null, null] }] });
  const removeRow = (i: number) => chart && setChart({ rows: chart.rows.filter((_, j) => j !== i) });

  async function pick(type: "product" | "collection") {
    if (!chart) return;
    const key = type === "product" ? "products" : "collections";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selected: any = await shopify.resourcePicker({ type, multiple: true, action: "select" } as any);
    if (!selected) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chosen = selected.map((s: any) => ({ handle: String(s.handle), title: String(s.title) }));
    const have = chart.match[key];
    setChart({ match: { ...chart.match, all: false, [key]: [...have, ...chosen.filter((n: { handle: string }) => !have.some((h) => h.handle === n.handle))].slice(0, 60) } });
  }

  return (
    <s-page heading="Size guide" inlineSize="large">
      <CategoryCrumb feature="size_guide" />
      <DemoButton feature="size_guide" template={templateInUse(SIZE_GUIDE_PRESETS, cfg, applySizeGuidePreset)} />
      <SaveControls dirty={changed(cfg, data.config)} saving={fetcher.state !== "idle" && fetcher.formData?.get("intent") !== "draft"} saved={data.saved} onSave={() => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" })} onDiscard={() => setCfg(data.config)} />
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?template=product`} target="_blank" onClick={seeOnStore}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to product page"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="size_guide" />
          <s-text color="subdued">
            Shoppers open a size chart and a size finder from the product page. The finder answers only from the height and weight ranges you set for each size. Add the Size guide block to the product page in the theme editor.
          </s-text>
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs tabs={["looks", "content", "design"]} value={tab} onChange={setTab} />
          <div className={ui.layout}>
            <s-stack gap="base">
              <Pane show={tab === "looks"}>
                <LookPicker width={560} presets={SIZE_GUIDE_PRESETS} config={cfg} apply={applySizeGuidePreset} onPick={(key) => setCfg((c) => applySizeGuidePreset(c, key))} render={(c) => <SizeGuidePreview config={c} chartId={chart?.id} />} />
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Size charts">
                  <s-stack gap="base">
                    <Switch label="Size guide is on" details="Off hides the links on every product. Your charts are kept." checked={cfg.on} onValue={(v) => setCfg((c) => ({ ...c, on: v }))} />
                    <s-stack direction="inline" gap="small-200">
                      {cfg.charts.map((c, i) => (
                        <Button key={c.id} variant={i === index ? "primary" : "secondary"} onClick={() => setAt(i)}>
                          {c.name || `Chart ${i + 1}`}
                        </Button>
                      ))}
                      {cfg.charts.length < MAX_CHARTS ? (
                        <Button variant="tertiary" onClick={addChart}>
                          Add a chart
                        </Button>
                      ) : null}
                    </s-stack>
                    <s-text color="subdued">A product uses the first chart (from the left) that is meant for it.</s-text>
                  </s-stack>
                </s-section>
                {chart ? (
                  <>
                    <s-section heading={`Chart: ${chart.name}`}>
                      <s-stack gap="base">
                        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                          <TextField label="Chart name" value={chart.name} onValue={(v) => setChart({ name: v })} maxLength={60} />
                          <Select label="Values are typed in" value={chart.unit} onValue={(v) => setChart({ unit: v === "in" ? "in" : "cm" })} options={[{ value: "cm", label: "Centimetres" }, { value: "in", label: "Inches" }]} />
                          <Select label="Drawing" value={chart.outline} onValue={(v) => setChart({ outline: v as Chart["outline"] })} options={OUTLINES.map((o) => ({ value: o, label: OUTLINE_LABEL[o] }))} />
                          <Checkbox label="Let shoppers switch between cm and in" checked={chart.unitSwitch} onValue={(v) => setChart({ unitSwitch: v })} />
                        </s-grid>
                        <MediaPicker label="Your own picture (instead of the drawing)" accept="image" alt="Size chart picture" value={chart.image} onValue={(v) => setChart({ image: v })} />
                        <TextArea label="Note under the chart" rows={2} maxLength={300} value={chart.note} onValue={(v) => setChart({ note: v })} details="For example how to measure." />
                        {cfg.charts.length > 1 ? (
                          <s-stack direction="inline">
                            <Button tone="critical" variant="tertiary" onClick={removeChart}>
                              Delete this chart
                            </Button>
                          </s-stack>
                        ) : null}
                      </s-stack>
                    </s-section>
                    <s-section heading="Sizes and measurements">
                      <s-stack gap="base">
                        <s-text color="subdued">One column per measurement (Chest, Waist, Inseam). Type ranges like “86 to 91”. Height and weight are only for the size finder: use centimetres and kilograms, and leave them empty to skip.</s-text>
                        <s-stack gap="small-200">
                          <s-text type="strong">Columns</s-text>
                          <s-stack direction="inline" gap="small-200">
                            {chart.columns.map((col, i) => (
                              <s-stack key={i} direction="inline" gap="small-100" alignItems="end">
                                <TextField label={`Column ${i + 1}`} value={col} maxLength={30} onValue={(v) => setChart({ columns: chart.columns.map((x, j) => (j === i ? v : x)) })} />
                                <Button variant="tertiary" accessibilityLabel={`Remove ${col}`} onClick={() => removeColumn(i)}>
                                  Remove
                                </Button>
                              </s-stack>
                            ))}
                            {chart.columns.length < MAX_COLUMNS ? (
                              <Button variant="tertiary" onClick={addColumn}>
                                Add a column
                              </Button>
                            ) : null}
                          </s-stack>
                        </s-stack>
                        {chart.rows.map((r, i) => (
                          <s-box key={i} padding="small-200" borderWidth="base" borderRadius="base">
                            <s-stack gap="small-200">
                              <s-grid gridTemplateColumns={`repeat(${Math.max(1, chart.columns.length) + 1}, minmax(90px, 1fr))`} gap="small-200">
                                <TextField label="Size" value={r.size} maxLength={20} onValue={(v) => setRow(i, { size: v })} />
                                {chart.columns.map((col, j) => (
                                  <TextField key={j} label={col || `Column ${j + 1}`} value={r.values[j] ?? ""} maxLength={30} onValue={(v) => setRow(i, { values: r.values.map((x, k) => (k === j ? v : x)) })} />
                                ))}
                              </s-grid>
                              {chart.rec.on ? (
                                <s-grid gridTemplateColumns="repeat(4, minmax(80px, 1fr))" gap="small-200">
                                  <TextField label="Height from (cm)" value={show(r.height[0])} onValue={(v) => setRow(i, { height: [num(v), r.height[1]] })} />
                                  <TextField label="Height to (cm)" value={show(r.height[1])} onValue={(v) => setRow(i, { height: [r.height[0], num(v)] })} />
                                  <TextField label="Weight from (kg)" value={show(r.weight[0])} onValue={(v) => setRow(i, { weight: [num(v), r.weight[1]] })} />
                                  <TextField label="Weight to (kg)" value={show(r.weight[1])} onValue={(v) => setRow(i, { weight: [r.weight[0], num(v)] })} />
                                </s-grid>
                              ) : null}
                              <s-stack direction="inline">
                                <Button variant="tertiary" tone="critical" onClick={() => removeRow(i)}>
                                  Remove size {r.size}
                                </Button>
                              </s-stack>
                            </s-stack>
                          </s-box>
                        ))}
                        {chart.rows.length < MAX_ROWS ? (
                          <s-stack direction="inline">
                            <Button onClick={addRow}>Add a size</Button>
                          </s-stack>
                        ) : null}
                      </s-stack>
                    </s-section>
                    <s-section heading="Size recommendation">
                      <s-stack gap="base">
                        <Switch label="Show “Size recommendation”" details="Shoppers type their height and weight; the answer is the size whose ranges fit, from the numbers above only." checked={chart.rec.on} onValue={(v) => setChart({ rec: { ...chart.rec, on: v } })} />
                        {chart.rec.on ? (
                          <>
                            <Checkbox label="Ask how they like it to fit (Snug is one size down, Relaxed one size up)" checked={chart.rec.fit} onValue={(v) => setChart({ rec: { ...chart.rec, fit: v } })} />
                            <TextField label="Fit note (optional)" details="Shown with the answer, for example “Runs large, size down”. You decide what it says." maxLength={200} value={chart.fitNote} onValue={(v) => setChart({ fitNote: v })} />
                          </>
                        ) : null}
                      </s-stack>
                    </s-section>
                    <s-section heading="Which products">
                      <s-stack gap="base">
                        <Checkbox label="All products with a size option" details="Products that have a Size option (or the same word in another language). A Gift Card or a candle gets no size guide. Choose products, collections or tags below to show it on others." checked={chart.match.all} onValue={(v) => setChart({ match: { ...chart.match, all: v } })} />
                        {!chart.match.all ? (
                          <s-stack gap="base">
                            <s-stack direction="inline" gap="small-200" alignItems="center">
                              <Button onClick={() => pick("product")}>Choose products</Button>
                              <s-text color="subdued">{chart.match.products.length ? chart.match.products.map((p) => p.title).join(", ") : "None chosen"}</s-text>
                            </s-stack>
                            <s-stack direction="inline" gap="small-200" alignItems="center">
                              <Button onClick={() => pick("collection")}>Choose collections</Button>
                              <s-text color="subdued">{chart.match.collections.length ? chart.match.collections.map((p) => p.title).join(", ") : "None chosen"}</s-text>
                            </s-stack>
                            {chart.match.products.length || chart.match.collections.length ? (
                              <s-stack direction="inline">
                                <Button variant="tertiary" onClick={() => setChart({ match: { ...chart.match, products: [], collections: [] } })}>
                                  Clear products and collections
                                </Button>
                              </s-stack>
                            ) : null}
                            <TextField label="Product tags" details="Separated by commas. Products with one of these tags use this chart." value={chart.match.tags} onValue={(v) => setChart({ match: { ...chart.match, tags: v } })} placeholder="tshirts, mens" />
                          </s-stack>
                        ) : null}
                      </s-stack>
                    </s-section>
                  </>
                ) : (
                  <s-section heading="No chart yet">
                    <Button onClick={addChart}>Add a chart</Button>
                  </s-section>
                )}
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Words">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <TextField label="Chart link" value={cfg.text.chartLink} onValue={(v) => text({ chartLink: v })} />
                    <TextField label="Recommendation link" value={cfg.text.recLink} onValue={(v) => text({ recLink: v })} />
                    <TextField label="Window title" value={cfg.text.title} onValue={(v) => text({ title: v })} />
                    <TextField label="Size column" value={cfg.text.sizeColumn} onValue={(v) => text({ sizeColumn: v })} />
                    <TextField label="Chart tab" value={cfg.text.chartTab} onValue={(v) => text({ chartTab: v })} />
                    <TextField label="Finder tab" value={cfg.text.recTab} onValue={(v) => text({ recTab: v })} />
                    <TextField label="Height" value={cfg.text.height} onValue={(v) => text({ height: v })} />
                    <TextField label="Weight" value={cfg.text.weight} onValue={(v) => text({ weight: v })} />
                    <TextField label="Fit question" value={cfg.text.fit} onValue={(v) => text({ fit: v })} />
                    <TextField label="Find button" value={cfg.text.find} onValue={(v) => text({ find: v })} />
                    <TextField label="Snug" value={cfg.text.snug} onValue={(v) => text({ snug: v })} />
                    <TextField label="Regular" value={cfg.text.regular} onValue={(v) => text({ regular: v })} />
                    <TextField label="Relaxed" value={cfg.text.relaxed} onValue={(v) => text({ relaxed: v })} />
                    <TextField label="Answer" details="{size} = the size" value={cfg.text.result} onValue={(v) => text({ result: v })} />
                    <TextField label="No size found" value={cfg.text.noMatch} onValue={(v) => text({ noMatch: v })} />
                    <TextField label="Missing numbers" value={cfg.text.fillIn} onValue={(v) => text({ fillIn: v })} />
                  </s-grid>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <s-section heading="Look">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Links" value={cfg.look.link} onValue={(v) => look({ link: v === "button" ? "button" : "underline" })} options={[{ value: "underline", label: "Underlined links" }, { value: "button", label: "Outline buttons" }]} />
                    <Select label="Where they go" value={cfg.place} onValue={(v) => setCfg((c) => ({ ...c, place: v === "block" ? "block" : "picker" }))} options={[{ value: "picker", label: "Under the size picker" }, { value: "block", label: "Where the block is placed" }]} />
                    <ColorField label="Accent colour" value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                    <ColorField label="Window background" value={cfg.look.bg} onValue={(v) => look({ bg: v })} />
                    <NumberField label="Corners" suffix="px" min={0} max={999} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                  </s-grid>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <SizesSection specs={SIZE_GUIDE_SIZES} value={cfg.sizes} onChange={(sizes) => setCfg((c) => ({ ...c, sizes }))} />
              </Pane>
            </s-stack>
            <PreviewFrame width={560} title="Product page">
              <ThemeLook style={data.style}>
                <SizeGuidePreview config={cfg} chartId={chart?.id} />
              </ThemeLook>
            </PreviewFrame>
          </div>
        </s-stack>
      </div>
    </s-page>
  );
}

/** "See it on my store" only stores the draft: the page keeps its state. */
export const shouldRevalidate: ShouldRevalidateFunction = ({ formData, defaultShouldRevalidate }) => (formData?.get("intent") === "draft" ? false : defaultShouldRevalidate);

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
