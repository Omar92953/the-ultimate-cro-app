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
import { getQuiz, saveQuiz } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook } from "../components/ThemeStyle";
import { applyQuizPreset, QUIZ_PRESETS, QUIZ_SIZES, withQuizDefaults, type QuizDesign, type QuizQuestion } from "../lib/quiz-design";
import { Button, Checkbox, ColorField, NumberField, Select, TextField } from "../components/fields";
import { QuizPreview } from "../components/QuizPreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { SizesSection } from "../components/SizesSection";
import { SortableList, arrayMove } from "../components/Sortable";
import { slottedRoute } from "../lib/design-slot.server";
import { DesignSlots, useDesignAction } from "../components/DesignSlots";
import { SaveControls, changed } from "../components/SaveControls";

export const loader = slottedRoute(["quiz"], async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme, style] = await Promise.all([getQuiz(admin), getThemeStatus(admin, session.shop).catch(() => null), getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE)]);
  return { config, saved, style, domain: session.shop, css: storefrontCss("ucs-sections.css"), inTheme: theme ? theme.installed.quiz : false, addLink: sectionLinks(session.shop).quiz };
});

export const action = slottedRoute(["quiz"], async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveQuiz(admin, withQuizDefaults(JSON.parse(String(form.get("config")))), form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
});

type C = QuizDesign;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export default function QuizDesigner() {
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
    else shopify.toast.show("Saved");
  }, [fetcher.state, fetcher.data, shopify]);

  const part =
    <K extends "text" | "results" | "look" | "space">(k: K) =>
    (patch: Partial<C[K]>) =>
      setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));
  const text = part("text"), results = part("results"), look = part("look"), space = part("space");
  const setQ = (id: string, patch: Partial<QuizQuestion>) => setCfg((c) => ({ ...c, questions: c.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post", action: designAction });
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post", action: designAction });

  return (
    <s-page heading="Product quiz" inlineSize="large">
      <CategoryCrumb feature="quiz" />
      <SaveControls dirty={changed(cfg, data.config)} saving={fetcher.state !== "idle" && fetcher.formData?.get("intent") !== "draft"} saved={data.saved} onSave={save} onDiscard={() => setCfg(data.config)} />
      <Button slot="secondary-actions" href={`https://${data.domain}/admin/themes/current/editor?previewPath=%2F`} target="_blank" onClick={seeOnStore}>
        See it on my store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to theme"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="quiz" />
          <DesignSlots base="quiz" blockName="Product quiz" />
          <s-text color="subdued">Each answer points to product tags (Products → a product → Tags). After the last question, the products whose tags match the answers best are shown, with add to cart. The answers are saved on the cart, so you see them on the order.</s-text>
          {!data.saved ? (
            <s-banner tone="info" heading="Not saved yet">
              The quiz shows on your store after you save here and add the “Product quiz” section.
            </s-banner>
          ) : null}
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs tabs={["looks", "content", "design"]} value={tab} onChange={setTab} />
          <div className={ui.layout}>
            <s-stack gap="base">
              <Pane show={tab === "looks"}>
                <LookPicker width={720} presets={QUIZ_PRESETS} config={cfg} apply={applyQuizPreset} onPick={(key) => setCfg((c) => applyQuizPreset(c, key))} render={(c) => <QuizPreview config={c} startAt={0} />} />
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Questions">
                  <s-stack gap="base">
                    <SortableList
                      items={cfg.questions}
                      keyOf={(q) => q.id}
                      labelOf={(q) => q.text}
                      onMove={(a, b) => setCfg((c) => ({ ...c, questions: arrayMove(c.questions, a, b) }))}
                      render={(q, i, handle) => (
                        <s-box padding="small-300" borderWidth="base" borderRadius="base">
                          <s-stack direction="inline" gap="small-300" alignItems="start">
                            {handle}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <s-stack gap="small-300">
                                <TextField label={`Question ${i + 1}`} value={q.text} onValue={(v) => setQ(q.id, { text: v })} />
                                {q.answers.map((a) => (
                                  <s-grid key={a.id} gridTemplateColumns="1fr 1fr auto" gap="small-200" alignItems="end">
                                    <TextField label="Answer" value={a.label} onValue={(v) => setQ(q.id, { answers: q.answers.map((x) => (x.id === a.id ? { ...x, label: v } : x)) })} />
                                    <TextField label="Product tags" details="Comma-separated" value={a.tags} onValue={(v) => setQ(q.id, { answers: q.answers.map((x) => (x.id === a.id ? { ...x, tags: v } : x)) })} />
                                    <Button variant="tertiary" tone="critical" icon="delete" accessibilityLabel="Remove answer" onClick={() => setQ(q.id, { answers: q.answers.filter((x) => x.id !== a.id) })}>
                                      Remove
                                    </Button>
                                  </s-grid>
                                ))}
                                <s-stack direction="inline" gap="small-200">
                                  {q.answers.length < 8 ? (
                                    <Button icon="plus" onClick={() => setQ(q.id, { answers: [...q.answers, { id: uid(), label: "Answer", tags: "" }] })}>
                                      Add answer
                                    </Button>
                                  ) : null}
                                  <Button variant="tertiary" tone="critical" onClick={() => setCfg((c) => ({ ...c, questions: c.questions.filter((x) => x.id !== q.id) }))}>
                                    Remove question
                                  </Button>
                                </s-stack>
                              </s-stack>
                            </div>
                          </s-stack>
                        </s-box>
                      )}
                    />
                    {cfg.questions.length < 8 ? (
                      <Button icon="plus" onClick={() => setCfg((c) => ({ ...c, questions: [...c.questions, { id: uid(), text: "New question", answers: [{ id: uid(), label: "Yes", tags: "" }, { id: uid(), label: "No", tags: "" }] }] }))}>
                        Add question
                      </Button>
                    ) : null}
                  </s-stack>
                </s-section>
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Results">
                  <s-stack gap="base">
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <TextField label="From the collection" details="Its handle, e.g. all, summer" value={cfg.results.collection} onValue={(v) => results({ collection: v })} />
                      <NumberField label="Products shown" min={1} max={12} step={1} value={cfg.results.count} onValue={(v) => results({ count: v })} />
                    </s-grid>
                    <Checkbox label="Save the answers on the cart (shown on the order)" checked={cfg.results.saveToCart} onValue={(v) => results({ saveToCart: v })} />
                  </s-stack>
                </s-section>
              </Pane>
              <Pane show={tab === "content"}>
                <s-section heading="Words">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <TextField label="Heading" value={cfg.text.heading} onValue={(v) => text({ heading: v })} />
                    <TextField label="Start button" value={cfg.text.start} onValue={(v) => text({ start: v })} />
                    <TextField label="Intro" value={cfg.text.intro} onValue={(v) => text({ intro: v })} />
                    <TextField label="Progress" details="{n} of {total}" value={cfg.text.progress} onValue={(v) => text({ progress: v })} />
                    <TextField label="Results heading" value={cfg.text.resultsHeading} onValue={(v) => text({ resultsHeading: v })} />
                    <TextField label="No exact match" value={cfg.text.none} onValue={(v) => text({ none: v })} />
                    <TextField label="Add to cart" value={cfg.text.add} onValue={(v) => text({ add: v })} />
                    <TextField label="Again" value={cfg.text.again} onValue={(v) => text({ again: v })} />
                    <TextField label="Back" value={cfg.text.back} onValue={(v) => text({ back: v })} />
                  </s-grid>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <s-section heading="Look">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Answers" value={cfg.look.style} onValue={(v) => look({ style: v as C["look"]["style"] })} options={[{ value: "cards", label: "Cards" }, { value: "list", label: "List" }]} />
                    <Select label="Alignment" value={cfg.look.align} onValue={(v) => look({ align: v as C["look"]["align"] })} options={[{ value: "center", label: "Centred" }, { value: "left", label: "Left" }]} />
                    <ColorField label="Answer cards" value={cfg.look.card} onValue={(v) => look({ card: v })} />
                    <ColorField label="Buttons" value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                    <ColorField label="Button text" value={cfg.look.onAccent} onValue={(v) => look({ onAccent: v })} />
                    <NumberField label="Corners" suffix="px" min={0} max={40} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                    <NumberField label="Space above" suffix="px" min={0} max={120} step={2} value={cfg.space.top} onValue={(v) => space({ top: v })} />
                    <NumberField label="Space below" suffix="px" min={0} max={120} step={2} value={cfg.space.bottom} onValue={(v) => space({ bottom: v })} />
                  </s-grid>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <SizesSection specs={QUIZ_SIZES} value={cfg.sizes} onChange={(sizes) => setCfg((c) => ({ ...c, sizes }))} />
              </Pane>
            </s-stack>
            <PreviewFrame width={720} title="Your store · click through the quiz">
              <ThemeLook style={data.style}>
                <QuizPreview config={cfg} />
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
