/**
 * The discount tools (docs/plans/mcp-server.md): buy X get Y, volume discounts, gift with purchase and upgrades, made as DRAFTS
 * (switched off) and published only with the allow publishing tick (publish_offer). Every tool runs the same checks as the app's deal
 * page (rules.server.ts requireDeal: the plan's feature, complete settings, offer slots). Fixed bundles are a bundle recipe.
 */
import { AdminError, gql } from "../admin.server";
import { listDeals, saveDeal } from "../deals.server";
import { dealFeature } from "../catalog";
import { RuleError, requireFeature } from "../rules";
import { requireDeal } from "../rules.server";
import { DEAL_TYPES, blankDeal, describeDeal, type BogoConfig, type Deal, type DealKind, type FixedConfig, type GiftConfig, type Target, type UpgradeConfig, type VariantPick, type VolumeConfig } from "../deals";
import { adminHandle, obj, refs } from "./shared.server";
import { DATA_NOTE, type Tool, type ToolContext } from "./tools.server";

/** The discount types the assistant can make (a fixed bundle is a bundle recipe; its tool comes with the bundle tools). */
export const DISCOUNT_KINDS = ["bogo", "volume", "gift", "upgrade"] as const satisfies readonly DealKind[];
type DiscountKind = (typeof DISCOUNT_KINDS)[number];
const isDiscountKind = (v: unknown): v is DiscountKind => (DISCOUNT_KINDS as readonly string[]).includes(String(v));

export type Deps = { saveDeal: typeof saveDeal; listDeals: typeof listDeals };

const TARGET = {
  type: "object",
  description: "Which products: { type: 'all' | 'products' | 'collections', productIds: [...], collectionIds: [...] } (ids from search_products and list_collections).",
  properties: { type: { type: "string", enum: ["all", "products", "collections"] }, productIds: { type: "array", items: { type: "string" } }, collectionIds: { type: "array", items: { type: "string" } } },
  required: ["type"],
  additionalProperties: false,
};
const DEAL_PROPS = {
  name: { type: "string", description: "The deal's name (shoppers see it at checkout and on the product page)." },
  buy: { ...TARGET, description: "Buy X get Y: the products that must be bought. " + TARGET.description },
  buyQty: { type: "integer", description: "Buy X get Y: how many to buy (X)." },
  get: { ...TARGET, description: "Buy X get Y: the products that are discounted. Leave out when they are the same products as the ones bought. " + TARGET.description },
  getSameAsBuy: { type: "boolean", description: "Buy X get Y: true when the discounted items are the same products as the ones bought (the default for a new deal)." },
  getQty: { type: "integer", description: "Buy X get Y: how many are discounted (Y)." },
  getPercent: { type: "number", description: "Buy X get Y: percent off the Y items, 1 to 100 (100 = free)." },
  target: { ...TARGET, description: "Volume discount: the products the quantity is counted across. " + TARGET.description },
  tiers: { type: "array", items: { type: "object", properties: { qty: { type: "integer", description: "2 or more" }, pct: { type: "number" } }, required: ["qty", "pct"] }, description: "Volume discount: for example 2 at 10% and 3 at 15%." },
  giftProductId: { type: "string", description: "Gift with purchase: the product given (its first variant), gid://shopify/Product/…" },
  minimumAmount: { type: "number", description: "Gift with purchase: the cart total in the store's currency that unlocks the gift." },
  onlyWithProductIds: { type: "array", items: { type: "string" }, description: "Gift with purchase: only when the cart has one of these products (optional)." },
  fromVariantId: { type: "string", description: "Upgrade: the option shoppers start with, gid://shopify/ProductVariant/…" },
  toVariantId: { type: "string", description: "Upgrade: the option offered instead." },
  text: { type: "string", description: "Upgrade: the offer text; it must contain {to} and may contain {delta}." },
  button: { type: "string", description: "Upgrade: the button text." },
};

async function target(ctx: ToolContext, raw: unknown, fallback: Target): Promise<Target> {
  if (raw === undefined) return fallback;
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const type = o.type === "products" || o.type === "collections" ? o.type : "all";
  const products = type === "products" ? (await refs(ctx, o.productIds, "Product")).map((p) => ({ id: p.id, title: p.title, image: p.image ?? null, handle: p.handle ?? "" })) : [];
  const collections = type === "collections" ? (await refs(ctx, o.collectionIds, "Collection")).map((c) => ({ id: c.id, title: c.title, handle: c.handle ?? "" })) : [];
  return { type, products, collections };
}

async function variantPick(ctx: ToolContext, id: unknown): Promise<VariantPick> {
  const gid = String(id);
  if (!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(gid)) throw new RuleError("A variant id looks like gid://shopify/ProductVariant/123 (search_products shows a product's variants).", "input", false);
  const d = await gql(ctx.admin, `#graphql
    query CroMcpVariant($id: ID!) { node(id: $id) { ... on ProductVariant { id title product { id handle title featuredMedia { preview { image { url } } } } } } }`, { id: gid });
  const v = d.node as { id: string; title: string; product: { id: string; handle: string; title: string; featuredMedia?: { preview?: { image?: { url?: string } } } } } | null;
  if (!v?.id) throw new RuleError(`No variant ${gid} in this store.`, "input", false);
  return { variantId: v.id, productId: v.product.id, handle: v.product.handle, title: v.title === "Default Title" ? v.product.title : `${v.product.title} (${v.title})`, image: v.product.featuredMedia?.preview?.image?.url ?? null };
}

async function giftPick(ctx: ToolContext, id: unknown): Promise<NonNullable<GiftConfig["gift"]>> {
  const gid = String(id);
  if (!/^gid:\/\/shopify\/Product\/\d+$/.test(gid)) throw new RuleError("A product id looks like gid://shopify/Product/123 (use search_products).", "input", false);
  const d = await gql(ctx.admin, `#graphql
    query CroMcpGift($id: ID!) { node(id: $id) { ... on Product { id handle title featuredMedia { preview { image { url } } } variants(first: 1) { nodes { id } } } } }`, { id: gid });
  const p = d.node as { id: string; handle: string; title: string; featuredMedia?: { preview?: { image?: { url?: string } } }; variants: { nodes: { id: string }[] } } | null;
  if (!p?.id || !p.variants.nodes[0]) throw new RuleError(`No product ${gid} in this store.`, "input", false);
  return { variantId: p.variants.nodes[0].id, title: p.title, image: p.featuredMedia?.preview?.image?.url ?? null, handle: p.handle };
}

const text = (v: unknown, max: number) => String(v).slice(0, max);
const tidyNum = (v: unknown) => Number(v);

/** Applies the arguments to a deal; only the fields sent change. Returns a draft (off). */
export async function applyDealArgs(ctx: ToolContext, deal: Deal, a: Record<string, unknown>): Promise<Deal> {
  const d: Deal = { ...deal, config: structuredClone(deal.config) };
  if (a.name !== undefined) d.name = text(a.name, 80);
  if (d.kind === "fixed") {
    // A frequently bought together set: the items (with how many of each) and the percent off the set.
    const c = d.config as FixedConfig;
    if (Array.isArray(a.items)) {
      const asked = a.items.slice(0, 10).map((i: { productId?: unknown; qty?: unknown }) => ({ id: String(i.productId), qty: Math.max(1, Math.round(tidyNum(i.qty) || 1)) }));
      const found = await refs(ctx, asked.map((i) => i.id), "Product");
      c.items = asked.flatMap((i) => {
        const p = found.find((x) => x.id === i.id);
        return p ? [{ product: { id: p.id, title: p.title, image: p.image ?? null, handle: p.handle ?? "" }, qty: i.qty }] : [];
      });
    }
    if (a.percent !== undefined) c.pct = tidyNum(a.percent);
  } else if (d.kind === "bogo") {
    const c = d.config as BogoConfig;
    c.buy = await target(ctx, a.buy, c.buy);
    if (a.get !== undefined) {
      c.get = await target(ctx, a.get, c.get);
      c.sameItems = false;
    }
    if (typeof a.getSameAsBuy === "boolean") c.sameItems = a.getSameAsBuy;
    if (a.buyQty !== undefined) c.x = Math.round(tidyNum(a.buyQty));
    if (a.getQty !== undefined) c.y = Math.round(tidyNum(a.getQty));
    if (a.getPercent !== undefined) c.pct = tidyNum(a.getPercent);
  } else if (d.kind === "volume") {
    const c = d.config as VolumeConfig;
    c.target = await target(ctx, a.target, c.target);
    if (Array.isArray(a.tiers)) c.tiers = a.tiers.slice(0, 8).map((t: { qty?: unknown; pct?: unknown }) => ({ qty: Math.round(tidyNum(t.qty)), pct: tidyNum(t.pct) }));
  } else if (d.kind === "gift") {
    const c = d.config as GiftConfig;
    if (a.giftProductId !== undefined) c.gift = await giftPick(ctx, a.giftProductId);
    if (a.minimumAmount !== undefined) c.min = tidyNum(a.minimumAmount);
    if (a.onlyWithProductIds !== undefined) {
      const products = (await refs(ctx, a.onlyWithProductIds, "Product")).map((p) => ({ id: p.id, title: p.title, image: p.image ?? null, handle: p.handle ?? "" }));
      c.onlyWith = products.length ? { type: "products", products, collections: [] } : null;
    }
  } else if (d.kind === "upgrade") {
    const c = d.config as UpgradeConfig;
    if (a.fromVariantId !== undefined) c.from = await variantPick(ctx, a.fromVariantId);
    if (a.toVariantId !== undefined) c.to = await variantPick(ctx, a.toVariantId);
    if (a.text !== undefined) c.text = text(a.text, 120);
    if (a.button !== undefined) c.button = text(a.button, 40);
  }
  return d;
}

export const dealSummary = (d: Deal) => ({ id: d.id, handle: d.handle, type: d.kind, name: d.name, on: d.active, describes: describeDeal(d) });
const appPage = (ctx: ToolContext, d: { kind: DealKind; handle: string | null }) => `https://admin.shopify.com/store/${adminHandle(ctx.shop)}/apps/${process.env.SHOPIFY_API_KEY}/app/deals/${d.kind}/${d.handle}`;
export const asRuleError = (e: unknown) => (e instanceof AdminError ? new RuleError(e.message, "input", false) : e);

/** publish_offer for a discount deal: switches it on with the same checks as the app's deal page. */
export function makeDealPublisher(deps: Deps) {
  /** Null when no deal has that id (so the next kind of offer can be tried). */
  return async (ctx: ToolContext, id: string) => {
    const deal = (await deps.listDeals(ctx.admin)).find((d) => d.id === id || d.handle === id);
    if (!deal) return null;
    try {
      await requireDeal(ctx.admin, ctx.shop, { ...deal, active: true });
      await deps.saveDeal(ctx.admin, { ...deal, active: true });
    } catch (e) {
      throw asRuleError(e);
    }
    return { ...dealSummary({ ...deal, active: true }), status: "live" };
  };
}

export function makeDealTools(deps: Deps): Tool[] {
  return [
    {
      name: "create_discount",
      description:
        "Create a discount deal as a DRAFT (switched off): 'bogo' (buy X get Y, e.g. buy 2 get 1 free), 'volume' (the more they buy, the bigger the discount), 'gift' (a free gift over an amount) or 'upgrade' (offer a better option for the price difference). It does nothing on the store until it is switched on: the merchant does that in the app, or you can with publish_offer when allowed. Use search_products and list_collections for ids." + DATA_NOTE,
      needs: "build",
      schema: obj({ type: { type: "string", enum: [...DISCOUNT_KINDS] }, ...DEAL_PROPS }, ["type", "name"]),
      summary: (a) => `${String(a.type)} ${String(a.name ?? "").slice(0, 60)}`,
      async run(ctx, args) {
        if (!isDiscountKind(args.type)) throw new RuleError(`type must be one of ${DISCOUNT_KINDS.join(", ")}. Bundles have their own tools.`, "input", false);
        requireFeature(ctx.plan, dealFeature(args.type), ctx.trial);
        const draft = await applyDealArgs(ctx, { ...blankDeal(args.type), active: false, name: DEAL_TYPES[args.type].defaultName }, args);
        try {
          await requireDeal(ctx.admin, ctx.shop, draft);
          const saved = await deps.saveDeal(ctx.admin, { ...draft, active: false });
          const made = { ...draft, id: saved.id ?? null, handle: saved.handle };
          return { ...dealSummary(made), status: "draft (off)", appPage: appPage(ctx, made), next: "Check it in the app, then switch it on there (or publish_offer when publishing is allowed)." };
        } catch (e) {
          throw asRuleError(e);
        }
      },
    },
    {
      name: "update_discount",
      description:
        "Change a discount deal (the fields you send; the rest stays). It stays as it is: on or off as before. Changing a deal that is ON changes the live store, so that needs publishing permission." + DATA_NOTE,
      needs: "build",
      schema: obj({ id: { type: "string", description: "The id or handle from list_offers." }, ...DEAL_PROPS }, ["id"]),
      summary: (a) => String(a.id).slice(0, 80),
      async run(ctx, args) {
        const id = String(args.id);
        const current = (await deps.listDeals(ctx.admin)).find((d) => (d.id === id || d.handle === id) && isDiscountKind(d.kind));
        if (!current) throw new RuleError("No buy X get Y, volume, gift or upgrade deal with that id. Use list_offers.", "input", false);
        requireFeature(ctx.plan, dealFeature(current.kind), ctx.trial);
        if (current.active && !(ctx.grant.scope === "build" && ctx.grant.allowPublish)) throw new RuleError("This deal is on, so changing it changes the live store. Turn it off in the app first, or connect again with “Allow publishing”.", "input", false);
        const next = await applyDealArgs(ctx, current, args);
        try {
          await requireDeal(ctx.admin, ctx.shop, next);
          await deps.saveDeal(ctx.admin, { ...next, active: current.active });
          return { ...dealSummary({ ...next, active: current.active }), status: current.active ? "saved (live)" : "saved (still off)", appPage: appPage(ctx, next) };
        } catch (e) {
          throw asRuleError(e);
        }
      },
    },
  ];
}

const DEFAULT_DEPS: Deps = { saveDeal, listDeals };
export const DEAL_TOOLS: Tool[] = makeDealTools(DEFAULT_DEPS);
export const publishDeal = makeDealPublisher(DEFAULT_DEPS);
