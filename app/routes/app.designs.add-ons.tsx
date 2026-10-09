/* eslint-disable @typescript-eslint/no-explicit-any -- App Bridge resource picker payloads are untyped */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { storefrontCss } from "../lib/storefront-css.server";
import { errorMessage } from "../lib/admin.server";
import { editorLinks, getThemeStatus } from "../lib/cro.server";
import { getAddons, saveAddons } from "../lib/designs.server";
import { withAddonsDefaults, type AddonItem, type AddonsConfig } from "../lib/addons";
import { Button, ColorField, NumberField, Select, Switch, TextField } from "../components/fields";
import { AddonsPreview } from "../components/AddonsPreview";
import ui from "../components/PageEditor.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [{ config, saved }, theme] = await Promise.all([getAddons(admin), getThemeStatus(admin).catch(() => null)]);
  return { config, saved, css: storefrontCss("ucs-sections.css"), inTheme: theme ? theme.installed.addons : null, addLink: editorLinks(session.shop).addons, shop: session.shop };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveAddons(admin, withAddonsDefaults(JSON.parse(String(form.get("config")))));
    return { ok: true, error: null, config };
  } catch (e) {
    return { ok: false, error: errorMessage(e), config: null };
  }
};

type C = AddonsConfig;
const numericId = (gid: string) => gid.split("/").pop() ?? "";

export default function AddonsDesigner() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<C>(data.config);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [loaded, setLoaded] = useState(data.config);
  if (loaded !== data.config) {
    setLoaded(data.config);
    setCfg(data.config);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show("Add-ons saved — live on your store");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const item = (i: number, patch: Partial<AddonItem>) => setCfg((c) => ({ ...c, items: c.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const message = (patch: Partial<C["message"]>) => setCfg((c) => ({ ...c, message: { ...c.message, ...patch } }));
  const look = (patch: Partial<C["look"]>) => setCfg((c) => ({ ...c, look: { ...c.look, ...patch } }));
  const where = (patch: Partial<C["where"]>) => setCfg((c) => ({ ...c, where: { ...c.where, ...patch } }));
  const save = () => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" });

  async function addProducts() {
    const selected: any = await shopify.resourcePicker({ type: "product", multiple: 6 - cfg.items.length, action: "add" } as any);
    if (!selected?.length) return;
    const added: AddonItem[] = selected.map((p: any) => {
      const variants = (p.variants ?? []).map((v: any) => ({ id: numericId(v.id), title: v.title, price: String(v.price ?? "") }));
      return {
        productId: p.id,
        handle: p.handle,
        title: p.title,
        image: p.images?.[0]?.originalSrc ?? null,
        variantId: variants[0]?.id ?? "",
        variants,
        label: "",
        text: "",
        checked: false,
      };
    });
    setCfg((c) => ({ ...c, items: [...c.items, ...added.filter((a) => a.variantId)].slice(0, 6) }));
  }

  async function pickTargets(kind: "products" | "collections") {
    const selected: any = await shopify.resourcePicker({ type: kind === "products" ? "product" : "collection", multiple: true, action: "select" } as any);
    if (!selected) return;
    where({ [kind]: selected.map((x: any) => ({ handle: x.handle, title: x.title })) });
  }

  return (
    <s-page heading="Add-ons" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to product page"}
      </Button>
      <s-stack gap="base">
        {data.inTheme === false ? (
          <s-banner tone="info" heading="Place the add-ons on your product page">
            Click “Add to product page”, drag the “Add-ons” block under the Add to cart button and save. Everything else is set here.
          </s-banner>
        ) : null}
        {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}

        <div className={ui.layout}>
          <s-stack gap="base">
            <s-section heading={`Add-ons (${cfg.items.length} of 6)`}>
              <s-stack gap="base">
                <s-text color="subdued">
                  Each add-on is a product in your store, like “Gift wrapping”. Shoppers tick it and it goes into the cart with the product. Add-ons always start unticked: Shopify requires shoppers to choose paid extras themselves.{" "}
                  <s-link href={`https://${data.shop}/admin/products/new`} target="_top">
                    Create a product
                  </s-link>{" "}
                  if you don’t have one yet.
                </s-text>
                {cfg.items.map((a, i) => (
                  <s-box key={`${a.productId}-${i}`} padding="base" borderWidth="base" borderRadius="base">
                    <s-stack gap="base">
                      <s-stack direction="inline" gap="base" alignItems="center">
                        <s-thumbnail src={a.image ?? undefined} alt={a.title} size="small" />
                        <s-text type="strong">{a.title}</s-text>
                      </s-stack>
                      {a.variants.length > 1 ? (
                        <Select label="Option" value={a.variantId} onValue={(v) => item(i, { variantId: v })} options={a.variants.map((v) => ({ value: v.id, label: `${v.title}${v.price ? ` · ${v.price}` : ""}` }))} />
                      ) : null}
                      <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                        <TextField label="Name shown (optional)" placeholder={a.title} value={a.label} onValue={(v) => item(i, { label: v })} />
                        <TextField label="Short note (optional)" placeholder="Wrapped by hand in recycled paper" value={a.text} onValue={(v) => item(i, { text: v })} />
                      </s-grid>
                      <s-box>
                        <Button tone="critical" variant="tertiary" icon="delete" onClick={() => setCfg((c) => ({ ...c, items: c.items.filter((_, j) => j !== i) }))}>
                          Remove
                        </Button>
                      </s-box>
                    </s-stack>
                  </s-box>
                ))}
                <s-box>
                  <Button icon="plus" disabled={cfg.items.length >= 6} onClick={addProducts}>
                    Add an add-on
                  </Button>
                </s-box>
              </s-stack>
            </s-section>

            <s-section heading="Gift message">
              <s-stack gap="base">
                <Switch label="Let shoppers write a message" details="Saved on the order line, next to the product." checked={cfg.message.on} onValue={(v) => message({ on: v })} />
                {cfg.message.on ? (
                  <>
                    <TextField label="Tick box text" value={cfg.message.label} onValue={(v) => message({ label: v })} />
                    <TextField label="Placeholder" value={cfg.message.placeholder} onValue={(v) => message({ placeholder: v })} />
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <TextField label="Name on the order" details="What you see in the order, e.g. Gift message." value={cfg.message.name} onValue={(v) => message({ name: v })} />
                      <NumberField label="Longest message" suffix="letters" min={20} max={500} step={10} value={cfg.message.max} onValue={(v) => message({ max: v })} />
                    </s-grid>
                  </>
                ) : null}
              </s-stack>
            </s-section>

            <s-section heading="Where it shows">
              <s-stack gap="base">
                <Select
                  label="Show on"
                  value={cfg.where.mode}
                  onValue={(v) => where({ mode: v as C["where"]["mode"] })}
                  options={[
                    { value: "all", label: "Every product page" },
                    { value: "products", label: "Only some products" },
                    { value: "collections", label: "Products in some collections" },
                  ]}
                />
                {cfg.where.mode !== "all" ? (
                  <s-stack gap="small-200">
                    <s-text>
                      {(cfg.where.mode === "products" ? cfg.where.products : cfg.where.collections).map((x) => x.title).join(", ") || "None chosen yet"}
                    </s-text>
                    <s-box>
                      <Button onClick={() => pickTargets(cfg.where.mode as "products" | "collections")}>{cfg.where.mode === "products" ? "Choose products" : "Choose collections"}</Button>
                    </s-box>
                  </s-stack>
                ) : null}
              </s-stack>
            </s-section>

            <s-section heading="Look">
              <s-stack gap="base">
                <TextField label="Heading (optional)" value={cfg.heading} onValue={(v) => setCfg((c) => ({ ...c, heading: v }))} />
                <Select label="Layout" value={cfg.style} onValue={(v) => setCfg((c) => ({ ...c, style: v as C["style"] }))} options={[{ value: "list", label: "List" }, { value: "cards", label: "Cards side by side" }]} />
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <ColorField label="Ticked colour" value={cfg.look.accent} onValue={(v) => look({ accent: v })} />
                  <ColorField label="Background" value={cfg.look.bg} onValue={(v) => look({ bg: v })} />
                  <ColorField label="Border" value={cfg.look.border} onValue={(v) => look({ border: v })} />
                  <NumberField label="Corners" suffix="px" min={0} max={24} step={1} value={cfg.look.radius} onValue={(v) => look({ radius: v })} />
                  <NumberField label="Name size" suffix="px" min={11} max={22} step={1} value={cfg.look.titleSize} onValue={(v) => look({ titleSize: v })} />
                  <NumberField label="Note size" suffix="px" min={10} max={18} step={1} value={cfg.look.textSize} onValue={(v) => look({ textSize: v })} />
                </s-grid>
              </s-stack>
            </s-section>
          </s-stack>

          <div className={ui.preview}>
            <div className={ui.previewBar}>
              <span>Live preview</span>
            </div>
            <style dangerouslySetInnerHTML={{ __html: data.css }} />
            <div className={ui.frame}>
              <AddonsPreview config={cfg} />
            </div>
          </div>
        </div>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
