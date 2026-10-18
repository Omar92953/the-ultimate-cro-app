/* eslint-disable @typescript-eslint/no-explicit-any -- App Bridge resource picker payloads are untyped */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { bundleBuilderLinks, deleteBundle, getThemeStatus, listBundles, saveBundle } from "../lib/cro.server";
import { SCOPE_MESSAGE, createBundlePage, createBundleProduct, isScopeError } from "../lib/bundle-product.server";
import { validateBundle } from "../lib/validate";
import { requireBundle } from "../lib/rules.server";
import { isRuleError } from "../lib/rules";
import { LimitUpgrade } from "../components/Upgrade";
import { errorMessage } from "../lib/admin.server";
import { bundlePricing, growingPricing, type Bundle, type BundleStep, type BundleTier } from "../lib/types";
import { Button, Checkbox, NumberField, Select, Switch, TextField } from "../components/fields";
import { ResourceList } from "../components/ResourceList";
import { MediaPicker } from "../components/MediaPicker";
import { Segmented } from "../components/ui";
import type { MediaRef } from "../lib/sections";
import { SortableList, arrayMove } from "../components/Sortable";
import { EditorLayout } from "../components/EditorLayout";
import { EditorSection } from "../components/EditorSection";
import { PreviewFrame } from "../components/DesignTabs";
import { DeleteOffer } from "../components/DeleteOffer";
import { useFlash } from "../components/flash";
import { ThemeLook } from "../components/ThemeStyle";
import { BundlePreview, SAMPLE_BUNDLE, type PreviewBundle, type PreviewItem } from "../components/BundlePreview";
import { getBundleDesign } from "../lib/designs.server";
import { getThemeStyle } from "../lib/theme-style.server";
import { FALLBACK_STYLE, previewTheme } from "../lib/theme-style";
import { storefrontCss } from "../lib/storefront-css.server";
import { SaveControls, changed } from "../components/SaveControls";
import { DemoButton } from "../components/DemoButton";
import { recipeOfBundle } from "../lib/bundle-recipes";

const blankStep = (): BundleStep => ({ label: "", required: true, min: 1, max: 1, products: [], collection: null });

/** Whether the builder block sits on the product template and on a page template (theme status). */
async function placement(admin: Parameters<typeof getThemeStatus>[0], shop: string) {
  const status = await getThemeStatus(admin, shop).catch(() => null);
  const files = status?.files.bundles ?? [];
  return {
    known: !!status,
    product: files.some((f) => /^templates\/product(\.|$)/.test(f)),
    page: files.some((f) => /^templates\/page(\.|$)/.test(f)),
    // Build your own bundle: the Bundle tray embed (tray + "+" on collection cards) and the
    // optional "Add to bundle" block on product pages.
    tray: !!status?.installed.bundle_tray,
    button: !!status?.installed.bundle_button,
  };
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [all, placed, design, style] = await Promise.all([
    listBundles(admin),
    placement(admin, session.shop),
    getBundleDesign(admin).then((d) => d.config),
    getThemeStyle(admin, session.shop).catch(() => FALLBACK_STYLE),
  ]);
  // The live preview: the store's own bundle design, theme look and the storefront stylesheet.
  const look = { design, style, css: storefrontCss("ucro.css") };
  if (params.handle === "new") {
    const bundle: Bundle = {
      name: "",
      active: true,
      product: null,
      steps: [{ ...blankStep(), label: "Choose your items", min: 3, max: 3 }],
      allowDuplicates: false,
      hideSoldOut: true,
      pricing: "fixed",
      percentOff: 10,
      tiers: [],
      extras: [],
      storeWide: true,
      page: null,
    };
    // Recipes from "Create bundle" (lib/bundle-recipes.ts) start with matching settings.
    const recipe = new URL(request.url).searchParams.get("recipe");
    let where: "product" | "page" | "both" = "product";
    if (recipe === "mixmatch") Object.assign(bundle, { storeWide: false, steps: [{ ...blankStep(), label: "Choose 3 items", min: 3, max: 3 }] });
    if (recipe === "growing") {
      Object.assign(bundle, { pricing: "percent_tiers", tiers: [{ qty: 2, price: 10 }, { qty: 3, price: 15 }, { qty: 4, price: 20 }], storeWide: false, steps: [{ ...blankStep(), label: "Choose your items", min: 1, max: 10 }] });
      where = "page";
    }
    if (recipe === "browse") Object.assign(bundle, { pricing: "percent", percentOff: 10, storeWide: true, steps: [{ ...blankStep(), label: "Choose 3 items", min: 3, max: 3 }] });
    if (recipe === "anyN") Object.assign(bundle, { pricing: "tiers", tiers: [{ qty: 3, price: 30 }, { qty: 6, price: 55 }], storeWide: false, steps: [{ ...blankStep(), label: "Choose 3 or 6 items", min: 3, max: 6 }] });
    return { bundle, others: all, isNew: true, shop: session.shop, placed, links: bundleBuilderLinks(session.shop), where, ...look };
  }
  const bundle = all.find((b) => b.handle === params.handle);
  if (!bundle) throw new Response("Bundle not found", { status: 404 });
  return { bundle, others: all, isNew: false, shop: session.shop, placed, links: bundleBuilderLinks(session.shop, bundle.product?.handle, bundle.page?.handle), where: (bundle.page ? "both" : "product") as "product" | "page" | "both", ...look };
};

const WHERE = { product: "Bundle product page", page: "Store page", both: "Product page and store page" } as const;

/** One line for the closed "Price & discount" step. */
function pricingSummary(b: Bundle) {
  const rows = (unit: (n: number) => string) => [...b.tiers].sort((x, y) => x.qty - y.qty).map((t) => `${t.qty}: ${unit(t.price)}`).join(", ");
  if (b.pricing === "percent") return `${b.percentOff}% off the picked items`;
  if (b.pricing === "tiers") return `Price by number of items (${rows((n) => String(n))})`;
  if (b.pricing === "percent_tiers") return `Bigger % off for more items (${rows((n) => `${n}%`)})`;
  if (b.pricing === "amount_tiers") return `Bigger amount off for more items (${rows((n) => `${n} off`)})`;
  return "One price: the bundle product's price";
}

/** The step a validation message belongs to, so a failed save opens it. */
function sectionOf(problem: string) {
  if (/name/i.test(problem) && !/product/i.test(problem)) return 1;
  if (/product|store page/i.test(problem) && !/^Step/.test(problem)) return 2;
  if (/^Step|step/.test(problem)) return 3;
  return 4;
}

/** "Create a new one": the bundle product the app makes on save. */
type NewProduct = { title: string; price: number; imageUrl: string | null };
/** Where shoppers build the bundle: its product page, a store page, or both. */
type Where = "product" | "page" | "both";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, redirect, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    if (form.get("intent") === "delete") {
      const done = await deleteBundle(admin, String(form.get("handle")));
      return redirect(`/app/bundles?deleted=${done}`);
    }
    const bundle = JSON.parse(String(form.get("bundle"))) as Bundle;
    const create = form.get("create") ? (JSON.parse(String(form.get("create"))) as NewProduct) : null;
    const where = (["product", "page", "both"].includes(String(form.get("where"))) ? String(form.get("where")) : "product") as Where;
    // The plan, the bundle's own checks and the offer slots (bundles and deals share one limit on smaller plans; a bundle can always be saved off).
    // Checked before anything is made, so a product or page is never created for a bundle that won't save.
    await requireBundle(admin, session.shop, { ...bundle, product: bundle.product ?? (create ? { id: "pending", title: create.title } : null) }, await listBundles(admin));
    if (!bundle.product && create) {
      // No starting price entered: for "price by number of items" show the lowest bundle price, so the
      // product page never says $0.00 (shoppers pay the tier price at checkout either way).
      const tierPrices = bundle.pricing === "tiers" ? bundle.tiers.map((t) => t.price).filter((x) => x > 0) : [];
      const price = create.price > 0 ? create.price : tierPrices.length ? Math.min(...tierPrices) : create.price;
      const p = await createBundleProduct(admin, { title: create.title || bundle.name, price, imageUrl: create.imageUrl, hidden: where === "page" });
      bundle.product = { id: p.id, title: p.title, image: p.image, handle: p.handle };
    }
    if (where === "product") bundle.page = null;
    else if (!bundle.page) bundle.page = await createBundlePage(admin, bundle.name || bundle.product?.title || "Build your bundle");
    const saved = await saveBundle(admin, bundle);
    return { ok: true, error: null, handle: saved.handle, upgrade: false };
  } catch (e) {
    return { ok: false, error: isScopeError(e) ? SCOPE_MESSAGE : errorMessage(e), handle: null, upgrade: isRuleError(e) && e.upgrade };
  }
};

export default function BundleEditor() {
  const { bundle: initial, others, isNew, shop, placed, links, where: initialWhere, design, style, css } = useLoaderData<typeof loader>();
  // One step open at a time; a new bundle starts at step 1, an existing one shows its summary.
  const [open, setOpen] = useState(isNew ? 1 : 0);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [bundle, setBundle] = useState<Bundle>(initial);
  // "Create a new one" (new bundles start with it) or pick a product the store already has.
  const [create, setCreate] = useState<{ on: boolean; title: string; price: number; image: MediaRef | null }>({ on: !initial.product, title: "", price: 0, image: null });
  const [where, setWhere] = useState<"product" | "page" | "both">(initialWhere);
  const [touched, setTouched] = useState(false);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const busy = fetcher.state !== "idle";

  // Reset the form when the loader returns fresh data (after a save or navigation).
  const [loaded, setLoaded] = useState(initial);
  // A reload after a save brings a new copy of the same data: keep the merchant's edits unless it
  // actually changed (otherwise a refused save of a new item would wipe the form).
  if (loaded !== initial) {
    setLoaded(initial);
    if (JSON.stringify(loaded) !== JSON.stringify(initial)) {
      setBundle(initial);
    }
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      shopify.toast.show("Saved");
      if (isNew && fetcher.data.handle) navigate(`/app/bundles/${fetcher.data.handle}`, { replace: true });
    } else if (fetcher.data.error) {
      shopify.toast.show("Could not save. See the message at the top", { isError: true });
    }
  }, [fetcher.state, fetcher.data, shopify, isNew, navigate]);

  const set = <K extends keyof Bundle>(key: K, value: Bundle[K]) => setBundle((b) => ({ ...b, [key]: value }));
  const [flashed, flash] = useFlash();
  const setStep = (i: number, patch: Partial<BundleStep>) => {
    flash(`step-${i}`);
    return setStepRaw(i, patch);
  };
  const setStepRaw = (i: number, patch: Partial<BundleStep>) =>
    set("steps", bundle.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const moveStep = (from: number, to: number) => set("steps", arrayMove(bundle.steps, from, to));

  const creating = create.on && !bundle.product;
  // The product is made on save when "Create a new one" is chosen.
  const problems = validateBundle({ ...bundle, product: bundle.product ?? (creating ? { id: "pending", title: create.title } : null) }, others);
  const save = () => {
    setTouched(true);
    if (problems.length) return setOpen(Math.min(...problems.map(sectionOf)));
    fetcher.submit(
      {
        intent: "save",
        bundle: JSON.stringify(bundle),
        where,
        ...(creating ? { create: JSON.stringify({ title: create.title.trim() || bundle.name, price: create.price, imageUrl: create.image?.url ?? null }) } : {}),
      },
      { method: "post" },
    );
  };
  // Live preview: real pictures and prices of what's chosen (fetched as the steps change).
  const previews = useFetcher<{ items: Record<string, PreviewItem[]>; currency: string }>();
  const ids = [...(bundle.product ? [bundle.product.id] : []), ...bundle.steps.flatMap((s) => (s.collection ? [s.collection.id] : s.products.map((p) => p.id)))];
  const idsKey = [...new Set(ids)].sort().join(",");
  useEffect(() => {
    if (idsKey) previews.load(`/app/bundles/preview-items?ids=${encodeURIComponent(idsKey)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the chosen products change
  }, [idsKey]);
  const items = previews.data?.items ?? {};
  const previewSteps = bundle.steps.map((s) => ({
    label: s.label || "Choose your items",
    min: s.required ? Math.max(1, s.min) : 0,
    max: Math.max(1, s.max),
    items: (s.collection ? items[s.collection.id] ?? [] : s.products.flatMap((p) => items[p.id] ?? [])).slice(0, 8),
  }));
  const usingSample = previewSteps.every((s) => !s.items.length);
  const startCents = creating ? Math.round(create.price * 100) : bundle.product ? (items[bundle.product.id]?.[0]?.cents ?? 0) : 0;
  const previewBundle: PreviewBundle = {
    ...(usingSample ? SAMPLE_BUNDLE : { name: bundle.name, steps: previewSteps }),
    name: bundle.name || "New bundle",
    price: startCents || (usingSample ? SAMPLE_BUNDLE.price : 0),
    pricing: { kind: bundle.pricing, percent: bundle.percentOff, tiers: bundle.tiers },
  };
  const previewKey = `${idsKey}|${bundle.steps.map((s) => `${s.min}-${s.max}`).join(",")}`;
  const previewCurrency = previews.data?.currency ?? "USD";
  const pageLook = previewTheme(style);
  const blockLook = design.look.scheme ? previewTheme(style, design.look.scheme) : null;

  const remove = () => {
    if (!bundle.handle) return;
    fetcher.submit({ intent: "delete", handle: bundle.handle }, { method: "post" });
  };

  return (
    <s-page heading={isNew ? "New bundle" : bundle.name} inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/bundles">
        Bundles
      </s-link>
      <DemoButton feature="bundles" recipe={recipeOfBundle(bundle)} />
      <SaveControls dirty={changed(bundle, initial)} saving={busy} saved={!isNew} allowLeave={busy || (isNew && !!fetcher.data?.handle)} onSave={save} onDiscard={() => { setBundle(initial); setTouched(false); }} />

      {fetcher.data?.error ? (
        <s-banner tone="critical" heading="The bundle was not saved">
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
        help="bundles"
        side={
          <>
            <s-section heading="Get it on your store">
              <s-stack gap="base">
                <s-stack gap="small-100">
                  <s-text type="strong">{bundle.product ? "1. Bundle product ✓" : "1. Bundle product"}</s-text>
                  <s-text color="subdued">
                    {bundle.product
                      ? "Shoppers see its page, and checkout shows the bundle under its name and picture."
                      : creating
                        ? "CRO Toolbox creates and publishes it when you save."
                        : "Choose the product in “Bundle” on the left."}
                  </s-text>
                  {bundle.product ? (
                    <s-stack direction="inline">
                      <Button variant="tertiary" href={`https://${shop}/admin/products/${bundle.product.id.split("/").pop()}`} target="_top">
                        Open in Shopify
                      </Button>
                    </s-stack>
                  ) : null}
                </s-stack>
                {where !== "page" ? (
                  <s-stack gap="small-100">
                    <s-text type="strong">{placed.product ? "2. Builder on the product page ✓" : "2. Add the builder to the product page"}</s-text>
                    <s-text color="subdued">Opens the theme editor with the Bundle builder block added. Drag it above Add to cart, then click Save. It shows only on bundle products.</s-text>
                    <s-stack direction="inline">
                      <Button variant={placed.product ? "tertiary" : "primary"} href={links.product} target="_top" icon="theme-edit" disabled={!bundle.product && !isNew}>
                        {placed.product ? "Open in theme editor" : "Add to theme"}
                      </Button>
                    </s-stack>
                  </s-stack>
                ) : null}
                {where !== "product" ? (
                  <s-stack gap="small-100">
                    <s-text type="strong">{placed.page && bundle.page ? `${where === "page" ? 2 : 3}. Builder on the store page ✓` : `${where === "page" ? 2 : 3}. Add the builder to the store page`}</s-text>
                    <s-text color="subdued">
                      {bundle.page ? `Your page: /pages/${bundle.page.handle}. The block shows only on this page.` : "CRO Toolbox creates the page when you save."}
                    </s-text>
                    {links.page ? (
                      <s-stack direction="inline">
                        <Button variant={placed.page ? "tertiary" : "primary"} href={links.page} target="_top" icon="theme-edit">
                          {placed.page ? "Open in theme editor" : "Add to theme"}
                        </Button>
                      </s-stack>
                    ) : null}
                  </s-stack>
                ) : null}
                {bundle.storeWide ? (
                  <>
                    <s-stack gap="small-100">
                      <s-text type="strong">{placed.tray ? `${where === "both" ? 4 : 3}. Bundle tray ✓` : `${where === "both" ? 4 : 3}. Turn on the Bundle tray`}</s-text>
                      <s-text color="subdued">Needed to build while browsing: it adds “+ Add to bundle” on the step’s collection page and the tray that follows the shopper. Turn it on once, then click Save in the theme editor.</s-text>
                      <s-stack direction="inline">
                        <Button variant={placed.tray ? "tertiary" : "primary"} href={links.tray} target="_top" icon="theme-edit">
                          {placed.tray ? "Open in theme editor" : "Turn on"}
                        </Button>
                      </s-stack>
                    </s-stack>
                    <s-stack gap="small-100">
                      <s-text type="strong">{placed.button ? `${where === "both" ? 5 : 4}. Add to bundle on product pages ✓` : `${where === "both" ? 5 : 4}. Add to bundle on product pages (optional)`}</s-text>
                      <s-text color="subdued">A button on each item’s product page that adds it to the bundle.</s-text>
                      <s-stack direction="inline">
                        <Button variant="tertiary" href={links.button} target="_top" icon="theme-edit">
                          {placed.button ? "Open in theme editor" : "Add to theme"}
                        </Button>
                      </s-stack>
                    </s-stack>
                  </>
                ) : null}
                {bundle.product ? (
                  <s-stack direction="inline">
                    <Button variant="tertiary" href={`https://${shop}${where === "page" && bundle.page ? `/pages/${bundle.page.handle}` : `/products/${bundle.product.handle ?? ""}`}`} target="_blank" icon="view">
                      View on your store
                    </Button>
                  </s-stack>
                ) : null}
              </s-stack>
            </s-section>

            <PreviewFrame
              title={`Preview · ${bundle.name || "New bundle"}`}
              tools={<Segmented label="Device" value={device} options={[{ value: "desktop", label: "Desktop" }, { value: "phone", label: "Phone" }]} onChange={setDevice} />}
            >
              <ThemeLook style={style}>
                <BundlePreview key={previewKey} config={design} bundle={previewBundle} currency={previewCurrency} phone={device === "phone"} page={pageLook} block={blockLook} highlight={flashed} />
              </ThemeLook>
            </PreviewFrame>
            {usingSample ? <s-text color="subdued">Sample items until you choose the products in step 3.</s-text> : null}
          </>
        }
      >
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <EditorSection n={1} title="Bundle" summary={`${bundle.name || "No name yet"} · ${bundle.active ? "Active" : "Paused"}`} done={!!bundle.name.trim()} open={open === 1} onToggle={() => setOpen((o) => (o === 1 ? 0 : 1))} onNext={() => setOpen(2)}>
          <TextField label="Name" details="Only you see this." value={bundle.name} onValue={(v) => set("name", v)} />
          <Switch label="Active" checked={bundle.active} onValue={(v) => set("active", v)} />
        </EditorSection>
        <EditorSection n={2} title="Where it shows" summary={`${bundle.product?.title ?? (creating ? `New product: ${create.title || bundle.name || "untitled"}` : "No product yet")} · ${WHERE[where]}`} done={!!bundle.product || creating} open={open === 2} onToggle={() => setOpen((o) => (o === 2 ? 0 : 2))} onNext={() => setOpen(3)}>
          {!bundle.product ? (
            <Segmented
              label="Bundle product"
              value={create.on ? "create" : "pick"}
              onChange={(v) => setCreate((c) => ({ ...c, on: v === "create" }))}
              options={[
                { value: "create", label: "Create a new one" },
                { value: "pick", label: "Connect existing product" },
              ]}
            />
          ) : null}
          {creating ? (
            <s-stack gap="base">
              <s-text color="subdued">The bundle product is what shoppers open, and what the cart and the order show for the bundle. CRO Toolbox creates it, publishes it and keeps its stock untracked (the picked items&apos; stock goes down).</s-text>
              <TextField label="Product title" placeholder={bundle.name || "Build your own box"} value={create.title} onValue={(v) => setCreate((c) => ({ ...c, title: v }))} />
              <NumberField
                label={bundle.pricing === "fixed" ? "Bundle price" : "Starting price"}
                details={bundle.pricing === "fixed" ? "Shoppers pay this for the whole bundle, whatever they pick." : bundle.pricing === "tiers" ? "Shown before anything is picked. Leave it at 0 to show the lowest bundle price." : "Shown before anything is picked; shoppers pay what the pricing below gives."}
                min={0}
                step={0.01}
                value={create.price}
                onValue={(v) => setCreate((c) => ({ ...c, price: Math.max(0, v) }))}
              />
              <MediaPicker label="Picture (optional)" accept="image" alt={create.title || bundle.name} value={create.image} onValue={(v) => setCreate((c) => ({ ...c, image: v }))} />
            </s-stack>
          ) : (
            <ResourceList
              type="product"
              multiple={false}
              label="Bundle product"
              details="The bundle as it shows on its page, in the cart and on the order (its title and picture)."
              value={bundle.product ? [bundle.product] : []}
              onChange={(v) => set("product", v[0] ?? null)}
            />
          )}
          <Select
            label="Where shoppers build it"
            value={where}
            onValue={(v) => setWhere(v === "page" || v === "both" ? v : "product")}
            options={[
              { value: "product", label: "On the bundle product's page" },
              { value: "page", label: "On its own store page (/pages/…)" },
              { value: "both", label: "Both" },
            ]}
            details={where === "page" ? "The bundle product stays out of search; shoppers start on the store page." : undefined}
          />
        </EditorSection>
        <EditorSection n={3} title="Products" summary={`${bundle.steps.length} step${bundle.steps.length === 1 ? "" : "s"}: ${bundle.steps.map((s) => s.label || "untitled").join(" · ")}`} done={bundle.steps.every((s) => s.label.trim() && (s.products.length || s.collection))} open={open === 3} onToggle={() => setOpen((o) => (o === 3 ? 0 : 3))} onNext={() => setOpen(4)}>
          <SortableList
            items={bundle.steps}
            keyOf={(_step, i) => String(i)}
            labelOf={(step) => step.label || "Step"}
            onMove={moveStep}
            gap={16}
            render={(step, i, handle) => (
            <s-section heading={`Step ${i + 1}${step.label ? `: ${step.label}` : ""}`}>
              <s-stack gap="base">
                <s-stack direction="inline" gap="small-100" alignItems="center">
                  {handle}
                  <s-text color="subdued">Drag to change the order of the steps</s-text>
                </s-stack>
                <TextField label="Label" placeholder="Choose 3 posters" value={step.label} onValue={(v) => setStep(i, { label: v })} />
                <Checkbox
                  label="Required"
                  details="Optional steps can be skipped."
                  checked={step.required}
                  onValue={(v) => setStep(i, { required: v })}
                />
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <NumberField
                    label="Minimum picks"
                    value={step.required ? step.min : 0}
                    min={step.required ? 1 : 0}
                    max={20}
                    step={1}
                    disabled={!step.required}
                    onValue={(v) => setStep(i, { min: v })}
                  />
                  <NumberField label="Maximum picks" value={step.max} min={1} max={20} step={1} onValue={(v) => setStep(i, { max: v })} />
                </s-grid>
                {step.collection ? (
                  <>
                    <ResourceList
                      type="collection"
                      multiple={false}
                      label="Choose from this collection"
                      details="All its products are offered, in the collection’s order (shoppers can load more and search)."
                      value={[step.collection]}
                      onChange={(v) => setStep(i, { collection: v[0] ?? null })}
                    />
                    <s-stack direction="inline">
                      <Button variant="tertiary" icon="product" onClick={() => setStep(i, { collection: null })}>
                        Use specific products instead
                      </Button>
                    </s-stack>
                  </>
                ) : (
                  <>
                    <ResourceList
                      type="product"
                      label="Choose from these products"
                      value={step.products}
                      onChange={(v) => setStep(i, { products: v })}
                    />
                    <s-stack direction="inline">
                      <Button
                        variant="tertiary"
                        icon="collection"
                        onClick={async () => {
                          const picked: any = await shopify.resourcePicker({ type: "collection", multiple: false, action: "select" } as any);
                          const c = picked?.[0];
                          if (c) setStep(i, { collection: { id: c.id, title: c.title, image: c.image?.originalSrc ?? null }, products: [] });
                        }}
                      >
                        Use a collection instead
                      </Button>
                    </s-stack>
                  </>
                )}
                <s-stack direction="inline" gap="small-200">
                  <Button
                    tone="critical"
                    variant="tertiary"
                    icon="delete"
                    disabled={bundle.steps.length === 1}
                    onClick={() => set("steps", bundle.steps.filter((_, j) => j !== i))}
                  >
                    Remove step
                  </Button>
                </s-stack>
              </s-stack>
            </s-section>
            )}
          />
          <s-stack direction="inline">
            <Button icon="plus" disabled={bundle.steps.length >= 6} onClick={() => set("steps", [...bundle.steps, blankStep()])}>
              Add step
            </Button>
          </s-stack>
        </EditorSection>
        <EditorSection n={4} title="Price & discount" summary={pricingSummary(bundle)} done={!growingPricing(bundle.pricing) && bundle.pricing !== "tiers" ? true : bundle.tiers.length > 0} open={open === 4} onToggle={() => setOpen((o) => (o === 4 ? 0 : 4))} onNext={() => setOpen(5)}>
          <Select
            label="Bundle price"
            value={bundle.pricing}
            onValue={(v) => {
              const pricing = bundlePricing(v);
              // Switching kind starts from example tiers, since a tier means something else in each kind.
              const seed: Record<string, BundleTier[]> = {
                tiers: [{ qty: 3, price: 30 }, { qty: 6, price: 55 }],
                percent_tiers: [{ qty: 2, price: 10 }, { qty: 3, price: 15 }, { qty: 4, price: 20 }],
                amount_tiers: [{ qty: 2, price: 5 }, { qty: 3, price: 10 }],
              };
              setBundle((b) => ({ ...b, pricing, tiers: pricing === b.pricing ? b.tiers : (seed[pricing] ?? b.tiers) }));
            }}
            options={[
              { value: "fixed", label: "One price: the bundle product's price" },
              { value: "percent", label: "A percentage off the items shoppers pick" },
              { value: "percent_tiers", label: "A bigger % off for more items (e.g. 2 items 10%, 3 items 15%)" },
              { value: "amount_tiers", label: "A bigger amount off for more items (e.g. 2 items 5 off, 3 items 10 off)" },
              { value: "tiers", label: "Price by number of items (e.g. 3 for 30, 6 for 55)" },
            ]}
          />
          {bundle.pricing === "percent" ? (
            <NumberField label="Percent off" suffix="%" min={1} max={90} step={1} value={bundle.percentOff} onValue={(v) => set("percentOff", v)} />
          ) : null}
          {bundle.pricing === "tiers" || growingPricing(bundle.pricing) ? (
            <s-stack gap="small-200">
              <s-text color="subdued">
                {bundle.pricing === "tiers"
                  ? "Shoppers pick exactly one of these numbers of items, and the bundle costs that tier's price. Make the steps' maximum high enough for the biggest tier."
                  : "Shoppers can pick any number of items; the biggest tier they reach applies, and the bundle shows what one more item would save."}
              </s-text>
              {bundle.tiers.map((t, i) => (
                <s-grid key={i} gridTemplateColumns="1fr 1fr auto" gap="small-200" alignItems="end">
                  <NumberField label={bundle.pricing === "tiers" ? "Items" : "Items or more"} min={1} step={1} value={t.qty} onValue={(v) => set("tiers", bundle.tiers.map((x, j) => (j === i ? { ...x, qty: Math.round(v) } : x)))} />
                  <NumberField
                    label={bundle.pricing === "percent_tiers" ? "Discount" : bundle.pricing === "amount_tiers" ? "Amount off" : "Price"}
                    suffix={bundle.pricing === "percent_tiers" ? "%" : undefined}
                    min={0}
                    max={bundle.pricing === "percent_tiers" ? 90 : undefined}
                    step={bundle.pricing === "percent_tiers" ? 1 : 0.01}
                    value={t.price}
                    onValue={(v) => set("tiers", bundle.tiers.map((x, j) => (j === i ? { ...x, price: v } : x)))}
                  />
                  <Button variant="tertiary" tone="critical" accessibilityLabel={`Remove tier ${i + 1}`} onClick={() => set("tiers", bundle.tiers.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                </s-grid>
              ))}
              <s-stack direction="inline">
                <Button variant="tertiary" icon="plus" onClick={() => set("tiers", [...bundle.tiers, { qty: (bundle.tiers.at(-1)?.qty ?? 0) + (bundle.pricing === "tiers" ? 3 : 1), price: 0 }])}>
                  Add tier
                </Button>
              </s-stack>
            </s-stack>
          ) : null}
          {bundle.pricing === "fixed" || bundle.pricing === "tiers" ? (
            <s-stack gap="small-200">
              <s-text type="strong">Extra charge for pricier options (optional)</s-text>
              <s-text color="subdued">For example XL +5: every XL item in the bundle adds 5 to the bundle price. Matches the option name as shown on the product (size, colour…).</s-text>
              {bundle.extras.map((x, i) => (
                <s-grid key={i} gridTemplateColumns="1fr 1fr auto" gap="small-200" alignItems="end">
                  <TextField label="Option value" placeholder="XL" value={x.value} onValue={(v) => set("extras", bundle.extras.map((y, j) => (j === i ? { ...y, value: v } : y)))} />
                  <NumberField label="Extra per item" min={0} step={0.01} value={x.amount} onValue={(v) => set("extras", bundle.extras.map((y, j) => (j === i ? { ...y, amount: v } : y)))} />
                  <Button variant="tertiary" tone="critical" accessibilityLabel={`Remove extra charge ${i + 1}`} onClick={() => set("extras", bundle.extras.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                </s-grid>
              ))}
              <s-stack direction="inline">
                <Button variant="tertiary" icon="plus" onClick={() => set("extras", [...bundle.extras, { value: "", amount: 0 }])}>
                  Add extra charge
                </Button>
              </s-stack>
            </s-stack>
          ) : null}
        </EditorSection>
        <EditorSection n={5} title="Options" summary={[bundle.storeWide ? "Build your own bundle" : "", bundle.allowDuplicates ? "Same item twice" : "", bundle.hideSoldOut ? "Sold out hidden" : ""].filter(Boolean).join(" · ") || "None"} done={true} open={open === 5} onToggle={() => setOpen((o) => (o === 5 ? 0 : 5))}>
          <Switch
            label="Let shoppers build it anywhere in the store"
            details="“Add to bundle” on product pages and “+” buttons on the step's collection page; a bundle tray follows the shopper until the bundle is complete. Off: only on the bundle product's page."
            checked={bundle.storeWide}
            onValue={(v) => set("storeWide", v)}
          />
          <Checkbox
            label="Allow the same item more than once"
            checked={bundle.allowDuplicates}
            onValue={(v) => set("allowDuplicates", v)}
          />
          <Checkbox label="Hide sold-out items" checked={bundle.hideSoldOut} onValue={(v) => set("hideSoldOut", v)} />
        </EditorSection>
        {!isNew ? (
          <DeleteOffer busy={busy} onDelete={remove}>
            <s-paragraph>{`“${bundle.name}” stops showing on your store. The bundle product itself is not deleted. This cannot be undone.`}</s-paragraph>
          </DeleteOffer>
        ) : null}
      </EditorLayout>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
