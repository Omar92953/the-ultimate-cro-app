/**
 * The MCP discount tools (create_discount, update_discount, and publish_offer for deals) against a fake Shopify admin and an in-memory
 * deal store: drafts stay off, the app's own checks refuse in the admin's words, publishing needs the tick.
 * Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-discounts-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

type Ctx = import("../../app/lib/mcp/tools.server").ToolContext;
type Tool = import("../../app/lib/mcp/tools.server").Tool;
type Deal = import("../../app/lib/deals").Deal;
let tools: Tool[];
let deals: Deal[] = [];
const saves: Deal[] = [];

const admin = {
  graphql: async (query: string, opts?: { variables?: Record<string, unknown> }) => {
    const v = opts?.variables ?? {};
    const data = (d: unknown) => ({ json: async () => ({ data: d }) });
    const gid = String(v.id ?? "");
    if (query.includes("CroMcpRefs")) return data({ nodes: (v.ids as string[]).map((id) => ({ id, title: `Thing ${id.split("/").pop()}`, handle: `thing-${id.split("/").pop()}` })) });
    if (query.includes("CroMcpGift")) return data({ node: gid.endsWith("/9") ? null : { id: gid, handle: "tote", title: "Tote bag", featuredMedia: null, variants: { nodes: [{ id: "gid://shopify/ProductVariant/55" }] } } });
    if (query.includes("CroMcpVariant")) return data({ node: gid.endsWith("/9") ? null : { id: gid, title: gid.endsWith("/1") ? "1 pack" : "3 pack", product: { id: "gid://shopify/Product/7", handle: "soap", title: "Soap", featuredMedia: null } } });
    return data({});
  },
};
const ctx = (plan: Ctx["plan"], grant: Partial<Ctx["grant"]> = {}): Ctx => ({ admin: admin as unknown as Ctx["admin"], shop: "t.myshopify.com", grant: { id: "g", shop: "t.myshopify.com", kind: "token", name: "t", scope: "build", allowPublish: false, ...grant }, plan, trial: null, planUrl: "https://plans.example" });
const tool = (name: string) => tools.find((t) => t.name === name)!;
const P = (n: number) => `gid://shopify/Product/${n}`;

let publishDeal: (ctx: Ctx, id: string) => Promise<unknown>;
before(async () => {
  const D = await import("../../app/lib/mcp/deal-tools.server");
  const B = await import("../../app/lib/mcp/build-tools.server");
  const deps = {
    saveDeal: (async (_a: unknown, d: Deal) => {
      saves.push(d);
      const handle = d.handle ?? `deal-${deals.length + 1}`;
      const row = { ...d, id: d.id ?? `gid://shopify/Metaobject/${deals.length + 1}`, handle };
      deals = [...deals.filter((x) => x.handle !== handle), row];
      return { id: row.id, handle };
    }) as never,
    listDeals: (async () => deals) as never,
  };
  tools = [...D.makeDealTools(deps), ...B.PUBLISH_TOOLS];
  publishDeal = D.makeDealPublisher(deps);
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("buy 2 get 1 free: a draft with the right settings, switched off", async () => {
  const out = (await tool("create_discount").run(ctx("starter"), { type: "bogo", name: "Buy 2 candles, get 1 free", buy: { type: "products", productIds: [P(1), P(2)] }, buyQty: 2, getQty: 1, getPercent: 100 })) as { status: string; on: boolean; describes: string; appPage: string };
  assert.equal(out.status, "draft (off)");
  assert.equal(out.on, false);
  assert.match(out.describes, /Buy 2 of Thing 1, Thing 2, get 1 free/);
  assert.match(out.appPage, /\/app\/deals\/bogo\/deal-1$/);
  const saved = saves.at(-1)!;
  assert.equal(saved.active, false);
  assert.deepEqual((saved.config as { sameItems: boolean; x: number; y: number; pct: number }).sameItems, true);
});

test("volume tiers, gift and upgrade are built from ids", async () => {
  const vol = (await tool("create_discount").run(ctx("starter"), { type: "volume", name: "Poster tiers", target: { type: "collections", collectionIds: ["gid://shopify/Collection/4"] }, tiers: [{ qty: 2, pct: 10 }, { qty: 3, pct: 15 }] })) as { describes: string };
  assert.match(vol.describes, /2\+ = 10% off, 3\+ = 15% off/);
  const gift = (await tool("create_discount").run(ctx("starter"), { type: "gift", name: "Tote", giftProductId: P(8), minimumAmount: 60 })) as { describes: string };
  assert.match(gift.describes, /Tote bag free over 60/);
  const up = (await tool("create_discount").run(ctx("starter"), { type: "upgrade", name: "3 pack", fromVariantId: "gid://shopify/ProductVariant/1", toVariantId: "gid://shopify/ProductVariant/3" })) as { describes: string };
  assert.match(up.describes, /Soap \(1 pack\) → Soap \(3 pack\)/);
});

test("the app's checks refuse in its words: missing pieces and bad ids", async () => {
  await assert.rejects(tool("create_discount").run(ctx("starter"), { type: "gift", name: "No gift" }), /Choose the gift product/);
  await assert.rejects(tool("create_discount").run(ctx("starter"), { type: "volume", name: "Bad tier", target: { type: "all" }, tiers: [{ qty: 1, pct: 10 }] }), /quantity must be 2 or more/);
  await assert.rejects(tool("create_discount").run(ctx("starter"), { type: "upgrade", name: "x", fromVariantId: "nonsense", toVariantId: "gid://shopify/ProductVariant/3" }), /variant id looks like/);
  await assert.rejects(tool("create_discount").run(ctx("starter"), { type: "gift", name: "x", giftProductId: P(9) }), /No product/);
  await assert.rejects(tool("create_discount").run(ctx("starter"), { type: "bundle", name: "x" }), /type must be one of/);
});

test("update_discount keeps what is not sent, leaves on/off alone, and a live deal needs publishing permission", async () => {
  deals = [];
  const made = (await tool("create_discount").run(ctx("starter"), { type: "bogo", name: "Deal", buy: { type: "all" }, buyQty: 2, getQty: 1, getPercent: 50 })) as { handle: string };
  const upd = (await tool("update_discount").run(ctx("starter"), { id: made.handle, getPercent: 100, name: "Deal, free" })) as { status: string; describes: string };
  assert.equal(upd.status, "saved (still off)");
  assert.match(upd.describes, /Buy 2 of any product, get 1 free/);
  const row = deals.find((d) => d.handle === made.handle)!;
  assert.equal(row.name, "Deal, free");
  assert.equal((row.config as { x: number }).x, 2);
  deals = deals.map((d) => ({ ...d, active: true }));
  await assert.rejects(tool("update_discount").run(ctx("starter"), { id: made.handle, getPercent: 20 }), /changes the live store/);
  const live = (await tool("update_discount").run(ctx("starter", { allowPublish: true }), { id: made.handle, getPercent: 20 })) as { status: string };
  assert.equal(live.status, "saved (live)");
  await assert.rejects(tool("update_discount").run(ctx("starter"), { id: "nope" }), /No buy X get Y/);
});

test("publish_offer switches a deal on, with the same checks", async () => {
  deals = [];
  const made = (await tool("create_discount").run(ctx("starter"), { type: "gift", name: "Tote", giftProductId: P(8), minimumAmount: 40 })) as { handle: string };
  const out = (await publishDeal(ctx("starter", { allowPublish: true }), made.handle)) as { status: string; on: boolean };
  assert.equal(await publishDeal(ctx("starter", { allowPublish: true }), "nope"), null, "no deal with that id: the next kind of offer is tried")
  assert.deepEqual({ status: out.status, on: out.on }, { status: "live", on: true });
  assert.equal(deals.find((d) => d.handle === made.handle)!.active, true);
  assert.equal(tool("publish_offer").needs, "publish");
  assert.equal(tool("create_discount").needs, "build");
});
