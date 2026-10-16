/* eslint-disable @typescript-eslint/no-explicit-any -- raw Admin API JSON; operations are schema-checked by `npm run graphql-codegen` */
/**
 * CRO Toolbox — all merchant configuration lives in Shopify, never in our database.
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
import { remember } from "./short-cache.server";
import { syncBundleGuard } from "./checkout-rules.server";

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
import { FEATURE_KEYS, bundlePricing } from "./types";
import { validateBundle, validateRule } from "./validate";
import { DEAL_TEXT, fbtForStorefront, normalizeFbt, toFunctionDeal, toStorefrontDeal, type Deal, type DealKind, type FbtDesign } from "./deals";
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
    ...(node.handle ? { handle: node.handle } : {}),
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
    ... on Product { title handle featuredMedia { preview { image { url } } } }
    ... on Collection { title handle image { url } }
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
    // The app's storage types come from shopify.app.toml; Shopify adds them to a store a little
    // after each release. Until then say so plainly instead of Shopify's raw message.
    if (e instanceof Error && /No metaobject definition exists/i.test(e.message)) {
      throw new AdminError("Shopify is still setting up this app's storage on your store after the update. Try again in a few minutes. If it keeps happening, reopen the app from Apps.");
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

/** Replaces the saved list (the Home page sends the whole list, newest first). */
export async function setSavedSections(admin: AdminClient, list: unknown) {
  const next = [...new Set(Array.isArray(list) ? list.filter((k): k is string => typeof k === "string" && k.length <= 60) : [])].slice(0, 100);
  await upsert(admin, "$app:cro_settings", "settings", { saved_sections: JSON.stringify(next) });
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

/** The automatic discount that runs the offer Function (merchants see it under Discounts). */
const OFFER_DISCOUNT_TITLE = "CRO Toolbox offers";

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

/** The "Frequently bought together" box design ($app:cro_design "fbt"), with defaults. */
export async function getFbtDesign(admin: AdminClient): Promise<FbtDesign> {
  const data = await gql(admin, `#graphql
    query CroFbt { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "fbt" }) { field(key: "config") { value } } }`);
  try {
    return normalizeFbt(JSON.parse(data.metaobjectByHandle?.field?.value ?? "null"));
  } catch {
    return normalizeFbt(null);
  }
}

/** Save the box design; the caller re-syncs the deals (syncDiscounts) so the store picks it up. */
export async function saveFbtDesign(admin: AdminClient, fbt: unknown) {
  await upsert(admin, "$app:cro_design", "fbt", { config: JSON.stringify(normalizeFbt(fbt)) });
}

/** The storefront copy of active deals ($app:cro_offers "main"), read by the boosters script. */
async function syncStorefrontDeals(admin: AdminClient, deals: Deal[]) {
  const fbt = await getFbtDesign(admin).catch(() => normalizeFbt(null));
  const data = { deals: deals.filter((d) => d.active).map(toStorefrontDeal), t: DEAL_TEXT, fbt: fbtForStorefront(fbt) };
  await upsert(admin, "$app:cro_offers", "main", { data: JSON.stringify(data) });
}

/**
 * `skip`: product ids (numbers) whose lines are bundles already priced as a bundle (mix & match
 * bundle products, merged at checkout, and bundle products/kits), so no offer discount stacks on them.
 */
export function buildDiscountConfig(rules: Rule[], deals: Deal[] = [], skip: string[] = []) {
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
    deals: deals.filter((d) => d.active).sort((a, b) => a.position - b.position).map(toFunctionDeal).filter((x) => x !== null),
    ...(skip.length ? { skip: [...new Set(skip)] } : {}),
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
  // Bundles are priced as bundles: offer discounts must not stack on them (kits loaded lazily:
  // kits.server imports this file).
  const [deals, bundles, kitIds] = await Promise.all([
    listDeals(admin),
    listBundles(admin).catch(() => []),
    import("./kits.server").then((m) => m.listKitIds(admin)).catch(() => [] as string[]),
  ]);
  const skip = [...bundles.flatMap((b) => (b.product ? [b.product.id] : [])), ...kitIds].map(numericId);
  const { config, collectionIds, needed } = buildDiscountConfig(rules, deals, skip);
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
    // Discounts made before the app was renamed keep their old title until the next save.
    if (existing.discount.title !== OFFER_DISCOUNT_TITLE) {
      await gql(
        admin,
        `#graphql
        mutation CroDiscountRename($id: ID!, $discount: DiscountAutomaticAppInput!) {
          discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $discount) { userErrors { field message } }
        }`,
        { id: existing.id, discount: { title: OFFER_DISCOUNT_TITLE } },
      ).catch(() => null); // a cosmetic rename never blocks saving offers
    }
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
        title: OFFER_DISCOUNT_TITLE,
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
const jsonList = (v: unknown): string[] => {
  try {
    const a = JSON.parse(String(v ?? "[]"));
    return Array.isArray(a) ? a.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** Products (or any nodes) as refs, 100 per query, keyed by id. */
async function refsByIds(admin: AdminClient, ids: string[]) {
  const out = new Map<string, Ref>();
  for (let i = 0; i < ids.length; i += 100) {
    const data = await gql(
      admin,
      `#graphql
      ${REF_FRAGMENT}
      query CroRefs($ids: [ID!]!) { nodes(ids: $ids) { ...CroRef } }`,
      { ids: ids.slice(i, i + 100) },
    );
    for (const n of data.nodes ?? []) {
      const r = toRef(n);
      if (r) out.set(r.id, r);
    }
  }
  return out;
}

/** Up to 50 bundles (the storefront's limit), read 25 at a time to keep each query's cost low. */
export async function listBundles(admin: AdminClient): Promise<Bundle[]> {
  const nodes: any[] = [];
  let after: string | null = null;
  for (let page = 0; page < 2; page++) {
    const data: any = await gql(
      admin,
      `#graphql
      ${REF_FRAGMENT}
      query CroBundles($after: String) {
        metaobjects(type: "$app:cro_bundle", first: 25, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            handle
            # One aliased field each, so only the reference fields ask for references (keeps the cost low).
            name: field(key: "name") { key value }
            active: field(key: "active") { key value }
            product: field(key: "product") { key value reference { ...CroRef } }
            allow_duplicates: field(key: "allow_duplicates") { key value }
            hide_sold_out: field(key: "hide_sold_out") { key value }
            pricing: field(key: "pricing") { key value }
            percent_off: field(key: "percent_off") { key value }
            price_rules: field(key: "price_rules") { key value }
            store_wide: field(key: "store_wide") { key value }
            page: field(key: "page") { key value reference { ... on Page { id title handle } } }
            steps: field(key: "steps") {
              key
              value
              references(first: 10) {
                nodes {
                  ... on Metaobject {
                    id
                    label: field(key: "label") { key value }
                    required: field(key: "required") { key value }
                    min_picks: field(key: "min_picks") { key value }
                    max_picks: field(key: "max_picks") { key value }
                    collection: field(key: "collection") { key value reference { ...CroRef } }
                    products: field(key: "products") { key value }
                  }
                }
              }
            }
          }
        }
      }`,
      { after },
    );
    nodes.push(...data.metaobjects.nodes);
    if (!data.metaobjects.pageInfo.hasNextPage) break;
    after = data.metaobjects.pageInfo.endCursor;
  }
  const aliased = (node: any, keys: string[]) => ({ fields: keys.map((k) => node[k]).filter(Boolean) as Field[] });
  // Step products are stored as a list of ids; load them all in one go (a nested connection per step costs too much).
  const productIds = new Set<string>();
  for (const node of nodes) {
    for (const s of node.steps?.references?.nodes ?? []) for (const id of jsonList(s.products?.value)) productIds.add(id);
  }
  const products = await refsByIds(admin, [...productIds]);
  return nodes.map((node: any) => {
    const f = fieldsOf(aliased(node, ["name", "active", "product", "allow_duplicates", "hide_sold_out", "pricing", "percent_off", "price_rules", "store_wide", "steps"]));
    const rules = fromPriceRules(json<any>(f.price_rules, null));
    return {
      id: node.id,
      handle: node.handle,
      name: f.name?.value || "Untitled bundle",
      active: bool(f.active, true),
      product: toRef(f.product?.reference),
      allowDuplicates: bool(f.allow_duplicates),
      hideSoldOut: bool(f.hide_sold_out, true),
      pricing: bundlePricing(f.pricing?.value),
      percentOff: Math.min(90, Math.max(0, Number(f.percent_off?.value) || 0)),
      tiers: rules.tiers,
      extras: rules.extras,
      storeWide: bool(f.store_wide, true),
      page: node.page?.reference?.id ? { id: node.page.reference.id, title: node.page.reference.title, handle: node.page.reference.handle } : null,
      steps: (f.steps?.references?.nodes ?? []).map((s: any) => {
        const sf = fieldsOf(aliased(s, ["label", "required", "min_picks", "max_picks", "collection", "products"]));
        return {
          label: sf.label?.value || "",
          required: bool(sf.required, true),
          min: num(sf.min_picks, 1),
          max: num(sf.max_picks, 1),
          products: jsonList(sf.products?.value).flatMap((id) => (products.has(id) ? [products.get(id)!] : [])),
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
    pricing: bundlePricing(bundle.pricing),
    percent_off: String(Math.min(90, Math.max(0, Number(bundle.percentOff) || 0))),
    price_rules: JSON.stringify(toPriceRules(bundle)),
    store_wide: String(bundle.storeWide !== false),
    page: bundle.page?.id ?? "",
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

/**
 * Tiers and option extras, in the compact form both the storefront (price_rules field, read by
 * Liquid) and the Cart Transform use, sorted by item count:
 *   tiers          { tr: [[qty, price cents]…] }
 *   percent_tiers  { pt: [[min qty, percent]…] }
 *   amount_tiers   { at: [[min qty, cents off]…] }
 * plus option extras { ex: { "xl": cents } } for the fixed and tier prices.
 */
export function toPriceRules(bundle: Pick<Bundle, "pricing" | "tiers" | "extras">) {
  const rows = [...(bundle.tiers ?? [])].filter((t) => t.qty >= 1 && t.price > 0).sort((a, b) => a.qty - b.qty);
  const tr = bundle.pricing === "tiers" ? rows.map((t) => [Math.round(t.qty), Math.round(t.price * 100)]) : [];
  const out: { tr: number[][]; ex: Record<string, number>; pt?: number[][]; at?: number[][] } = { tr, ex: {} };
  if (bundle.pricing === "percent_tiers") out.pt = rows.map((t) => [Math.round(t.qty), Math.min(90, Math.round(t.price * 100) / 100)]);
  if (bundle.pricing === "amount_tiers") out.at = rows.map((t) => [Math.round(t.qty), Math.round(t.price * 100)]);
  if (bundle.pricing === "fixed" || bundle.pricing === "tiers") {
    for (const x of bundle.extras ?? []) if (x.value.trim() && x.amount > 0) out.ex[x.value.trim().toLowerCase()] = Math.round(x.amount * 100);
  }
  return out;
}

function fromPriceRules(v: any): Pick<Bundle, "tiers" | "extras"> {
  const rows = (list: unknown, scale: number) =>
    Array.isArray(list) ? list.filter((t: unknown) => Array.isArray(t)).map(([qty, n]: number[]) => ({ qty: Number(qty) || 1, price: (Number(n) || 0) / scale })) : [];
  // One kind of tier per bundle: % (pt), amount off (at) or price (tr).
  const tiers = Array.isArray(v?.pt) ? rows(v.pt, 1) : Array.isArray(v?.at) ? rows(v.at, 100) : rows(v?.tr, 100);
  const extras = v?.ex && typeof v.ex === "object" ? Object.entries(v.ex).map(([value, cents]) => ({ value, amount: (Number(cents) || 0) / 100 })) : [];
  return { tiers, extras };
}

/** Each bundle product's first variant (the merged line's parent) and its price in cents. */
async function bundleParents(admin: AdminClient, productIds: string[]) {
  const out = new Map<string, { variant: string; cents: number }>();
  for (let i = 0; i < productIds.length; i += 50) {
    const data = await gql(
      admin,
      `#graphql
      query CroBundleParents($ids: [ID!]!) {
        nodes(ids: $ids) { ... on Product { id variants(first: 1) { nodes { id price } } } }
      }`,
      { ids: productIds.slice(i, i + 50) },
    );
    for (const p of data.nodes) {
      const v = p?.variants?.nodes?.[0];
      if (p?.id && v) out.set(p.id, { variant: numericId(v.id), cents: Math.round(Number(v.price) * 100) });
    }
  }
  return out;
}

/**
 * The checkout config for the cro-bundles Cart Transform: steps point at a collection (checked by
 * Shopify, any size) or a short product list, so it stays small for big catalogues.
 */
export async function buildBundleConfig(admin: AdminClient, bundles: Bundle[]) {
  const active = bundles.filter((b) => b.active && b.product);
  const parents = await bundleParents(admin, [...new Set(active.map((b) => b.product!.id))]);
  const collections = new Set<string>();
  const b: Record<string, unknown> = {};
  for (const bundle of active) {
    const parent = parents.get(bundle.product!.id);
    if (!parent) continue;
    b[numericId(bundle.product!.id)] = {
      pv: parent.variant,
      d: bundle.allowDuplicates ? 1 : 0,
      k: ({ fixed: "f", percent: "p", tiers: "t", percent_tiers: "pt", amount_tiers: "at" } as const)[bundle.pricing] ?? "f",
      pr: parent.cents,
      pc: bundle.pricing === "percent" ? bundle.percentOff : 0,
      ...toPriceRules(bundle),
      s: bundle.steps.map((s) => {
        const n = s.required ? Math.max(1, Math.round(s.min)) : 0;
        const x = Math.max(n, Math.round(s.max), 1);
        if (s.collection) {
          collections.add(s.collection.id);
          return { n, x, c: numericId(s.collection.id) };
        }
        return { n, x, p: s.products.map((p) => Number(numericId(p.id)).toString(36)) };
      }),
    };
  }
  const value = JSON.stringify({ b });
  if (value.length > FUNCTION_METAFIELD_LIMIT) {
    throw new AdminError(`Your bundles list too many single products for Shopify's checkout engine (${value.length} of ${FUNCTION_METAFIELD_LIMIT} bytes). Use a collection for the bigger steps.`);
  }
  return { value, vars: JSON.stringify({ collections: [...collections] }) };
}

/** How the storefront adds bundles: "merge" (picks as items, merged at checkout) or "line" (one bundle line). */
async function setBundleMode(admin: AdminClient, mode: "merge" | "line") {
  await upsert(admin, "$app:cro_design", "bundle_mode", { config: JSON.stringify({ m: mode }) });
}

/** The checkout guard that refuses a bare bundle product. A failure here never blocks saving a bundle. */
async function guardBundles(admin: AdminClient, productIds: string[]) {
  try {
    await syncBundleGuard(admin, productIds);
  } catch (error) {
    console.error("[bundle guard]", error);
  }
}

export async function syncBundles(admin: AdminClient) {
  const bundles = await listBundles(admin);
  const { value, vars } = await buildBundleConfig(admin, bundles);
  const data = await gql(
    admin,
    `#graphql
    query CroCartTransforms { cartTransforms(first: 5) { nodes { id } } }`,
  );
  const existing = data.cartTransforms.nodes[0];
  if (!existing && (await resolveDiscountEngine(admin)).engine === "native") {
    // Custom install on a non-Plus plan: Shopify doesn't run custom-app Cart Transforms there.
    // Bundles then sell as one line at the bundle price with the picks listed; stock isn't split.
    await setBundleMode(admin, "line");
    await guardBundles(admin, []);
    return null;
  }
  const metafields = [
    { namespace: "$app", key: "bundles", type: "json", value },
    { namespace: "$app", key: "bundle_vars", type: "json", value: vars },
  ];
  await setBundleMode(admin, "merge");
  // The bundle guard is off: Shopify's validation sees a merged bundle as one line with no picks
  // under it, so it refused real bundles (tested on Testing2, 2026-10-15). Passing no ids switches
  // off any guard made earlier.
  await guardBundles(admin, []);
  if (existing) {
    const set = await gql(
      admin,
      `#graphql
      mutation CroBundleConfig($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) { metafields { id } userErrors { field message } }
      }`,
      { metafields: metafields.map((m) => ({ ...m, ownerId: existing.id })) },
    );
    const errors = set.metafieldsSet?.userErrors ?? [];
    if (errors.length) throw new AdminError(errors.map((e: { message: string }) => e.message).join(" "));
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
    { metafields },
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
  bundle_button: "ucro-add-to-bundle",
  bundle_tray: "ucro-bundle-tray",
  drawer: "ucro-cart-offers",
  reviews: "ucs-reviews",
  product_reviews: "ucs-product-reviews",
  faq: "ucs-faq",
  logos: "ucs-logos",
  announcements: "ucs-announcement",
  quick_add: "ucs-quick-add",
  hero: "ucs-hero",
  countdown_bar: "ucs-countdown-bar",
  boosters: "ucs-boosters",
  contact: "ucs-contact",
  image_carousel: "ucs-image-carousel",
  addons: "ucs-addons",
  header: "ucs-header",
  footer: "ucs-footer",
  stock: "ucs-stock",
  delivery: "ucs-delivery",
  personalize: "ucs-personalize",
  cart_extras: "ucs-cart-extras",
  quiz: "ucs-quiz",
  wishlist: "ucs-boosters",
  track: "ucs-order-page",
  returns: "ucs-order-page",
  collection_pills: "ucs-collection-pills",
  shipping_bar: "ucs-shipping-bar",
} as const;

/** App embeds (switched on in App embeds) rather than blocks placed in a template. */
const EMBEDS: (keyof typeof BLOCKS)[] = ["drawer", "announcements", "quick_add", "boosters", "bundle_tray", "wishlist"];

export type ThemeStatus = {
  themeName: string | null;
  installed: Record<keyof typeof BLOCKS, boolean>;
  /** The theme files each block sits in (templates/index.json, sections/header-group.json…). */
  files: Record<keyof typeof BLOCKS, string[]>;
};

/** Reads the published theme (read_themes) to see which blocks/embeds are actually in use. */
/** Which blocks/embeds the MAIN theme uses; with `shop`, fresh for 20 s, then answered from memory
 * (refreshed in the background) for 10 min (see short-cache.server.ts). */
export function getThemeStatus(admin: AdminClient, shop?: string): Promise<ThemeStatus> {
  return shop ? remember(shop, "status", 20000, () => readThemeStatus(admin), 600000) : readThemeStatus(admin);
}

async function readThemeStatus(admin: AdminClient): Promise<ThemeStatus> {
  const installed = Object.fromEntries(Object.keys(BLOCKS).map((k) => [k, false])) as ThemeStatus["installed"];
  const files = Object.fromEntries(Object.keys(BLOCKS).map((k) => [k, []])) as unknown as ThemeStatus["files"];
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
  if (!theme) return { themeName: null, installed, files };
  for (const file of theme.files.nodes) {
    const content: string = file.body?.content ?? "";
    // Blocks live in templates and section groups; settings_data.json only holds app embeds.
    for (const [key, handle] of Object.entries(BLOCKS) as [keyof typeof BLOCKS, string][]) {
      if (EMBEDS.includes(key) || file.filename === "config/settings_data.json") continue;
      if (content.includes(`/blocks/${handle}/`)) {
        installed[key] = true;
        files[key].push(file.filename);
      }
    }
    if (file.filename === "config/settings_data.json") {
      for (const key of EMBEDS) installed[key] = embedEnabled(content, BLOCKS[key]);
    }
  }
  return { themeName: theme.name, installed, files };
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

/**
 * "Add to theme" for one bundle: the builder block added to the product template (opened on the
 * bundle product) and, for a store-page bundle, to the page template (opened on that page). The
 * block shows only on its bundle's product or page, so placing it once per template is enough.
 */
export function bundleBuilderLinks(shop: string, productHandle?: string | null, pageHandle?: string | null) {
  const key = process.env.SHOPIFY_API_KEY;
  const base = `https://${shop}/admin/themes/current/editor`;
  const block = `${key}/${BLOCKS.bundles}`;
  return {
    product: `${base}?template=product&addAppBlockId=${block}&target=mainSection${productHandle ? `&previewPath=${encodeURIComponent(`/products/${productHandle}`)}` : ""}`,
    page: pageHandle ? `${base}?template=page&addAppBlockId=${block}&target=newAppsSection&previewPath=${encodeURIComponent(`/pages/${pageHandle}`)}` : null,
    tray: `${base}?context=apps&activateAppId=${key}/${BLOCKS.bundle_tray}`,
    button: `${base}?template=product&addAppBlockId=${key}/${BLOCKS.bundle_button}&target=mainSection`,
  };
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
    bundle_button: `${base}?template=product&addAppBlockId=${key}/${BLOCKS.bundle_button}&target=mainSection`,
    bundle_tray: `${base}?context=apps&activateAppId=${key}/${BLOCKS.bundle_tray}`,
    drawer: `${base}?context=apps&activateAppId=${key}/${BLOCKS.drawer}`,
    contact: `${base}?template=page.contact&addAppBlockId=${key}/${BLOCKS.contact}&target=newAppsSection`,
    addons: `${base}?template=product&addAppBlockId=${key}/${BLOCKS.addons}&target=mainSection`,
    editor: base,
  };
}
