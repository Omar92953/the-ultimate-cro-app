/**
 * Saving the after-purchase offer works every time, not only the first (2026-11-13: the second save failed with "Key is in
 * use for Shop metafields", so the offer could not be turned off or changed). Run: npm run test:app
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdminClient } from "../../app/lib/admin.server";

Object.assign(process.env, { SHOPIFY_APP_URL: "https://app.example" });

/** A store whose definition is `state`: "defined" (with `storefront` access), "none", or "unstructured" (offer saved, no definition). */
function store(state: "defined" | "none" | "unstructured", storefront = "PUBLIC_READ") {
  const ops: string[] = [];
  let saved: string | null = null;
  const admin = {
    graphql: async (q: string, o?: { variables?: Record<string, unknown> }) => {
      const op = /(query|mutation) (\w+)/.exec(q)?.[2] ?? "";
      ops.push(op);
      const v = o?.variables ?? {};
      const data =
        op === "CroPostPurchaseDefinitionFind" ? { metafieldDefinitions: { nodes: state === "defined" ? [{ id: "gid://shopify/MetafieldDefinition/1", access: { storefront } }] : [] } }
        : op === "CroPostPurchaseDefinition"
          ? state === "unstructured"
            ? { metafieldDefinitionCreate: { createdDefinition: null, userErrors: [{ code: "UNSTRUCTURED_ALREADY_EXISTS", message: "Key is in use for Shop metafields on the 'cro_toolbox' namespace." }] } }
            : ((state = "defined"), { metafieldDefinitionCreate: { createdDefinition: { id: "gid://shopify/MetafieldDefinition/1" }, userErrors: [] } })
        : op === "CroPostPurchaseUnstructured" ? ((state = "none"), { metafieldsDelete: { userErrors: [] } })
        : op === "CroPostPurchaseDefinitionAccess" ? { metafieldDefinitionUpdate: { userErrors: [] } }
        : op === "CroPostPurchaseSave" ? ((saved = String((v.metafields as { value: string }[])[0].value)), { metafieldsSet: { userErrors: [] } })
        : {};
      return { json: async () => ({ data }) };
    },
  } as unknown as AdminClient;
  return { admin, ops, saved: () => (saved ? JSON.parse(saved) : null) };
}

const offer = (on: boolean) => ({ on, pct: 15, product: { productId: "gid://shopify/Product/1", variantId: "gid://shopify/ProductVariant/2", title: "Liquid", variantTitle: "", price: 749.95, image: null } });

test("a saved offer can be saved again: switched off, it stays off", async () => {
  const { savePostPurchase } = await import("../../app/lib/post-purchase.server");
  const s = store("defined");
  const c = await savePostPurchase(s.admin, "gid://shopify/Shop/1", offer(false));
  assert.equal(c.on, false);
  assert.equal(s.saved().on, false);
  assert.ok(!s.ops.includes("CroPostPurchaseDefinition"), "an existing definition is not created again");
});

test("the first save makes the definition checkout reads", async () => {
  const { savePostPurchase } = await import("../../app/lib/post-purchase.server");
  const s = store("none");
  await savePostPurchase(s.admin, "gid://shopify/Shop/1", offer(true));
  assert.deepEqual(s.ops, ["CroPostPurchaseDefinitionFind", "CroPostPurchaseDefinition", "CroPostPurchaseSave"]);
  assert.equal(s.saved().on, true);
});

test("an offer saved without a definition is replaced, so checkout can read it", async () => {
  const { savePostPurchase } = await import("../../app/lib/post-purchase.server");
  const s = store("unstructured");
  await savePostPurchase(s.admin, "gid://shopify/Shop/1", offer(true));
  assert.deepEqual(s.ops, ["CroPostPurchaseDefinitionFind", "CroPostPurchaseDefinition", "CroPostPurchaseUnstructured", "CroPostPurchaseDefinition", "CroPostPurchaseSave"]);
});

test("a definition checkout can't read gets storefront access", async () => {
  const { savePostPurchase } = await import("../../app/lib/post-purchase.server");
  const s = store("defined", "NONE");
  await savePostPurchase(s.admin, "gid://shopify/Shop/1", offer(true));
  assert.ok(s.ops.includes("CroPostPurchaseDefinitionAccess"));
});
