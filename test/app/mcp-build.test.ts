/**
 * The MCP build and publish tools against a fake Shopify admin that keeps metaobjects in memory:
 * drafts stay drafts, publishing copies them, plan and size rules refuse in the admin's words.
 * Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-build-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

type Ctx = import("../../app/lib/mcp/tools.server").ToolContext;
type Tool = import("../../app/lib/mcp/tools.server").Tool;
let tools: Tool[];
const store = new Map<string, Record<string, string>>();

const admin = {
  graphql: async (query: string, opts?: { variables?: Record<string, unknown> }) => {
    const v = opts?.variables ?? {};
    const data = (d: unknown) => ({ json: async () => ({ data: d }) });
    if (query.includes("metaobjectUpsert")) {
      const handle = (v.handle as { handle: string }).handle;
      store.set(handle, { ...(store.get(handle) ?? {}), ...Object.fromEntries(((v.metaobject as { fields: { key: string; value: string }[] }).fields).map((f) => [f.key, f.value])) });
      return data({ metaobjectUpsert: { metaobject: { id: `gid://shopify/Metaobject/${store.size}`, handle }, userErrors: [] } });
    }
    if (query.includes("metaobjectByHandle")) {
      const handle = (typeof v.handle === "string" ? v.handle : (v.handle as { handle: string }).handle);
      const row = store.get(handle);
      return data({ metaobjectByHandle: row ? { id: "x", field: { value: row.config ?? null } } : null });
    }
    return data({});
  },
};
const ctx = (plan: Ctx["plan"], grant: Partial<Ctx["grant"]> = {}): Ctx => ({ admin: admin as unknown as Ctx["admin"], shop: "t.myshopify.com", grant: { id: "g", shop: "t.myshopify.com", kind: "token", name: "t", scope: "build", allowPublish: true, ...grant }, plan, trial: null, planUrl: "https://plans.example" });
const tool = (name: string) => tools.find((t) => t.name === name)!;
const cfg = (handle: string) => JSON.parse(store.get(handle)?.config ?? "null");

before(async () => {
  for (const f of ["prisma/migrations/20261016000000_feature_requests/migration.sql"]) {
    for (const stmt of fs.readFileSync(f, "utf8").split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  }
  const S = await import("../../app/lib/mcp/server.server");
  const B = await import("../../app/lib/mcp/build-tools.server");
  tools = [...B.BUILD_TOOLS, ...B.PUBLISH_TOOLS];
  void S;
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a design is a draft until it is published", async () => {
  const set = (await tool("set_design").run(ctx("starter"), { feature: "faq", template: "cards", values: { text: { heading: "Questions?" }, nonsense: 1, look: { nothing: true } } })) as { status: string; ignoredFields?: string[]; draft: { text?: { heading?: string } } };
  assert.equal(set.status, "draft");
  assert.deepEqual(set.ignoredFields?.sort(), ["look.nothing", "nonsense"]);
  // Only the draft copies are written: nothing live, no editor copy.
  assert.ok(store.has("faq_draft") && store.has("mcp_pending_faq"));
  assert.ok(!store.has("faq") && !store.has("faq_editor"));
  // A second change builds on the pending draft.
  await tool("set_design").run(ctx("starter"), { feature: "faq", values: { text: { heading: "Ask us" } } });
  assert.equal(cfg("mcp_pending_faq").text.heading, "Ask us");
  assert.ok(JSON.stringify(cfg("mcp_pending_faq")).length > 200, "the template survived the second change");
  // Publishing needs the tick.
  assert.equal(tool("publish").needs, "publish");
  const out = (await tool("publish").run(ctx("starter"), { feature: "faq" })) as { status: string };
  assert.equal(out.status, "live");
  assert.ok(store.has("faq") && store.has("faq_editor"));
  assert.equal(cfg("faq_editor").text.heading, "Ask us");
  assert.equal(cfg("mcp_pending_faq"), null);
  await assert.rejects(tool("publish").run(ctx("starter"), { feature: "faq" }), /no draft/i);
});

test("plan, template and size rules refuse in the admin's words", async () => {
  await assert.rejects(tool("set_design").run(ctx("free"), { feature: "size_guide", template: "links" }), /Starter plan/);
  await assert.rejects(tool("set_design").run(ctx("starter"), { feature: "faq", template: "nope" }), /Choose one of: .*cards/);
  await assert.rejects(tool("set_design").run(ctx("starter"), { feature: "faq" }), /template, values, or both/);
  await assert.rejects(tool("set_design").run(ctx("pro"), { feature: "size_guide", values: { charts: Array.from({ length: 9 }, () => ({})) } }), /up to 8 charts/);
  await assert.rejects(tool("set_design").run(ctx("pro"), { feature: "hero", values: {} }), /can't be built this way yet/);
  await assert.rejects(tool("set_design").run(ctx("pro"), { feature: "not_a_feature", values: {} }), /Unknown feature/);
  assert.ok(!store.has("size_guide_draft"), "a refused call writes nothing");
});

test("discard goes back to the saved design", async () => {
  await tool("set_design").run(ctx("pro"), { feature: "delivery", template: "box" }).catch(() => null);
  await tool("discard_draft").run(ctx("pro"), { feature: "delivery" });
  assert.equal(cfg("mcp_pending_delivery"), null);
});

test("links point at the theme editor and the app page", async () => {
  const r = (await tool("get_preview_link").run(ctx("starter"), { feature: "size_guide" })) as { themeEditor: string; app: string };
  assert.match(r.themeEditor, /admin\/themes\/current\/editor.*ucs-size-guide/);
  assert.match(r.app, /admin\.shopify\.com\/store\/t\/apps\/k\/app\/designs\/size-guide/);
});

test("tool scopes: building needs build, publishing needs the tick", () => {
  const need = Object.fromEntries(tools.map((t) => [t.name, t.needs]));
  assert.deepEqual(need, { set_design: "build", discard_draft: "build", get_preview_link: "read", get_place_link: "read", create_offer: "build", update_offer: "build", publish: "publish", publish_offer: "publish" });
});
