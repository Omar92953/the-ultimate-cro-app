/**
 * Checkout → Payment & delivery rules (/app/checkout/payment, /delivery) and Order limits (/limits).
 * Rules are saved on the app's customization in the store and run by the cro-payment, cro-delivery
 * and cro-validation Functions at checkout (see app/lib/checkout-rules.ts).
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage, gql } from "../lib/admin.server";
import { getCheckoutRules, saveCheckoutRules } from "../lib/checkout-rules.server";
import { checkCheckoutRules } from "../lib/billing.server";
import { LimitUpgrade } from "../components/Upgrade";
import { CUSTOMERS, LIMIT_KINDS, describeChange, newChangeRule, newLimitRule, type ChangeRule, type CheckoutKind, type LimitRule, type Picked } from "../lib/checkout-rules";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { Button, NumberField, Select, Switch, TextArea, TextField } from "../components/fields";
import { Explainer } from "../components/ui";
import { SaveControls } from "../components/SaveControls";

type PageKind = "payment" | "delivery" | "limits";
const KIND: Record<PageKind, CheckoutKind> = { payment: "payment", delivery: "delivery", limits: "validation" };
const pageKind = (v: unknown): PageKind | null => (v === "payment" || v === "delivery" || v === "limits" ? v : null);

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const page = pageKind(params.kind);
  if (!page) throw new Response("Not found", { status: 404 });
  const { admin } = await authenticate.admin(request);
  const [rules, shop] = await Promise.all([
    getCheckoutRules(admin).catch((e) => ({ error: errorMessage(e) })),
    gql(admin, `#graphql
      query CroShopCurrency { shop { currencyCode } }`).catch(() => null),
  ]);
  if ("error" in rules) return { page, error: rules.error, set: null, currency: "USD" };
  return { page, error: null, set: rules[KIND[page]], currency: (shop?.shop?.currencyCode as string) ?? "USD" };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const page = pageKind(params.kind);
  if (!page) throw new Response("Not found", { status: 404 });
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const rules = JSON.parse(String(form.get("rules") ?? "[]")) as { on?: boolean }[];
    // Checkout rules count together across payment, delivery and order limits (plans.ts checkoutRules).
    const limit = await checkCheckoutRules(admin, session.shop, KIND[page], rules.filter((r) => r.on).length);
    if (limit) return { ok: false as const, error: limit.error, saved: null, upgrade: true };
    const saved = await saveCheckoutRules(admin, KIND[page], rules, form.get("enabled") !== "false");
    return { ok: true as const, error: null, saved, upgrade: false };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e), saved: null, upgrade: false };
  }
};

const TEXT = {
  payment: {
    heading: "Payment rules",
    what: "Hide, rename or reorder the payment methods shoppers see at checkout, depending on the order.",
    how: "Each rule picks the payment methods whose name contains your text, and changes them when every condition you set is met. Rules run from top to bottom.",
    example: "Hide “Cash on Delivery” when the order is over EGP 5,000 or for a first order.",
    what1: "payment method" as const,
    match: "Payment method name contains",
    matchHelp: "As it appears at checkout, e.g. Cash on Delivery, PayPal, Bank transfer.",
  },
  delivery: {
    heading: "Delivery rules",
    what: "Hide, rename or reorder the delivery options shoppers see at checkout, depending on the order.",
    how: "Each rule picks the delivery options whose name contains your text, and changes them when every condition you set is met. The cheapest option stays first and selected, as Shopify requires.",
    example: "Hide “Express” when the cart has a fragile product, or rename “Standard” to “Free delivery in 2–3 days” over EGP 1,500.",
    what1: "delivery option" as const,
    match: "Delivery option name contains",
    matchHelp: "As it appears at checkout, e.g. Standard, Express, Local pickup. Shopify keeps a carrier's name in front of a renamed option.",
  },
};

export default function CheckoutRules() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [enabled, setEnabled] = useState(data.set?.enabled ?? true);
  const [rules, setRules] = useState<(ChangeRule | LimitRule)[]>(data.set?.rules ?? []);
  // Unsaved changes: the rules differ from the last successful save (or from the page load).
  const [sent, setSent] = useState(JSON.stringify(data.set?.rules ?? []));
  const saved = fetcher.data?.ok ? sent : JSON.stringify(data.set?.rules ?? []);
  const dirty = JSON.stringify(rules) !== saved;
  const page = data.page;

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show("Saved");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const money = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: data.currency, maximumFractionDigits: 0 }).format(n);
    } catch {
      return String(n);
    }
  };
  const change = (list: (ChangeRule | LimitRule)[]) => setRules(list);
  const update = (id: string, patch: Partial<ChangeRule> | Partial<LimitRule>) => change(rules.map((r) => (r.id === id ? ({ ...r, ...patch } as ChangeRule | LimitRule) : r)));
  const move = (i: number, d: number) => {
    const list = [...rules];
    const [r] = list.splice(i, 1);
    list.splice(i + d, 0, r);
    change(list);
  };
  const save = (on = enabled) => {
    setSent(JSON.stringify(rules));
    fetcher.submit({ rules: JSON.stringify(rules), enabled: String(on) }, { method: "post" });
  };
  async function pickProducts(current: Picked[]): Promise<Picked[] | null> {
    const selected = (await shopify.resourcePicker({ type: "product", multiple: true, action: "select", selectionIds: current.map((p) => ({ id: p.id })) } as Parameters<typeof shopify.resourcePicker>[0])) as { id: string; title: string }[] | undefined;
    return selected ? selected.map((p) => ({ id: p.id, title: p.title })) : null;
  }

  const feature = page === "limits" ? "order_limits" : page === "delivery" ? "delivery_rules" : "payment_rules";
  const heading = page === "limits" ? "Order limits" : TEXT[page].heading;

  return (
    <s-page heading={heading} inlineSize="large">
      <CategoryCrumb feature={feature} />
      <SaveControls dirty={dirty} saving={fetcher.state !== "idle"} onSave={() => save()} onDiscard={() => setRules(JSON.parse(saved))} />
      <s-stack gap="base">
        <FeatureTabs feature={feature} />
        {page === "limits" ? (
          <Explainer
            what="Stop orders that break your limits, with your own message at checkout."
            how="A minimum order, a maximum per product, or a number of items. When the cart breaks a limit, checkout shows the message and the shopper can't pay until they fix the cart."
            example="“The minimum order is EGP 300.” or “Face masks: you can order up to 5.”"
          />
        ) : (
          <Explainer what={TEXT[page].what} how={TEXT[page].how} example={TEXT[page].example} />
        )}
        {fetcher.data?.upgrade ? (
          <s-banner tone="warning" heading="Plan limit reached">
            <s-stack gap="small-200">
              <s-text>{fetcher.data.error}</s-text>
              <LimitUpgrade show />
            </s-stack>
          </s-banner>
        ) : null}
        {data.error ? (
          <s-banner tone="critical" heading="Checkout rules could not be read">
            {data.error} If this mentions access, open the app again from your Shopify admin to accept the new permissions.
          </s-banner>
        ) : null}

        <s-section>
          <s-stack gap="small-200">
            <Switch
              label={enabled ? "Rules are on at checkout" : "Rules are off"}
              checked={enabled}
              onValue={(v) => {
                setEnabled(v);
                save(v);
              }}
            />
            <s-text color="subdued">
              {page === "payment"
                ? "Shopify decides which payment changes a plan allows; some, like renaming, may not apply on every plan or country."
                : page === "delivery"
                  ? "Shopify requires the cheapest option to stay selected first, so rules never hide the cheapest option or move another one above it. The last option is never hidden either."
                  : "Limits are checked at checkout. Use {limit} for the number and {product} for the product's name in a message."}
            </s-text>
          </s-stack>
        </s-section>

        {rules.length === 0 ? (
          <s-section>
            <s-paragraph>No rules yet.</s-paragraph>
          </s-section>
        ) : null}

        {rules.map((r, i) =>
          page === "limits" ? (
            <LimitCard key={r.id} r={r as LimitRule} i={i} count={rules.length} money={money} currency={data.currency} update={update} move={move} remove={() => change(rules.filter((x) => x.id !== r.id))} pick={pickProducts} />
          ) : (
            <ChangeCard key={r.id} r={r as ChangeRule} i={i} count={rules.length} page={page} money={money} currency={data.currency} update={update} move={move} remove={() => change(rules.filter((x) => x.id !== r.id))} pick={pickProducts} />
          ),
        )}

        <s-stack direction="inline" gap="base">
          <Button icon="plus" disabled={rules.length >= 25} onClick={() => change([...rules, page === "limits" ? newLimitRule() : newChangeRule(page)])}>
            Add a rule
          </Button>
        </s-stack>
      </s-stack>
    </s-page>
  );
}

type CardProps<R> = {
  r: R;
  i: number;
  count: number;
  money: (n: number) => string;
  currency: string;
  update: (id: string, patch: Partial<R>) => void;
  move: (i: number, d: number) => void;
  remove: () => void;
  pick: (current: Picked[]) => Promise<Picked[] | null>;
};

function RuleActions({ i, count, move, remove }: { i: number; count: number; move: (i: number, d: number) => void; remove: () => void }) {
  return (
    <s-stack direction="inline" gap="small-200">
      <Button variant="tertiary" icon="arrow-up" accessibilityLabel="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
        Up
      </Button>
      <Button variant="tertiary" icon="arrow-down" accessibilityLabel="Move down" disabled={i === count - 1} onClick={() => move(i, 1)}>
        Down
      </Button>
      <Button variant="tertiary" tone="critical" icon="delete" onClick={remove}>
        Remove
      </Button>
    </s-stack>
  );
}

function Products({ picked, onPick, label }: { picked: Picked[]; onPick: () => void; label: string }) {
  return (
    <s-stack gap="small-100">
      <s-text type="strong">{label}</s-text>
      <s-text color="subdued">{picked.length ? picked.map((p) => p.title).join(", ") : "Any product"}</s-text>
      <s-stack direction="inline" gap="small-200">
        <Button onClick={onPick}>{picked.length ? "Change products" : "Choose products"}</Button>
      </s-stack>
    </s-stack>
  );
}

function ChangeCard({ r, i, count, page, money, currency, update, move, remove, pick }: CardProps<ChangeRule> & { page: "payment" | "delivery" }) {
  const t = TEXT[page];
  const [countries, setCountries] = useState(r.when.countries.join(", "));
  const when = (patch: Partial<ChangeRule["when"]>) => update(r.id, { when: { ...r.when, ...patch } });
  return (
    <s-section heading={`Rule ${i + 1}`}>
      <s-stack gap="base">
        <s-text color="subdued">{describeChange(r, t.what1, money)}</s-text>
        <Switch label="On" checked={r.on} onValue={(on) => update(r.id, { on })} />
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <TextField label={t.match} details={t.matchHelp} value={r.match} maxLength={80} onValue={(match) => update(r.id, { match })} />
          <Select
            label="Do this"
            value={r.action}
            options={[
              { value: "hide", label: "Hide it" },
              { value: "rename", label: "Rename it" },
              { value: "move", label: "Move it" },
            ]}
            onValue={(v) => update(r.id, { action: v as ChangeRule["action"] })}
          />
        </s-grid>
        {r.action === "rename" ? <TextField label="New name" value={r.name} maxLength={100} onValue={(name) => update(r.id, { name })} /> : null}
        {r.action === "move" ? <NumberField label="New position" details="1 = first in the list" min={1} max={20} step={1} value={r.index + 1} onValue={(v) => update(r.id, { index: Math.max(0, Math.round(v) - 1) })} /> : null}
        <s-divider />
        <s-text type="strong">Only when (leave empty for always)</s-text>
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <NumberField label="Order total at least" suffix={currency} min={0} step={1} value={r.when.min} onValue={(min) => when({ min: Math.max(0, min) })} />
          <NumberField label="Order total at most" suffix={currency} min={0} step={1} value={r.when.max} onValue={(max) => when({ max: Math.max(0, max) })} />
          <TextField
            label="Shipping to countries"
            details="Two-letter codes, e.g. EG, SA, AE"
            value={countries}
            onValue={(v) => {
              setCountries(v);
              when({ countries: v.split(/[\s,]+/).map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)) });
            }}
          />
          <Select label="Shopper" value={r.when.customer} options={CUSTOMERS} onValue={(v) => when({ customer: v as ChangeRule["when"]["customer"] })} />
        </s-grid>
        <Products
          label="Cart has any of these products"
          picked={r.picked}
          onPick={async () => {
            const p = await pick(r.picked);
            if (p) update(r.id, { picked: p, when: { ...r.when, products: p.map((x) => x.id) } });
          }}
        />
        <RuleActions i={i} count={count} move={move} remove={remove} />
      </s-stack>
    </s-section>
  );
}

function LimitCard({ r, i, count, money, currency, update, move, remove, pick }: CardProps<LimitRule>) {
  const k = LIMIT_KINDS.find((x) => x.value === r.kind)!;
  const preview = (r.message || k.message).replace(/\{limit\}/g, k.unit === "money" ? money(r.value) : String(r.value)).replace(/\{product\}/g, r.picked[0]?.title ?? "Classic tee");
  return (
    <s-section heading={`Limit ${i + 1}`}>
      <s-stack gap="base">
        <Switch label="On" checked={r.on} onValue={(on) => update(r.id, { on })} />
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <Select label="Limit" value={r.kind} options={LIMIT_KINDS} onValue={(v) => update(r.id, { kind: v as LimitRule["kind"] })} />
          <NumberField label={k.unit === "money" ? "Amount" : "Quantity"} suffix={k.unit === "money" ? currency : "items"} min={0} step={1} value={r.value} onValue={(value) => update(r.id, { value: Math.max(0, value) })} />
        </s-grid>
        {k.perProduct ? (
          <Products
            label="For these products"
            picked={r.picked}
            onPick={async () => {
              const p = await pick(r.picked);
              if (p) update(r.id, { picked: p, products: p.map((x) => x.id) });
            }}
          />
        ) : null}
        <TextArea label="Message at checkout" details={`Empty uses: ${k.message}`} rows={2} maxLength={250} placeholder={k.message} value={r.message} onValue={(message) => update(r.id, { message })} />
        <s-banner tone="warning">{preview}</s-banner>
        <RuleActions i={i} count={count} move={move} remove={remove} />
      </s-stack>
    </s-section>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
