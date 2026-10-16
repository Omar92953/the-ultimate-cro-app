/**
 * Per-offer styles. A block can have up to 5 styles (design-slot.server.ts: style 1 is the group's
 * default, 2 to 5 are extra). An offer (an upsell or cross sell rule, or a mix and match bundle) can be
 * linked to one of them through its `design` field; the storefront block then shows that style for
 * this offer instead of the block's own "Style" setting. Offers without the field keep the default.
 *
 * Data plan: nothing is migrated. `design` is a new optional number field on `$app:cro_rule` and
 * `$app:cro_bundle` (shopify.app.toml). It is only written once an offer gets its own style, so a store
 * that has not received the new definition yet keeps saving offers. The style itself is the existing
 * `$app:cro_design` entry `<base>_<N>` (created as a copy of style 1 on the first save).
 */
import { gql, type AdminClient } from "./admin.server";
import { listBundles, listRules, upsert } from "./cro.server";
import { MAX_DESIGNS } from "./design-slot.server";

import { STYLE_GROUPS, type StyleGroup, type StyleOffer } from "./offer-style";

export { STYLE_GROUPS, isStyleGroup, type StyleGroup, type StyleOffer } from "./offer-style";

/** The group's offers that can have their own style, active ones first. */
export async function styleOffers(admin: AdminClient, group: StyleGroup): Promise<StyleOffer[]> {
  const rows: StyleOffer[] =
    group === "bundles"
      ? (await listBundles(admin)).map((b) => ({ handle: b.handle ?? "", name: b.name, active: b.active, design: b.design ?? 0 }))
      : (await listRules(admin, group === "upsell" ? "upsell" : "cross_sell")).map((r) => ({ handle: r.handle ?? "", name: r.name, active: r.active, design: r.design ?? 0 }));
  return rows.filter((r) => r.handle).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}

/** Which styles (2 to 5) of a block already exist in the store. */
export async function existingSlots(admin: AdminClient, base: string): Promise<Set<number>> {
  const data = await gql(admin, `#graphql
    query CroStyleHandles { metaobjects(type: "$app:cro_design", first: 250) { nodes { handle } } }`);
  const have = new Set<string>((data.metaobjects?.nodes ?? []).map((m: { handle: string }) => m.handle));
  const out = new Set<number>();
  for (let n = 2; n <= MAX_DESIGNS; n++) if (have.has(`${base}_${n}`) || have.has(`${base}_${n}_editor`)) out.add(n);
  return out;
}

/** The style a new "own style" should use: the first one nobody uses and the plan allows, or null. */
export function freeSlot(offers: StyleOffer[], existing: Set<number>, allowed: number): number | null {
  const taken = new Set([...offers.map((o) => o.design).filter((n) => n > 1), ...existing]);
  for (let n = 2; n <= Math.min(allowed, MAX_DESIGNS); n++) if (!taken.has(n)) return n;
  return null;
}

/** Saves "this offer uses style N" (only that field changes). */
export async function linkOfferStyle(admin: AdminClient, group: StyleGroup, handle: string, slot: number) {
  if (!(slot >= 2 && slot <= MAX_DESIGNS) || !/^[a-z0-9_-]{1,100}$/i.test(handle)) return;
  const type = group === "bundles" ? "$app:cro_bundle" : "$app:cro_rule";
  await upsert(admin, type, handle, { design: String(slot) });
}

/** After a style is saved from "?design=N&offer=handle", link that offer to style N. */
export async function linkFromRequest(admin: AdminClient, request: Request, group: StyleGroup) {
  const url = new URL(request.url);
  const offer = url.searchParams.get("offer");
  const slot = Number(url.searchParams.get("design"));
  if (offer && slot > 1) await linkOfferStyle(admin, group, offer, slot);
}

/** The styles (1 to 5) a block has in the store, with their names (design-slots names). */
export async function styleSlots(admin: AdminClient, base: string): Promise<{ slot: number; name: string }[]> {
  const [have, namesData] = await Promise.all([
    existingSlots(admin, base),
    gql(admin, `#graphql
      query CroStyleNames { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "design_names" }) { field(key: "config") { value } } }`).catch(() => null),
  ]);
  let names: Record<string, string> = {};
  try {
    names = JSON.parse(namesData?.metaobjectByHandle?.field?.value ?? "{}")?.[base] ?? {};
  } catch {
    names = {};
  }
  return [1, ...[...have].sort((a, b) => a - b)].map((slot) => ({ slot, name: names[String(slot)] || `Style ${slot}` }));
}

/** What the Style page of an offer group lists: one section per kind of thing with a look. */
export type StyleRow = { key: string; title: string; sub: string; href: string; pill: "Default style" | "Own style" | "Style" | "New style" | "All offers" };
export type StyleSection = { key: string; title: string; /** The feature whose plan unlocks it (lock icon and upgrade card). */ feature: string; rows: StyleRow[] };

export async function styleSections(admin: AdminClient, group: StyleGroup, allowed: number): Promise<StyleSection[]> {
  const meta = STYLE_GROUPS[group];
  const offers = await styleOffers(admin, group);
  const offerRows = (): StyleRow[] => [
    { key: "default", title: "Default style", sub: `Used by every ${meta.noun} that has no style of its own`, href: meta.design, pill: "All offers" },
    ...offers.map((o) => ({ key: o.handle, title: o.name, sub: o.active ? "Active" : "Paused", href: allowed > 1 ? `/app/styles/${group}/${o.handle}` : meta.design, pill: (o.design > 1 ? "Own style" : "Default style") as StyleRow["pill"] })),
  ];
  const slotRows = async (base: string, path: string, noun: string): Promise<StyleRow[]> => {
    const slots = await styleSlots(admin, base);
    const used = new Set(slots.map((x) => x.slot));
    const next = [2, 3, 4, 5].find((n) => !used.has(n) && n <= allowed);
    return [
      ...slots.map((x) => ({ key: `${base}-${x.slot}`, title: x.name, sub: x.slot === 1 ? `The default look of ${noun}` : `Pick it in the theme editor with the block's Style setting`, href: x.slot === 1 ? path : `${path}?design=${x.slot}`, pill: "Style" as const })),
      ...(next ? [{ key: `${base}-new`, title: "New style", sub: "Starts as a copy of the default style", href: `${path}?design=${next}&copy=1`, pill: "New style" as const }] : []),
    ];
  };
  if (group === "upsell")
    return [
      { key: "offers", title: "Quantity & sizes", feature: "upsell", rows: offerRows() },
      { key: "addons", title: "Add-ons", feature: "addons", rows: await slotRows("addons", "/app/styles/upsell/addons", "add-ons") },
      { key: "personalize", title: "Personalization", feature: "personalize", rows: await slotRows("personalize", "/app/styles/upsell/personalize", "personalization") },
    ];
  if (group === "cross_sell")
    return [
      { key: "offers", title: "Cross sell offers", feature: "cross_sell", rows: offerRows() },
      { key: "cart", title: "Offers in your theme's cart", feature: "cart_offers", rows: [{ key: "cart-offers", title: "Cart drawer offers", sub: "The “Cart drawer” part of the default style", href: meta.design, pill: "Style" }] },
    ];
  return [
    { key: "offers", title: "Mix and match, build your own, tiered and fixed price bundles", feature: "bundles", rows: offerRows() },
    { key: "fbt", title: "Frequently bought together", feature: "bundles", rows: [{ key: "fbt-box", title: "Frequently bought together box", sub: "Shared by every Frequently bought together box on your store", href: "/app/styles/bundles/fbt", pill: "Style" }] },
  ];
}
