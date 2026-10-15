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
import { blankKit, kitVariantPrice, productNumber, validateKit, type Kit } from "../lib/kits";
import { EditorLayout } from "../components/EditorLayout";
import { EditorSection } from "../components/EditorSection";
import type { PreviewItem } from "../components/BundlePreview";
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
      navigate("/app/bundles?type=kit");
    } else if (fetcher.data.ok) {
      shopify.toast.show("Saved");
      if (isNew && fetcher.data.id) navigate(`/app/kits/${fetcher.data.id}`, { replace: true });
    } else if (fetcher.data.error) {
      shopify.toast.show("Could not save. See the message at the top", { isError: true });
    }
  }, [fetcher.state, fetcher.data, shopify, isNew, navigate]);

  const set = <K extends keyof Kit>(key: K, value: Kit[K]) => setKit((k) => ({ ...k, [key]: value }));
  const problems = validateKit(kit);
  // One step open at a time; a new kit starts at step 1.
  const [open, setOpen] = useState(isNew ? 1 : 0);
  const save = () => {
    setTouched(true);
    if (problems.length) return setOpen(problems.some((p) => /price|discount/i.test(p)) && !problems.some((p) => /item|name|product/i.test(p)) ? 2 : 1);
    fetcher.submit({ intent: "save", kit: JSON.stringify(kit) }, { method: "post" });
  };
  // Live preview: the items' real pictures and prices (fetched as the items change).
  const previews = useFetcher<{ items: Record<string, PreviewItem[]>; currency: string }>();
  const idsKey = kit.items.map((i) => i.productId).sort().join(",");
  useEffect(() => {
    if (idsKey) previews.load(`/app/bundles/preview-items?ids=${encodeURIComponent(idsKey)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the items change
  }, [idsKey]);
  const found = previews.data?.items ?? {};
  const totalCents = kit.items.reduce((n, i) => n + (found[i.productId]?.[0]?.cents ?? 0) * i.qty, 0);
  const priced = totalCents ? kitVariantPrice(kit, totalCents / 100) : null;
  const money = (amount: string | number) => {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency: previews.data?.currency ?? "USD" }).format(Number(amount));
    } catch {
      return String(amount);
    }
  };
  const picture = kit.items.find((i) => i.image)?.image ?? null;

  const remove = () => {
    if (!kit.productId || !window.confirm(`Delete “${kit.title}”? Its product is deleted in Shopify too (the items themselves are not touched).`)) return;
    fetcher.submit({ intent: "delete", productId: kit.productId }, { method: "post" });
  };

  return (
    <s-page heading={isNew ? "New bundle product" : kit.title} inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/bundles?type=kit">
        Bundles
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
            It&apos;s still a draft. CRO Toolbox publishes new bundle products itself once you approve its new permission (open the app from Apps). You can also set it to Active in Products.
          </s-banner>
        ) : null}

        <EditorLayout
          side={
            <>
              <s-section heading="On your store">
                <s-stack gap="small-300">
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, border: "1px solid #e3e3e3", borderRadius: 12 }}>
                    <div style={{ aspectRatio: "1 / 1", borderRadius: 8, background: picture ? `center / cover no-repeat url(${picture}${picture.includes("?") ? "&" : "?"}width=500)` : "linear-gradient(145deg,#f1f1f1,#e3e3e3)" }} />
                    <strong style={{ fontSize: 15 }}>{kit.title || "Bundle product"}</strong>
                    <span style={{ fontSize: 15 }}>
                      {priced ? money(priced.price) : "Price shows once items are chosen"}{" "}
                      {priced?.compareAtPrice ? <s style={{ color: "#8a8a8a" }}>{money(priced.compareAtPrice)}</s> : null}
                    </span>
                    {kit.items.length ? (
                      <div style={{ fontSize: 13, color: "#616161" }}>
                        What&apos;s inside:
                        <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                          {kit.items.map((i) => (
                            <li key={i.productId}>{`${i.qty > 1 ? `${i.qty} × ` : ""}${i.title}`}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <span style={{ padding: "10px 12px", textAlign: "center", borderRadius: 8, background: "#303030", color: "#fff", fontWeight: 600, fontSize: 14 }}>Add to cart</span>
                  </div>
                  <s-text color="subdued">A sketch with your items&apos; prices (lowest option). The cart shows the kit as one line; each item&apos;s stock goes down.</s-text>
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
            </>
          }
        >
          <EditorSection n={1} title="Items" summary={kit.items.length ? `${kit.title || "Untitled"} · ${kit.items.length} item${kit.items.length === 1 ? "" : "s"}` : "No items yet"} done={!!kit.title.trim() && kit.items.length > 1} open={open === 1} onToggle={() => setOpen((o) => (o === 1 ? 0 : 1))} onNext={() => setOpen(2)}>
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
          </EditorSection>
          <EditorSection n={2} title="Price" summary={kit.pricing === "percent" ? `${kit.pct}% off the items' total${kit.compareAt ? ", was/now shown" : ""}` : `One price: ${kit.price}`} done={kit.pricing === "percent" ? kit.pct > 0 : kit.price > 0} open={open === 2} onToggle={() => setOpen((o) => (o === 2 ? 0 : 2))}>
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
          </EditorSection>
        </EditorLayout>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
