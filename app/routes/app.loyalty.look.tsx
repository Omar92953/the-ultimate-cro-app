/**
 * Loyalty → Look: templates, colours and button for the storefront widget, every word it shows, and the Rewards
 * page (made by the app, shown by the Order & wishlist pages block). Live preview of the widget for a member and
 * a guest, and of the Rewards page. Saving also saves the storefront copy (lib/loyalty/storefront.server.ts).
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { createOrderPage, orderPageContext } from "../lib/order-page-setup.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { getProgram, saveProgramConfig } from "../lib/loyalty/program.server";
import { publishLoyalty } from "../lib/loyalty/storefront.server";
import { LOYALTY_PRESETS, MAX_FAQ, WIDGET_TEXTS, applyLoyaltyPreset, type LoyaltyConfig } from "../lib/loyalty/config";
import { Button, Checkbox, ColorField, NumberField, TextArea, TextField } from "../components/fields";
import { PageIntro, Segmented } from "../components/ui";
import { FeatureTabs } from "../components/FeatureNav";
import { SaveControls, changed } from "../components/SaveControls";
import { LookPicker } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { LoyaltyPreview, type LoyaltyView } from "../components/LoyaltyPreview";
import ui from "../components/PageEditor.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [p, theme] = await Promise.all([getProgram(session.shop), getThemeStatus(admin, session.shop).catch(() => null)]);
  const ctx = await orderPageContext(admin, session.shop, theme);
  return {
    config: p.config,
    saved: p.saved,
    css: storefrontCss("ucs-loyalty.css"),
    page: ctx.pages.loyalty ? { handle: ctx.pages.loyalty.handle } : null,
    pageInTheme: ctx.loyaltyInTemplate,
    addLink: ctx.links.track,
    editor: ctx.editor("loyalty"),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    if (form.get("intent") === "page") {
      await createOrderPage(admin, "loyalty");
      return { ok: true, error: null, intent: "page" };
    }
    await saveProgramConfig(session.shop, JSON.parse(String(form.get("config"))));
    await publishLoyalty(admin, session.shop);
    return { ok: true, error: null, intent: "save" };
  } catch (e) {
    return { ok: false, error: errorMessage(e), intent: "" };
  }
};

type C = LoyaltyConfig;
type TextKey = keyof typeof WIDGET_TEXTS;
const TEXT_GROUPS: { title: string; keys: [TextKey, string][] }[] = [
  { title: "Button and panel", keys: [["launcher", "Button"], ["title", "Panel title"], ["have", "Above the points"], ["pending", "Points on the way ({n})"], ["earn", "Ways to earn heading"], ["rewards", "Rewards heading"], ["history", "History heading"]] },
  { title: "Shoppers who aren't members", keys: [["guestTitle", "Title"], ["guestText", "Text"], ["join", "Create an account"], ["signIn", "Sign in"], ["joinNow", "Join (signed in)"]] },
  { title: "Rewards", keys: [["get", "Get a reward"], ["more", "Points still needed ({n})"], ["code", "Codes heading"], ["copy", "Copy"], ["copied", "After copying"], ["apply", "Use the code"], ["applied", "After using"], ["credit", "After store credit"], ["error", "Something went wrong"]] },
  { title: "Ways to earn", keys: [["orderWay", "Orders"], ["signupWay", "Account"], ["firstWay", "First order"], ["reviewWay", "Product review"]] },
  { title: "Referrals", keys: [["referTitle", "Heading"], ["referText", "Text ({friend}, {gift})"], ["referLink", "Link label"], ["shareText", "Shared message ({friend})"], ["refBanner", "Friend arrives ({friend})"], ["referWay", "Ways to earn"], ["offPercent", "Percent off ({x})"], ["offAmount", "Amount off ({x})"], ["freeShip", "Free shipping"], ["creditGift", "Store credit gift ({x})"], ["email", "Share by email"]] },
  { title: "On the store", keys: [["product", "Product page ({n})"], ["cart", "Cart ({n})"], ["earned", "Points went up ({n})"]] },
];

export default function LoyaltyLook() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [cfg, setCfg] = useState<C>(d.config);
  const [tab, setTab] = useState<DesignTab>("looks");
  const [view, setView] = useState<LoyaltyView>("member");
  const [loaded, setLoaded] = useState(d.config);
  if (loaded !== d.config) {
    setLoaded(d.config);
    setCfg(d.config);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
    else shopify.toast.show(fetcher.data.intent === "page" ? "Rewards page made" : "Saved");
  }, [fetcher.state, fetcher.data, shopify]);
  const widget = (patch: Partial<C["widget"]>) => setCfg((c) => ({ ...c, widget: { ...c.widget, ...patch } }));
  const text = (k: TextKey, v: string) => setCfg((c) => ({ ...c, widget: { ...c.widget, texts: { ...c.widget.texts, [k]: v } } }));
  const page = (patch: Partial<C["page"]>) => setCfg((c) => ({ ...c, page: { ...c.page, ...patch } }));
  const making = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "page";

  return (
    <s-page heading="Loyalty program" inlineSize="large">
      <SaveControls dirty={changed(cfg, d.config)} saving={fetcher.state !== "idle" && !making} saved={d.saved} onSave={() => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" })} onDiscard={() => setCfg(d.config)} />
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature="loyalty" />
          <PageIntro text="How the rewards widget and the Rewards page look on your store, and every word they show." />
          <style dangerouslySetInnerHTML={{ __html: d.css }} />
          <DesignTabs tabs={["looks", "content", "design"]} value={tab} onChange={setTab} />
          <div className={ui.layout}>
            <s-stack gap="base">
              <Pane show={tab === "looks"}>
                <LookPicker width={420} presets={LOYALTY_PRESETS} config={cfg} apply={applyLoyaltyPreset} onPick={(key) => setCfg((c) => applyLoyaltyPreset(c, key))} render={(c) => <LoyaltyPreview config={c} view="member" />} />
              </Pane>

              <Pane show={tab === "content"}>
                <s-section heading="Rewards page">
                  <s-stack gap="base">
                    {d.page ? (
                      <s-stack direction="inline" gap="small-200" alignItems="center">
                        <s-text color="subdued">{`Your page: /pages/${d.page.handle}. ${d.pageInTheme ? "It is on your store." : "Add the Order & wishlist pages block to your page template."}`}</s-text>
                        <Button variant="tertiary" href={d.pageInTheme ? d.editor : d.addLink} target="_top" icon="theme-edit">
                          {d.pageInTheme ? "Open in theme editor" : "Add the block"}
                        </Button>
                      </s-stack>
                    ) : (
                      <s-stack direction="inline" gap="small-200" alignItems="center">
                        <s-text color="subdued">A page that explains the program: how it works, ways to earn, rewards and questions.</s-text>
                        <Button loading={making} onClick={() => fetcher.submit({ intent: "page" }, { method: "post" })}>
                          Make the Rewards page
                        </Button>
                      </s-stack>
                    )}
                    <TextField label="Page title" maxLength={60} value={cfg.page.title} onValue={(v) => page({ title: v })} />
                    <TextArea label="Text under the title" rows={2} maxLength={200} value={cfg.page.sub} onValue={(v) => page({ sub: v })} />
                    <s-text type="strong">How it works</s-text>
                    {cfg.page.how.map((x, i) => (
                      <s-grid key={i} gridTemplateColumns="minmax(0, 1fr) minmax(0, 2fr)" gap="small-200">
                        <TextField label={`Step ${i + 1}`} maxLength={40} value={x.t} onValue={(v) => page({ how: cfg.page.how.map((y, j) => (j === i ? { ...y, t: v } : y)) })} />
                        <TextField label="Text" maxLength={160} value={x.x} onValue={(v) => page({ how: cfg.page.how.map((y, j) => (j === i ? { ...y, x: v } : y)) })} />
                      </s-grid>
                    ))}
                    <s-text type="strong">Questions</s-text>
                    {cfg.page.faq.map((x, i) => (
                      <s-box key={i} padding="small-200" borderWidth="base" borderRadius="base">
                        <s-stack gap="small-200">
                          <TextField label="Question" maxLength={160} value={x.q} onValue={(v) => page({ faq: cfg.page.faq.map((y, j) => (j === i ? { ...y, q: v } : y)) })} />
                          <TextArea label="Answer" rows={2} maxLength={600} value={x.a} onValue={(v) => page({ faq: cfg.page.faq.map((y, j) => (j === i ? { ...y, a: v } : y)) })} />
                          <s-stack direction="inline">
                            <Button variant="tertiary" tone="critical" onClick={() => page({ faq: cfg.page.faq.filter((_, j) => j !== i) })}>
                              Remove
                            </Button>
                          </s-stack>
                        </s-stack>
                      </s-box>
                    ))}
                    {cfg.page.faq.length < MAX_FAQ ? (
                      <s-stack direction="inline">
                        <Button icon="plus" onClick={() => page({ faq: [...cfg.page.faq, { q: "", a: "" }] })}>
                          Add a question
                        </Button>
                      </s-stack>
                    ) : null}
                  </s-stack>
                </s-section>
                {TEXT_GROUPS.map((g) => (
                  <s-section key={g.title} heading={g.title}>
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      {g.keys.map(([k, label]) => (
                        <TextField key={k} label={label} maxLength={200} value={cfg.widget.texts[k]} onValue={(v) => text(k, v)} />
                      ))}
                    </s-grid>
                  </s-section>
                ))}
              </Pane>

              <Pane show={tab === "design"}>
                <s-section heading="Widget">
                  <s-stack gap="base">
                    <s-stack gap="small-200">
                      <s-text>Button side</s-text>
                      <Segmented label="Button side" value={cfg.widget.position} onChange={(v) => widget({ position: v })} options={[{ value: "left", label: "Bottom left" }, { value: "right", label: "Bottom right" }]} />
                    </s-stack>
                    <s-stack gap="small-200">
                      <s-text>Button</s-text>
                      <Segmented label="Button" value={cfg.widget.launcher} onChange={(v) => widget({ launcher: v })} options={[{ value: "text", label: "Icon and text" }, { value: "icon", label: "Icon only" }]} />
                    </s-stack>
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <ColorField label="Main colour" value={cfg.widget.accent} onValue={(v) => widget({ accent: v })} />
                      <ColorField label="Text on the main colour" value={cfg.widget.onAccent} onValue={(v) => widget({ onAccent: v })} />
                      <NumberField label="Corners" suffix="px" min={0} max={28} step={1} value={cfg.widget.radius} onValue={(v) => widget({ radius: v })} />
                    </s-grid>
                    <Checkbox label="“Earn X points with this” on product pages" checked={cfg.widget.productPoints} onValue={(v) => widget({ productPoints: v })} />
                    <Checkbox label="“Earn X points with this order” in the cart" checked={cfg.widget.cartPoints} onValue={(v) => widget({ cartPoints: v })} />
                  </s-stack>
                </s-section>
              </Pane>
            </s-stack>

            <PreviewFrame title="Your store" width={view === "page" ? 1100 : 520} tools={<Segmented label="Preview" value={view} options={[{ value: "member", label: "Member" }, { value: "guest", label: "Not signed in" }, { value: "page", label: "Rewards page" }]} onChange={setView} />}>
              <LoyaltyPreview config={cfg} view={view} />
            </PreviewFrame>
          </div>
        </s-stack>
      </div>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
