import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage } from "../lib/admin.server";
import { getThemeStatus } from "../lib/cro.server";
import { getTrackOffers } from "../lib/track-offers.server";
import { getTrackSell } from "../lib/track-sell.server";
import { DEFAULT_TRACK_SELL, withTrackSellDefaults, type TrackSell } from "../lib/track-sell";
import { orderPageContext } from "../lib/order-page-setup.server";
import { getOrderPage, saveOrderPage } from "../lib/designs.server";
import { getPlan } from "../lib/billing.server";
import { atLeast } from "../lib/plans";
import { getReturnRules } from "../lib/shopify-returns.server";
import { storeCreditBonus } from "../lib/return-rules";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE } from "../lib/theme-style";
import { ThemeLook } from "../components/ThemeStyle";
import { applyOrderPagePreset, ORDER_PAGE_PRESETS, ORDER_PAGE_SIZES, TEXTS, TRACK_SHOW_LABEL, withOrderPageDefaults, type OrderPageDesign, type OrderPageKind } from "../lib/order-pages";
import { Checkbox, Button, ColorField, NumberField, Select, Switch, TextArea, TextField } from "../components/fields";
import { OrderPagePreview, type PreviewSells, type SampleOrder } from "../components/OrderPagePreview";
import ui from "../components/PageEditor.module.css";
import { LookPicker, templateInUse } from "../components/LookPicker";
import { DesignTabs, Pane, PreviewFrame, type DesignTab } from "../components/DesignTabs";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";
import { SizesSection } from "../components/SizesSection";
import { Segmented } from "../components/ui";
import { slottedRoute } from "../lib/design-slot.server";
import { DesignSlots, useDesignAction } from "../components/DesignSlots";
import { SaveControls, changed } from "../components/SaveControls";

/** This page serves both: Track order (/app/pages/track) and Returns (/app/pages/returns). */
const kindOf = (request: Request): OrderPageKind => (new URL(request.url).pathname.endsWith("/returns") ? "returns" : "track");

export const loader = slottedRoute(["track_page", "returns_page"], async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const kind = kindOf(request);
  const [{ config, saved }, theme, style] = await Promise.all([getOrderPage(admin, kind), getThemeStatus(admin, session.shop).catch(() => null), getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE)]);
  const ctx = await orderPageContext(admin, session.shop, theme);
  const offers = (await getTrackOffers(admin).catch(() => ({ offers: [] }))).offers.filter((o) => o.active).map((o) => ({ id: o.id, slot: o.slot, kind: o.kind, headline: o.headline, text: o.text, button: o.button }));
  const sell = await getTrackSell(admin).catch(() => ({ sell: DEFAULT_TRACK_SELL, saved: false }));
  // The store credit bonus the Returns page gives (Pro), shown in the after delivery preview like on the store.
  const creditBonus = kind === "track" && atLeast((await getPlan(admin, session.shop)).plan, "pro") ? await getReturnRules(admin).then(({ rules }) => storeCreditBonus(rules.saving)).catch(() => 0) : 0;
  return { creditBonus, offers, sell: sell.sell, kind, config, saved, style, domain: session.shop, css: storefrontCss("ucs-sections.css"), inTheme: ctx.inPageTemplate && !!ctx.pages[kind], pageMade: !!ctx.pages[kind], seeLink: ctx.editor(kind), addLink: kind === "track" ? ctx.links.track : ctx.links.returns };
});

export const action = slottedRoute(["track_page", "returns_page"], async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const kind = kindOf(request);
  const form = await request.formData();
  try {
    const config = await saveOrderPage(admin, kind, withOrderPageDefaults(JSON.parse(String(form.get("config"))), kind), form.get("intent") === "draft");
    return { ok: true, draft: form.get("intent") === "draft", error: null, config };
  } catch (e) {
    return { ok: false, draft: false, error: errorMessage(e), config: null };
  }
});

type C = OrderPageDesign;

export default function OrderPageDesigner() {
  const data = useLoaderData<typeof loader>();
  const openTab = useSearchParams()[0].get("open");
  const isTrack = data.kind === "track";
  const feature = isTrack ? "track" : "returns";
  const title = isTrack ? "Track order page" : "Returns page";
  const [cfg, setCfg] = useState<C>(data.config);
  // Tracking & Returns links to "What the page sells" with ?open=show.
  const [tab, setTab] = useState<DesignTab>(() => (isTrack && openTab === "show" ? "show" : "looks"));
  const [view, setView] = useState<"form" | "transit" | "delivered" | "delayed" | "items">("form");
  const step = view === "form" ? "form" : "result";
  const sample: SampleOrder = view === "delivered" || view === "delayed" ? view : "transit";
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

  const look = (patch: Partial<C["look"]>) => setCfg((c) => ({ ...c, scheme: "", look: { ...c.look, ...patch } }));
  const space = (patch: Partial<C["space"]>) => setCfg((c) => ({ ...c, space: { ...c.space, ...patch } }));
  const text = (key: string, v: string) => setCfg((c) => ({ ...c, text: { ...c.text, [key]: v } }));
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post", action: designAction });
  const seeOnStore = () => fetcher.submit({ config: JSON.stringify(cfg), intent: "draft" }, { method: "post", action: designAction });
  const groups = [...new Set(TEXTS[data.kind].map((t) => t.group))];
  // What the page sells (next order discount…): its own Save, shared by every style (lib/track-sell.ts).
  const [sell, setSell] = useState<TrackSell>(data.sell);
  const sells: PreviewSells = { next: sell.nextOrder.on, buyAgain: sell.buyAgain.on, after: sell.afterDelivery.on, late: sell.delay.on, creditBonus: data.creditBonus, offers: { above: data.offers.find((o) => o.slot === "above") ?? null, below: data.offers.find((o) => o.slot === "below") ?? null } };
  const sellFetcher = useFetcher<{ ok: boolean; error: string | null }>();
  useEffect(() => {
    if (sellFetcher.state !== "idle" || !sellFetcher.data) return;
    if (sellFetcher.data.ok) shopify.toast.show("Saved");
    else shopify.toast.show(sellFetcher.data.error || "Not saved", { isError: true });
  }, [sellFetcher.state, sellFetcher.data, shopify]);
  const after = (patch: Partial<TrackSell["afterDelivery"]>) => setSell((x) => ({ ...x, afterDelivery: { ...x.afterDelivery, ...patch } }));
  const friend = (patch: Partial<TrackSell["afterDelivery"]["friend"]>) => setSell((x) => ({ ...x, afterDelivery: { ...x.afterDelivery, friend: { ...x.afterDelivery.friend, ...patch } } }));
  const delay = (patch: Partial<TrackSell["delay"]>) => setSell((x) => ({ ...x, delay: { ...x.delay, ...patch } }));
  const again = (patch: Partial<TrackSell["buyAgain"]>) => setSell((x) => ({ ...x, buyAgain: { ...x.buyAgain, ...patch } }));
  const next = (patch: Partial<TrackSell["nextOrder"]>) => setSell((x) => ({ ...x, nextOrder: { ...x.nextOrder, ...patch } }));
  const row = (k: "like" | "complete", patch: Partial<C["recs"]["like"]>) => setCfg((c) => ({ ...c, recs: { ...c.recs, [k]: { ...c.recs[k], ...patch } } }));
  async function pickProducts(k: "like" | "complete") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selected: any = await shopify.resourcePicker({ type: "product", multiple: true, action: "select" } as any);
    if (!selected) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    row(k, { picks: selected.slice(0, 12).map((s: any) => ({ handle: String(s.handle), title: String(s.title) })) });
  }

  return (
    <s-page heading={title} inlineSize="large">
      <CategoryCrumb feature={feature} />
      <DemoButton feature={feature} template={templateInUse(ORDER_PAGE_PRESETS, cfg, applyOrderPagePreset)} />
      <SaveControls dirty={changed(cfg, data.config)} saving={fetcher.state !== "idle" && fetcher.formData?.get("intent") !== "draft"} saved={data.saved} onSave={save} onDiscard={() => setCfg(data.config)} />
      <Button slot="secondary-actions" href={data.seeLink} target="_blank" onClick={seeOnStore}>
        Preview on store
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : data.pageMade ? "Add the block" : "Open the theme editor"}
      </Button>
      <div className={ui.shell}>
        <s-stack gap="base">
          <FeatureTabs feature={feature} />
          <DesignSlots base={isTrack ? "track_page" : "returns_page"} blockName="Order & wishlist pages" />
          <s-text color="subdued">
            {isTrack
              ? "Shoppers enter their order number and email and see the order's status, items and tracking. The app makes the “Track your order” page for you (Tracking & Returns, step “Make the two pages”); the one block in its theme template shows it."
              : "Shoppers find their order with its number and email, choose the items and a reason, and the request arrives in Returns here. The app makes the “Returns” page for you (Tracking & Returns, step “Make the two pages”); the one block in its theme template shows it."}
          </s-text>
          {!data.saved ? (
            <s-banner tone="info" heading="Not saved yet">
              The standard words and look are used until you save here.
            </s-banner>
          ) : null}
          <style dangerouslySetInnerHTML={{ __html: data.css }} />
          <DesignTabs tabs={isTrack ? ["looks", "show", "content", "design"] : ["looks", "content", "design"]} value={tab} onChange={setTab} />
          <div className={ui.layout}>
            <s-stack gap="base">
              <Pane show={tab === "looks"}>
                <LookPicker width={640} presets={ORDER_PAGE_PRESETS} config={cfg} apply={applyOrderPagePreset} onPick={(key) => setCfg((c) => applyOrderPagePreset(c, key))} render={(c) => <OrderPagePreview config={c} step="form" />} />
              </Pane>

              {groups.map((g) => (
                <Pane key={g} show={tab === "content"}>
                  <s-section heading={g}>
                    <s-stack gap="base">
                      {TEXTS[data.kind]
                        .filter((t) => t.group === g)
                        .map((t) => (t.long ? <TextArea key={t.key} label={t.label} rows={t.key === "reasons" ? 5 : 2} value={cfg.text[t.key] ?? ""} onValue={(v) => text(t.key, v)} /> : <TextField key={t.key} label={t.label} value={cfg.text[t.key] ?? ""} onValue={(v) => text(t.key, v)} />))}
                    </s-stack>
                  </s-section>
                </Pane>
              ))}

              {isTrack ? (
                <Pane show={tab === "show"}>
                  <s-section heading="What the page sells">
                    <s-stack gap="base">
                      <Switch label="Give a discount on the next order" details="Shoppers whose order is paid see a real Shopify discount code with an expiry, with a Copy button." checked={sell.nextOrder.on} onValue={(v) => next({ on: v })} />
                      {sell.nextOrder.on ? (
                        <>
                          <Select label="Code" value={sell.nextOrder.mode} onValue={(v) => next({ mode: v === "shared" ? "shared" : "perOrder" })} options={[{ value: "perOrder", label: "A new single use code for each order" }, { value: "shared", label: "One code for everybody (renewed when you save)" }]} />
                          {sell.nextOrder.mode === "shared" ? <TextField label="The code" value={sell.nextOrder.sharedCode} onValue={(v) => next({ sharedCode: v })} maxLength={20} details="Letters and digits. Saving makes it or moves its end date." /> : null}
                          <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base">
                            <NumberField label="Discount" suffix="%" min={1} max={90} step={1} value={sell.nextOrder.percent} onValue={(v) => next({ percent: v })} />
                            <NumberField label="Minimum order" details="0 = none" min={0} max={100000} step={1} value={sell.nextOrder.minimum} onValue={(v) => next({ minimum: v })} />
                            <NumberField label="Valid for" suffix="days" min={1} max={365} step={1} value={sell.nextOrder.days} onValue={(v) => next({ days: v })} />
                          </s-grid>
                        </>
                      ) : null}
                      <s-stack gap="base">
                        <Switch label="Buy again button" details="Puts the order's items that are in stock in a new cart and names the ones that are sold out." checked={sell.buyAgain.on} onValue={(v) => again({ on: v })} />
                        {sell.buyAgain.on ? (
                          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                            <Select label="For" value={sell.buyAgain.only} onValue={(v) => again({ only: v === "types" ? "types" : v === "tags" ? "tags" : "all" })} options={[{ value: "all", label: "Every product" }, { value: "types", label: "Only these product types" }, { value: "tags", label: "Only products with these tags" }]} />
                            {sell.buyAgain.only !== "all" ? <TextField label={sell.buyAgain.only === "types" ? "Product types" : "Product tags"} details="Separated by commas." value={sell.buyAgain.list} onValue={(v) => again({ list: v })} /> : <span />}
                          </s-grid>
                        ) : null}
                      </s-stack>
                      <s-stack gap="base">
                        <Switch label="After delivery: “How was your order?”" details="Once every shipment is delivered the page asks for a review, links to your Returns page and can give a code to share with a friend." checked={sell.afterDelivery.on} onValue={(v) => after({ on: v })} />
                        {sell.afterDelivery.on ? (
                          <s-stack gap="base">
                            <Select label="“Write a review” goes to" value={sell.afterDelivery.review} onValue={(v) => after({ review: v === "url" ? "url" : "product" })} options={[{ value: "product", label: "Each product's page" }, { value: "url", label: "A review page URL" }]} />
                            {sell.afterDelivery.review === "url" ? <TextField label="Review page address" placeholder="https://" value={sell.afterDelivery.reviewUrl} onValue={(v) => after({ reviewUrl: v })} details="Where your review app collects reviews. Must start with https://" /> : null}
                            <Checkbox label="Link to the Returns page" checked={sell.afterDelivery.returnsLink} onValue={(v) => after({ returnsLink: v })} />
                            <Switch label="Give a code to share with a friend" details="A real single use Shopify code with an expiry, made for the order." checked={sell.afterDelivery.friend.on} onValue={(v) => friend({ on: v })} />
                            {sell.afterDelivery.friend.on ? (
                              <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base">
                                <NumberField label="Discount" suffix="%" min={1} max={90} step={1} value={sell.afterDelivery.friend.percent} onValue={(v) => friend({ percent: v })} />
                                <NumberField label="Minimum order" details="0 = none" min={0} max={100000} step={1} value={sell.afterDelivery.friend.minimum} onValue={(v) => friend({ minimum: v })} />
                                <NumberField label="Valid for" suffix="days" min={1} max={365} step={1} value={sell.afterDelivery.friend.days} onValue={(v) => friend({ days: v })} />
                              </s-grid>
                            ) : null}
                          </s-stack>
                        ) : null}
                      </s-stack>
                      <s-stack gap="base">
                        <Switch label="Late orders: say sorry" details="When a shipment is more than a day past its expected date, or the carrier reports a problem, the page shows your apology (edit the words in Late orders) and can give a real code." checked={sell.delay.on} onValue={(v) => delay({ on: v })} />
                        {sell.delay.on ? (
                          <s-stack gap="base">
                            <Select label="Give" value={sell.delay.gift} onValue={(v) => delay({ gift: v === "percent" ? "percent" : v === "shipping" ? "shipping" : "none" })} options={[{ value: "none", label: "Just the apology" }, { value: "percent", label: "A discount on the next order" }, { value: "shipping", label: "Free shipping on the next order" }]} />
                            <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                              {sell.delay.gift === "percent" ? <NumberField label="Discount" suffix="%" min={1} max={90} step={1} value={sell.delay.percent} onValue={(v) => delay({ percent: v })} /> : <span />}
                              {sell.delay.gift !== "none" ? <NumberField label="Valid for" suffix="days" min={1} max={365} step={1} value={sell.delay.days} onValue={(v) => delay({ days: v })} /> : <span />}
                            </s-grid>
                          </s-stack>
                        ) : null}
                      </s-stack>
                      <s-stack direction="inline">
                        <Button loading={sellFetcher.state !== "idle"} disabled={JSON.stringify(withTrackSellDefaults(sell)) === JSON.stringify(data.sell)} onClick={() => sellFetcher.submit({ sell: JSON.stringify(sell) }, { method: "post", action: "/app/track-sell" })}>
                          Save
                        </Button>
                      </s-stack>
                    </s-stack>
                  </s-section>
                </Pane>
              ) : null}
              {isTrack ? (
                <Pane show={tab === "show"}>
                  <s-section heading="What shoppers see after the lookup">
                    <s-stack gap="base">
                      <s-text color="subdued">The order number, date and status always show. Choose the rest.</s-text>
                      {(Object.keys(TRACK_SHOW_LABEL) as (keyof C["show"])[]).map((k) => (
                        <Checkbox key={k} label={TRACK_SHOW_LABEL[k].label} details={TRACK_SHOW_LABEL[k].details} checked={cfg.show[k]} onValue={(v) => setCfg((c) => ({ ...c, show: { ...c.show, [k]: v } }))} />
                      ))}
                      <Checkbox label="What the order cost" details="Each item's price, then subtotal, shipping, discounts and total, in the currency the shopper paid in. Prices only: never the payment method or address." checked={cfg.prices} onValue={(v) => setCfg((c) => ({ ...c, prices: v }))} />
                    </s-stack>
                  </s-section>
                  <s-section heading="Recommendations under the order">
                    <s-stack gap="base">
                      <s-text color="subdued">Products shoppers can add to a new cart from this page. Products already in the order are never shown, and only products in stock.</s-text>
                      {(["like", "complete"] as const).map((k) => (
                        <s-box key={k} padding="small-200" borderWidth="base" borderRadius="base">
                          <s-stack gap="small-200">
                            <Switch label={k === "like" ? "“You may also like” row" : "“Complete your order” row"} checked={cfg.recs[k].on} onValue={(v) => row(k, { on: v })} />
                            {cfg.recs[k].on ? (
                              <>
                                <TextField label="Heading" value={cfg.recs[k].heading} onValue={(v) => row(k, { heading: v })} maxLength={60} />
                                <Select label="Products come from" value={cfg.recs[k].source} onValue={(v) => row(k, { source: v as C["recs"]["like"]["source"] })} options={[{ value: "collection", label: "The order's collections" }, { value: "together", label: "Bought together (learned from your orders)" }, { value: "picks", label: "Chosen products" }]} />
                                {cfg.recs[k].source === "picks" ? (
                                  <s-stack direction="inline" gap="small-200" alignItems="center">
                                    <Button onClick={() => pickProducts(k)}>Choose products</Button>
                                    <s-text color="subdued">{cfg.recs[k].picks.length ? cfg.recs[k].picks.map((p) => p.title).join(", ") : "None chosen"}</s-text>
                                  </s-stack>
                                ) : null}
                              </>
                            ) : null}
                          </s-stack>
                        </s-box>
                      ))}
                      {cfg.recs.like.on || cfg.recs.complete.on ? (
                        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
                          <NumberField label="Products per row" min={1} max={8} step={1} value={cfg.recs.count} onValue={(v) => setCfg((c) => ({ ...c, recs: { ...c.recs, count: v } }))} />
                          <TextField label="Button" value={cfg.recs.button} onValue={(v) => setCfg((c) => ({ ...c, recs: { ...c.recs, button: v } }))} />
                          <TextField label="After adding" value={cfg.recs.added} onValue={(v) => setCfg((c) => ({ ...c, recs: { ...c.recs, added: v } }))} />
                        </s-grid>
                      ) : null}
                    </s-stack>
                  </s-section>
                </Pane>
              ) : null}

              {isTrack ? (
                <Pane show={tab === "show"}>
                  <s-section heading="Track page offers (Pro)">
                    <s-stack gap="small-200">
                      <s-text color="subdued">An offer above and one below the tracking, made in Offers. The order is already paid, so they start a new cart or give a real code that expires.</s-text>
                      {(["above", "below"] as const).map((slot) => {
                        const o = data.offers.find((x) => x.slot === slot);
                        return (
                          <s-text key={slot}>
                            <b>{slot === "above" ? "Above the tracking:" : "Below the tracking:"}</b> {o ? <s-link href={`/app/offers/track/${o.id}`}>{o.headline}</s-link> : "Nothing yet"}
                          </s-text>
                        );
                      })}
                      <s-stack direction="inline">
                        <Button href="/app/offers/track/new">Add an offer to the Track page</Button>
                      </s-stack>
                    </s-stack>
                  </s-section>
                </Pane>
              ) : null}

              {!isTrack ? (
                <Pane show={tab === "content"}>
                  <s-section heading="Return window and approval">
                    <s-text color="subdued">
                      How long shoppers have, which products are excluded, which reasons are approved at once and what shoppers are told after approval are set in <s-link href="/app/returns/rules">Returns rules</s-link>.
                    </s-text>
                  </s-section>
                </Pane>
              ) : null}

              <Pane show={tab === "design"}>
                <s-section heading="Look">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <Select label="Alignment" value={cfg.look.align} onValue={(v) => look({ align: v as C["look"]["align"] })} options={[{ value: "center", label: "Centred" }, { value: "left", label: "Left" }]} />
                    <NumberField label="Width" suffix="px" min={360} max={1200} step={20} value={cfg.look.maxWidth} onValue={(v) => look({ maxWidth: v })} />
                    <ColorField label="Card" value={cfg.look.card} onValue={(v) => look({ card: v })} />
                    <NumberField label="Corners" suffix="px" min={0} max={40} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                    <ColorField label="Button" value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                    <ColorField label="Button text" value={cfg.look.onAccent} onValue={(v) => look({ onAccent: v })} />
                  </s-grid>
                </s-section>
              </Pane>
              <Pane show={tab === "design"}>
                <SizesSection specs={ORDER_PAGE_SIZES} value={cfg.sizes} onChange={(sizes) => setCfg((c) => ({ ...c, sizes }))} />
              </Pane>
              <Pane show={tab === "design"}>
                <s-section heading="Spacing">
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <NumberField label="Space above" suffix="px" min={0} max={120} step={2} value={cfg.space.top} onValue={(v) => space({ top: v })} />
                    <NumberField label="Space below" suffix="px" min={0} max={120} step={2} value={cfg.space.bottom} onValue={(v) => space({ bottom: v })} />
                  </s-grid>
                </s-section>
              </Pane>
            </s-stack>

            <PreviewFrame
              width={760}
              title={title}
              tools={<Segmented label="Show" value={view} options={isTrack ? [{ value: "form", label: "Form" }, { value: "transit", label: "In transit" }, { value: "delivered", label: "Delivered" }, { value: "delayed", label: "Delayed" }] : [{ value: "form", label: "Form" }, { value: "items", label: "Choosing items" }]} onChange={setView} />}
            >
              <ThemeLook style={data.style}>
                <OrderPagePreview config={cfg} step={step} sample={sample} sells={sells} />
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
