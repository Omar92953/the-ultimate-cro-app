/**
 * Every offer in the store, of every type, as one list (lib/offer-types.ts): the Offers hub's table
 * and the plan's offer slots (plans.ts) both count from here. Reads run at once; a type that can't
 * be read (e.g. bundle products before the products permission is approved) is just left out.
 */
import type { AdminClient } from "./admin.server";
import { listBundles, listDeals, listRules } from "./cro.server";
import { listKits } from "./kits.server";
import { getPostPurchase } from "./post-purchase.server";
import type { OfferRow } from "./offer-types";
import type { DealKind } from "./deals";

const DEAL_WHERE: Record<DealKind, string> = {
  fixed: "Product pages",
  bogo: "Product pages and cart",
  volume: "Product pages",
  gift: "Cart",
  upgrade: "Product page and cart",
};
const PLACE: Record<string, string> = { product: "Product page", cart: "Cart page", drawer: "Cart drawer" };

export async function listOffers(admin: AdminClient): Promise<OfferRow[]> {
  const [rules, bundles, deals, kits, post] = await Promise.all([
    listRules(admin).catch(() => []),
    listBundles(admin).catch(() => []),
    listDeals(admin).catch(() => []),
    listKits(admin).catch(() => []),
    getPostPurchase(admin).catch(() => null),
  ]);
  const rows: OfferRow[] = [];
  for (const r of rules) {
    const upsell = r.kind === "upsell";
    rows.push({
      id: r.id ?? r.handle ?? r.name,
      type: upsell ? "upsell" : "cross_sell",
      name: r.name,
      active: r.active,
      where: upsell ? "Product page" : r.placements.map((p) => PLACE[p] ?? p).join(", "),
      href: `/app/offers/${upsell ? "upsell" : "cross-sell"}/${r.handle}`,
    });
  }
  for (const b of bundles) {
    rows.push({ id: b.id ?? b.handle ?? b.name, type: "bundle", name: b.name, active: b.active, where: b.storeWide ? "Bundle page and anywhere in the store" : "Bundle product page", href: `/app/bundles/${b.handle}` });
  }
  for (const k of kits) {
    rows.push({ id: k.productId, type: "kit", name: k.title, active: true, where: k.status === "ACTIVE" ? "Its own product page" : "Draft product (not on the store yet)", href: `/app/kits/${k.productId.split("/").pop()}` });
  }
  for (const d of deals) {
    rows.push({ id: d.id ?? d.handle ?? d.name, type: d.kind, name: d.name, active: d.active, where: DEAL_WHERE[d.kind], href: `/app/deals/${d.kind}/${d.handle}` });
  }
  const pp = post?.config;
  if (pp && (pp.product || pp.on)) {
    rows.push({ id: "post_purchase", type: "post_purchase", name: pp.product ? `${pp.product.title}${pp.pct ? ` · ${pp.pct}% off` : ""}` : "After-purchase offer", active: pp.on, where: "After payment", href: "/app/checkout/after-purchase" });
  }
  return rows;
}
