/**
 * Create or edit a bundle product ("kit"). Saving builds the product in Shopify (Shopify's own
 * fixed bundles) and sets its prices. See lib/kits.server.ts.
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage, numericId } from "../lib/admin.server";
import { deleteKit, listKits, saveKit } from "../lib/kits.server";
import { blankKit, productNumber, validateKit, type Kit } from "../lib/kits";
import { checkLimit } from "../lib/billing.server";
import { Button, Checkbox, NumberField, Select, TextField } from "../components/fields";
import { ResourceList } from "../components/ResourceList";
import { LimitUpgrade } from "../components/Upgrade";
import { SaveControls, changed } from "../components/SaveControls";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  if (params.id === "new") return { kit: blankKit(), row: null, isNew: true };
  const row = (await listKits(admin)).find((k) => numericId(k.productId) === params.id);
  if (!row) throw new Response("Bundle product not found", { status: 404 });
  const kit: Kit = { productId: row.productId, title: row.title, items: row.items, pricing: row.pricing, pct: row.pct, price: row.price, compareAt: row.compareAt };
  return { kit, row: { status: row.status, handle: row.handle, variants: row.variants }, isNew: false };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    if (form.get("intent") === "delete") {
      await deleteKit(admin, String(form.get("productId")));
      return { ok: true, error: null, id: null, deleted: true, upgrade: false };
    }
    const kit = JSON.parse(String(form.get("kit"))) as Kit;
    if (!kit.productId) {
      const over = await checkLimit(admin, session.shop, "offerSlots", { active: true, handle: null });
      if (over) return { ok: false, error: over.error, id: null, deleted: false, upgrade: true };
    }
    const saved = await saveKit(admin, kit);
    return { ok: true, error: null, id: numericId(saved.productId!), deleted: false, upgrade: false };
  } catch (e) {
    return { ok: false, error: errorMessage(e), id: null, deleted: false, upgrade: false };
  }
};

export default function KitEditor() {
  const { kit: initial, row, isNew } = useLoaderData<typeof loader>();
  const [kit, setKit] = useState<Kit>(initial);
  const [touched, setTouched] = useState(false);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const busy = fetcher.state !== "idle";

  const [loaded, setLoaded] = useState(initial);
  if (loaded !== initial) {
    setLoaded(initial);
    setKit(initial);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.deleted) {
      shopify.toast.show("Bundle product deleted");
      navigate("/app/kits");
    } else if (fetcher.data.ok) {
      shopify.toast.show("Saved");
      if (isNew && fetcher.data.id) navigate(`/app/kits/${fetcher.data.id}`, { replace: true });
    } else if (fetcher.data.error) {
      shopify.toast.show("Could not save. See the message at the top", { isError: true });
    }
  }, [fetcher.state, fetcher.data, shopify, isNew, navigate]);

  const set = <K extends keyof Kit>(key: K, value: Kit[K]) => setKit((k) => ({ ...k, [key]: value }));
  const problems = validateKit(kit);
  const save = () => {
    setTouched(true);
    if (problems.length) return;
    fetcher.submit({ intent: "save", kit: JSON.stringify(kit) }, { method: "post" });
  };
  const remove = () => {
    if (!kit.productId || !window.confirm(`Delete “${kit.title}”? Its product is deleted in Shopify too (the items themselves are not touched).`)) return;
    fetcher.submit({ intent: "delete", productId: kit.productId }, { method: "post" });
  };

  return (
    <s-page heading={isNew ? "New bundle product" : kit.title} inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/kits">
        Bundle products
      </s-link>
      <SaveControls dirty={changed(kit, initial)} saving={busy} saved={!isNew} label={isNew ? "Create in Shopify" : "Save"} allowLeave={busy || !!fetcher.data?.deleted || (isNew && !!fetcher.data?.id)} onSave={save} onDiscard={() => { setKit(initial); setTouched(false); }} />
      {!isNew ? (
        <Button slot="secondary-actions" href={`shopify://admin/products/${productNumber(kit.productId ?? "")}`} target="_top">
          Photos, description and publishing
        </Button>
      ) : null}
      {!isNew ? (
        <Button slot="secondary-actions" tone="critical" onClick={remove} disabled={busy}>
          Delete
        </Button>
      ) : null}

      <s-stack gap="base">
        {fetcher.data?.error ? (
          <s-banner tone="critical" heading="The bundle product was not saved">
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
        {row && row.status !== "ACTIVE" ? (
          <s-banner tone="info" heading="Not on your store yet">
            Shopify created the bundle as a draft. Add photos and a description, then set it to Active in Products to sell it.
          </s-banner>
        ) : null}

        <s-section heading="Bundle product">
          <s-stack gap="base">
            <TextField label="Name" details="The product's title on your store." value={kit.title} onValue={(v) => set("title", v)} />
            <ResourceList
              type="product"
              label="Items in the bundle"
              details="Up to 30. Each item's sizes, colours… become options on the bundle's page. Its stock comes from these items."
              value={kit.items.map((i) => ({ id: i.productId, title: i.title, image: i.image }))}
              onChange={(v) => set("items", v.map((r) => kit.items.find((i) => i.productId === r.id) ?? { productId: r.id, title: r.title, image: r.image ?? null, qty: 1 }))}
            />
            {kit.items.length ? (
              <s-grid gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap="small-200">
                {kit.items.map((item, i) => (
                  <NumberField
                    key={item.productId}
                    label={`How many “${item.title}”`}
                    min={1}
                    max={99}
                    step={1}
                    value={item.qty}
                    onValue={(v) => set("items", kit.items.map((x, j) => (j === i ? { ...x, qty: Math.round(v) } : x)))}
                  />
                ))}
              </s-grid>
            ) : null}
          </s-stack>
        </s-section>

        <s-section heading="Price">
          <s-stack gap="base">
            <Select
              label="Bundle price"
              value={kit.pricing}
              onValue={(v) => set("pricing", v === "fixed" ? "fixed" : "percent")}
              options={[
                { value: "percent", label: "A percentage off the items' total (pricier options cost more)" },
                { value: "fixed", label: "One fixed price for every option" },
              ]}
            />
            {kit.pricing === "percent" ? (
              <NumberField label="Discount" suffix="%" min={0} max={90} step={1} value={kit.pct} onValue={(v) => set("pct", v)} />
            ) : (
              <NumberField label="Price" min={0} step={0.01} value={kit.price} onValue={(v) => set("price", v)} />
            )}
            <Checkbox
              label="Show the items' total as the compare-at price (“was … now …”)"
              details="Kept up to date by itself when an item's price changes."
              checked={kit.compareAt}
              onValue={(v) => set("compareAt", v)}
            />
          </s-stack>
        </s-section>

        {row?.variants.length ? (
          <s-section heading="Prices in Shopify now" padding="none">
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Option</s-table-header>
                <s-table-header format="numeric">Price</s-table-header>
                <s-table-header format="numeric">Compare at</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {row.variants.slice(0, 50).map((v) => (
                  <s-table-row key={v.title}>
                    <s-table-cell>{v.title === "Default Title" ? "Default" : v.title}</s-table-cell>
                    <s-table-cell>{v.price}</s-table-cell>
                    <s-table-cell>{v.compareAtPrice ?? "None"}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          </s-section>
        ) : null}
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
