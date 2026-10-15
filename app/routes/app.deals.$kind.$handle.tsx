/* eslint-disable @typescript-eslint/no-explicit-any -- App Bridge resource picker payloads are untyped */
import { Fragment, useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage, gql } from "../lib/admin.server";
import { getFbtDesign, resolveDiscountEngine, saveFbtDesign, syncDiscounts } from "../lib/cro.server";
import { deleteDeal, listDeals, saveDeal } from "../lib/deals.server";
import { checkLimit } from "../lib/billing.server";
import { LimitUpgrade } from "../components/Upgrade";
import {
  DEAL_TYPES,
  blankDeal,
  describeDeal,
  isDealKind,
  normalizeFbt,
  validateDeal,
  type FbtDesign,
  type BogoConfig,
  type Deal,
  type FixedConfig,
  type GiftConfig,
  type UpgradeConfig,
  type Target,
  type VolumeConfig,
} from "../lib/deals";
import type { Ref } from "../lib/types";
import { Button, Checkbox, NumberField, Select, Switch, TextField } from "../components/fields";
import { ResourceList } from "../components/ResourceList";
import { SaveControls, changed } from "../components/SaveControls";
import { EditorLayout } from "../components/EditorLayout";
import { EditorSection } from "../components/EditorSection";
import { Segmented } from "../components/ui";
import type { PreviewItem } from "../components/BundlePreview";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const kind = params.kind;
  if (!isDealKind(kind)) throw new Response("Not found", { status: 404 });
  const [{ engine }, shop, fbt] = await Promise.all([
    resolveDiscountEngine(admin),
    gql(admin, `#graphql
      query CroDealShop { shop { currencyCode } }`),
    kind === "fixed" ? getFbtDesign(admin).catch(() => normalizeFbt(null)) : Promise.resolve(null),
  ]);
  const currency: string = shop.shop.currencyCode;
  if (params.handle === "new") return { kind, deal: blankDeal(kind), isNew: true, engine, currency, fbt };
  const deal = (await listDeals(admin)).find((d) => d.handle === params.handle && d.kind === kind);
  if (!deal) throw new Response("Deal not found", { status: 404 });
  return { kind, deal, isNew: false, engine, currency, fbt };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, redirect, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    if (form.get("intent") === "delete") {
      await deleteDeal(admin, String(form.get("id")));
      return redirect(`/app/deals/${params.kind}`);
    }
    const deal = JSON.parse(String(form.get("deal"))) as Deal;
    // Bundles and deals share one limit on smaller plans (lib/plans.ts); a deal can always be saved off.
    const over = await checkLimit(admin, session.shop, "offerSlots", deal);
    if (over) return { ok: false, error: over.error, handle: null, upgrade: true };
    const saved = await saveDeal(admin, deal);
    // The box look is shared by every fixed bundle; saving it re-sends the deals to the store.
    if (form.get("fbt")) {
      await saveFbtDesign(admin, JSON.parse(String(form.get("fbt"))));
      await syncDiscounts(admin);
    }
    return { ok: true, error: null, handle: saved.handle, upgrade: false };
  } catch (e) {
    return { ok: false, error: errorMessage(e), handle: null, upgrade: false };
  }
};

const toProduct = (r: Ref) => ({ id: r.id, title: r.title, image: r.image ?? null, handle: r.handle ?? "" });
const toCollection = (r: Ref) => ({ id: r.id, title: r.title, handle: r.handle ?? "" });

/** "Which products?" — all, specific products, or collections. */
function TargetPicker(props: { label: string; value: Target; onChange: (t: Target) => void; allLabel?: string; productsOnly?: boolean }) {
  const t = props.value;
  return (
    <s-stack gap="base">
      <Select
        label={props.label}
        value={t.type}
        onValue={(v) => props.onChange({ ...t, type: v as Target["type"] })}
        options={
          props.productsOnly
            ? [{ value: "products", label: "Specific products" }]
            : [
                { value: "all", label: props.allLabel ?? "Any product" },
                { value: "products", label: "Specific products" },
                { value: "collections", label: "Products in collections" },
              ]
        }
      />
      {t.type === "products" ? (
        <ResourceList type="product" label="Products" value={t.products} onChange={(v) => props.onChange({ ...t, products: v.map(toProduct) })} />
      ) : null}
      {t.type === "collections" ? (
        <ResourceList
          type="collection"
          label="Collections"
          value={t.collections}
          onChange={(v) => props.onChange({ ...t, collections: v.map(toCollection) })}
        />
      ) : null}
    </s-stack>
  );
}

export default function DealEditor() {
  const { kind, deal: initial, isNew, engine, currency, fbt: initialFbt } = useLoaderData<typeof loader>();
  const t = DEAL_TYPES[kind];
  const [deal, setDeal] = useState<Deal>(initial);
  const [touched, setTouched] = useState(false);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const busy = fetcher.state !== "idle";

  const [fbt, setFbt] = useState<FbtDesign | null>(initialFbt);
  const fbtChanged = !!fbt && changed(fbt, initialFbt);
  const [loaded, setLoaded] = useState(initial);
  if (loaded !== initial) {
    setLoaded(initial);
    setDeal(initial);
    setFbt(initialFbt);
  }
  // Fixed bundles: one step open at a time (a new one starts at 1).
  const [open, setOpen] = useState(isNew ? 1 : 0);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      shopify.toast.show("Saved");
      if (isNew && fetcher.data.handle) navigate(`/app/deals/${kind}/${fetcher.data.handle}`, { replace: true });
    } else if (fetcher.data.error) {
      shopify.toast.show("Could not save. See the message at the top", { isError: true });
    }
  }, [fetcher.state, fetcher.data, shopify, isNew, kind, navigate]);

  const config = deal.config as any;
  const fixedCfg = config as FixedConfig;
  const setConfig = (patch: Record<string, unknown>) => setDeal((d) => ({ ...d, config: { ...d.config, ...patch } as Deal["config"] }));
  const problems = validateDeal(deal);
  const save = () => {
    setTouched(true);
    if (problems.length) return setOpen(1);
    fetcher.submit({ intent: "save", deal: JSON.stringify(deal), ...(fbtChanged ? { fbt: JSON.stringify(fbt) } : {}) }, { method: "post" });
  };
  const remove = () => {
    if (!deal.id || !window.confirm(`Delete “${deal.name}”? This can't be undone.`)) return;
    fetcher.submit({ intent: "delete", id: deal.id }, { method: "post" });
  };

  async function pickVariant(which: "from" | "to") {
    const selected: any = await shopify.resourcePicker({ type: "variant", multiple: false, action: "select" } as any);
    const v = selected?.[0];
    if (!v?.id) return;
    const product = v.product ?? {};
    const vt = v.title && v.title !== "Default Title" ? ` (${v.title})` : "";
    setConfig({ [which]: { variantId: v.id, productId: product.id ?? "", handle: product.handle ?? "", title: `${product.title ?? v.displayName ?? ""}${vt}`, image: v.image?.originalSrc ?? product.images?.[0]?.originalSrc ?? null } });
  }

  async function pickGift() {
    const selected: any = await shopify.resourcePicker({
      type: "product",
      multiple: false,
      action: "select",
      filter: { variants: true, draft: false, archived: false },
    } as any);
    const p = selected?.[0];
    if (!p) return;
    const v = p.variants?.[0];
    if (!v?.id) return;
    const variantTitle = v.title && v.title !== "Default Title" ? ` (${v.title})` : "";
    setConfig({
      gift: { variantId: v.id, title: `${p.title}${variantTitle}`, image: v.image?.originalSrc ?? p.images?.[0]?.originalSrc ?? null, handle: p.handle ?? "" },
    });
  }

  return (
    <s-page heading={isNew ? `New ${t.singular}` : deal.name} inlineSize="large">
      <s-link slot="breadcrumb-actions" href={kind === "fixed" ? "/app/bundles?type=fixed" : `/app/deals/${kind}`}>
        {kind === "fixed" ? "Bundles" : t.title}
      </s-link>
      <SaveControls dirty={changed(deal, initial) || fbtChanged} saving={busy} saved={!isNew} allowLeave={busy || (isNew && !!fetcher.data?.handle)} onSave={save} onDiscard={() => { setDeal(initial); setFbt(initialFbt); setTouched(false); }} />
      {!isNew ? (
        <Button slot="secondary-actions" tone="critical" onClick={remove} disabled={busy}>
          Delete
        </Button>
      ) : null}

      <s-stack gap="base">
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
        {engine === "native" ? (
          <s-banner tone="warning" heading="Not applied at checkout on this store">
            This store uses Shopify&apos;s native discounts (Settings), which can&apos;t run this bundle type.
          </s-banner>
        ) : null}

        {kind === "fixed" && fbt ? (
          <EditorLayout side={<FbtSide deal={deal} fbt={fbt} how={t.how} />}>
            <EditorSection
              n={1}
              title="Items"
              summary={fixedCfg.items.length ? `${deal.name || "Untitled"} · ${fixedCfg.items.length} products` : "No products yet"}
              done={!!deal.name.trim() && fixedCfg.items.length > 1}
              open={open === 1}
              onToggle={() => setOpen((o) => (o === 1 ? 0 : 1))}
              onNext={() => setOpen(2)}
            >
              <s-stack gap="base">
                <TextField label="Name" details="Shoppers see it next to the discount at checkout." value={deal.name} maxLength={60} onValue={(v) => setDeal((d) => ({ ...d, name: v }))} />
                <Switch label="Active" checked={deal.active} onValue={(v) => setDeal((d) => ({ ...d, active: v }))} />
                <ResourceList
                  type="product"
                  label="Products"
                  details="At least 2. The box shows on each of their product pages; the discount applies when all of them are in the cart."
                  value={fixedCfg.items.map((i) => i.product)}
                  onChange={(v) =>
                    setConfig({
                      items: v.map((r) => ({
                        product: toProduct(r),
                        qty: fixedCfg.items.find((i) => i.product.id === r.id)?.qty ?? 1,
                      })),
                    })
                  }
                />
                {fixedCfg.items.map((item, n) => (
                  <NumberField
                    key={item.product.id}
                    label={`How many of ${item.product.title}`}
                    value={item.qty}
                    min={1}
                    max={10}
                    step={1}
                    onValue={(v) => setConfig({ items: fixedCfg.items.map((x, j) => (j === n ? { ...x, qty: v } : x)) })}
                  />
                ))}
              </s-stack>
            </EditorSection>
            <EditorSection n={2} title="Discount" summary={`${fixedCfg.pct}% off when bought together`} done={fixedCfg.pct > 0} open={open === 2} onToggle={() => setOpen((o) => (o === 2 ? 0 : 2))} onNext={() => setOpen(3)}>
              <NumberField label="Discount on the bundle" suffix="%" value={fixedCfg.pct} min={1} max={90} step={1} onValue={(v) => setConfig({ pct: v })} />
            </EditorSection>
            <EditorSection n={3} title="Box look" summary={`“${fbt.heading || "No heading"}” · ${fbt.layout === "row" ? "pictures in a row" : fbt.images ? "list with pictures" : "list"}`} done open={open === 3} onToggle={() => setOpen((o) => (o === 3 ? 0 : 3))}>
              <s-stack gap="base">
                <s-text color="subdued">Shared by every Frequently bought together box on your store.</s-text>
                <Segmented
                  label="Layout"
                  value={fbt.layout}
                  onChange={(v) => setFbt({ ...fbt, layout: v })}
                  options={[
                    { value: "row" as const, label: "Pictures in a row" },
                    { value: "list" as const, label: "List" },
                  ]}
                />
                <TextField label="Heading" value={fbt.heading} maxLength={80} onValue={(v) => setFbt({ ...fbt, heading: v })} />
                <TextField label="Button" details="[count] is the number of items and [price] the bundle price, e.g. Buy all [count]: [price]" value={fbt.button} maxLength={40} onValue={(v) => setFbt({ ...fbt, button: v })} />
                <Checkbox label="Show product pictures" checked={fbt.images} onValue={(v) => setFbt({ ...fbt, images: v })} />
                <Segmented
                  label="Show the saving as"
                  value={fbt.saving}
                  onChange={(v) => setFbt({ ...fbt, saving: v })}
                  options={[
                    { value: "amount" as const, label: "An amount (Save $12)" },
                    { value: "pct" as const, label: "A percentage (15% off)" },
                  ]}
                />
              </s-stack>
            </EditorSection>
          </EditorLayout>
        ) : (
          <EditorLayout
            side={
              <s-section heading="How it works">
                <s-paragraph>{t.how}</s-paragraph>
              </s-section>
            }
          >
            <s-stack gap="base">
          <s-section heading="Summary">
            <s-stack gap="base">
              <s-paragraph>{describeDeal(deal)}</s-paragraph>
              <TextField
                label="Name"
                details="Shoppers see it on the product page and next to the discount at checkout."
                value={deal.name}
                maxLength={60}
                onValue={(v) => setDeal((d) => ({ ...d, name: v }))}
              />
              <Switch label="Active" checked={deal.active} onValue={(v) => setDeal((d) => ({ ...d, active: v }))} />
            </s-stack>
          </s-section>

          {kind === "bogo" ? (
            <>
              <s-section heading="1. Customer buys">
                <s-stack gap="base">
                  <NumberField label="Quantity" value={(config as BogoConfig).x} min={1} max={20} step={1} onValue={(v) => setConfig({ x: v })} />
                  <TargetPicker label="Of" value={(config as BogoConfig).buy} onChange={(v) => setConfig({ buy: v })} />
                </s-stack>
              </s-section>
              <s-section heading="2. Customer gets">
                <s-stack gap="base">
                  <NumberField label="Quantity" value={(config as BogoConfig).y} min={1} max={20} step={1} onValue={(v) => setConfig({ y: v })} />
                  <Checkbox
                    label="From the same products"
                    details="“Buy 2, get 1 free”: of every 3 items, the cheapest is discounted."
                    checked={(config as BogoConfig).sameItems}
                    onValue={(v) => setConfig({ sameItems: v })}
                  />
                  {!(config as BogoConfig).sameItems ? (
                    <TargetPicker label="From" value={(config as BogoConfig).get} onChange={(v) => setConfig({ get: v })} />
                  ) : null}
                  <Select
                    label="At"
                    value={(config as BogoConfig).pct >= 100 ? "free" : "pct"}
                    onValue={(v) => setConfig({ pct: v === "free" ? 100 : 50 })}
                    options={[
                      { value: "free", label: "Free" },
                      { value: "pct", label: "A percentage off" },
                    ]}
                  />
                  {(config as BogoConfig).pct < 100 ? (
                    <NumberField label="Discount" suffix="%" value={(config as BogoConfig).pct} min={1} max={99} step={1} onValue={(v) => setConfig({ pct: v })} />
                  ) : null}
                </s-stack>
              </s-section>
            </>
          ) : null}

          {kind === "volume" ? (
            <>
              <s-section heading="1. Which products count">
                <TargetPicker label="Products" allLabel="All products" value={(config as VolumeConfig).target} onChange={(v) => setConfig({ target: v })} />
              </s-section>
              <s-section heading="2. Tiers">
                <s-stack gap="base">
                  {(config as VolumeConfig).tiers.map((tier, n) => (
                    <s-grid key={n} gridTemplateColumns="1fr 1fr auto" gap="base" alignItems="end">
                      <NumberField
                        label="Items in cart"
                        value={tier.qty}
                        min={2}
                        max={99}
                        step={1}
                        onValue={(v) => setConfig({ tiers: (config as VolumeConfig).tiers.map((x, j) => (j === n ? { ...x, qty: v } : x)) })}
                      />
                      <NumberField
                        label="Discount"
                        suffix="%"
                        value={tier.pct}
                        min={1}
                        max={90}
                        step={1}
                        onValue={(v) => setConfig({ tiers: (config as VolumeConfig).tiers.map((x, j) => (j === n ? { ...x, pct: v } : x)) })}
                      />
                      <Button
                        variant="tertiary"
                        tone="critical"
                        icon="delete"
                        accessibilityLabel={`Remove tier ${n + 1}`}
                        onClick={() => setConfig({ tiers: (config as VolumeConfig).tiers.filter((_, j) => j !== n) })}
                      >
                        Remove
                      </Button>
                    </s-grid>
                  ))}
                  <s-stack direction="inline">
                    <Button
                      icon="plus"
                      disabled={(config as VolumeConfig).tiers.length >= 6}
                      onClick={() => {
                        const tiers = (config as VolumeConfig).tiers;
                        const last = tiers[tiers.length - 1];
                        setConfig({ tiers: [...tiers, { qty: (last?.qty ?? 1) + 1, pct: Math.min(90, (last?.pct ?? 5) + 5) }] });
                      }}
                    >
                      Add tier
                    </Button>
                  </s-stack>
                </s-stack>
              </s-section>
            </>
          ) : null}

          {kind === "upgrade" ? (
            <>
              <s-section heading="1. When the shopper has">
                <s-stack gap="base">
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <Button onClick={() => pickVariant("from")}>{(config as UpgradeConfig).from ? "Change" : "Choose option"}</Button>
                    <s-text>{(config as UpgradeConfig).from?.title ?? "Nothing chosen yet"}</s-text>
                  </s-stack>
                  <s-text color="subdued">The product option shoppers start with, e.g. “Coffee beans, 250 g”.</s-text>
                </s-stack>
              </s-section>
              <s-section heading="2. Offer them">
                <s-stack gap="base">
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <Button onClick={() => pickVariant("to")}>{(config as UpgradeConfig).to ? "Change" : "Choose option"}</Button>
                    <s-text>{(config as UpgradeConfig).to?.title ?? "Nothing chosen yet"}</s-text>
                  </s-stack>
                  <s-text color="subdued">The better option, e.g. “Coffee beans, 1 kg”. It can be another product.</s-text>
                </s-stack>
              </s-section>
              <s-section heading="3. Words">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <TextField label="Offer" details="{to} = the better option, {delta} = how much more it costs" value={(config as UpgradeConfig).text} onValue={(v) => setConfig({ text: v })} />
                  <TextField label="Button" value={(config as UpgradeConfig).button} onValue={(v) => setConfig({ button: v })} />
                </s-grid>
              </s-section>
            </>
          ) : null}

          {kind === "gift" ? (
            <>
              <s-section heading="1. The gift">
                <s-stack gap="base">
                  {(config as GiftConfig).gift ? (
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-thumbnail src={(config as GiftConfig).gift!.image ?? undefined} alt={(config as GiftConfig).gift!.title} size="small-200" />
                      <s-text>{(config as GiftConfig).gift!.title}</s-text>
                    </s-stack>
                  ) : (
                    <s-text color="subdued">No gift chosen yet.</s-text>
                  )}
                  <s-stack direction="inline">
                    <Button icon="product" onClick={pickGift}>
                      {(config as GiftConfig).gift ? "Change gift" : "Choose gift"}
                    </Button>
                  </s-stack>
                </s-stack>
              </s-section>
              <s-section heading="2. When shoppers get it">
                <s-stack gap="base">
                  <NumberField
                    label="Cart total at least"
                    suffix={currency}
                    details="Not counting the gift itself. Shoppers paying in other currencies get the converted amount."
                    value={(config as GiftConfig).min}
                    min={0}
                    step={1}
                    onValue={(v) => setConfig({ min: v })}
                  />
                  <Checkbox
                    label="Only when the cart has certain products"
                    checked={!!(config as GiftConfig).onlyWith}
                    onValue={(v) => setConfig({ onlyWith: v ? { type: "products", products: [], collections: [] } : null })}
                  />
                  {(config as GiftConfig).onlyWith ? (
                    <TargetPicker label="Products" productsOnly value={(config as GiftConfig).onlyWith!} onChange={(v) => setConfig({ onlyWith: v })} />
                  ) : null}
                </s-stack>
              </s-section>
            </>
          ) : null}

            </s-stack>
          </EditorLayout>
        )}
      </s-stack>
    </s-page>
  );
}

/** The box as it shows on a product page, with the items' real prices. */
function FbtSide({ deal, fbt, how }: { deal: Deal; fbt: FbtDesign; how: string }) {
  const cfg = deal.config as FixedConfig;
  const prices = useFetcher<{ items: Record<string, PreviewItem[]>; currency: string }>();
  const idsKey = cfg.items.map((i) => i.product.id).sort().join(",");
  useEffect(() => {
    if (idsKey) prices.load(`/app/bundles/preview-items?ids=${encodeURIComponent(idsKey)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the items change
  }, [idsKey]);
  const found = prices.data?.items ?? {};
  const money = (cents: number) => {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency: prices.data?.currency ?? "USD" }).format(cents / 100);
    } catch {
      return (cents / 100).toFixed(2);
    }
  };
  const total = cfg.items.reduce((n, i) => n + (found[i.product.id]?.[0]?.cents ?? 0) * i.qty, 0);
  const saving = Math.round((total * cfg.pct) / 100);
  const row = fbt.layout === "row";
  const items = cfg.items.length ? cfg.items : [{ product: { id: "a", title: "First product", image: null, handle: "" }, qty: 1 }, { product: { id: "b", title: "Second product", image: null, handle: "" }, qty: 1 }];
  const count = items.reduce((n, i) => n + i.qty, 0);
  return (
    <s-stack gap="base">
      <s-section heading="Preview">
        <s-stack gap="small-300">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, border: "1px solid #e3e3e3", borderRadius: 12 }}>
            {fbt.heading ? <strong style={{ fontSize: 16 }}>{fbt.heading}</strong> : null}
            {row && fbt.images ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {items.map((i, n) => (
                  <Fragment key={i.product.id}>
                    {n ? <span style={{ fontSize: 22, opacity: 0.6 }}>+</span> : null}
                    <span style={{ flex: "1 1 0", maxWidth: 140, aspectRatio: "1", borderRadius: 12, background: i.product.image ? `#f4f4f4 center / 84% no-repeat url(${i.product.image}${i.product.image.includes("?") ? "&" : "?"}width=300)` : n % 2 ? "linear-gradient(145deg,#bde0fe,#6c9bd2)" : "linear-gradient(145deg,#ffd6a5,#f4a261)" }} />
                  </Fragment>
                ))}
              </div>
            ) : null}
            {items.map((i, n) => (
              <div key={i.product.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: row ? 13 : undefined }}>
                {fbt.images && !row ? (
                  <span style={{ width: 48, height: 48, flex: "none", borderRadius: 8, background: i.product.image ? `center / cover no-repeat url(${i.product.image}${i.product.image.includes("?") ? "&" : "?"}width=120)` : n % 2 ? "linear-gradient(145deg,#bde0fe,#6c9bd2)" : "linear-gradient(145deg,#ffd6a5,#f4a261)" }} />
                ) : null}
                <span style={{ flex: 1, fontSize: 14 }}>{`${i.qty > 1 ? `${i.qty} × ` : ""}${i.product.title}`}</span>
                <span style={{ fontSize: 14 }}>{found[i.product.id]?.[0] ? money(found[i.product.id][0].cents * i.qty) : ""}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span>{total ? <><strong>{money(total - saving)}</strong> <s style={{ color: "#8a8a8a" }}>{money(total)}</s></> : null}</span>
              <span style={{ padding: "2px 8px", borderRadius: 999, background: "#e3f1e6", color: "#1a7f37", fontWeight: 700, fontSize: 12 }}>{fbt.saving === "pct" ? `${cfg.pct}% off` : total ? `Save ${money(saving)}` : `Save ${cfg.pct}%`}</span>
            </div>
            <span style={{ padding: "10px 12px", textAlign: "center", borderRadius: 999, background: "#121212", color: "#fff", fontWeight: 600, fontSize: 14 }}>
              {fbt.button.replace(/\[count\]/g, String(count)).replace(/\[price\]/g, total ? money(total - saving) : "$0.00")}
            </span>
          </div>
          <s-text color="subdued">A sketch; on your store it takes your theme&apos;s fonts and colours.</s-text>
        </s-stack>
      </s-section>
      <s-section heading="How it works">
        <s-paragraph>{how}</s-paragraph>
      </s-section>
    </s-stack>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
