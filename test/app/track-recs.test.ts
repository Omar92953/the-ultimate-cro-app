/** Recommendations under the order on the Track page (lib/track-recs.server.ts, lib/order-pages.ts). Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdminClient } from "../../app/lib/admin.server";
import { readRecRequest, trackRecs } from "../../app/lib/track-recs.server";
import { toStorefrontOrderPage, withOrderPageDefaults, withRecs } from "../../app/lib/order-pages";

const product = (handle: string, over: Record<string, unknown> = {}) => ({ handle, title: handle.toUpperCase(), status: "ACTIVE", featuredMedia: { preview: { image: { url: `https://cdn/${handle}.jpg` } } }, priceRangeV2: { minVariantPrice: { amount: "12.50", currencyCode: "EUR" } }, variants: { nodes: [{ id: "gid://shopify/ProductVariant/55", availableForSale: true }] }, ...over });

function admin(opts: { related: unknown[]; products: Record<string, unknown>[]; together?: Record<string, string[]> }) {
  const asked: string[] = [];
  return {
    asked,
    admin: {
      graphql: async (query: string, o?: { variables?: Record<string, unknown> }) => {
        const data = (d: unknown) => ({ json: async () => ({ data: d }) });
        if (query.includes("CroTrackRelated")) return data({ nodes: opts.related });
        if (query.includes("CroBoughtTogetherMap")) return data({ metaobjectByHandle: { field: { value: JSON.stringify({ map: opts.together ?? {} }) } } });
        if (query.includes("CroTrackRecs")) {
          asked.push(String(o?.variables?.q));
          const wanted = String(o?.variables?.q).split(" OR ").map((x) => x.replace("handle:", ""));
          return data({ products: { nodes: opts.products.filter((p) => wanted.includes(String(p.handle))) } });
        }
        return data({});
      },
    } as unknown as AdminClient,
  };
}

test("the page's request is cleaned", () => {
  assert.equal(readRecRequest(null), null);
  assert.equal(readRecRequest({ rows: [] }), null);
  const r = readRecRequest({ count: 99, rows: [{ key: "like", source: "picks", picks: ["ok-handle", "Bad Handle!", "x".repeat(300)] }, { key: "complete", source: "together" }, { key: "like", source: "collection" }] })!;
  assert.equal(readRecRequest({ rows: [{ key: "nope", source: "picks" }] }), null);
  assert.equal(r.count, 8);
  assert.equal(r.rows.length, 2, "at most two rows");
  assert.deepEqual(r.rows[0].picks, ["ok-handle"]);
});

test("collection and bought together rows skip what is in the order and what is sold out", async () => {
  const f = admin({
    related: [{ id: "gid://shopify/Product/1", handle: "tee", collections: { nodes: [{ products: { nodes: [{ handle: "tee" }, { handle: "cap" }, { handle: "socks" }, { handle: "gone" }, { handle: "draft" }] } }] } }],
    together: { "1": ["belt", "cap"] },
    products: [product("cap"), product("socks"), product("belt"), product("gone", { variants: { nodes: [{ id: "gid://shopify/ProductVariant/9", availableForSale: false }] } }), product("draft", { status: "DRAFT" })],
  });
  const out = await trackRecs(f.admin, ["gid://shopify/Product/1"], readRecRequest({ count: 4, rows: [{ key: "like", source: "collection" }, { key: "complete", source: "together" }] })!);
  assert.deepEqual(out.like.map((p) => p.handle), ["cap", "socks"]);
  // "cap" already shows in the first row, so the second row has only belt.
  assert.deepEqual(out.complete.map((p) => p.handle), ["belt"]);
  assert.equal(out.like[0].variantId, 55);
  assert.equal(out.like[0].currency, "EUR");
  assert.ok(!f.asked.join(" ").includes("handle:tee"), "the order's own product is never asked for");
});

test("picks work even without order products, and the count limits a row", async () => {
  const f = admin({ related: [], products: ["a", "b", "c"].map((h) => product(h)) });
  const out = await trackRecs(f.admin, [], readRecRequest({ count: 2, rows: [{ key: "like", source: "picks", picks: ["a", "b", "c"] }] })!);
  assert.deepEqual(out.like.map((p) => p.handle), ["a", "b"]);
  const none = await trackRecs(f.admin, [], readRecRequest({ rows: [{ key: "like", source: "collection" }] })!);
  assert.deepEqual(none, { like: [], complete: [] });
});

test("the page design: off by default, and only the rows that are on reach the store copy", () => {
  assert.equal(toStorefrontOrderPage(withOrderPageDefaults({}, "track")).recs, null);
  const d = withOrderPageDefaults({ recs: { like: { on: true, source: "picks", picks: [{ handle: "ok", title: "OK" }, { handle: "No Way", title: "x" }] }, count: 50 } }, "track");
  assert.equal(d.recs.count, 8);
  const store = toStorefrontOrderPage(d).recs!;
  assert.deepEqual(store.rows, [{ key: "like", heading: "You may also like", source: "picks", picks: ["ok"] }]);
  // Returns pages never get rows.
  assert.equal(toStorefrontOrderPage(withOrderPageDefaults({ recs: { like: { on: true } } }, "returns")).recs, null);
  assert.equal(withRecs(undefined).complete.heading, "Complete your order");
});
