/**
 * Checkout → After-purchase offer: one product at a discount, offered right after payment and added
 * to the paid order in one click (cro-post-purchase extension; see app/lib/post-purchase.ts).
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { getPostPurchase, refreshPostPurchaseUrl, savePostPurchase } from "../lib/post-purchase.server";
import type { OfferProduct, PostPurchaseConfig } from "../lib/post-purchase";
import { CategoryCrumb } from "../components/FeatureNav";
import { Button, NumberField, Switch, TextArea, TextField } from "../components/fields";
import { Explainer } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  await refreshPostPurchaseUrl(admin).catch(() => null);
  const data = await getPostPurchase(admin);
  return { ...data, settings: `https://${session.shop}/admin/settings/checkout` };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const { shopId } = await getPostPurchase(admin);
    const config = await savePostPurchase(admin, shopId, JSON.parse(String(form.get("config") ?? "{}")));
    return { ok: true as const, error: null, config };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e), config: null };
  }
};

type Picked = { id: string; title: string; images?: { originalSrc?: string }[]; variants?: { id: string; title: string; price?: string | number; image?: { originalSrc?: string } | null }[] };

export default function AfterPurchase() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [c, setC] = useState<PostPurchaseConfig>(data.config);
  const [sent, setSent] = useState(JSON.stringify(data.config));
  const dirty = JSON.stringify(c) !== (fetcher.data?.ok ? sent : JSON.stringify(data.config));
  const set = (patch: Partial<PostPurchaseConfig>) => setC({ ...c, ...patch });

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show("Saved");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const save = (next = c) => {
    setSent(JSON.stringify(next));
    fetcher.submit({ config: JSON.stringify(next) }, { method: "post" });
  };
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: data.currency }).format(n);
    } catch {
      return String(n);
    }
  };

  async function pick() {
    const selected = (await shopify.resourcePicker({ type: "product", multiple: false, action: "select", filter: { variants: true } } as Parameters<typeof shopify.resourcePicker>[0])) as Picked[] | undefined;
    const p = selected?.[0];
    if (!p) return;
    const v = p.variants?.[0];
    if (!v) return;
    const product: OfferProduct = {
      productId: p.id,
      variantId: v.id,
      title: p.title,
      variantTitle: v.title,
      price: Number(v.price) || 0,
      image: v.image?.originalSrc ?? p.images?.[0]?.originalSrc ?? null,
    };
    set({ product });
  }

  const offerPrice = c.product ? c.product.price * (1 - c.pct / 100) : 0;

  return (
    <s-page heading="After-purchase offer" inlineSize="large">
      <CategoryCrumb feature="post_purchase" />
      <Button slot="primary-action" variant="primary" loading={fetcher.state !== "idle"} disabled={!dirty} onClick={() => save()}>
        Save
      </Button>
      <s-stack gap="base">
        <Explainer
          what="Right after paying, the shopper sees one more product at a discount and adds it to the order with one click — no card details again."
          how="Pick the product and the discount here. Shopify shows the offer between payment and the thank-you page, and adds it to the same order and shipment. Not shown when the product is already in the order."
          example="“Wait — add this to your order: Travel case, EGP 300 → EGP 255 (15% off).”"
        />
        <s-banner tone="info" heading="Before it shows to shoppers">
          In Settings → Checkout, under Post-purchase page, choose CRO Toolbox. Shopify shows after-purchase offers for card and Shop Pay payments; publishing an app with this feature needs Shopify’s approval for post-purchase extensions.{" "}
          <s-link href={data.settings} target="_blank">
            Open checkout settings
          </s-link>
        </s-banner>

        <s-grid gridTemplateColumns="minmax(0, 1.2fr) minmax(0, 1fr)" gap="base">
          <s-stack gap="base">
            <s-section>
              <Switch
                label={c.on ? "Offer is on" : "Offer is off"}
                checked={c.on}
                disabled={!c.product}
                details={c.product ? undefined : "Pick a product first."}
                onValue={(on) => {
                  const next = { ...c, on };
                  setC(next);
                  save(next);
                }}
              />
            </s-section>
            <s-section heading="Product">
              <s-stack gap="base">
                {c.product ? (
                  <s-stack direction="inline" gap="base" alignItems="center">
                    {c.product.image ? <s-thumbnail src={c.product.image} alt={c.product.title} size="small" /> : null}
                    <s-stack gap="none">
                      <s-text type="strong">{c.product.title}</s-text>
                      <s-text color="subdued">
                        {c.product.variantTitle !== "Default Title" ? `${c.product.variantTitle} · ` : ""}
                        {money(c.product.price)}
                      </s-text>
                    </s-stack>
                  </s-stack>
                ) : (
                  <s-text color="subdued">No product yet.</s-text>
                )}
                <s-stack direction="inline">
                  <Button onClick={pick}>{c.product ? "Change product" : "Choose a product"}</Button>
                </s-stack>
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <NumberField label="Discount" suffix="%" min={0} max={90} step={1} value={c.pct} onValue={(pct) => set({ pct: Math.min(90, Math.max(0, Math.round(pct))) })} />
                  <NumberField label="Only for orders from" suffix={data.currency} details="0 = every order" min={0} step={1} value={c.min} onValue={(min) => set({ min: Math.max(0, min) })} />
                </s-grid>
              </s-stack>
            </s-section>
            <s-section heading="Text">
              <s-stack gap="base">
                <TextField label="Heading" value={c.heading} maxLength={120} onValue={(heading) => set({ heading })} />
                <TextArea label="Text" rows={2} maxLength={300} value={c.text} onValue={(text) => set({ text })} />
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <TextField label="Accept button" value={c.button} maxLength={40} onValue={(button) => set({ button })} />
                  <TextField label="Decline link" value={c.decline} maxLength={40} onValue={(decline) => set({ decline })} />
                </s-grid>
              </s-stack>
            </s-section>
          </s-stack>
          <s-box>
            <div style={{ position: "sticky", top: 16, background: "#fff", border: "1px solid #e3e3e3", borderRadius: 12, padding: 16, display: "grid", gap: 12, fontSize: 13, color: "#1a1a1a", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
              <div style={{ background: "#f1f6fe", border: "1px solid #c7dbf7", borderRadius: 8, padding: 12, display: "grid", gap: 4, textAlign: "center" }}>
                <b style={{ fontSize: 15 }}>{c.heading || "…"}</b>
                <span>{c.text}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
                <div style={{ aspectRatio: "1", borderRadius: 8, background: c.product?.image ? `center / cover url(${c.product.image})` : "#eee" }} />
                <div style={{ display: "grid", gap: 6 }}>
                  <b style={{ fontSize: 15 }}>{c.product?.title ?? "Your product"}</b>
                  <span>
                    {c.pct > 0 && c.product ? <s style={{ color: "#707070", marginRight: 6 }}>{money(c.product.price)}</s> : null}
                    <b style={{ color: "#b42318" }}>{c.product ? money(offerPrice) : "—"}</b>
                  </span>
                  <span style={{ display: "block", padding: "9px 0", borderRadius: 6, background: "#1773b0", color: "#fff", textAlign: "center", fontWeight: 600 }}>{c.button || "…"}</span>
                  <span style={{ textAlign: "center", color: "#1773b0" }}>{c.decline}</span>
                </div>
              </div>
            </div>
          </s-box>
        </s-grid>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
