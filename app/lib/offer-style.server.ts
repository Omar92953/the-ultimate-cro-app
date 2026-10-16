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

export type StyleGroup = "upsell" | "cross_sell" | "bundles";
export const STYLE_GROUPS: Record<StyleGroup, { title: string; base: string; design: string; noun: string }> = {
  upsell: { title: "Upsell", base: "upsell", design: "/app/designs/upsell", noun: "upsell offer" },
  cross_sell: { title: "Cross sell", base: "cross_sell", design: "/app/designs/cross-sell", noun: "cross sell offer" },
  bundles: { title: "Bundles", base: "bundles", design: "/app/designs/bundles", noun: "bundle" },
};
export const isStyleGroup = (v: unknown): v is StyleGroup => typeof v === "string" && v in STYLE_GROUPS;

export type StyleOffer = { handle: string; name: string; active: boolean; design: number };

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
