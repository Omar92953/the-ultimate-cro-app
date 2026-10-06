/* eslint-disable @typescript-eslint/no-explicit-any -- App Bridge resource picker payloads are untyped */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage, gql } from "../lib/admin.server";
import { resolveDiscountEngine } from "../lib/cro.server";
import { deleteDeal, listDeals, saveDeal } from "../lib/deals.server";
import {
  DEAL_TYPES,
  blankDeal,
  describeDeal,
  isDealKind,
  validateDeal,
  type BogoConfig,
  type Deal,
  type FixedConfig,
  type GiftConfig,
  type Target,
  type VolumeConfig,
} from "../lib/deals";
import type { Ref } from "../lib/types";
import { Button, Checkbox, NumberField, Select, Switch, TextField } from "../components/fields";
import { ResourceList } from "../components/ResourceList";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const kind = params.kind;
  if (!isDealKind(kind)) throw new Response("Not found", { status: 404 });
  const [{ engine }, shop] = await Promise.all([
    resolveDiscountEngine(admin),
    gql(admin, `#graphql
      query CroDealShop { shop { currencyCode } }`),
  ]);
  const currency: string = shop.shop.currencyCode;
  if (params.handle === "new") return { kind, deal: blankDeal(kind), isNew: true, engine, currency };
  const deal = (await listDeals(admin)).find((d) => d.handle === params.handle && d.kind === kind);
  if (!deal) throw new Response("Deal not found", { status: 404 });
  return { kind, deal, isNew: false, engine, currency };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, redirect } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    if (form.get("intent") === "delete") {
      await deleteDeal(admin, String(form.get("id")));
      return redirect(`/app/deals/${params.kind}`);
    }
    const saved = await saveDeal(admin, JSON.parse(String(form.get("deal"))) as Deal);
    return { ok: true, error: null, handle: saved.handle };
  } catch (e) {
    return { ok: false, error: errorMessage(e), handle: null };
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
  const { kind, deal: initial, isNew, engine, currency } = useLoaderData<typeof loader>();
  const t = DEAL_TYPES[kind];
  const [deal, setDeal] = useState<Deal>(initial);
  const [touched, setTouched] = useState(false);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const busy = fetcher.state !== "idle";

  const [loaded, setLoaded] = useState(initial);
  if (loaded !== initial) {
    setLoaded(initial);
    setDeal(initial);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      shopify.toast.show("Bundle saved");
      if (isNew && fetcher.data.handle) navigate(`/app/deals/${kind}/${fetcher.data.handle}`, { replace: true });
    } else if (fetcher.data.error) {
      shopify.toast.show("Could not save — see the message at the top", { isError: true });
    }
  }, [fetcher.state, fetcher.data, shopify, isNew, kind, navigate]);

  const config = deal.config as any;
  const setConfig = (patch: Record<string, unknown>) => setDeal((d) => ({ ...d, config: { ...d.config, ...patch } as Deal["config"] }));
  const problems = validateDeal(deal);
  const save = () => {
    setTouched(true);
    if (problems.length) return;
    fetcher.submit({ intent: "save", deal: JSON.stringify(deal) }, { method: "post" });
  };
  const remove = () => {
    if (!deal.id || !window.confirm(`Delete “${deal.name}”? This can't be undone.`)) return;
    fetcher.submit({ intent: "delete", id: deal.id }, { method: "post" });
  };

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
    const variantTitle = v.title && v.title !== "Default Title" ? ` — ${v.title}` : "";
    setConfig({
      gift: { variantId: v.id, title: `${p.title}${variantTitle}`, image: v.image?.originalSrc ?? p.images?.[0]?.originalSrc ?? null, handle: p.handle ?? "" },
    });
  }

  return (
    <s-page heading={isNew ? `New ${t.singular}` : deal.name} inlineSize="large">
      <s-link slot="breadcrumb-actions" href={`/app/deals/${kind}`}>
        {t.title}
      </s-link>
      <Button slot="primary-action" variant="primary" onClick={save} loading={busy}>
        Save
      </Button>
      {!isNew ? (
        <Button slot="secondary-actions" tone="critical" onClick={remove} disabled={busy}>
          Delete
        </Button>
      ) : null}

      <s-stack gap="base">
        {fetcher.data?.error ? (
          <s-banner tone="critical" heading="The bundle was not saved">
            {fetcher.data.error}
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

        {kind === "fixed" ? (
          <s-section heading="Products in the bundle">
            <s-stack gap="base">
              <ResourceList
                type="product"
                label="Products"
                details="At least 2. The discount applies when all of them are in the cart."
                value={(config as FixedConfig).items.map((i) => i.product)}
                onChange={(v) =>
                  setConfig({
                    items: v.map((r) => ({
                      product: toProduct(r),
                      qty: (config as FixedConfig).items.find((i) => i.product.id === r.id)?.qty ?? 1,
                    })),
                  })
                }
              />
              {(config as FixedConfig).items.map((item, n) => (
                <NumberField
                  key={item.product.id}
                  label={`How many of ${item.product.title}`}
                  value={item.qty}
                  min={1}
                  max={10}
                  step={1}
                  onValue={(v) => setConfig({ items: (config as FixedConfig).items.map((x, j) => (j === n ? { ...x, qty: v } : x)) })}
                />
              ))}
              <NumberField label="Discount on the bundle" suffix="%" value={(config as FixedConfig).pct} min={1} max={90} step={1} onValue={(v) => setConfig({ pct: v })} />
            </s-stack>
          </s-section>
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

        <s-section heading="How it works">
          <s-paragraph>{t.how}</s-paragraph>
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
