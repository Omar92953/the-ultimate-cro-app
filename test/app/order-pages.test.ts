/** The app makes the Track and Returns pages and remembers their handles (lib/order-page-setup.server.ts). Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdminClient } from "../../app/lib/admin.server";

Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

function fakeAdmin(existing: Record<string, { id: string; handle: string; title: string }> = {}) {
  const store = new Map<string, string>();
  const created: string[] = [];
  const admin = {
    graphql: async (query: string, opts?: { variables?: Record<string, unknown> }) => {
      const v = opts?.variables ?? {};
      const data = (d: unknown) => ({ json: async () => ({ data: d }) });
      if (query.includes("pageCreate")) {
        const page = v.page as { title: string; handle: string };
        created.push(page.handle);
        return data({ pageCreate: { page: { id: `gid://shopify/Page/${created.length + 100}`, handle: page.handle, title: page.title }, userErrors: [] } });
      }
      if (query.includes("CroPageTemplates")) return data({ nodes: ((v.ids as string[]) ?? []).map((id) => ({ id, templateSuffix: null })) });
      if (query.includes("pages(first")) return data({ pages: { nodes: existing[String(v.q).replace("handle:", "")] ? [existing[String(v.q).replace("handle:", "")]] : [] } });
      if (query.includes("metaobjectUpsert")) {
        store.set((v.handle as { handle: string }).handle, ((v.metaobject as { fields: { value: string }[] }).fields[0]).value);
        return data({ metaobjectUpsert: { metaobject: { id: "x", handle: "order_pages" }, userErrors: [] } });
      }
      if (query.includes("metaobjectByHandle")) return data({ metaobjectByHandle: store.has("order_pages") ? { field: { value: store.get("order_pages") } } : null });
      return data({});
    },
  };
  return { admin: admin as unknown as AdminClient, store, created };
}

test("it makes the page and saves both handles for the block", async () => {
  const { createOrderPage, getOrderPages } = await import("../../app/lib/order-page-setup.server");
  const f = fakeAdmin();
  assert.deepEqual(await getOrderPages(f.admin), { track: null, returns: null, wishlist: null, loyalty: null });
  const t = await createOrderPage(f.admin, "track");
  const r = await createOrderPage(f.admin, "returns");
  assert.deepEqual(f.created, ["track-your-order", "returns"]);
  const pages = await getOrderPages(f.admin);
  assert.equal(pages.track?.handle, t.handle);
  assert.equal(pages.returns?.handle, r.handle);
  // The block reads these two flat fields.
  const saved = JSON.parse(f.store.get("order_pages")!);
  assert.equal(saved.trackHandle, "track-your-order");
  assert.equal(saved.returnsHandle, "returns");
});

test("a page that already has the handle is adopted, not created twice", async () => {
  const { createOrderPage } = await import("../../app/lib/order-page-setup.server");
  const f = fakeAdmin({ returns: { id: "gid://shopify/Page/7", handle: "returns", title: "Returns" } });
  const p = await createOrderPage(f.admin, "returns");
  assert.equal(p.id, "gid://shopify/Page/7");
  assert.deepEqual(f.created, []);
});

test("the editor link opens the page the app made", async () => {
  const { orderPageContext } = await import("../../app/lib/order-page-setup.server");
  const f = fakeAdmin();
  const none = await orderPageContext(f.admin, "t.myshopify.com", { files: { track: ["templates/index.json"] } });
  assert.equal(none.inPageTemplate, false);
  assert.match(none.editor("track"), /previewPath=%2Fpages%2Ftrack-your-order/);
});

test("the block must be in the template the made pages really use", async () => {
  const { orderPageContext, templateFile } = await import("../../app/lib/order-page-setup.server");
  assert.equal(templateFile(null), "templates/page.json");
  assert.equal(templateFile("track"), "templates/page.track.json");
  const f = fakeAdmin();
  await (await import("../../app/lib/order-page-setup.server")).createOrderPage(f.admin, "track");
  await (await import("../../app/lib/order-page-setup.server")).createOrderPage(f.admin, "returns");
  // The fake answers every page with the default template (no suffix).
  const only = await orderPageContext(f.admin, "t.myshopify.com", { files: { track: ["templates/page.contact.json"] } });
  assert.equal(only.inPageTemplate, false, "another page.*.json is not the template these pages use");
  const yes = await orderPageContext(f.admin, "t.myshopify.com", { files: { track: ["templates/page.json"] } });
  assert.equal(yes.inPageTemplate, true);
});

test("the Wishlist page is made and remembered like the other two", async () => {
  const { createOrderPage, getOrderPages } = await import("../../app/lib/order-page-setup.server");
  const f = fakeAdmin();
  await createOrderPage(f.admin, "wishlist");
  assert.equal((await getOrderPages(f.admin)).wishlist?.handle, "wishlist");
  assert.equal(JSON.parse(f.store.get("order_pages")!).wishlistHandle, "wishlist");
});

test("the Rewards page (loyalty) is made and remembered like the others", async () => {
  const { createOrderPage, getOrderPages } = await import("../../app/lib/order-page-setup.server");
  const f = fakeAdmin();
  await createOrderPage(f.admin, "loyalty");
  assert.equal((await getOrderPages(f.admin)).loyalty?.handle, "rewards");
  assert.equal(JSON.parse(f.store.get("order_pages")!).loyaltyHandle, "rewards");
});
