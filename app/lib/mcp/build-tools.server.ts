/**
 * The build and publish tools (docs/plans/mcp-server.md §3). Everything is a DRAFT:
 *   - a design is saved as the theme editor draft ("<feature>_draft", the "See it on my store" mechanism)
 *     and as a pending copy here; only publish copies it to the live design;
 *   - an offer is created switched off; only publish_offer turns it on (offer slot rule applies).
 * Every tool runs the same cleaners, plan checks and limits as the admin pages (lib/rules.ts).
 */
import db from "../../db.server";
import { AdminError, gql } from "../admin.server";
import { feature, featureHref, type FeatureKey } from "../catalog";
import { cleanRequest } from "../feature-requests";
import { createFeatureRequest } from "../feature-requests.server";
import { listRules, saveRule, upsert } from "../cro.server";
import { RuleError, requireFeature, requireFeatureRequests, requireSizeGuide } from "../rules";
import { requireOfferSlot } from "../rules.server";
import { sectionLinks } from "../sections.server";
import type { Placement, Rule, Ref } from "../types";
import { DESIGNS } from "./registry.server";
import { DATA_NOTE, asFeature, featureArg, type Tool, type ToolContext } from "./tools.server";

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const PENDING = (key: FeatureKey) => `mcp_pending_${key}`;

/* ------------------------------------------------------------ pending designs -- */
async function readPending(ctx: ToolContext, key: FeatureKey): Promise<unknown | null> {
  const d = await gql(ctx.admin, `#graphql
    query CroMcpPending($handle: String!) { metaobjectByHandle(handle: { type: "$app:cro_design", handle: $handle }) { field(key: "config") { value } } }`, { handle: PENDING(key) });
  try {
    return JSON.parse(d.metaobjectByHandle?.field?.value ?? "null");
  } catch {
    return null;
  }
}
const writePending = (ctx: ToolContext, key: FeatureKey, config: unknown) => upsert(ctx.admin, "$app:cro_design", PENDING(key), { config: JSON.stringify(config) });

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/** Objects are merged field by field; anything else (texts, numbers, lists) replaces. */
export function deepMerge(base: unknown, patch: unknown): unknown {
  if (!isObj(base) || !isObj(patch)) return patch;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = k in base ? deepMerge(base[k], v) : v;
  return out;
}
/** Fields the assistant sent that the design does not have (so it learns they did nothing). */
export function ignoredFields(sent: unknown, kept: unknown, path = ""): string[] {
  if (!isObj(sent)) return [];
  return Object.keys(sent).flatMap((k) => {
    const here = path ? `${path}.${k}` : k;
    if (!isObj(kept) || !(k in kept)) return [here];
    return ignoredFields(sent[k], kept[k], here);
  });
}

function designOf(key: FeatureKey) {
  const d = DESIGNS[key];
  if (!d) throw new RuleError(`${feature(key).title} can't be built this way yet. Use request_feature, or open it in the app: ${featureHref(key)}`, "input", false);
  return d;
}

const adminHandle = (shop: string) => shop.replace(/\.myshopify\.com$/, "");
function links(ctx: ToolContext, key: FeatureKey) {
  const sl = sectionLinks(ctx.shop) as Record<string, string>;
  return {
    themeEditor: sl[key] ?? sl.editor,
    app: `https://admin.shopify.com/store/${adminHandle(ctx.shop)}/apps/${process.env.SHOPIFY_API_KEY}${featureHref(key)}`,
  };
}

/* ------------------------------------------------------------------ offers -- */
const PLACEMENTS: Placement[] = ["product", "cart", "drawer"];
async function refs(ctx: ToolContext, ids: unknown, what: "Product" | "Collection"): Promise<Ref[]> {
  const list = Array.isArray(ids) ? ids.map(String).filter((x) => new RegExp(`^gid://shopify/${what}/\\d+$`).test(x)).slice(0, 50) : [];
  if (!list.length) return [];
  const d = await gql(ctx.admin, `#graphql
    query CroMcpRefs($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id title handle } ... on Collection { id title handle } } }`, { ids: list });
  return (d.nodes as ({ id: string; title: string; handle: string } | null)[]).filter((n): n is { id: string; title: string; handle: string } => !!n).map((n) => ({ id: n.id, title: n.title, handle: n.handle }));
}

type OfferArgs = Record<string, unknown>;
const OFFER_PROPS = {
  name: { type: "string", description: "The offer's name (only you and the merchant see it)." },
  triggerType: { type: "string", enum: ["all", "products", "collections"], description: "What makes the offer show: every product, chosen products, or chosen collections." },
  triggerProductIds: { type: "array", items: { type: "string" }, description: "Product ids (gid://shopify/Product/…) from search_products." },
  triggerCollectionIds: { type: "array", items: { type: "string" }, description: "Collection ids (gid://shopify/Collection/…) from list_collections." },
  offeredProductIds: { type: "array", items: { type: "string" }, description: "Cross sell: the products offered." },
  discountPercent: { type: "number", description: "Cross sell: percent off the offered products, 0 to 100." },
  tiers: { type: "array", items: { type: "object", properties: { qty: { type: "integer" }, pct: { type: "number" }, label: { type: "string" }, badge: { type: "string" } }, required: ["qty", "pct"] }, description: "Upsell: quantity tiers, for example 1 at 0%, 2 at 10%, 3 at 15%." },
  placements: { type: "array", items: { type: "string", enum: PLACEMENTS }, description: "Cross sell: product page, cart page and/or cart drawer." },
  headline: { type: "string" },
  subheadline: { type: "string" },
  buttonLabel: { type: "string" },
  discountLabel: { type: "string" },
};

function blankRule(kind: Rule["kind"]): Rule {
  return {
    kind, name: "", active: false, priority: 10, triggerType: "all", triggerProducts: [], triggerCollections: [], offeredProducts: [],
    tiers: kind === "upsell" ? [{ qty: 1, pct: 0 }, { qty: 2, pct: 10 }, { qty: 3, pct: 15, badge: "Most popular" }] : [],
    upsellType: "quantity", optionName: "", placements: ["product"],
    headline: kind === "upsell" ? "Buy more, save more" : "Pairs well with", subheadline: "", buttonLabel: kind === "cross_sell" ? "Add selected to cart" : "", discountPercent: 0, discountLabel: "",
  };
}

async function applyOfferArgs(ctx: ToolContext, rule: Rule, a: OfferArgs): Promise<Rule> {
  const r: Rule = { ...rule, active: false };
  const text = (v: unknown, max: number) => String(v).slice(0, max);
  if (a.name !== undefined) r.name = text(a.name, 80);
  if (a.triggerType !== undefined) r.triggerType = (["all", "products", "collections"] as const).includes(a.triggerType as "all") ? (a.triggerType as Rule["triggerType"]) : "all";
  if (a.triggerProductIds !== undefined) r.triggerProducts = await refs(ctx, a.triggerProductIds, "Product");
  if (a.triggerCollectionIds !== undefined) r.triggerCollections = await refs(ctx, a.triggerCollectionIds, "Collection");
  if (a.offeredProductIds !== undefined) r.offeredProducts = await refs(ctx, a.offeredProductIds, "Product");
  if (a.discountPercent !== undefined) r.discountPercent = Number(a.discountPercent);
  if (a.tiers !== undefined && Array.isArray(a.tiers)) r.tiers = a.tiers.slice(0, 8).map((t: { qty?: unknown; pct?: unknown; label?: unknown; badge?: unknown }) => ({ qty: Number(t.qty), pct: Number(t.pct), ...(t.label ? { label: text(t.label, 40) } : {}), ...(t.badge ? { badge: text(t.badge, 30) } : {}) }));
  if (a.placements !== undefined && Array.isArray(a.placements)) r.placements = a.placements.filter((p): p is Placement => PLACEMENTS.includes(p as Placement));
  for (const k of ["headline", "subheadline", "buttonLabel", "discountLabel"] as const) if (a[k] !== undefined) r[k] = text(a[k], 120);
  return r;
}

const offerSummary = (r: Rule & { handle?: string }) => ({ id: r.id ?? r.handle, handle: r.handle, type: r.kind, name: r.name, on: r.active });

/* -------------------------------------------------------------------- tools -- */
export const BUILD_TOOLS: Tool[] = [
  {
    name: "set_design",
    description:
      "Design a feature as a DRAFT (nothing goes live). Start from a template key (list_templates), then change settings with values (the shape get_design returns; only the fields you send change). Unknown fields are reported as ignored. The draft shows only in the theme editor (get_preview_link); the merchant publishes it in the app, or you can with publish when allowed." + DATA_NOTE,
    needs: "build",
    schema: obj({ feature: featureArg(), template: { type: "string", description: "A template key from list_templates." }, values: { type: "object", description: "Settings to change, in the shape get_design returns." } }, ["feature"]),
    summary: (a) => `${String(a.feature)}${a.template ? ` ${String(a.template)}` : ""}`,
    async run(ctx, args) {
      const key = asFeature(args.feature);
      requireFeature(ctx.plan, key, ctx.trial);
      const d = designOf(key);
      if (args.template === undefined && args.values === undefined) throw new RuleError("Send a template, values, or both.", "input", false);
      let working: unknown = (await readPending(ctx, key)) ?? (await d.get(ctx.admin)).config;
      if (typeof args.template === "string" && args.template) {
        if (!d.presets.some((p) => p.key === args.template)) throw new RuleError(`Unknown template “${args.template.slice(0, 40)}”. Choose one of: ${d.presets.map((p) => p.key).join(", ")}.`, "input", false);
        working = d.apply(working as never, args.template);
      }
      if (args.values !== undefined) {
        if (!isObj(args.values)) throw new RuleError("values must be an object.", "input", false);
        working = deepMerge(working, args.values);
      }
      if (key === "size_guide") requireSizeGuide(working);
      const clean = d.clean(working);
      await d.save(ctx.admin, clean as never, true);
      await writePending(ctx, key, clean);
      const l = links(ctx, key);
      const ignored = isObj(args.values) ? ignoredFields(args.values, clean) : [];
      return { feature: key, status: "draft", draft: clean, ignoredFields: ignored.length ? ignored : undefined, preview: l, next: "Open the theme editor link to see the draft (only visible there), then publish it in the app." };
    },
  },
  {
    name: "discard_draft",
    description: "Throw away a feature's draft: the theme editor goes back to the saved design.",
    needs: "build",
    schema: obj({ feature: featureArg() }, ["feature"]),
    summary: (a) => String(a.feature),
    async run(ctx, args) {
      const key = asFeature(args.feature);
      const d = designOf(key);
      await writePending(ctx, key, null);
      await d.save(ctx.admin, (await d.get(ctx.admin)).config as never, true);
      return { feature: key, status: "discarded" };
    },
  },
  {
    name: "get_preview_link",
    description: "Where the merchant sees a draft: the theme editor link (the draft shows only there, only to them) and the feature's page in the app.",
    needs: "read",
    schema: obj({ feature: featureArg() }, ["feature"]),
    async run(ctx, args) {
      const key = asFeature(args.feature);
      return { feature: key, ...links(ctx, key), pendingDraft: !!(DESIGNS[key] && (await readPending(ctx, key))) };
    },
  },
  {
    name: "get_place_link",
    description: "The theme editor link that adds the feature's block to the right page (the merchant clicks it and saves; the app cannot edit theme files).",
    needs: "read",
    schema: obj({ feature: featureArg() }, ["feature"]),
    async run(ctx, args) {
      const key = asFeature(args.feature);
      return { feature: key, addToTheme: links(ctx, key).themeEditor, note: "Opens the theme editor with the block ready to place. The merchant saves the theme." };
    },
  },
  {
    name: "create_offer",
    description: "Create an upsell or cross sell offer, switched OFF (a draft). The merchant turns it on in the app, or you can with publish_offer when allowed. Use search_products and list_collections for ids." + DATA_NOTE,
    needs: "build",
    schema: obj({ type: { type: "string", enum: ["upsell", "cross_sell"] }, ...OFFER_PROPS }, ["type", "name"]),
    summary: (a) => `${String(a.type)} ${String(a.name ?? "").slice(0, 60)}`,
    async run(ctx, args) {
      const kind = args.type === "cross_sell" ? "cross_sell" : args.type === "upsell" ? "upsell" : null;
      if (!kind) throw new RuleError("type must be upsell or cross_sell. Bundles and discounts are not built through the assistant yet; use request_feature or the app.", "input", false);
      requireFeature(ctx.plan, kind === "upsell" ? "upsell" : "cross_sell", ctx.trial);
      const rule = await applyOfferArgs(ctx, blankRule(kind), args);
      try {
        const saved = await saveRule(ctx.admin, rule);
        return { ...offerSummary({ ...rule, id: saved.id ?? undefined, handle: saved.handle }), status: "draft (off)", appPage: `https://admin.shopify.com/store/${adminHandle(ctx.shop)}/apps/${process.env.SHOPIFY_API_KEY}/app/offers/${kind === "upsell" ? "upsell" : "cross-sell"}/${saved.handle}` };
      } catch (e) {
        if (e instanceof AdminError) throw new RuleError(e.message, "input", false);
        throw e;
      }
    },
  },
  {
    name: "update_offer",
    description: "Change an upsell or cross sell offer (the fields you send; the rest stays). It stays as it is: switched on or off as before. Changes to an offer that is ON go live at once, so they need publishing permission." + DATA_NOTE,
    needs: "build",
    schema: obj({ id: { type: "string", description: "The id or handle from list_offers." }, ...OFFER_PROPS }, ["id"]),
    summary: (a) => String(a.id).slice(0, 80),
    async run(ctx, args) {
      const id = String(args.id);
      const current = (await listRules(ctx.admin)).find((r) => r.id === id || r.handle === id);
      if (!current) throw new RuleError("No upsell or cross sell offer with that id. Use list_offers.", "input", false);
      if (current.active && !(ctx.grant.scope === "build" && ctx.grant.allowPublish)) throw new RuleError("This offer is on, so changing it changes the live store. Turn it off in the app first, or connect again with “Allow publishing”.", "input", false);
      const rule = { ...(await applyOfferArgs(ctx, current, args)), active: current.active };
      try {
        const saved = await saveRule(ctx.admin, rule);
        return { ...offerSummary({ ...rule, handle: saved.handle }), status: current.active ? "saved (live)" : "saved (still off)" };
      } catch (e) {
        if (e instanceof AdminError) throw new RuleError(e.message, "input", false);
        throw e;
      }
    },
  },
  {
    name: "request_feature",
    description: "When none of the tools can do what the merchant asked, send it to the CRO Toolbox team as a feature request (Growth and Pro plans; Pro requests are built first). Tell the merchant it was sent. Max 5 a day. Describe what the store should do, not how.",
    needs: "build",
    schema: obj({ what: { type: "string", description: "What the store should do, in the merchant's words (up to 2000 characters)." }, where: { type: "string", description: "Where it should show, for example the product page (optional)." } }, ["what"]),
    summary: (a) => String(a.what ?? "").slice(0, 60),
    async run(ctx, args) {
      requireFeatureRequests(ctx.plan);
      const clean = cleanRequest(args.what, args.where);
      if (!clean.ok) throw new RuleError(clean.error, "input", false);
      const today = await db.featureRequest.count({ where: { shop: ctx.shop, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
      if (today >= 5) throw new RuleError("Five requests were already sent today. Try again tomorrow.", "limit", false);
      await createFeatureRequest(ctx.shop, ctx.plan, clean.text, clean.place);
      return { sent: true, message: ctx.plan === "pro" ? "Sent. Requests from the Pro plan are built first." : "Sent to the CRO Toolbox team." };
    },
  },
];

export const PUBLISH_TOOLS: Tool[] = [
  {
    name: "publish",
    description: "Make a feature's draft the live design on the store. Runs the same checks as saving in the app. Only works when the merchant allowed publishing for this connection.",
    needs: "publish",
    schema: obj({ feature: featureArg() }, ["feature"]),
    summary: (a) => String(a.feature),
    async run(ctx, args) {
      const key = asFeature(args.feature);
      requireFeature(ctx.plan, key, ctx.trial);
      const d = designOf(key);
      const pending = await readPending(ctx, key);
      if (!pending) throw new RuleError("There is no draft to publish. Use set_design first.", "input", false);
      const clean = d.clean(pending);
      if (key === "size_guide") requireSizeGuide(clean);
      await d.save(ctx.admin, clean as never, false);
      await writePending(ctx, key, null);
      return { feature: key, status: "live", note: "Shoppers see it where the block or embed is on in the theme (get_place_link)." };
    },
  },
  {
    name: "publish_offer",
    description: "Switch an offer ON. Offer slots of the plan apply: when none is free the answer says so. Only works when the merchant allowed publishing.",
    needs: "publish",
    schema: obj({ id: { type: "string", description: "The id or handle from list_offers." } }, ["id"]),
    summary: (a) => String(a.id).slice(0, 80),
    async run(ctx, args) {
      const id = String(args.id);
      const current = (await listRules(ctx.admin)).find((r) => r.id === id || r.handle === id);
      if (!current) throw new RuleError("No upsell or cross sell offer with that id. Use list_offers.", "input", false);
      requireFeature(ctx.plan, current.kind === "upsell" ? "upsell" : "cross_sell", ctx.trial);
      await requireOfferSlot(ctx.admin, ctx.shop, { active: true, id: current.id, handle: current.handle });
      const saved = await saveRule(ctx.admin, { ...current, active: true });
      return { ...offerSummary({ ...current, active: true, handle: saved.handle }), status: "live" };
    },
  },
];
