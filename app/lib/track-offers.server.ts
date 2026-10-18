/**
 * Track page offers (Pro), server side: where they are kept ($app:cro_design "track_offers"), saving with its checks, and the
 * offers one order's Track page shows (products from the store, a real single use Shopify code made for the order when the
 * offer gives one). The paid order is never edited.
 */
import { randomBytes } from "node:crypto";
import { AdminError, gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";
import { givenCode } from "./track-sell.server";
import { MAX_TRACK_OFFERS, trackOfferProblem, withTrackOfferDefaults, withTrackOffersDefaults, type TrackOffer, type TrackOffers, type TrackSlot } from "./track-offers";

export async function getTrackOffers(admin: AdminClient): Promise<TrackOffers> {
  const d = await gql(admin, `#graphql
    query CroTrackOffers { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "track_offers" }) { field(key: "config") { value } } }`);
  try {
    return withTrackOffersDefaults(JSON.parse(d.metaobjectByHandle?.field?.value ?? "null"));
  } catch {
    return { offers: [] };
  }
}

async function put(admin: AdminClient, offers: TrackOffer[]) {
  await upsert(admin, "$app:cro_design", "track_offers", { config: JSON.stringify({ offers }) });
}

/** Saves one offer (new when it has no id). The caller has checked the plan. Throws a message the merchant can read. */
export async function saveTrackOffer(admin: AdminClient, raw: unknown): Promise<TrackOffer> {
  const all = (await getTrackOffers(admin)).offers;
  const o = withTrackOfferDefaults(raw);
  const isNew = !o.id || !all.some((x) => x.id === o.id);
  if (isNew) {
    if (all.length >= MAX_TRACK_OFFERS) throw new AdminError(`You can have up to ${MAX_TRACK_OFFERS} Track page offers. Delete one first.`);
    o.id = `t${randomBytes(4).toString("hex")}`;
  }
  const problem = trackOfferProblem(o, all);
  if (problem) throw new AdminError(problem);
  await put(admin, isNew ? [...all, o] : all.map((x) => (x.id === o.id ? o : x)));
  return o;
}

export async function deleteTrackOffer(admin: AdminClient, id: string) {
  const all = (await getTrackOffers(admin)).offers;
  await put(admin, all.filter((x) => x.id !== id));
}

export type ShownProduct = { handle: string; title: string; image: string | null; price: string; currency: string; variantId: number };
export type ShownOffer = {
  kind: TrackOffer["kind"];
  headline: string;
  text: string;
  button: string;
  products: ShownProduct[];
  /** The code the offer gives (single use, real expiry), when it gives one. */
  code?: { code: string; percent: number; minimum: number; endsAt: string; currency: string };
};

async function productsOf(admin: AdminClient, ids: string[]): Promise<Map<string, ShownProduct & { id: string }>> {
  const out = new Map<string, ShownProduct & { id: string }>();
  if (!ids.length) return out;
  const d = await gql(admin, `#graphql
    query CroTrackOfferProducts($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id handle title status featuredMedia { preview { image { url } } } variants(first: 20) { nodes { id availableForSale price } } } } }`, { ids });
  const cur = (await gql(admin, `#graphql
    query CroShopCurrency { shop { currencyCode } }`)).shop.currencyCode as string;
  for (const p of (d.nodes ?? []) as ({ id: string; handle: string; title: string; status: string; featuredMedia?: { preview?: { image?: { url?: string } } }; variants: { nodes: { id: string; availableForSale: boolean; price: string }[] } } | null)[]) {
    if (!p?.id || p.status !== "ACTIVE") continue;
    const v = p.variants.nodes.find((x) => x.availableForSale);
    if (!v) continue;
    out.set(p.id, { id: p.id, handle: p.handle, title: p.title, image: p.featuredMedia?.preview?.image?.url ?? null, price: v.price, currency: cur, variantId: Number(v.id.split("/").pop()) });
  }
  return out;
}

/**
 * The offers this order's Track page shows, one per slot. A slot is left out when its offer is off, its products are gone or
 * out of stock, or its code could not be made (never an offer without the code it promises). `currency`: the order's.
 */
export async function trackOffersFor(admin: AdminClient, shop: string, orderId: string, currency: string): Promise<Partial<Record<TrackSlot, ShownOffer>>> {
  const live = (await getTrackOffers(admin)).offers.filter((o) => o.active);
  if (!live.length) return {};
  const products = await productsOf(admin, [...new Set(live.flatMap((o) => o.products.map((p) => p.id)))]).catch(() => new Map());
  const out: Partial<Record<TrackSlot, ShownOffer>> = {};
  for (const o of live) {
    if (out[o.slot]) continue;
    const mine = o.products.map((p) => products.get(p.id)).filter((p): p is ShownProduct & { id: string } => !!p);
    if ((o.kind === "cross_sell" || o.kind === "gift") && !mine.length) continue;
    const shown: ShownOffer = { kind: o.kind, headline: o.headline, text: o.text, button: o.button, products: mine.map((p) => ({ handle: p.handle, title: p.title, image: p.image, price: p.price, currency: p.currency, variantId: p.variantId })) };
    try {
      const wants = o.kind === "shipping" || o.kind === "discount" || (o.kind === "cross_sell" && o.percent > 0) || o.kind === "gift";
      if (wants) {
        const spec = { percent: o.kind === "gift" ? 100 : o.percent, minimum: o.minimum, days: 1, hours: o.hours, shipping: o.kind === "shipping", productIds: o.kind === "cross_sell" || o.kind === "gift" ? mine.map((p) => p.id) : undefined };
        const code = await givenCode(admin, shop, orderId, `offer-${o.id}`, "TRACK", spec, o.name);
        if (!code) continue; // its code expired: the offer is over for this order
        shown.code = { ...code, currency };
      }
    } catch (e) {
      console.error(`[proxy/track] offer ${o.id} ${shop}:`, e instanceof Error ? e.message : e);
      continue;
    }
    out[o.slot] = shown;
  }
  return out;
}
