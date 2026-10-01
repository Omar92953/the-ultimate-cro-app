/* eslint-disable @typescript-eslint/no-explicit-any -- App Bridge resource picker payloads are untyped */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { deleteBundle, listBundles, saveBundle } from "../lib/cro.server";
import { validateBundle } from "../lib/validate";
import { errorMessage } from "../lib/admin.server";
import type { Bundle, BundleStep } from "../lib/types";
import { Button, Checkbox, NumberField, Switch, TextField } from "../components/fields";
import { ResourceList } from "../components/ResourceList";

const blankStep = (): BundleStep => ({ label: "", required: true, min: 1, max: 1, products: [], collection: null });

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const all = await listBundles(admin);
  if (params.handle === "new") {
    const bundle: Bundle = {
      name: "",
      active: true,
      product: null,
      steps: [{ ...blankStep(), label: "Choose your items", min: 3, max: 3 }],
      allowDuplicates: false,
      hideSoldOut: true,
    };
    return { bundle, others: all, isNew: true, shop: session.shop };
  }
  const bundle = all.find((b) => b.handle === params.handle);
  if (!bundle) throw new Response("Bundle not found", { status: 404 });
  return { bundle, others: all, isNew: false, shop: session.shop };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, redirect } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    if (form.get("intent") === "delete") {
      await deleteBundle(admin, String(form.get("handle")));
      return redirect("/app/bundles");
    }
    const saved = await saveBundle(admin, JSON.parse(String(form.get("bundle"))) as Bundle);
    return { ok: true, error: null, handle: saved.handle };
  } catch (e) {
    return { ok: false, error: errorMessage(e), handle: null };
  }
};

export default function BundleEditor() {
  const { bundle: initial, others, isNew, shop } = useLoaderData<typeof loader>();
  const [bundle, setBundle] = useState<Bundle>(initial);
  const [touched, setTouched] = useState(false);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const busy = fetcher.state !== "idle";

  // Reset the form when the loader returns fresh data (after a save or navigation).
  const [loaded, setLoaded] = useState(initial);
  if (loaded !== initial) {
    setLoaded(initial);
    setBundle(initial);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) {
      shopify.toast.show("Bundle saved");
      if (isNew && fetcher.data.handle) navigate(`/app/bundles/${fetcher.data.handle}`, { replace: true });
    } else if (fetcher.data.error) {
      shopify.toast.show("Could not save — see the message at the top", { isError: true });
    }
  }, [fetcher.state, fetcher.data, shopify, isNew, navigate]);

  const set = <K extends keyof Bundle>(key: K, value: Bundle[K]) => setBundle((b) => ({ ...b, [key]: value }));
  const setStep = (i: number, patch: Partial<BundleStep>) =>
    set("steps", bundle.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= bundle.steps.length) return;
    const next = [...bundle.steps];
    [next[i], next[j]] = [next[j], next[i]];
    set("steps", next);
  };

  const problems = validateBundle(bundle, others);
  const save = () => {
    setTouched(true);
    if (problems.length) return;
    fetcher.submit({ intent: "save", bundle: JSON.stringify(bundle) }, { method: "post" });
  };
  const remove = () => {
    if (!bundle.handle || !window.confirm(`Delete “${bundle.name}”? The bundle product itself is not deleted.`)) return;
    fetcher.submit({ intent: "delete", handle: bundle.handle }, { method: "post" });
  };

  return (
    <s-page heading={isNew ? "New bundle" : bundle.name}>
      <s-link slot="breadcrumb-actions" href="/app/bundles">
        Bundles
      </s-link>
      <Button slot="primary-action" variant="primary" onClick={save} loading={busy}>
        Save
      </Button>
      {!isNew ? (
        <Button slot="secondary-actions" tone="critical" onClick={remove} disabled={busy}>
          Delete
        </Button>
      ) : null}

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

      <s-section heading="Bundle">
        <s-stack gap="base">
          <TextField label="Name" details="Only you see this." value={bundle.name} onValue={(v) => set("name", v)} />
          <Switch label="Active" checked={bundle.active} onValue={(v) => set("active", v)} />
          <ResourceList
            type="product"
            multiple={false}
            label="Bundle product"
            details="The product shoppers buy. Its price is the bundle price. Create it first in Products."
            value={bundle.product ? [bundle.product] : []}
            onChange={(v) => set("product", v[0] ?? null)}
          />
          <Checkbox
            label="Allow the same item more than once"
            checked={bundle.allowDuplicates}
            onValue={(v) => set("allowDuplicates", v)}
          />
          <Checkbox label="Hide sold-out items" checked={bundle.hideSoldOut} onValue={(v) => set("hideSoldOut", v)} />
        </s-stack>
      </s-section>

      {bundle.steps.map((step, i) => (
        <s-section key={i} heading={`Step ${i + 1}${step.label ? ` — ${step.label}` : ""}`}>
          <s-stack gap="base">
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
                  details="Its first 50 products (in the collection’s own order) are offered."
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
              <Button icon="arrow-up" disabled={i === 0} onClick={() => moveStep(i, -1)}>
                Move up
              </Button>
              <Button icon="arrow-down" disabled={i === bundle.steps.length - 1} onClick={() => moveStep(i, 1)}>
                Move down
              </Button>
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
      ))}

      <s-section>
        <Button icon="plus" disabled={bundle.steps.length >= 6} onClick={() => set("steps", [...bundle.steps, blankStep()])}>
          Add step
        </Button>
      </s-section>

      <s-section slot="aside" heading="Before you go live">
        <s-unordered-list>
          <s-list-item>
            Set the bundle product’s price to the bundle price. Shoppers pay exactly that price, whatever they pick.
          </s-list-item>
          <s-list-item>
            In the bundle product, untick “Track quantity” — the picked items’ own stock is what goes down.
          </s-list-item>
          <s-list-item>
            Add the Bundle builder block to the bundle product’s page in the theme editor (a separate product template
            works well), and turn off express checkout buttons there.
          </s-list-item>
          <s-list-item>
            {bundle.product ? (
              <s-link href={`https://${shop}/admin/products/${bundle.product.id.split("/").pop()}`} target="_top">
                Open the bundle product
              </s-link>
            ) : (
              <s-link href={`https://${shop}/admin/products/new`} target="_top">
                Create a bundle product
              </s-link>
            )}
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
