/** Draft bundle products (bundle-product.server.ts): a draft is not Active and not published; activating makes it live. Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdminClient } from "../../app/lib/admin.server";
import { activateBundleProduct, createBundleProduct } from "../../app/lib/bundle-product.server";

function fake() {
  const calls: { op: string; vars: Record<string, any> }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const admin = {
    graphql: async (query: string, o?: { variables?: Record<string, any> }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const op = /(?:mutation|query)\s+(\w+)/.exec(query)?.[1] ?? "";
      calls.push({ op, vars: o?.variables ?? {} });
      const data = (d: unknown) => ({ json: async () => ({ data: d }) });
      switch (op) {
        case "CroBundleProductCreate": return data({ productCreate: { product: { id: "gid://shopify/Product/1", title: "T", handle: "t", featuredMedia: null }, userErrors: [] } });
        case "CroBundleVariant": return data({ product: { variants: { nodes: [{ id: "gid://shopify/ProductVariant/1" }] } } });
        case "CroBundleVariantSet": return data({ productVariantsBulkUpdate: { userErrors: [] } });
        case "CroPublications": return data({ publications: { nodes: [{ id: "gid://shopify/Publication/1", channels: { nodes: [{ handle: "online_store", name: "Online Store" }] } }] } });
        case "CroPublish": return data({ publishablePublish: { userErrors: [] } });
        case "CroBundleProductActivate": return data({ productUpdate: { product: { id: "gid://shopify/Product/1" }, userErrors: [] } });
        default: return data({});
      }
    },
  };
  return { admin: admin as unknown as AdminClient, calls };
}

test("a draft bundle product is not Active and not published", async () => {
  const a = fake();
  await createBundleProduct(a.admin, { title: "Box", price: 20, draft: true });
  assert.equal(a.calls.find((c) => c.op === "CroBundleProductCreate")!.vars.product.status, "DRAFT");
  assert.ok(!a.calls.some((c) => c.op === "CroPublish"), "not published to the Online Store");
  const live = fake();
  await createBundleProduct(live.admin, { title: "Box", price: 20 });
  assert.equal(live.calls.find((c) => c.op === "CroBundleProductCreate")!.vars.product.status, "ACTIVE");
  assert.ok(live.calls.some((c) => c.op === "CroPublish"), "the app's own bundles are still published at once");
});

test("activating a draft makes it Active and publishes it", async () => {
  const a = fake();
  await activateBundleProduct(a.admin, "gid://shopify/Product/1");
  assert.deepEqual(a.calls.find((c) => c.op === "CroBundleProductActivate")!.vars.product, { id: "gid://shopify/Product/1", status: "ACTIVE" });
  assert.ok(a.calls.some((c) => c.op === "CroPublish"));
});
