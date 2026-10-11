/**
 * One-click post-purchase offer (Checkout → After-purchase offer): after paying, before the thank-you
 * page, the shopper sees one product at a discount and adds it to the order with one click — no
 * new payment details. Run by the cro-post-purchase extension.
 *
 * Saved in the shop metafield cro_toolbox.post_purchase (readable at checkout, which is how the
 * extension gets it). The app server re-reads it when it signs the change, so the discount and
 * product can't be altered in the browser. Shared by client and server.
 */

export type OfferProduct = { productId: string; variantId: string; title: string; variantTitle: string; price: number; image: string | null };
export type PostPurchaseConfig = {
  on: boolean;
  heading: string;
  text: string;
  button: string;
  decline: string;
  pct: number;
  min: number;
  product: OfferProduct | null;
  /** The app's address, for the extension to ask it to sign the change. Set by the server. */
  url: string;
};

export const POST_PURCHASE_METAFIELD = { namespace: "cro_toolbox", key: "post_purchase" } as const;

export const DEFAULT_POST_PURCHASE: PostPurchaseConfig = {
  on: false,
  heading: "Wait — add this to your order",
  text: "A one-time offer for you, shipped with your order. No need to enter your details again.",
  button: "Add to my order",
  decline: "No thanks",
  pct: 15,
  min: 0,
  product: null,
  url: "",
};

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const s = (v: unknown, fallback: string, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : fallback);
const n = (v: unknown, lo: number, hi: number, fallback: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fallback;
};

export function withPostPurchaseDefaults(raw: unknown): PostPurchaseConfig {
  const r = obj(raw);
  const d = DEFAULT_POST_PURCHASE;
  const p = obj(r.product);
  const product: OfferProduct | null =
    typeof p.variantId === "string" && p.variantId.startsWith("gid://shopify/ProductVariant/") && typeof p.productId === "string"
      ? { productId: p.productId, variantId: p.variantId, title: s(p.title, "", 200), variantTitle: s(p.variantTitle, "", 120), price: n(p.price, 0, 1e9, 0), image: typeof p.image === "string" && /^https:\/\//.test(p.image) ? p.image : null }
      : null;
  return {
    on: r.on === true,
    heading: s(r.heading, d.heading, 120),
    text: s(r.text, d.text, 300),
    button: s(r.button, d.button, 40),
    decline: s(r.decline, d.decline, 40),
    pct: Math.round(n(r.pct, 0, 90, d.pct)),
    min: n(r.min, 0, 1e9, 0),
    product,
    url: s(r.url, "", 300),
  };
}

export const numericId = (gid: string) => Number(gid.split("/").pop());

/** The change the shopper accepts: the offer variant, 1 piece, at the offer discount. */
export function offerChanges(c: PostPurchaseConfig) {
  if (!c.product) return [];
  return [
    {
      type: "add_variant" as const,
      variantId: numericId(c.product.variantId),
      quantity: 1,
      ...(c.pct > 0 ? { discount: { value: c.pct, valueType: "percentage" as const, title: `${c.pct}% off — after-purchase offer` } } : {}),
    },
  ];
}
