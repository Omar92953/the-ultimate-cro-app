import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { deleteRule, listRules, resolveDiscountEngine, saveRule } from "../lib/cro.server";
import { getCrossSellDesign, getUpsellDesign } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { firstProduct, productForRule } from "../lib/preview-products.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { FALLBACK_STYLE, previewTheme } from "../lib/theme-style";
import { validateRule } from "../lib/validate";
import { errorMessage } from "../lib/admin.server";
import { KINDS } from "../lib/kinds";
import { checkLimit } from "../lib/billing.server";
import { LimitUpgrade } from "../components/Upgrade";
import type { Placement, Rule, RuleKind, Tier } from "../lib/types";
import { Button, Checkbox, NumberField, Select, Switch, TextField } from "../components/fields";
import { ResourceList } from "../components/ResourceList";
import { UpsellDesignPreview } from "../components/UpsellDesignPreview";
import { CrossSellDesignPreview } from "../components/CrossSellDesignPreview";
import { PreviewFrame } from "../components/DesignTabs";
import { ThemeLook } from "../components/ThemeStyle";
import { DeleteOffer } from "../components/DeleteOffer";
import { useFlash } from "../components/flash";
import type { PreviewItem } from "../components/BundlePreview";
import { EditorLayout } from "../components/EditorLayout";
import { SaveControls, changed } from "../components/SaveControls";
import { DemoButton } from "../components/DemoButton";

function blankRule(kind: RuleKind): Rule {
  return {
    kind,
    name: "",
    active: true,
    priority: 10,
    triggerType: "all",
    triggerProducts: [],
    triggerCollections: [],
    offeredProducts: [],
    tiers:
      kind === "upsell"
        ? [
            { qty: 1, pct: 0 },
            { qty: 2, pct: 10 },
            { qty: 3, pct: 15, badge: "Most popular" },
          ]
        : [],
    upsellType: "quantity",
    optionName: "",
    placements: ["product"],
    headline: kind === "upsell" ? "Buy more, save more" : "Pairs well with",
    subheadline: "",
    buttonLabel: kind === "cross_sell" ? "Add selected to cart" : "",
    discountPercent: 0,
    discountLabel: "",
  };
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const meta = KINDS[params.kind ?? ""];
  if (!meta) throw new Response("Not found", { status: 404 });
  const [{ engine }, style, upsellDesign, crossDesign] = await Promise.all([
    resolveDiscountEngine(admin),
    getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE),
    meta.kind === "upsell" ? getUpsellDesign(admin) : null,
    meta.kind === "cross_sell" ? getCrossSellDesign(admin) : null,
  ]);
  const isNew = params.handle === "new";
  const rule = isNew ? blankRule(meta.kind) : (await listRules(admin, meta.kind)).find((r) => r.handle === params.handle);
  if (!rule) throw new Response("Rule not found", { status: 404 });
  // The preview shows the real block: the store's look, its stylesheet and a real product.
  const product = (await productForRule(admin, rule, session.shop).catch(() => null)) ?? (await firstProduct(admin, session.shop).catch(() => null));
  return {
    kindSlug: params.kind!,
    meta,
    rule,
    isNew,
    engine,
    style,
    css: storefrontCss("ucro.css"),
    upsellDesign: upsellDesign?.config ?? null,
    crossDesign: crossDesign?.config ?? null,
    product,
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, redirect, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  try {
    if (intent === "delete") {
      const done = await deleteRule(admin, String(form.get("id")));
      return redirect(`/app/offers/${params.kind}?deleted=${done}`);
    }
    const rule = JSON.parse(String(form.get("rule"))) as Rule;
    // The plan's limit counts offers that are on (lib/plans.ts); an offer can always be saved off.
    const over = await checkLimit(admin, session.shop, "offerSlots", rule);
    if (over) return { ok: false, error: over.error, handle: null, upgrade: true };
    const saved = await saveRule(admin, rule);
    return { ok: true, error: null, handle: saved.handle, upgrade: false };
  } catch (e) {
    return { ok: false, error: errorMessage(e), handle: null, upgrade: false };
  }
};

export default function RuleEditor() {
  const { kindSlug, meta, rule: initial, isNew, engine, style, css, upsellDesign, crossDesign, product } = useLoaderData<typeof loader>();
  const [rule, setRule] = useState<Rule>(initial);
  const [touched, setTouched] = useState(false);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const busy = fetcher.state !== "idle";
  const isUpsell = rule.kind === "upsell";
  const [flashed, flash] = useFlash();

  // Reset the form when the loader returns fresh data (after a save or navigation).
  const [loaded, setLoaded] = useState(initial);
  // A reload after a save brings a new copy of the same data: keep the merchant's edits unless it
  // actually changed (otherwise a refused save of a new item would wipe the form).
  if (loaded !== initial) {
    setLoaded(initial);
    if (JSON.stringify(loaded) !== JSON.stringify(initial)) {
      setRule(initial);
    }
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      shopify.toast.show("Saved");
      if (isNew && fetcher.data.handle) navigate(`/app/offers/${kindSlug}/${fetcher.data.handle}`, { replace: true });
    } else if (fetcher.data.error) {
      shopify.toast.show("Could not save. See the message at the top", { isError: true });
    }
  }, [fetcher.state, fetcher.data, shopify, isNew, kindSlug, navigate]);

  const set = <K extends keyof Rule>(key: K, value: Rule[K]) => setRule((r) => ({ ...r, [key]: value }));
  const setTier = (i: number, patch: Partial<Tier>) => {
    set("tiers", rule.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));
    flash(`tier-${i}`);
  };

  // Real pictures and prices of the suggested products (fetched as they change).
  const previews = useFetcher<{ items: Record<string, PreviewItem[]>; currency: string }>();
  const idsKey = [...new Set(rule.offeredProducts.map((p) => p.id))].sort().join(",");
  useEffect(() => {
    if (idsKey) previews.load(`/app/bundles/preview-items?ids=${encodeURIComponent(idsKey)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the chosen products change
  }, [idsKey]);
  const setOffered = (v: Rule["offeredProducts"]) => {
    const old = rule.offeredProducts.map((p) => p.id);
    const added = v.findIndex((p) => !old.includes(p.id));
    set("offeredProducts", v);
    if (added >= 0) flash(`item-${added}`);
  };
  const togglePlacement = (p: Placement, on: boolean) =>
    set("placements", on ? [...new Set([...rule.placements, p])] : rule.placements.filter((x) => x !== p));

  // Shoppers never see the name, so don't make it a hurdle: fall back to the headline.
  const toSave: Rule = { ...rule, name: rule.name.trim() || rule.headline.trim() || meta.title.replace(/s$/, "") };
  const problems = validateRule(toSave);
  const save = () => {
    setTouched(true);
    if (problems.length) return;
    fetcher.submit({ intent: "save", rule: JSON.stringify(toSave) }, { method: "post" });
  };
  const remove = () => {
    if (!rule.id) return;
    fetcher.submit({ intent: "delete", id: rule.id }, { method: "post" });
  };
  const pageLook = previewTheme(style);
  const scheme = (isUpsell ? upsellDesign?.look.scheme : "") ?? "";
  const blockLook = scheme ? previewTheme(style, scheme) : null;
  const items = previews.data?.items ?? {};
  const crossItems = rule.offeredProducts.slice(0, 6).map((p) => ({ title: p.title, image: items[p.id]?.[0]?.image ?? p.image ?? null, cents: items[p.id]?.[0]?.cents ?? 0 }));

  return (
    <s-page heading={isNew ? `New ${meta.singular}` : rule.name} inlineSize="large">
      <s-link slot="breadcrumb-actions" href={`/app/offers/${kindSlug}`}>
        {meta.title}
      </s-link>
      <DemoButton feature={isUpsell ? "upsell" : "cross_sell"} />
      <SaveControls dirty={changed(rule, initial)} saving={busy} saved={!isNew} allowLeave={busy || (isNew && !!fetcher.data?.handle)} onSave={save} onDiscard={() => { setRule(initial); setTouched(false); }} />

      {fetcher.data?.error ? (
        <s-banner tone="critical" heading="The offer was not saved">
          <s-stack gap="small-200">
            {fetcher.data.error}
            <LimitUpgrade show={fetcher.data.upgrade} />
          </s-stack>
        </s-banner>
      ) : null}
      {touched && problems.length ? (
        <s-banner tone="warning" heading="Please fix these first">
          <s-unordered-list>
            {problems.map((p) => (
              <s-list-item key={p}>{p}</s-list-item>
            ))}
          </s-unordered-list>
        </s-banner>
      ) : null}

      <EditorLayout
        preview
        help={meta.kind === "upsell" ? "upsell-offers" : "cross-sell-offers"}
        side={
          <>
              <PreviewFrame title={isUpsell ? "Product page · this offer" : "Product page · these suggestions"}>
                <ThemeLook style={style}>
                  {isUpsell && upsellDesign ? (
                    <UpsellDesignPreview
                      config={upsellDesign}
                      offer={{ headline: rule.headline, subheadline: rule.subheadline, variant: rule.upsellType === "variant", optionName: rule.optionName, tiers: rule.tiers }}
                      product={product}
                      currency={product?.currency}
                      page={pageLook}
                      block={blockLook}
                      highlight={flashed}
                    />
                  ) : crossDesign ? (
                    <CrossSellDesignPreview
                      config={crossDesign}
                      offer={{ headline: rule.headline, subheadline: rule.subheadline, button: rule.buttonLabel, pct: rule.discountPercent, items: crossItems.length ? crossItems : [{ title: "Pick products below", image: null, cents: 0 }] }}
                      currency={previews.data?.currency ?? product?.currency}
                      page={pageLook}
                      block={blockLook}
                      highlight={flashed}
                    />
                  ) : null}
                </ThemeLook>
              </PreviewFrame>
              <s-text color="subdued">The real block with your store&apos;s look. Colors and fonts follow your theme.</s-text>

              <s-section heading="Discount at checkout">
                <s-paragraph>
                  {engine === "native"
                    ? "Saving creates Shopify automatic discounts for this offer. Don't edit them in Discounts; the app replaces them on every save."
                    : "Applied by the “CRO Toolbox offers” automatic discount, which combines with order and shipping discounts."}
                </s-paragraph>
              </s-section>
          </>
        }
      >
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <s-section heading="Status">
          <s-stack gap="base">
            <Switch label={rule.active ? "Active: showing on your store" : "Paused: hidden"} checked={rule.active} onValue={(v) => set("active", v)} />
            <TextField label="Offer name" placeholder={rule.headline} details="Only you see this." value={rule.name} onValue={(v) => set("name", v)} />
            <NumberField
              label="Show order"
              details="When several offers match the same product, the lowest number shows first."
              value={rule.priority}
              min={0}
              max={999}
              step={1}
              onValue={(v) => set("priority", v)}
            />
          </s-stack>
        </s-section>
          {isUpsell ? (
            <>
              <s-section heading="1. Choose the offer">
                <s-stack gap="base">
                <Select
                  label="What do shoppers get?"
                  value={rule.upsellType}
                  onValue={(v) => {
                    const type = v as Rule["upsellType"];
                    if (type === rule.upsellType) return;
                    setRule((r) => ({
                      ...r,
                      upsellType: type,
                      optionName: type === "variant" ? r.optionName || "Size" : r.optionName,
                      headline: type === "variant" && r.headline === "Buy more, save more" ? "Choose your size" : r.headline,
                      tiers:
                        type === "variant"
                          ? [
                              { qty: 1, value: "", pct: 0 },
                              { qty: 1, value: "", pct: 10, badge: "Best value" },
                            ]
                          : [
                              { qty: 1, pct: 0 },
                              { qty: 2, pct: 10 },
                              { qty: 3, pct: 15, badge: "Most popular" },
                            ],
                    }));
                  }}
                  options={[
                    { value: "quantity", label: "A discount for buying more (Buy 2, save 10%)" },
                    { value: "variant", label: "A discount on bigger sizes (size upgrade)" },
                  ]}
                  details={
                    rule.upsellType === "variant"
                      ? "Each choice is a size (or another option). Picking it switches the product to that size, discounted at checkout."
                      : "Each choice is a quantity. The discount applies at checkout once the cart has that many; different sizes count together."
                  }
                />
                {rule.upsellType === "variant" ? (
                  <TextField
                    label="Option name"
                    placeholder="Size"
                    details="Exactly as it appears on your products, e.g. Size, Volume, Pack."
                    value={rule.optionName}
                    onValue={(v) => set("optionName", v)}
                  />
                ) : null}
                </s-stack>
              </s-section>
              <s-section heading={rule.upsellType === "variant" ? "2. Set the sizes and discounts" : "2. Set the quantities and discounts"}>
                <s-stack gap="base">
                {rule.tiers.map((t, i) => (
                  <s-box key={i} padding="base" borderWidth="base" borderRadius="base">
                    <s-stack gap="small-200">
                      <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                        {rule.upsellType === "variant" ? (
                          <TextField
                            label={`${rule.optionName || "Option"} value`}
                            placeholder={i === 0 ? "50 ml" : "100 ml"}
                            value={t.value ?? ""}
                            onValue={(v) => setTier(i, { value: v })}
                          />
                        ) : (
                          <NumberField label="Quantity" value={t.qty} min={1} max={99} step={1} onValue={(v) => setTier(i, { qty: v })} />
                        )}
                        <NumberField label="Discount" suffix="%" value={t.pct} min={0} max={90} step={1} onValue={(v) => setTier(i, { pct: v })} />
                        <TextField
                          label="Label (optional)"
                          placeholder={rule.upsellType === "variant" ? t.value || "100 ml" : `Buy ${t.qty}`}
                          value={t.label ?? ""}
                          onValue={(v) => setTier(i, { label: v })}
                        />
                        <TextField
                          label="Badge (optional)"
                          placeholder={rule.upsellType === "variant" ? "Best value" : "Most popular"}
                          value={t.badge ?? ""}
                          onValue={(v) => setTier(i, { badge: v })}
                        />
                      </s-grid>
                      <s-stack direction="inline">
                        <Button variant="tertiary" tone="critical" icon="delete" onClick={() => set("tiers", rule.tiers.filter((_, j) => j !== i))}>
                          Remove tier
                        </Button>
                      </s-stack>
                    </s-stack>
                  </s-box>
                ))}
                <s-stack direction="inline">
                  <Button
                    icon="plus"
                    disabled={rule.tiers.length >= 6}
                    onClick={() => {
                      const last = rule.tiers[rule.tiers.length - 1];
                      set(
                        "tiers",
                        rule.upsellType === "variant"
                          ? [...rule.tiers, { qty: 1, value: "", pct: Math.min(90, (last?.pct ?? 0) + 5) }]
                          : [...rule.tiers, { qty: (last?.qty ?? 0) + 1, pct: Math.min(90, (last?.pct ?? 0) + 5) }],
                      );
                    }}
                  >
                    Add tier
                  </Button>
                </s-stack>
                {engine === "native" && rule.upsellType === "variant" && rule.triggerType === "all" ? (
                  <s-banner tone="warning" heading="Choose products or collections">
                    With native discounts, size tiers need specific products or collections (so the app can find each
                    size’s variants). With “All products” the tiers show, but checkout won’t discount them.
                  </s-banner>
                ) : null}
                  </s-stack>
              </s-section>
              <s-section heading="3. Choose the products">
                <s-stack gap="base">
              <Select
                label={isUpsell ? "Show this offer on" : "Show these suggestions for"}
                value={rule.triggerType}
                onValue={(v) => set("triggerType", v as Rule["triggerType"])}
                options={[
                  { value: "all", label: "All products" },
                  { value: "products", label: "Specific products" },
                  { value: "collections", label: "Products in collections" },
                ]}
                details={isUpsell ? undefined : "On the product page of these products, or when they are in the cart."}
              />
              {rule.triggerType === "products" ? (
                <ResourceList type="product" label="Products" value={rule.triggerProducts} onChange={(v) => set("triggerProducts", v)} />
              ) : null}
              {rule.triggerType === "collections" ? (
                <ResourceList
                  type="collection"
                  label="Collections"
                  value={rule.triggerCollections}
                  onChange={(v) => set("triggerCollections", v)}
                />
              ) : null}
                </s-stack>
              </s-section>
            </>
          ) : (
            <>
              <s-section heading="1. Choose when to show it">
                <s-stack gap="base">
              <Select
                label={isUpsell ? "Show this offer on" : "Show these suggestions for"}
                value={rule.triggerType}
                onValue={(v) => set("triggerType", v as Rule["triggerType"])}
                options={[
                  { value: "all", label: "All products" },
                  { value: "products", label: "Specific products" },
                  { value: "collections", label: "Products in collections" },
                ]}
                details={isUpsell ? undefined : "On the product page of these products, or when they are in the cart."}
              />
              {rule.triggerType === "products" ? (
                <ResourceList type="product" label="Products" value={rule.triggerProducts} onChange={(v) => set("triggerProducts", v)} />
              ) : null}
              {rule.triggerType === "collections" ? (
                <ResourceList
                  type="collection"
                  label="Collections"
                  value={rule.triggerCollections}
                  onChange={(v) => set("triggerCollections", v)}
                />
              ) : null}
                </s-stack>
              </s-section>
              <s-section heading="2. Choose the products to suggest">
                <s-stack gap="base">
                <ResourceList
                  type="product"
                  label="Products to suggest"
                  details="Sold-out products, the product being viewed and products already in the cart are skipped automatically."
                  value={rule.offeredProducts}
                  onChange={setOffered}
                />
                <s-text type="strong">Show them on</s-text>
                <Checkbox label="Product page" checked={rule.placements.includes("product")} onValue={(v) => togglePlacement("product", v)} />
                <Checkbox label="Cart page" checked={rule.placements.includes("cart")} onValue={(v) => togglePlacement("cart", v)} />
                <Checkbox
                  label="Cart drawer"
                  details="Also switch on “Cart drawer offers” in Settings."
                  checked={rule.placements.includes("drawer")}
                  onValue={(v) => togglePlacement("drawer", v)}
                />
                </s-stack>
              </s-section>
              <s-section heading="3. Add a discount (optional)">
                <NumberField
                  label="Discount on the suggested products"
                  suffix="%"
                  details="0 = no discount. Applies at checkout while one of the products from step 1 is also in the cart."
                  value={rule.discountPercent}
                  min={0}
                  max={90}
                  step={1}
                  onValue={(v) => set("discountPercent", v)}
                />
              </s-section>
            </>
          )}

          <s-section heading="4. Write the text">
            <s-stack gap="base">
              <TextField label="Headline" value={rule.headline} onValue={(v) => set("headline", v)} />
              <TextField label="Subheadline (optional)" value={rule.subheadline} onValue={(v) => set("subheadline", v)} />
              {!isUpsell ? (
                <TextField
                  label="Button text"
                  details="The number of ticked products is added automatically, e.g. “Add selected to cart (2)”."
                  value={rule.buttonLabel}
                  onValue={(v) => set("buttonLabel", v)}
                />
              ) : null}
              <TextField
                label="Discount name at checkout"
                placeholder={rule.headline || rule.name}
                details="Shoppers see this next to the discount in the cart and at checkout."
                value={rule.discountLabel}
                onValue={(v) => set("discountLabel", v)}
              />
              {engine === "native" && isUpsell && rule.triggerType === "all" && rule.tiers.some((t) => t.pct > 0) ? (
                <s-banner tone="warning" heading="Counts the whole cart">
                  With native discounts, an “All products” upsell is an order discount: the minimum quantity counts every item
                  in the cart, the tier’s percentage comes off the whole order, and it doesn’t combine with other order
                  discounts. Choose specific products or collections to limit it.
                </s-banner>
              ) : null}
              {engine === "native" && !isUpsell && rule.triggerType === "all" && rule.discountPercent > 0 ? (
                <s-banner tone="warning" heading="Discount applies without a trigger">
                  With native discounts, an “All products” cross sell can’t require a trigger product, so the offered products
                  get this discount even when bought on their own. Choose specific products or collections as the trigger to
                  require one.
                </s-banner>
              ) : null}
            </s-stack>
          </s-section>
          {!isNew ? (
            <DeleteOffer busy={busy} onDelete={remove}>
              <s-paragraph>{`“${rule.name || rule.headline}” stops showing on your store and its checkout discount is removed. This cannot be undone.`}</s-paragraph>
            </DeleteOffer>
          ) : null}
      </EditorLayout>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
