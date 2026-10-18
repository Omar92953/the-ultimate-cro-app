/**
 * The bundle tools: all six recipes (lib/bundle-recipes.ts) made as DRAFTS and published only with the allow publishing tick.
 *   fbt (frequently bought together) → a "fixed" deal, switched off;
 *   kit (fixed bundle sold as one product) → a bundle product left as a Shopify draft;
 *   mixmatch, browse, growing, anyN → a mix and match bundle, off, on a bundle product that is a draft (not active, not on the Online Store).
 * Every tool runs the same checks as the app's pages (rules.server.ts requireDeal, requireBundle, requireKit).
 * Bundles are placed on their bundle product's page; showing one on a store page is done in the app.
 */
import { AdminError } from "../admin.server";
import { listBundles, saveBundle } from "../cro.server";
import { listDeals, saveDeal } from "../deals.server";
import { activateBundleProduct, createBundleProduct } from "../bundle-product.server";
import { listKits, publishKit, saveKit } from "../kits.server";
import { BUNDLE_RECIPES, type RecipeKey } from "../bundle-recipes";
import { blankDeal, type Deal } from "../deals";
import { RuleError } from "../rules";
import { requireBundle, requireDeal, requireKit } from "../rules.server";
import { MAX_KIT_ITEMS, type Kit } from "../kits";
import type { Bundle, BundleStep, BundleTier } from "../types";
import { applyDealArgs, asRuleError, dealSummary, type Deps as DealDeps } from "./deal-tools.server";
import { adminHandle, obj, refs } from "./shared.server";
import { DATA_NOTE, type Tool, type ToolContext } from "./tools.server";

export type BundleDeps = DealDeps & {
  listBundles: typeof listBundles;
  saveBundle: typeof saveBundle;
  listKits: typeof listKits;
  saveKit: typeof saveKit;
  publishKit: typeof publishKit;
  createBundleProduct: typeof createBundleProduct;
  activateBundleProduct: typeof activateBundleProduct;
};

const RECIPE_KEYS = BUNDLE_RECIPES.map((r) => r.key);
const isRecipe = (v: unknown): v is RecipeKey => (RECIPE_KEYS as string[]).includes(String(v));
const num = (v: unknown) => Number(v);
const text = (v: unknown, max: number) => String(v).slice(0, max);

const BUNDLE_PROPS = {
  name: { type: "string", description: "The bundle's name (for a fixed bundle it is also the product's title; shoppers see it)." },
  items: { type: "array", items: { type: "object", properties: { productId: { type: "string" }, qty: { type: "integer" } }, required: ["productId"] }, description: "fbt and kit: the products in the set, with how many of each (2 or more items; ids from search_products)." },
  percent: { type: "number", description: "fbt: percent off the set. kit: percent off the items' total. mixmatch and browse: percent off the picked items. Default 10." },
  price: { type: "number", description: "kit: one price for the set (instead of percent). mixmatch: one price for the whole bundle (instead of percent)." },
  poolCollectionId: { type: "string", description: "mixmatch, browse, growing, anyN: the collection shoppers pick from (gid://shopify/Collection/…)." },
  poolProductIds: { type: "array", items: { type: "string" }, description: "The same with chosen products instead of a collection." },
  pick: { type: "integer", description: "mixmatch and browse: how many items shoppers pick." },
  stepLabel: { type: "string", description: "The heading of the pick step, for example Choose 3 candles." },
  tiers: { type: "array", items: { type: "object", properties: { qty: { type: "integer" }, value: { type: "number" } }, required: ["qty", "value"] }, description: "growing: number of items and the percent (or amount) off, for example 2 at 10, 3 at 15. anyN: number of items and the bundle price, for example 3 at 30, 6 at 55." },
  growingKind: { type: "string", enum: ["percent", "amount"], description: "growing: whether the tier values are percent off or an amount off." },
  hideSoldOut: { type: "boolean" },
  allowDuplicates: { type: "boolean", description: "Shoppers may pick the same item more than once." },
};

type Args = Record<string, unknown>;

async function stepFrom(ctx: ToolContext, a: Args, label: string, min: number, max: number): Promise<BundleStep> {
  const collection = typeof a.poolCollectionId === "string" ? (await refs(ctx, [a.poolCollectionId], "Collection"))[0] ?? null : null;
  const products = collection ? [] : await refs(ctx, a.poolProductIds, "Product");
  return { label: a.stepLabel !== undefined ? text(a.stepLabel, 60) : label, required: true, min, max, products, collection: collection ? { id: collection.id, title: collection.title, handle: collection.handle ?? "" } : null };
}

const tiersOf = (a: Args, fallback: BundleTier[]): BundleTier[] => (Array.isArray(a.tiers) ? a.tiers.slice(0, 8).map((t: { qty?: unknown; value?: unknown }) => ({ qty: Math.round(num(t.qty)), price: num(t.value) })) : fallback);

/** A new mix and match style bundle from the arguments (off, no product yet). */
export async function buildBundle(ctx: ToolContext, recipe: Exclude<RecipeKey, "fbt" | "kit">, a: Args): Promise<{ bundle: Bundle; startPrice: number }> {
  const base: Bundle = {
    name: a.name !== undefined ? text(a.name, 80) : "", active: false, product: null, steps: [], allowDuplicates: a.allowDuplicates === true, hideSoldOut: a.hideSoldOut !== false,
    pricing: "percent", percentOff: a.percent !== undefined ? num(a.percent) : 10, tiers: [], extras: [], storeWide: recipe === "browse", page: null,
  };
  const pick = a.pick !== undefined ? Math.max(1, Math.round(num(a.pick))) : 3;
  if (recipe === "mixmatch" || recipe === "browse") {
    base.steps = [await stepFrom(ctx, a, `Choose ${pick} items`, pick, pick)];
    if (recipe === "mixmatch" && a.price !== undefined && num(a.price) > 0) base.pricing = "fixed";
    return { bundle: base, startPrice: base.pricing === "fixed" ? num(a.price) : 0 };
  }
  if (recipe === "growing") {
    base.pricing = a.growingKind === "amount" ? "amount_tiers" : "percent_tiers";
    base.tiers = tiersOf(a, [{ qty: 2, price: 10 }, { qty: 3, price: 15 }, { qty: 4, price: 20 }]);
    base.steps = [await stepFrom(ctx, a, "Choose your items", 1, Math.max(10, ...base.tiers.map((t) => t.qty)))];
    return { bundle: base, startPrice: 0 };
  }
  // anyN: any 3 for $30, any 6 for $55
  base.pricing = "tiers";
  base.tiers = tiersOf(a, [{ qty: 3, price: 30 }, { qty: 6, price: 55 }]);
  const qtys = base.tiers.map((t) => t.qty).filter((q) => q >= 1);
  base.steps = [await stepFrom(ctx, a, `Choose ${qtys.length ? [...qtys].sort((x, y) => x - y).join(" or ") : "your"} items`, Math.min(...(qtys.length ? qtys : [1])), Math.max(...(qtys.length ? qtys : [1])))];
  const prices = base.tiers.map((t) => t.price).filter((p) => p > 0);
  return { bundle: base, startPrice: prices.length ? Math.min(...prices) : 0 };
}

async function kitFrom(ctx: ToolContext, a: Args, current: Kit | null): Promise<Kit> {
  const kit: Kit = current ? { ...current, items: [...current.items] } : { productId: null, title: "", items: [], pricing: "percent", pct: 10, price: 0, compareAt: true };
  if (a.name !== undefined) kit.title = text(a.name, 120);
  if (Array.isArray(a.items)) {
    const asked = a.items.slice(0, MAX_KIT_ITEMS).map((i: { productId?: unknown; qty?: unknown }) => ({ id: String(i.productId), qty: Math.max(1, Math.round(num(i.qty) || 1)) }));
    const found = await refs(ctx, asked.map((i) => i.id), "Product");
    kit.items = asked.flatMap((i) => {
      const p = found.find((x) => x.id === i.id);
      return p ? [{ productId: p.id, title: p.title, image: p.image ?? null, qty: i.qty }] : [];
    });
  }
  if (a.price !== undefined && num(a.price) > 0) {
    kit.pricing = "fixed";
    kit.price = num(a.price);
  } else if (a.percent !== undefined) {
    kit.pricing = "percent";
    kit.pct = num(a.percent);
  }
  return kit;
}

const appBase = (ctx: ToolContext) => `https://admin.shopify.com/store/${adminHandle(ctx.shop)}/apps/${process.env.SHOPIFY_API_KEY}/app`;
const numericId = (gid: string) => gid.split("/").pop();

export function makeBundleTools(deps: BundleDeps): Tool[] {
  return [
    {
      name: "create_bundle",
      description:
        "Create a bundle as a DRAFT (nothing shows on the store). Recipes: 'fbt' (frequently bought together: a set shown on each item's page with a discount), 'kit' (a fixed bundle sold as its own product), 'mixmatch' (shoppers pick items from a collection on the bundle's page for one price or a percent off), 'browse' (build your own bundle from collection pages with a tray), 'growing' (tiered: the more items, the bigger the discount) and 'anyN' (any 3 for $30). The bundle product, when there is one, is created as a draft product. The merchant switches it on in the app, or you can with publish_offer when allowed. Use search_products and list_collections for ids." + DATA_NOTE,
      needs: "build",
      schema: obj({ recipe: { type: "string", enum: RECIPE_KEYS }, ...BUNDLE_PROPS }, ["recipe", "name"]),
      summary: (a) => `${String(a.recipe)} ${String(a.name ?? "").slice(0, 60)}`,
      async run(ctx, args) {
        if (!isRecipe(args.recipe)) throw new RuleError(`recipe must be one of ${RECIPE_KEYS.join(", ")}.`, "input", false);
        try {
          if (args.recipe === "fbt") {
            const draft = await applyDealArgs(ctx, { ...blankDeal("fixed"), active: false }, { ...args, name: args.name });
            await requireDeal(ctx.admin, ctx.shop, draft);
            const saved = await deps.saveDeal(ctx.admin, { ...draft, active: false });
            const made: Deal = { ...draft, id: saved.id ?? null, handle: saved.handle };
            return { ...dealSummary(made), recipe: "fbt", status: "draft (off)", appPage: `${appBase(ctx)}/deals/fixed/${saved.handle}` };
          }
          if (args.recipe === "kit") {
            const kit = await kitFrom(ctx, args, null);
            await requireKit(ctx.admin, ctx.shop, kit);
            const saved = await deps.saveKit(ctx.admin, kit, { draft: true });
            return { id: saved.productId, type: "kit", recipe: "kit", name: saved.title, on: false, status: "draft (a draft product, not on the store)", appPage: `${appBase(ctx)}/kits/${numericId(saved.productId!)}` };
          }
          const { bundle, startPrice } = await buildBundle(ctx, args.recipe, args);
          // Everything is checked before the draft product is made, so a product is never created for a bundle that won't save.
          const others = await deps.listBundles(ctx.admin);
          await requireBundle(ctx.admin, ctx.shop, { ...bundle, product: { id: "pending", title: bundle.name } }, others);
          const p = await deps.createBundleProduct(ctx.admin, { title: bundle.name, price: startPrice, draft: true });
          const saved = await deps.saveBundle(ctx.admin, { ...bundle, product: { id: p.id, title: p.title, image: p.image, handle: p.handle } });
          return { id: saved.id ?? saved.handle, handle: saved.handle, type: "bundle", recipe: args.recipe, name: bundle.name, on: false, status: "draft (off, on a draft product)", appPage: `${appBase(ctx)}/bundles/${saved.handle}` };
        } catch (e) {
          throw asRuleError(e);
        }
      },
    },
    {
      name: "update_bundle",
      description:
        "Change a bundle (the fields you send; the rest stays). It stays as it is: on or off as before. Changing a bundle that is ON changes the live store, so that needs publishing permission. For a mix and match style bundle you can change name, percent, price, pick, tiers, the pool and the options; for fbt and kit the items, percent, price and name." + DATA_NOTE,
      needs: "build",
      schema: obj({ id: { type: "string", description: "The id or handle from list_offers." }, ...BUNDLE_PROPS }, ["id"]),
      summary: (a) => String(a.id).slice(0, 80),
      async run(ctx, args) {
        const id = String(args.id);
        const live = ctx.grant.scope === "build" && ctx.grant.allowPublish;
        const liveError = new RuleError("This bundle is on, so changing it changes the live store. Turn it off in the app first, or connect again with “Allow publishing”.", "input", false);
        try {
          const deal = (await deps.listDeals(ctx.admin)).find((d) => d.kind === "fixed" && (d.id === id || d.handle === id));
          if (deal) {
            if (deal.active && !live) throw liveError;
            const next = await applyDealArgs(ctx, deal, args);
            await requireDeal(ctx.admin, ctx.shop, next);
            await deps.saveDeal(ctx.admin, { ...next, active: deal.active });
            return { ...dealSummary({ ...next, active: deal.active }), recipe: "fbt", status: deal.active ? "saved (live)" : "saved (still off)" };
          }
          const kitRow = (await deps.listKits(ctx.admin)).find((k) => k.productId === id || numericId(k.productId) === id);
          if (kitRow) {
            if (kitRow.status === "ACTIVE" && !live) throw liveError;
            const kit = await kitFrom(ctx, args, kitRow);
            await requireKit(ctx.admin, ctx.shop, kit);
            const saved = await deps.saveKit(ctx.admin, kit);
            return { id: saved.productId, type: "kit", recipe: "kit", name: saved.title, on: kitRow.status === "ACTIVE", status: kitRow.status === "ACTIVE" ? "saved (live)" : "saved (still a draft)" };
          }
          const all = await deps.listBundles(ctx.admin);
          const current = all.find((b) => b.id === id || b.handle === id);
          if (!current) throw new RuleError("No bundle with that id. Use list_offers.", "input", false);
          if (current.active && !live) throw liveError;
          const next = await updateBundleFrom(ctx, current, args);
          await requireBundle(ctx.admin, ctx.shop, next, all);
          await deps.saveBundle(ctx.admin, { ...next, active: current.active });
          return { id: current.id ?? current.handle, handle: current.handle, type: "bundle", name: next.name, on: current.active, status: current.active ? "saved (live)" : "saved (still off)" };
        } catch (e) {
          throw asRuleError(e);
        }
      },
    },
  ];
}

/** An existing mix and match style bundle with the arguments applied (only what was sent changes). */
async function updateBundleFrom(ctx: ToolContext, b: Bundle, a: Args): Promise<Bundle> {
  const next: Bundle = { ...b, steps: b.steps.map((s) => ({ ...s })), tiers: [...b.tiers] };
  if (a.name !== undefined) next.name = text(a.name, 80);
  if (a.hideSoldOut !== undefined) next.hideSoldOut = a.hideSoldOut === true;
  if (a.allowDuplicates !== undefined) next.allowDuplicates = a.allowDuplicates === true;
  if (a.percent !== undefined) next.percentOff = num(a.percent);
  if (a.tiers !== undefined) next.tiers = tiersOf(a, next.tiers);
  if (a.growingKind === "percent" || a.growingKind === "amount") next.pricing = a.growingKind === "amount" ? "amount_tiers" : "percent_tiers";
  if (a.pick !== undefined && next.steps[0]) {
    const pick = Math.max(1, Math.round(num(a.pick)));
    next.steps[0] = { ...next.steps[0], min: pick, max: pick };
  }
  if (a.stepLabel !== undefined && next.steps[0]) next.steps[0] = { ...next.steps[0], label: text(a.stepLabel, 60) };
  if ((a.poolCollectionId !== undefined || a.poolProductIds !== undefined) && next.steps[0]) {
    const pool = await stepFrom(ctx, a, next.steps[0].label, next.steps[0].min, next.steps[0].max);
    next.steps[0] = { ...next.steps[0], products: pool.products, collection: pool.collection };
  }
  return next;
}

/** publish_offer for a bundle or a fixed bundle product: switches it on with the same checks as the app. Null when no bundle has that id. */
export function makeBundlePublisher(deps: BundleDeps) {
  return async (ctx: ToolContext, id: string) => {
    const all = await deps.listBundles(ctx.admin);
    const bundle = all.find((b) => b.id === id || b.handle === id);
    try {
      if (bundle) {
        await requireBundle(ctx.admin, ctx.shop, { ...bundle, active: true }, all);
        if (bundle.product) await deps.activateBundleProduct(ctx.admin, bundle.product.id);
        await deps.saveBundle(ctx.admin, { ...bundle, active: true });
        return { id: bundle.id ?? bundle.handle, handle: bundle.handle, type: "bundle", name: bundle.name, on: true, status: "live" };
      }
      const kit = (await deps.listKits(ctx.admin)).find((k) => k.productId === id || numericId(k.productId) === id);
      if (kit) {
        await requireKit(ctx.admin, ctx.shop, { ...kit, productId: kit.productId });
        await deps.publishKit(ctx.admin, kit.productId);
        return { id: kit.productId, type: "kit", name: kit.title, on: true, status: "live" };
      }
    } catch (e) {
      throw e instanceof AdminError ? new RuleError(e.message, "input", false) : asRuleError(e);
    }
    return null;
  };
}

export const BUNDLE_DEPS: BundleDeps = { saveDeal, listDeals, listBundles, saveBundle, listKits, saveKit, publishKit, createBundleProduct, activateBundleProduct };
export const BUNDLE_TOOLS: Tool[] = makeBundleTools(BUNDLE_DEPS);
export const publishBundle = makeBundlePublisher(BUNDLE_DEPS);
