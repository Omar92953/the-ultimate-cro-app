/* eslint-disable @typescript-eslint/no-explicit-any -- raw Admin API JSON; operations are schema-checked by `npm run graphql-codegen` */
/**
 * The Ultimate CRO App — all merchant configuration lives in Shopify, never in our database.
 *
 *  - $app:cro_settings  (handle "settings")  feature switches
 *  - $app:cro_rule                              cross-sell / upsell rules
 *  - $app:cro_slide + $app:cro_carousel ("main") video carousel
 *  - $app:cro_bundle + $app:cro_bundle_step     mix-and-match bundles
 *
 * The storefront reads those directly (theme app extension). Two Shopify Functions need a
 * compact copy, which is rewritten on every save so display and checkout can't disagree:
 *  - the automatic app discount's $app.function-configuration (+ $app.function-input)
 *  - the cart transform's $app.bundles
 */
import { gql, numericId, AdminError, type AdminClient } from "./admin.server";

import type {
  Ref,
  TriggerType,
  Tier,
  RuleKind,
  Placement,
  Rule,
  Settings,
  Slide,
  BundleStep,
  Bundle,
  DiscountMode,
  DiscountEngine,
  UpsellType,
} from "./types";
import { FEATURE_KEYS } from "./types";
import { validateBundle, validateRule } from "./validate";
import { DEAL_TEXT, toFunctionDeal, toStorefrontDeal, type Deal, type DealKind } from "./deals";
export * from "./types";
export { validateBundle, validateRule };

/* Shopify silently ignores Function metafields over 10,000 bytes; keep a margin. */
const FUNCTION_METAFIELD_LIMIT = 9500;
/* Function list variables are capped at 100 elements. */
const FUNCTION_LIST_LIMIT = 100;

/* --------------------------------------------------------------- helpers -- */
type Field = { key: string; value: string | null; reference?: any; references?: { nodes: any[] } | null };

function fieldsOf(node: { fields: Field[] }): Record<string, Field> {
  const out: Record<string, Field> = {};
  for (const f of node.fields || []) out[f.key] = f;
  return out;
}

function toRef(node: any): Ref | null {
  if (!node?.id) return null;
  return {
    id: node.id,
    title: node.title ?? node.alt ?? node.handle ?? "",
    image: node.featuredMedia?.preview?.image?.url ?? node.image?.url ?? node.preview?.image?.url ?? null,
  };
}

function refs(field?: Field): Ref[] {
  return (field?.references?.nodes ?? []).map(toRef).filter(Boolean) as Ref[];
}

function bool(field?: Field, fallback = false) {
  if (!field || field.value == null) return fallback;
  return field.value === "true";
}

function num(field?: Field, fallback = 0) {
  const n = Number(field?.value);
  return Number.isFinite(n) ? n : fallback;
}

function json<T>(field: Field | undefined, fallback: T): T {
  try {
    return field?.value ? (JSON.parse(field.value) as T) : fallback;
  } catch {
    return fallback;
  }
}

const REF_FRAGMENT = `#graphql
  fragment CroRef on Node {
    __typename
    id
    ... on Product { title featuredMedia { preview { image { url } } } }
    ... on Collection { title image { url } }
    ... on Video { alt preview { image { url } } }
    ... on MediaImage { alt preview { image { url } } }
  }
`;

export async function upsert(admin: AdminClient, type: string, handle: string, fields: Record<string, string>) {
  try {
    return await upsertOnce(admin, type, handle, fields);
  } catch (e) {
    // "" is how an optional text is cleared. If Shopify ever rejects blanks, save the rest
    // rather than failing the whole save.
    const nonEmpty = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== ""));
    if (e instanceof AdminError && /blank|empty/i.test(e.message) && Object.keys(nonEmpty).length < Object.keys(fields).length) {
      return upsertOnce(admin, type, handle, nonEmpty);
    }
    throw e;
  }
}

async function upsertOnce(admin: AdminClient, type: string, handle: string, fields: Record<string, string>) {
  const data = await gql(
    admin,
    `#graphql
    mutation CroUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject { id handle }
        userErrors { field message }
      }
    }`,
    {
      handle: { type, handle },
      metaobject: { fields: Object.entries(fields).map(([key, value]) => ({ key, value })) },
    },
  );
  return data.metaobjectUpsert.metaobject as { id: string; handle: string };
}

async function create(admin: AdminClient, type: string, fields: Record<string, string>) {
  const data = await gql(
    admin,
    `#graphql
    mutation CroCreate($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject { id handle }
        userErrors { field message }
      }
    }`,
    {
      metaobject: {
        type,
        fields: Object.entries(fields)
          .filter(([, value]) => value !== "")
          .map(([key, value]) => ({ key, value })),
      },
    },
  );
  return data.metaobjectCreate.metaobject as { id: string; handle: string };
}

export async function remove(admin: AdminClient, id: string) {
  await gql(
    admin,
    `#graphql
    mutation CroDelete($id: ID!) {
      metaobjectDelete(id: $id) { deletedId userErrors { field message } }
    }`,
    { id },
  );
}

export function slug(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/* -------------------------------------------------------------- settings -- */
export async function getSettings(admin: AdminClient): Promise<Settings> {
  const data = await gql(
    admin,
    `#graphql
    query CroSettings {
      metaobjectByHandle(handle: { type: "$app:cro_settings", handle: "settings" }) {
        fields { key value }
      }
    }`,
  );
  const f = data.metaobjectByHandle ? fieldsOf(data.metaobjectByHandle) : {};
  return {
    cross_sell_enabled: bool(f.cross_sell_enabled, true),
    upsell_enabled: bool(f.upsell_enabled, true),
    videos_enabled: bool(f.videos_enabled, true),
    bundles_enabled: bool(f.bundles_enabled, true),
  };
}

type DiscountSettings = { mode: DiscountMode; nativeIds: string[] };

export async function getDiscountSettings(admin: AdminClient): Promise<DiscountSettings> {
  const data = await gql(
    admin,
    `#graphql
    query CroDiscountSettings {
      metaobjectByHandle(handle: { type: "$app:cro_settings", handle: "settings" }) {
        fields { key value }
      }
    }`,
  );
  const f = data.metaobjectByHandle ? fieldsOf(data.metaobjectByHandle) : {};
  const mode = f.discount_mode?.value;
  return {
    mode: mode === "function" || mode === "native" ? mode : "auto",
    nativeIds: json<string[]>(f.native_discounts, []),
  };
}

export async function setDiscountMode(admin: AdminClient, mode: DiscountMode) {
  await upsert(admin, "$app:cro_settings", "settings", { discount_mode: mode });
  return syncDiscounts(admin);
}

async function saveNativeIds(admin: AdminClient, ids: string[]) {
  await upsert(admin, "$app:cro_settings", "settings", { native_discounts: JSON.stringify(ids) });
}

export async function setSetting(admin: AdminClient, key: keyof Settings, value: boolean) {
  const current = await getSettings(admin);
  current[key] = value;
  await upsert(
    admin,
    "$app:cro_settings",
    "settings",
    Object.fromEntries(FEATURE_KEYS.map((k) => [k, String(current[k])])),
  );
}

/** Home: the section cards the merchant saved, newest first. */
export async function getSavedSections(admin: AdminClient): Promise<string[]> {
  const data = await gql(
    admin,
    `#graphql
    query CroSavedSections {
      metaobjectByHandle(handle: { type: "$app:cro_settings", handle: "settings" }) { field(key: "saved_sections") { value } }
    }`,
  );
  const value = json<unknown>((data.metaobjectByHandle?.field ?? undefined) as Field | undefined, []);
  return Array.isArray(value) ? value.filter((k): k is string => typeof k === "string") : [];
}

export async function setSectionSaved(admin: AdminClient, key: string, saved: boolean) {
  const current = (await getSavedSections(admin)).filter((k) => k !== key);
  const next = saved ? [key, ...current] : current;
  await upsert(admin, "$app:cro_settings", "settings", { saved_sections: JSON.stringify(next.slice(0, 100)) });
  return next;
}

/* ----------------------------------------------------------------- rules -- */
export async function listRules(admin: AdminClient, kind?: RuleKind): Promise<Rule[]> {
  const data = await gql(
    admin,
    `#graphql
    ${REF_FRAGMENT}
    query CroRules {
      metaobjects(type: "$app:cro_rule", first: 100) {
        nodes {
          id
          handle
          fields {
            key
            value
            references(first: 50) { nodes { ...CroRef } }
          }
        }
      }
    }`,
  );
  const rules: Rule[] = data.metaobjects.nodes.map((node: any) => {
    const f = fieldsOf(node);
    return {
      id: node.id,
      handle: node.handle,
      kind: (f.kind?.value as RuleKind) || "cross_sell",
      name: f.name?.value || "Untitled rule",
      active: bool(f.active, true),
      priority: num(f.priority, 100),
      triggerType: (f.trigger_type?.value as TriggerType) || "all",
      triggerProducts: refs(f.trigger_products),
      triggerCollections: refs(f.trigger_collections),
      offeredProducts: refs(f.offered_products),
      tiers: json<Tier[]>(f.tiers, []),
      upsellType: (f.upsell_type?.value as UpsellType) === "variant" ? "variant" : "quantity",
      optionName: f.option_name?.value || "",
      placements: json<Placement[]>(f.placements, ["product"]),
      headline: f.headline?.value || "",
      subheadline: f.subheadline?.value || "",
      buttonLabel: f.button_label?.value || "",
      discountPercent: num(f.discount_percent, 0),
      discountLabel: f.discount_label?.value || "",
    };
  });
  return rules
    .filter((r) => !kind || r.kind === kind)
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}


export async function saveRule(admin: AdminClient, rule: Rule) {
  const errors = validateRule(rule);
  if (errors.length) throw new AdminError(errors.join(" "));
  const isVariant = rule.kind === "upsell" && rule.upsellType === "variant";
  const tiers = (isVariant ? [...rule.tiers] : [...rule.tiers].sort((a, b) => a.qty - b.qty)).map((t) => ({
    qty: isVariant ? 1 : Math.round(t.qty),
    pct: Math.round(t.pct * 100) / 100,
    ...(isVariant ? { value: (t.value || "").trim() } : {}),
    ...(t.label ? { label: t.label } : {}),
    ...(t.badge ? { badge: t.badge } : {}),
  }));
  const saved = await upsert(admin, "$app:cro_rule", rule.handle || slug(`rule-${rule.kind.replace("_", "")}`), {
    name: rule.name.trim(),
    kind: rule.kind,
    active: String(rule.active),
    priority: String(Math.round(rule.priority) || 0),
    trigger_type: rule.triggerType,
    trigger_products: JSON.stringify(rule.triggerType === "products" ? rule.triggerProducts.map((r) => r.id) : []),
    trigger_collections: JSON.stringify(rule.triggerType === "collections" ? rule.triggerCollections.map((r) => r.id) : []),
    offered_products: JSON.stringify(rule.kind === "cross_sell" ? rule.offeredProducts.map((r) => r.id) : []),
    tiers: JSON.stringify(rule.kind === "upsell" ? tiers : []),
    upsell_type: rule.kind === "upsell" ? rule.upsellType : "quantity",
    option_name: isVariant ? rule.optionName.trim() : "",
    placements: JSON.stringify(rule.kind === "upsell" ? ["product"] : rule.placements),
    headline: rule.headline,
    subheadline: rule.subheadline,
    button_label: rule.buttonLabel,
    discount_percent: String(rule.kind === "cross_sell" ? Number(rule.discountPercent) || 0 : 0),
    discount_label: rule.discountLabel,
  });
  await syncDiscounts(admin);
  return saved;
}

export async function deleteRule(admin: AdminClient, id: string) {
  await remove(admin, id);
  await syncDiscounts(admin);
}

/* --------------------------------------------------- offer discount sync -- */
export type DiscountStatus = {
  id: string | null;
  status: string | null;
  needed: boolean;
  mode: DiscountMode;
  engine: DiscountEngine;
  reason: string;
  nativeCount: number;
};

/**
 * Shopify only runs Functions from custom-distribution apps on Plus (and development) stores.
 * "auto" therefore picks native automatic discounts for a custom install on any other plan.
 * Set APP_DISTRIBUTION=custom on the server of a custom-distribution app record.
 */
export async function resolveDiscountEngine(
  admin: AdminClient,
  mode?: DiscountMode,
): Promise<{ mode: DiscountMode; engine: DiscountEngine; reason: string }> {
  const chosen = mode ?? (await getDiscountSettings(admin)).mode;
  if (chosen === "function") return { mode: chosen, engine: "function", reason: "Chosen in settings." };
  if (chosen === "native") return { mode: chosen, engine: "native", reason: "Chosen in settings." };
  if (process.env.APP_DISTRIBUTION !== "custom") {
    return { mode: chosen, engine: "function", reason: "App Store install: Shopify Functions run on every plan." };
  }
  const data = await gql(
    admin,
    `#graphql
    query CroShopPlan { shop { plan { shopifyPlus partnerDevelopment } } }`,
  );
  const plan = data.shop.plan;
  if (plan.shopifyPlus || plan.partnerDevelopment) {
    return { mode: chosen, engine: "function", reason: "Custom install on a Plus or development store: Functions are available." };
  }
  return {
    mode: chosen,
    engine: "native",
    reason: "Custom install on a non-Plus plan: Shopify only runs custom-app Functions on Plus, so native discounts are used.",
  };
}

async function findOfferDiscount(admin: AdminClient) {
  const data = await gql(
    admin,
    `#graphql
    query CroDiscounts {
      discountNodes(first: 100, query: "method:automatic") {
        nodes {
          id
          discount {
            __typename
            ... on DiscountAutomaticApp {
              title
              status
              appDiscountType { appKey functionId }
            }
          }
        }
      }
    }`,
  );
  const apiKey = process.env.SHOPIFY_API_KEY;
  return (
    data.discountNodes.nodes.find(
      (n: any) => n.discount?.__typename === "DiscountAutomaticApp" && n.discount.appDiscountType?.appKey === apiKey,
    ) ?? null
  );
}

/* ------------------------------------------------------------------ deals -- */
export async function listDeals(admin: AdminClient): Promise<Deal[]> {
  const data = await gql(
    admin,
    `#graphql
    query CroDeals { metaobjects(type: "$app:cro_deal", first: 100) { nodes { id handle fields { key value } } } }`,
  );
  const deals: Deal[] = data.metaobjects.nodes.map((node: any) => {
    const f = fieldsOf(node);
    return {
      id: node.id,
      handle: node.handle,
      kind: (f.kind?.value || "fixed") as DealKind,
      name: f.name?.value || "",
      active: bool(f.active, true),
      position: num(f.position, 0),
      config: json(f.config, {} as any),
    };
  });
  return deals.sort((a, b) => a.position - b.position || String(a.handle).localeCompare(String(b.handle)));
}

/** The storefront copy of active deals ($app:cro_offers "main"), read by the boosters script. */
async function syncStorefrontDeals(admin: AdminClient, deals: Deal[]) {
  const data = { deals: deals.filter((d) => d.active).map(toStorefrontDeal), t: DEAL_TEXT };
  await upsert(admin, "$app:cro_offers", "main", { data: JSON.stringify(data) });
}

export function buildDiscountConfig(rules: Rule[], deals: Deal[] = []) {
  const active = rules.filter((r) => r.active).sort((a, b) => a.priority - b.priority);
  const trigger = (r: Rule) => ({
    type: r.triggerType,
    products: r.triggerType === "products" ? r.triggerProducts.map((p) => p.id) : [],
    collections: r.triggerType === "collections" ? r.triggerCollections.map((c) => c.id) : [],
  });
  const config = {
    upsell: active
      .filter((r) => r.kind === "upsell")
      .map((r) =>
        r.upsellType === "variant"
          ? {
              trigger: trigger(r),
              type: "variant" as const,
              option: r.optionName,
              tiers: r.tiers.map((t) => ({ value: t.value || "", pct: t.pct })),
              label: r.discountLabel || r.headline || r.name,
            }
          : {
              trigger: trigger(r),
              tiers: r.tiers.map((t) => ({ qty: t.qty, pct: t.pct })),
              label: r.discountLabel || r.headline || r.name,
            },
      ),
    crossSell: active
      .filter((r) => r.kind === "cross_sell" && r.discountPercent > 0)
      .map((r) => ({
        trigger: trigger(r),
        offered: r.offeredProducts.map((p) => p.id),
        pct: r.discountPercent,
        label: r.discountLabel || r.headline || r.name,
      })),
    deals: deals.filter((d) => d.active).sort((a, b) => a.position - b.position).map(toFunctionDeal),
  };
  const dealCollections = config.deals.flatMap((d: any) =>
    [d.trigger, d.buy, d.get].filter(Boolean).flatMap((t: any) => t.collections || []),
  );
  const collectionIds = [
    ...new Set([...config.upsell, ...config.crossSell].flatMap((r) => r.trigger.collections).concat(dealCollections)),
  ];
  const needed =
    config.upsell.some((r) => r.tiers.some((t) => t.pct > 0)) || config.crossSell.length > 0 || config.deals.length > 0;
  return { config, collectionIds, needed };
}

async function deleteAutomaticDiscount(admin: AdminClient, id: string) {
  try {
    await gql(
      admin,
      `#graphql
      mutation CroDiscountDelete($id: ID!) {
        discountAutomaticDelete(id: $id) { deletedAutomaticDiscountId userErrors { field message } }
      }`,
      { id },
    );
  } catch {
    // Already deleted by the merchant — nothing to do.
  }
}

/** Keeps checkout discounts in line with the rules, using whichever engine applies to this shop. */
export async function syncDiscounts(admin: AdminClient): Promise<DiscountStatus> {
  const rules = await listRules(admin);
  const settings = await getDiscountSettings(admin);
  const resolved = await resolveDiscountEngine(admin, settings.mode);

  if (resolved.engine === "function") {
    for (const id of settings.nativeIds) await deleteAutomaticDiscount(admin, id);
    if (settings.nativeIds.length) await saveNativeIds(admin, []);
    const status = await syncFunctionDiscount(admin, rules);
    return { ...status, ...resolved, nativeCount: 0 };
  }

  // Native: never let the Function discount run alongside (it would double-discount).
  // Bundle deals need the Function, so the storefront must not advertise them here.
  await syncStorefrontDeals(admin, []);
  const fn = await findOfferDiscount(admin);
  if (fn) await deleteAutomaticDiscount(admin, fn.id);

  const specs = buildNativeDiscounts(rules, await resolveVariantTiers(admin, rules));
  if (specs.length > NATIVE_LIMIT) {
    throw new AdminError(
      `Native discounts: your rules need ${specs.length} automatic discounts, but Shopify allows only about 25 active at once (the app keeps ${NATIVE_LIMIT} for itself). Merge rules or use fewer upsell tiers.`,
    );
  }
  for (const id of settings.nativeIds) await deleteAutomaticDiscount(admin, id);
  const ids: string[] = [];
  try {
    for (const spec of specs) ids.push(await createNativeDiscount(admin, spec));
  } finally {
    await saveNativeIds(admin, ids);
  }
  return { id: null, status: ids.length ? "ACTIVE" : null, needed: specs.length > 0, ...resolved, nativeCount: ids.length };
}

/* ---- native automatic discounts (all plans) ---- */
const NATIVE_LIMIT = 20;
const COMBINES = { orderDiscounts: true, productDiscounts: false, shippingDiscounts: true };
// Shopify files "Amount off products" on all products under ORDER discounts, and order discounts
// that combine with each other stack — so the 2+ and 3+ tiers would both apply. Not combining
// with other order discounts makes Shopify apply only the best tier.
const COMBINES_ORDER = { ...COMBINES, orderDiscounts: false };

type NativeSpec =
  | { kind: "basic"; title: string; items: Record<string, unknown>; pct: number; minQty: number }
  | { kind: "bxgy"; title: string; buys: Record<string, unknown>; gets: string[]; pct: number };

function triggerItems(r: Rule): Record<string, unknown> {
  if (r.triggerType === "products") return { products: { productsToAdd: r.triggerProducts.map((p) => p.id) } };
  if (r.triggerType === "collections") return { collections: { add: r.triggerCollections.map((c) => c.id) } };
  return { all: true };
}

/**
 * Maps rules onto Shopify's own discount types:
 *  - upsell tier (qty ≥ n → x%)  → "Amount off products", minimum quantity n
 *  - cross-sell with triggers     → "Buy X get Y": buy a trigger, x% off the offered products
 *  - cross-sell for all products  → "Amount off products" on the offered products (no trigger:
 *    Shopify's Buy X get Y needs specific products or collections)
 * Product discounts don't combine with each other, so Shopify applies the best one per cart.
 */
/** For "variant" upsells: rule handle → option value (lower-case) → variant ids of the trigger products. */
type VariantTierMap = Map<string, Map<string, string[]>>;

async function resolveVariantTiers(admin: AdminClient, rules: Rule[]): Promise<VariantTierMap> {
  const out: VariantTierMap = new Map();
  for (const r of rules) {
    if (!r.active || r.kind !== "upsell" || r.upsellType !== "variant" || r.triggerType === "all") continue;
    const productIds = new Set<string>(r.triggerType === "products" ? r.triggerProducts.map((p) => p.id) : []);
    for (const c of r.triggerType === "collections" ? r.triggerCollections : []) {
      const data = await gql(
        admin,
        `#graphql
        query CroCollectionProducts($id: ID!) {
          collection(id: $id) { products(first: 250) { nodes { id } } }
        }`,
        { id: c.id },
      );
      for (const p of data.collection?.products.nodes ?? []) productIds.add(p.id);
    }
    const byValue = new Map<string, string[]>();
    const ids = [...productIds];
    for (let i = 0; i < ids.length; i += 50) {
      const data = await gql(
        admin,
        `#graphql
        query CroVariantOptions($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product { variants(first: 100) { nodes { id selectedOptions { name value } } } }
          }
        }`,
        { ids: ids.slice(i, i + 50) },
      );
      for (const p of data.nodes) {
        for (const v of p?.variants?.nodes ?? []) {
          const opt = v.selectedOptions.find((o: any) => o.name.toLowerCase() === r.optionName.trim().toLowerCase());
          if (!opt) continue;
          const key = String(opt.value).toLowerCase();
          byValue.set(key, [...(byValue.get(key) ?? []), v.id]);
        }
      }
    }
    out.set(r.handle || r.name, byValue);
  }
  return out;
}

export function buildNativeDiscounts(rules: Rule[], variantTiers: VariantTierMap = new Map()): NativeSpec[] {
  const specs: NativeSpec[] = [];
  const used = new Set<string>();
  const unique = (title: string) => {
    let t = title.trim() || "Offer";
    for (let n = 2; used.has(t.toLowerCase()); n++) t = `${title} (${n})`;
    used.add(t.toLowerCase());
    return t;
  };
  const active = rules.filter((r) => r.active).sort((a, b) => a.priority - b.priority);
  for (const r of active) {
    const label = r.discountLabel || r.headline || r.name;
    if (r.kind === "upsell" && r.upsellType === "variant") {
      // Size-upgrade tiers: a discount on exactly the variants with that option value.
      // ("All products" can't be listed variant by variant — the rule editor warns about it.)
      const byValue = variantTiers.get(r.handle || r.name);
      for (const t of r.tiers) {
        const ids = byValue?.get(String(t.value || "").toLowerCase()) ?? [];
        if (!(t.pct > 0) || !ids.length) continue;
        specs.push({
          kind: "basic",
          title: unique(`${label} (${t.value})`),
          items: { products: { productVariantsToAdd: ids.slice(0, 100) } },
          pct: t.pct,
          minQty: 1,
        });
      }
    } else if (r.kind === "upsell") {
      for (const t of r.tiers) {
        if (!(t.pct > 0)) continue;
        specs.push({ kind: "basic", title: unique(`${label} (${t.qty}+)`), items: triggerItems(r), pct: t.pct, minQty: t.qty });
      }
    } else if (r.discountPercent > 0 && r.offeredProducts.length) {
      const offered = r.offeredProducts.map((p) => p.id);
      if (r.triggerType === "all") {
        specs.push({ kind: "basic", title: unique(label), items: { products: { productsToAdd: offered } }, pct: r.discountPercent, minQty: 1 });
      } else {
        specs.push({ kind: "bxgy", title: unique(label), buys: triggerItems(r), gets: offered, pct: r.discountPercent });
      }
    }
  }
  return specs;
}

async function createNativeDiscount(admin: AdminClient, spec: NativeSpec): Promise<string> {
  const startsAt = new Date().toISOString();
  const percentage = Math.round((spec.pct / 100) * 10000) / 10000;
  if (spec.kind === "basic") {
    const data = await gql(
      admin,
      `#graphql
      mutation CroNativeBasic($d: DiscountAutomaticBasicInput!) {
        discountAutomaticBasicCreate(automaticBasicDiscount: $d) {
          automaticDiscountNode { id }
          userErrors { field message }
        }
      }`,
      {
        d: {
          title: spec.title,
          startsAt,
          combinesWith: "all" in spec.items ? COMBINES_ORDER : COMBINES,
          ...(spec.minQty > 1 ? { minimumRequirement: { quantity: { greaterThanOrEqualToQuantity: String(spec.minQty) } } } : {}),
          customerGets: { value: { percentage }, items: spec.items },
        },
      },
    );
    return data.discountAutomaticBasicCreate.automaticDiscountNode.id;
  }
  const data = await gql(
    admin,
    `#graphql
    mutation CroNativeBxgy($d: DiscountAutomaticBxgyInput!) {
      discountAutomaticBxgyCreate(automaticBxgyDiscount: $d) {
        automaticDiscountNode { id }
        userErrors { field message }
      }
    }`,
    {
      d: {
        title: spec.title,
        startsAt,
        combinesWith: COMBINES,
        customerBuys: { value: { quantity: "1" }, items: spec.buys },
        customerGets: {
          value: { discountOnQuantity: { quantity: String(spec.gets.length), effect: { percentage } } },
          items: { products: { productsToAdd: spec.gets } },
        },
      },
    },
  );
  return data.discountAutomaticBxgyCreate.automaticDiscountNode.id;
}

async function syncFunctionDiscount(
  admin: AdminClient,
  rules: Rule[],
): Promise<{ id: string | null; status: string | null; needed: boolean }> {
  const deals = await listDeals(admin);
  const { config, collectionIds, needed } = buildDiscountConfig(rules, deals);
  const value = JSON.stringify(config);
  if (value.length > FUNCTION_METAFIELD_LIMIT) {
    throw new AdminError(
      `Your discounted rules are too large for Shopify's discount engine (${value.length} of ${FUNCTION_METAFIELD_LIMIT} bytes). Use collections instead of long product lists, or remove unused rules.`,
    );
  }
  if (collectionIds.length > FUNCTION_LIST_LIMIT) {
    throw new AdminError(`Discounted rules can use at most ${FUNCTION_LIST_LIMIT} different collections in total.`);
  }
  const metafields = [
    { namespace: "$app", key: "function-configuration", type: "json", value },
    { namespace: "$app", key: "function-input", type: "json", value: JSON.stringify({ collectionIds }) },
  ];

  const existing = await findOfferDiscount(admin);
  if (existing) {
    await gql(
      admin,
      `#graphql
      mutation CroDiscountConfig($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) { metafields { id } userErrors { field message } }
      }`,
      { metafields: metafields.map((m) => ({ ...m, ownerId: existing.id })) },
    );
    // The storefront copy is written only after checkout's config is saved, so shoppers are never
    // shown a deal that checkout doesn't apply.
    await syncStorefrontDeals(admin, deals);
    return { id: existing.id, status: existing.discount.status, needed };
  }
  if (!needed) {
    await syncStorefrontDeals(admin, deals);
    return { id: null, status: null, needed };
  }

  const data = await gql(
    admin,
    `#graphql
    mutation CroDiscountCreate($discount: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $discount) {
        automaticAppDiscount { discountId status }
        userErrors { field message }
      }
    }`,
    {
      discount: {
        title: "Ultimate CRO offers",
        functionHandle: "cro-discount",
        discountClasses: ["PRODUCT"],
        startsAt: new Date().toISOString(),
        combinesWith: { orderDiscounts: true, productDiscounts: false, shippingDiscounts: true },
        metafields,
      },
    },
  );
  const created = data.discountAutomaticAppCreate.automaticAppDiscount;
  await syncStorefrontDeals(admin, deals);
  return { id: created.discountId, status: created.status, needed };
}

export async function getDiscountStatus(admin: AdminClient): Promise<DiscountStatus> {
  const settings = await getDiscountSettings(admin);
  const resolved = await resolveDiscountEngine(admin, settings.mode);
  const existing = resolved.engine === "function" ? await findOfferDiscount(admin) : null;
  return {
    id: existing?.id ?? null,
    status: existing?.discount.status ?? (settings.nativeIds.length ? "ACTIVE" : null),
    needed: false,
    ...resolved,
    nativeCount: resolved.engine === "native" ? settings.nativeIds.length : 0,
  };
}

/* --------------------------------------------------------------- carousel -- */
export async function getSlides(admin: AdminClient): Promise<Slide[]> {
  const data = await gql(
    admin,
    `#graphql
    ${REF_FRAGMENT}
    query CroCarousel {
      metaobjectByHandle(handle: { type: "$app:cro_carousel", handle: "main" }) {
        field(key: "slides") {
          references(first: 50) {
            nodes {
              ... on Metaobject {
                id
                fields { key value reference { ...CroRef } }
              }
            }
          }
        }
      }
    }`,
  );
  const nodes = data.metaobjectByHandle?.field?.references?.nodes ?? [];
  return nodes.map((node: any) => {
    const f = fieldsOf(node);
    const video = toRef(f.video?.reference);
    const image = toRef(f.image?.reference);
    return {
      video: video ? { ...video, kind: "video" as const } : image ? { ...image, kind: "image" as const } : null,
      product: toRef(f.product?.reference),
      caption: f.caption?.value || "",
    };
  });
}

export async function saveSlides(admin: AdminClient, slides: Slide[]) {
  const oldData = await gql(
    admin,
    `#graphql
    query CroOldSlides { metaobjects(type: "$app:cro_slide", first: 100) { nodes { id } } }`,
  );
  // Slides are recreated on every save: simpler than clearing optional reference fields.
  const created: string[] = [];
  for (const s of slides.filter((s) => s.video)) {
    const mo = await create(admin, "$app:cro_slide", {
      video: s.video!.kind === "video" ? s.video!.id : "",
      image: s.video!.kind === "image" ? s.video!.id : "",
      product: s.product?.id ?? "",
      caption: s.caption.trim(),
    });
    created.push(mo.id);
  }
  await upsert(admin, "$app:cro_carousel", "main", { slides: JSON.stringify(created) });
  for (const { id } of oldData.metaobjects.nodes) await remove(admin, id);
}

export async function listVideoFiles(admin: AdminClient) {
  const data = await gql(
    admin,
    `#graphql
    query CroVideoFiles {
      files(first: 50, query: "media_type:VIDEO", sortKey: CREATED_AT, reverse: true) {
        nodes {
          ... on Video { id alt filename duration preview { image { url } } }
        }
      }
    }`,
  );
  return data.files.nodes
    .filter((n: any) => n?.id)
    .map((n: any) => ({
      id: n.id as string,
      title: (n.alt || n.filename || "Video") as string,
      image: (n.preview?.image?.url ?? null) as string | null,
      duration: n.duration as number | null,
    }));
}

export async function listProductVideos(admin: AdminClient, productId: string) {
  const data = await gql(
    admin,
    `#graphql
    query CroProductVideos($id: ID!) {
      product(id: $id) {
        id
        title
        media(first: 50) {
          nodes { mediaContentType ... on Video { id alt preview { image { url } } } }
        }
      }
    }`,
    { id: productId },
  );
  const product = data.product;
  if (!product) return [];
  return product.media.nodes
    .filter((m: any) => m.mediaContentType === "VIDEO" && m.id)
    .map((m: any) => ({
      id: m.id as string,
      title: (m.alt || product.title) as string,
      image: (m.preview?.image?.url ?? null) as string | null,
      duration: null,
    }));
}

/* ---------------------------------------------------------------- bundles -- */
export async function listBundles(admin: AdminClient): Promise<Bundle[]> {
  const data = await gql(
    admin,
    `#graphql
    ${REF_FRAGMENT}
    query CroBundles {
      metaobjects(type: "$app:cro_bundle", first: 50) {
        nodes {
          id
          handle
          fields {
            key
            value
            reference { ...CroRef }
            references(first: 20) {
              nodes {
                ... on Metaobject {
                  id
                  fields {
                    key
                    value
                    reference { ...CroRef }
                    references(first: 50) { nodes { ...CroRef } }
                  }
                }
              }
            }
          }
        }
      }
    }`,
  );
  return data.metaobjects.nodes.map((node: any) => {
    const f = fieldsOf(node);
    return {
      id: node.id,
      handle: node.handle,
      name: f.name?.value || "Untitled bundle",
      active: bool(f.active, true),
      product: toRef(f.product?.reference),
      allowDuplicates: bool(f.allow_duplicates),
      hideSoldOut: bool(f.hide_sold_out, true),
      steps: (f.steps?.references?.nodes ?? []).map((s: any) => {
        const sf = fieldsOf(s);
        return {
          label: sf.label?.value || "",
          required: bool(sf.required, true),
          min: num(sf.min_picks, 1),
          max: num(sf.max_picks, 1),
          products: refs(sf.products),
          collection: toRef(sf.collection?.reference),
        } satisfies BundleStep;
      }),
    } satisfies Bundle;
  });
}


export async function saveBundle(admin: AdminClient, bundle: Bundle) {
  const all = await listBundles(admin);
  const errors = validateBundle(bundle, all);
  if (errors.length) throw new AdminError(errors.join(" "));

  // Check the checkout-side size before writing anything.
  const previous = all.find((b) => b.handle === bundle.handle);
  const next = [...all.filter((b) => b.handle !== bundle.handle), bundle];
  await buildBundleConfig(admin, next);

  const oldSteps = previous?.handle ? await stepIds(admin, previous.handle) : [];
  const stepIdsNew: string[] = [];
  for (const s of bundle.steps) {
    const mo = await create(admin, "$app:cro_bundle_step", {
      label: s.label.trim(),
      required: String(s.required),
      min_picks: String(s.required ? Math.max(1, Math.round(s.min)) : 0),
      max_picks: String(Math.max(1, Math.round(s.max))),
      products: s.collection ? "[]" : JSON.stringify(s.products.map((p) => p.id)),
      collection: s.collection?.id ?? "",
    });
    stepIdsNew.push(mo.id);
  }
  const saved = await upsert(admin, "$app:cro_bundle", bundle.handle || slug("bundle"), {
    name: bundle.name.trim(),
    active: String(bundle.active),
    product: bundle.product!.id,
    steps: JSON.stringify(stepIdsNew),
    allow_duplicates: String(bundle.allowDuplicates),
    hide_sold_out: String(bundle.hideSoldOut),
  });
  for (const id of oldSteps) await remove(admin, id);
  await syncBundles(admin);
  return saved;
}

async function stepIds(admin: AdminClient, handle: string): Promise<string[]> {
  const data = await gql(
    admin,
    `#graphql
    query CroBundleSteps($handle: MetaobjectHandleInput!) {
      metaobjectByHandle(handle: $handle) {
        field(key: "steps") { references(first: 20) { nodes { ... on Metaobject { id } } } }
      }
    }`,
    { handle: { type: "$app:cro_bundle", handle } },
  );
  return (data.metaobjectByHandle?.field?.references?.nodes ?? []).map((n: any) => n.id);
}

export async function deleteBundle(admin: AdminClient, handle: string) {
  const all = await listBundles(admin);
  const bundle = all.find((b) => b.handle === handle);
  if (!bundle?.id) return;
  const steps = await stepIds(admin, handle);
  await remove(admin, bundle.id);
  for (const id of steps) await remove(admin, id);
  await syncBundles(admin);
}

async function productVariantIds(admin: AdminClient, productIds: string[]) {
  const out = new Map<string, string[]>();
  for (let i = 0; i < productIds.length; i += 50) {
    const data = await gql(
      admin,
      `#graphql
      query CroVariants($ids: [ID!]!) {
        nodes(ids: $ids) { ... on Product { id variants(first: 100) { nodes { id } } } }
      }`,
      { ids: productIds.slice(i, i + 50) },
    );
    for (const p of data.nodes) if (p?.id) out.set(p.id, p.variants.nodes.map((v: any) => v.id));
  }
  return out;
}

async function collectionVariantIds(admin: AdminClient, collectionId: string): Promise<string[]> {
  // First 50 products in the collection's own order — the same 50 the storefront block shows.
  const data = await gql(
    admin,
    `#graphql
    query CroCollectionVariants($id: ID!) {
      collection(id: $id) {
        products(first: 50, sortKey: COLLECTION_DEFAULT) {
          nodes { variants(first: 100) { nodes { id } } }
        }
      }
    }`,
    { id: collectionId },
  );
  return (data.collection?.products.nodes ?? []).flatMap((p: any) => p.variants.nodes.map((v: any) => v.id));
}

export async function buildBundleConfig(admin: AdminClient, bundles: Bundle[]) {
  const active = bundles.filter((b) => b.active && b.product);
  const productIds = [...new Set(active.flatMap((b) => b.steps.flatMap((s) => (s.collection ? [] : s.products.map((p) => p.id)))))];
  const variants = await productVariantIds(admin, productIds);
  const b: Record<string, { d: 0 | 1; s: { n: number; x: number; v: string[] }[] }> = {};
  for (const bundle of active) {
    const steps = [];
    for (const s of bundle.steps) {
      const ids = s.collection
        ? await collectionVariantIds(admin, s.collection.id)
        : s.products.flatMap((p) => variants.get(p.id) ?? []);
      const min = s.required ? Math.max(1, Math.round(s.min)) : 0;
      steps.push({
        n: min,
        x: Math.max(min, Math.round(s.max)),
        v: [...new Set(ids.map((id) => Number(numericId(id)).toString(36)))],
      });
    }
    b[numericId(bundle.product!.id)] = { d: bundle.allowDuplicates ? 1 : 0, s: steps };
  }
  const value = JSON.stringify({ b });
  if (value.length > FUNCTION_METAFIELD_LIMIT) {
    throw new AdminError(
      `Your bundles offer too many product variants for Shopify's checkout engine (${value.length} of ${FUNCTION_METAFIELD_LIMIT} bytes). Use smaller collections or fewer products per step.`,
    );
  }
  return value;
}

export async function syncBundles(admin: AdminClient) {
  const value = await buildBundleConfig(admin, await listBundles(admin));
  const data = await gql(
    admin,
    `#graphql
    query CroCartTransforms { cartTransforms(first: 5) { nodes { id } } }`,
  );
  const existing = data.cartTransforms.nodes[0];
  if (!existing && (await resolveDiscountEngine(admin)).engine === "native") {
    // Custom install on a non-Plus plan: Shopify doesn't run custom-app Cart Transforms there.
    // Bundles still sell at the bundle price with the picks on the order; stock isn't split.
    return null;
  }
  const metafield = { namespace: "$app", key: "bundles", type: "json", value };
  if (existing) {
    await gql(
      admin,
      `#graphql
      mutation CroBundleConfig($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) { metafields { id } userErrors { field message } }
      }`,
      { metafields: [{ ...metafield, ownerId: existing.id }] },
    );
    return existing.id as string;
  }
  const created = await gql(
    admin,
    `#graphql
    mutation CroCartTransformCreate($metafields: [MetafieldInput!]) {
      cartTransformCreate(functionHandle: "cro-bundles", blockOnFailure: false, metafields: $metafields) {
        cartTransform { id }
        userErrors { field message }
      }
    }`,
    { metafields: [metafield] },
  );
  return created.cartTransformCreate.cartTransform.id as string;
}

export async function hasCartTransform(admin: AdminClient) {
  const data = await gql(
    admin,
    `#graphql
    query CroHasCartTransform { cartTransforms(first: 1) { nodes { id } } }`,
  );
  return data.cartTransforms.nodes.length > 0;
}

/* ------------------------------------------------------------ theme status -- */
export const BLOCKS = {
  cross_sell: "ucro-cross-sell",
  upsell: "ucro-upsell",
  videos: "ucro-video-carousel",
  bundles: "ucro-bundle-builder",
  drawer: "ucro-cart-offers",
  reviews: "ucs-reviews",
  faq: "ucs-faq",
  logos: "ucs-logos",
  announcements: "ucs-announcement",
  quick_add: "ucs-quick-add",
  hero: "ucs-hero",
  countdown: "ucs-countdown",
  countdown_bar: "ucs-countdown-bar",
  boosters: "ucs-boosters",
} as const;

/** App embeds (switched on in App embeds) rather than blocks placed in a template. */
const EMBEDS: (keyof typeof BLOCKS)[] = ["drawer", "announcements", "quick_add", "countdown_bar", "boosters"];

export type ThemeStatus = {
  themeName: string | null;
  installed: Record<keyof typeof BLOCKS, boolean>;
};

/** Reads the published theme (read_themes) to see which blocks/embeds are actually in use. */
export async function getThemeStatus(admin: AdminClient): Promise<ThemeStatus> {
  const installed = Object.fromEntries(Object.keys(BLOCKS).map((k) => [k, false])) as ThemeStatus["installed"];
  const data = await gql(
    admin,
    `#graphql
    query CroTheme {
      themes(first: 1, roles: [MAIN]) {
        nodes {
          name
          files(first: 250, filenames: ["templates/*.json", "sections/*.json", "config/settings_data.json"]) {
            nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } }
          }
        }
      }
    }`,
  );
  const theme = data.themes.nodes[0];
  if (!theme) return { themeName: null, installed };
  for (const file of theme.files.nodes) {
    const content: string = file.body?.content ?? "";
    for (const [key, handle] of Object.entries(BLOCKS) as [keyof typeof BLOCKS, string][]) {
      if (EMBEDS.includes(key)) continue;
      if (content.includes(`/blocks/${handle}/`)) installed[key] = true;
    }
    if (file.filename === "config/settings_data.json") {
      for (const key of EMBEDS) installed[key] = embedEnabled(content, BLOCKS[key]);
    }
  }
  return { themeName: theme.name, installed };
}

function embedEnabled(settingsData: string, handle: string) {
  try {
    const clean = settingsData.replace(/^\s*\/\*[\s\S]*?\*\//, "");
    const blocks = JSON.parse(clean)?.current?.blocks ?? {};
    return Object.values<any>(blocks).some((b) => String(b.type).includes(`/blocks/${handle}/`) && b.disabled !== true);
  } catch {
    return false;
  }
}

/** Theme editor deep links that add our block (or switch on our embed) in one click. */
export function editorLinks(shop: string) {
  const key = process.env.SHOPIFY_API_KEY;
  const base = `https://${shop}/admin/themes/current/editor`;
  return {
    cross_sell: `${base}?template=product&addAppBlockId=${key}/${BLOCKS.cross_sell}&target=mainSection`,
    upsell: `${base}?template=product&addAppBlockId=${key}/${BLOCKS.upsell}&target=mainSection`,
    videos: `${base}?template=index&addAppBlockId=${key}/${BLOCKS.videos}&target=newAppsSection`,
    bundles: `${base}?template=product&addAppBlockId=${key}/${BLOCKS.bundles}&target=mainSection`,
    drawer: `${base}?context=apps&activateAppId=${key}/${BLOCKS.drawer}`,
    editor: base,
  };
}
