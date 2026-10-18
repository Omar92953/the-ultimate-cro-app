/**
 * The MCP bundle tools: all six recipes as drafts, the shared checks, and publishing, against a fake Shopify admin and in-memory stores.
 * Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-bundles-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

type Ctx = import("../../app/lib/mcp/tools.server").ToolContext;
type Tool = import("../../app/lib/mcp/tools.server").Tool;
type Deal = import("../../app/lib/deals").Deal;
type Bundle = import("../../app/lib/types").Bundle;
type Kit = import("../../app/lib/kits").Kit;
let tools: Tool[];
let publish: (ctx: Ctx, id: string) => Promise<unknown>;
let deals: Deal[] = [];
let bundles: Bundle[] = [];
let kits: (Kit & { productId: string; status: string })[] = [];
const events: string[] = [];
const productInputs: Record<string, unknown>[] = [];
const kitSaves: { kit: Kit; opts?: { draft?: boolean } }[] = [];

const admin = {
  graphql: async (query: string, opts?: { variables?: Record<string, unknown> }) => {
    const v = opts?.variables ?? {};
    const data = (d: unknown) => ({ json: async () => ({ data: d }) });
    if (query.includes("CroMcpRefs")) return data({ nodes: (v.ids as string[]).map((id) => ({ id, title: `${id.includes("Collection") ? "Collection" : "Product"} ${id.split("/").pop()}`, handle: `h${id.split("/").pop()}`, featuredMedia: null })) });
    return data({});
  },
};
const ctx = (grant: Partial<Ctx["grant"]> = {}): Ctx => ({ admin: admin as unknown as Ctx["admin"], shop: "t.myshopify.com", grant: { id: "g", shop: "t.myshopify.com", kind: "token", name: "t", scope: "build", allowPublish: false, ...grant }, plan: "starter", trial: null, planUrl: "https://plans.example" });
const tool = (name: string) => tools.find((t) => t.name === name)!;
const P = (n: number) => `gid://shopify/Product/${n}`;
const C = (n: number) => `gid://shopify/Collection/${n}`;

before(async () => {
  const T = await import("../../app/lib/mcp/bundle-tools.server");
  const deps = {
    saveDeal: (async (_a: unknown, d: Deal) => {
      const handle = d.handle ?? `deal-${deals.length + 1}`;
      deals = [...deals.filter((x) => x.handle !== handle), { ...d, id: d.id ?? `gid://shopify/Metaobject/d${deals.length + 1}`, handle }];
      events.push(`saveDeal:${handle}:${d.active}`);
      return { id: `gid://shopify/Metaobject/d`, handle };
    }) as never,
    listDeals: (async () => deals) as never,
    listBundles: (async () => bundles) as never,
    saveBundle: (async (_a: unknown, b: Bundle) => {
      const handle = b.handle ?? `bundle-${bundles.length + 1}`;
      bundles = [...bundles.filter((x) => x.handle !== handle), { ...b, handle, id: b.id ?? `gid://shopify/Metaobject/b${bundles.length + 1}` }];
      events.push(`saveBundle:${handle}:${b.active}`);
      return { id: `gid://shopify/Metaobject/b`, handle };
    }) as never,
    listKits: (async () => kits) as never,
    saveKit: (async (_a: unknown, kit: Kit, opts?: { draft?: boolean }) => {
      kitSaves.push({ kit, opts });
      const productId = kit.productId ?? `gid://shopify/Product/9${kits.length + 1}`;
      kits = [...kits.filter((k) => k.productId !== productId), { ...kit, productId, status: opts?.draft ? "DRAFT" : "ACTIVE" }];
      return { ...kit, productId };
    }) as never,
    publishKit: (async (_a: unknown, productId: string) => {
      events.push(`publishKit:${productId}`);
      kits = kits.map((k) => (k.productId === productId ? { ...k, status: "ACTIVE" } : k));
      return null;
    }) as never,
    createBundleProduct: (async (_a: unknown, input: Record<string, unknown>) => {
      productInputs.push(input);
      events.push("createProduct");
      return { id: `gid://shopify/Product/5${productInputs.length}`, title: String(input.title), handle: "bundle-product", image: null };
    }) as never,
    activateBundleProduct: (async (_a: unknown, id: string) => {
      events.push(`activate:${id}`);
    }) as never,
  };
  tools = T.makeBundleTools(deps);
  publish = T.makeBundlePublisher(deps);
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

type Made = { id: string; handle?: string; recipe?: string; on: boolean; status: string; appPage: string; describes?: string };
const make = (args: Record<string, unknown>) => tool("create_bundle").run(ctx(), args) as Promise<Made>;

test("frequently bought together: a fixed deal, switched off", async () => {
  const out = await make({ recipe: "fbt", name: "Camera kit", items: [{ productId: P(1) }, { productId: P(2), qty: 2 }], percent: 15 });
  assert.equal(out.on, false);
  assert.match(out.describes!, /Product 1 \+ 2× Product 2 · 15% off/);
  assert.match(out.appPage, /\/app\/deals\/fixed\//);
  assert.ok(events.at(-1)!.endsWith(":false"));
});

test("fixed bundle product: saved as a draft product with its items and price", async () => {
  const out = await make({ recipe: "kit", name: "Gift set", items: [{ productId: P(1) }, { productId: P(2) }], price: 40 });
  assert.equal(out.on, false);
  assert.match(out.status, /draft/);
  const { kit, opts } = kitSaves.at(-1)!;
  assert.equal(opts?.draft, true, "the product stays a Shopify draft");
  assert.deepEqual({ pricing: kit.pricing, price: kit.price, items: kit.items.length }, { pricing: "fixed", price: 40, items: 2 });
  assert.match(out.appPage, /\/app\/kits\/\d+$/);
});

test("mix and match, build your own, tiered and fixed price: a draft product first, then an off bundle", async () => {
  const mm = await make({ recipe: "mixmatch", name: "Candle box", poolCollectionId: C(4), pick: 3, percent: 12 });
  assert.equal(mm.on, false);
  const b1 = bundles.at(-1)!;
  assert.deepEqual({ pricing: b1.pricing, off: b1.percentOff, storeWide: b1.storeWide, active: b1.active, min: b1.steps[0].min, max: b1.steps[0].max, collection: b1.steps[0].collection?.id }, { pricing: "percent", off: 12, storeWide: false, active: false, min: 3, max: 3, collection: C(4) });
  assert.deepEqual(productInputs.at(-1), { title: "Candle box", price: 0, draft: true }, "a draft product: not active, not on the Online Store");
  assert.ok(events.indexOf("createProduct") < events.findIndex((e) => e.startsWith("saveBundle")), "product before bundle");

  await make({ recipe: "mixmatch", name: "Fixed price box", poolProductIds: [P(1), P(2), P(3)], pick: 2, price: 25 });
  assert.deepEqual({ pricing: bundles.at(-1)!.pricing, product: productInputs.at(-1)!.price }, { pricing: "fixed", product: 25 });

  await make({ recipe: "browse", name: "Build your own", poolCollectionId: C(5), pick: 4 });
  assert.deepEqual({ storeWide: bundles.at(-1)!.storeWide, pricing: bundles.at(-1)!.pricing }, { storeWide: true, pricing: "percent" });

  await make({ recipe: "growing", name: "Buy more save more", poolCollectionId: C(6), tiers: [{ qty: 2, value: 5 }, { qty: 4, value: 20 }] });
  assert.deepEqual({ pricing: bundles.at(-1)!.pricing, tiers: bundles.at(-1)!.tiers, max: bundles.at(-1)!.steps[0].max }, { pricing: "percent_tiers", tiers: [{ qty: 2, price: 5 }, { qty: 4, price: 20 }], max: 10 });
  await make({ recipe: "growing", name: "Amount off", poolCollectionId: C(6), growingKind: "amount" });
  assert.equal(bundles.at(-1)!.pricing, "amount_tiers");

  await make({ recipe: "anyN", name: "Any 3 or 6", poolCollectionId: C(7), tiers: [{ qty: 3, value: 30 }, { qty: 6, value: 55 }] });
  const any = bundles.at(-1)!;
  assert.deepEqual({ pricing: any.pricing, min: any.steps[0].min, max: any.steps[0].max, label: any.steps[0].label, price: productInputs.at(-1)!.price }, { pricing: "tiers", min: 3, max: 6, label: "Choose 3 or 6 items", price: 30 });
});

test("the app's checks refuse first, and no product is made for a bundle that won't save", async () => {
  const before = productInputs.length;
  await assert.rejects(make({ recipe: "mixmatch", name: "No pool" }), /Step 1 needs products or a collection/);
  await assert.rejects(make({ recipe: "anyN", name: "Bad tiers", poolCollectionId: C(1), tiers: [{ qty: 3, value: 30 }, { qty: 3, value: 40 }] }), /same number of items/);
  await assert.rejects(make({ recipe: "kit", name: "One item", items: [{ productId: P(1) }] }), /at least two items/);
  await assert.rejects(make({ recipe: "fbt", name: "One item", items: [{ productId: P(1) }] }), /at least 2 products/);
  await assert.rejects(make({ recipe: "nonsense", name: "x" }), /recipe must be one of/);
  assert.equal(productInputs.length, before, "no draft product was made");
});

test("update_bundle: unsent fields stay, on/off stays, a live bundle needs the tick", async () => {
  const mm = await make({ recipe: "mixmatch", name: "To change", poolCollectionId: C(4), pick: 3, percent: 10 });
  const out = (await tool("update_bundle").run(ctx(), { id: mm.handle, percent: 20, pick: 4 })) as { status: string };
  assert.equal(out.status, "saved (still off)");
  const saved = bundles.find((b) => b.handle === mm.handle)!;
  assert.deepEqual({ off: saved.percentOff, min: saved.steps[0].min, collection: saved.steps[0].collection?.id, active: saved.active }, { off: 20, min: 4, collection: C(4), active: false });
  bundles = bundles.map((b) => ({ ...b, active: true }));
  await assert.rejects(tool("update_bundle").run(ctx(), { id: mm.handle, percent: 30 }), /changes the live store/);
  const liveOut = (await tool("update_bundle").run(ctx({ allowPublish: true }), { id: mm.handle, percent: 30 })) as { status: string };
  assert.equal(liveOut.status, "saved (live)");
  const kit = await make({ recipe: "kit", name: "Kit to change", items: [{ productId: P(1) }, { productId: P(2) }], percent: 10 });
  const k = (await tool("update_bundle").run(ctx(), { id: kit.id, name: "Renamed", percent: 25 })) as { status: string };
  assert.equal(k.status, "saved (still a draft)");
  assert.deepEqual({ title: kits.at(-1)!.title, pct: kits.at(-1)!.pct }, { title: "Renamed", pct: 25 });
  const f = await make({ recipe: "fbt", name: "Set", items: [{ productId: P(1) }, { productId: P(2) }], percent: 10 });
  const fu = (await tool("update_bundle").run(ctx(), { id: f.handle ?? f.id, percent: 20 })) as { status: string };
  assert.equal(fu.status, "saved (still off)");
  await assert.rejects(tool("update_bundle").run(ctx(), { id: "nope" }), /No bundle with that id/);
});

test("publishing a bundle activates its draft product and switches it on; a fixed bundle product is made ready to sell", async () => {
  bundles = [];
  events.length = 0;
  const mm = await make({ recipe: "growing", name: "Tiered", poolCollectionId: C(6) });
  const out = (await publish(ctx({ allowPublish: true }), mm.handle!)) as { status: string; on: boolean };
  assert.deepEqual({ status: out.status, on: out.on }, { status: "live", on: true });
  assert.ok(events.some((e) => e.startsWith("activate:gid://shopify/Product/5")), "the draft product is activated");
  assert.equal(bundles.find((b) => b.handle === mm.handle)!.active, true);
  const kit = await make({ recipe: "kit", name: "Gift", items: [{ productId: P(1) }, { productId: P(2) }] });
  const k = (await publish(ctx({ allowPublish: true }), kit.id)) as { status: string };
  assert.equal(k.status, "live");
  assert.ok(events.includes(`publishKit:${kit.id}`));
  assert.equal(await publish(ctx({ allowPublish: true }), "nope"), null);
  assert.equal(tool("create_bundle").needs, "build");
  assert.equal(tool("update_bundle").needs, "build");
});
