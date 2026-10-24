/**
 * What a plan change does to a store (audit 2026-10-23: 4.2, 4.3, 8.4), against an in-memory store: offers over the
 * plan's slots pause and come back, theme features the plan locks are moved aside and back (settings kept), A/B tests
 * pause below Pro and run again after an upgrade. Run: npm run test:app
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdminClient } from "../../app/lib/admin.server";

Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

type Row = { id: string; type: string; handle: string; fields: Record<string, string> };

/** Metaobjects by type and handle; every other call answers nothing. */
function fakeStore() {
  const rows = new Map<string, Row>();
  let n = 0;
  const key = (type: string, handle: string) => `${type}|${handle}`;
  const put = (type: string, handle: string, fields: Record<string, string>) => {
    const old = rows.get(key(type, handle));
    const row = { id: old?.id ?? `gid://shopify/Metaobject/${++n}`, type, handle, fields: { ...(old?.fields ?? {}), ...fields } };
    rows.set(key(type, handle), row);
    return row;
  };
  const node = (r: Row) => ({ id: r.id, handle: r.handle, fields: Object.entries(r.fields).map(([k, value]) => ({ key: k, value, references: { nodes: [] } })), field: { value: r.fields.config ?? null } });
  const admin = {
    graphql: async (q: string, o?: { variables?: Record<string, any> }) => { // eslint-disable-line @typescript-eslint/no-explicit-any -- raw GraphQL variables
      const v = o?.variables ?? {};
      let data: unknown = {};
      const list = /metaobjects\(type: "([^"]+)"/.exec(q);
      const byHandle = /metaobjectByHandle\(handle: \{ type: "([^"]+)", handle: (?:"([^"]+)"|\$handle) \}\)/.exec(q);
      if (/metaobjectUpsert/.test(q)) {
        const r = put(v.handle.type, v.handle.handle, Object.fromEntries(v.metaobject.fields.map((f: { key: string; value: string }) => [f.key, f.value])));
        data = { metaobjectUpsert: { metaobject: { id: r.id, handle: r.handle }, userErrors: [] } };
      } else if (/metaobjectDelete/.test(q)) {
        for (const [k, r] of rows) if (r.id === v.id) rows.delete(k);
        data = { metaobjectDelete: { deletedId: v.id, userErrors: [] } };
      } else if (list) {
        data = { metaobjects: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [...rows.values()].filter((r) => r.type === list[1]).map(node) } };
      } else if (byHandle) {
        const r = rows.get(key(byHandle[1], byHandle[2] ?? v.handle));
        data = { metaobjectByHandle: r ? node(r) : null };
      } else if (/CroCheckoutRules/.test(q)) data = { paymentCustomizations: { nodes: [] }, deliveryCustomizations: { nodes: [] }, validations: { nodes: [] } };
      else if (/CroPostPurchase/.test(q)) data = { shop: { id: "gid://shopify/Shop/1", currencyCode: "USD", offer: null } };
      return { json: async () => ({ data }) };
    },
  } as unknown as AdminClient;
  return { admin, rows, put, get: (type: string, handle: string) => rows.get(key(type, handle)) ?? null };
}

const DESIGN = "$app:cro_design";
const noSync = () => {
  const calls: string[] = [];
  return { calls, sync: { discounts: async () => void calls.push("discounts"), bundles: async () => void calls.push("bundles") } };
};

test("4.2: a downgrade moves locked theme features aside (settings kept), an upgrade brings them back", async () => {
  const { applyPlanLimits } = await import("../../app/lib/billing.server");
  const s = fakeStore();
  s.put(DESIGN, "quiz", { config: '{"q":1}' });
  s.put(DESIGN, "quiz_editor", { config: '{"all":1}' });
  s.put(DESIGN, "image_carousel_2", { config: '{"s":[1]}' });
  s.put(DESIGN, "shoppable", { config: '{"d":1}' });
  s.put(DESIGN, "faq", { config: '{"free":1}' });
  const { sync } = noSync();

  let state = await applyPlanLimits(s.admin, "free", sync);
  assert.equal(s.get(DESIGN, "quiz"), null, "the store no longer sees the quiz");
  assert.equal(s.get(DESIGN, "quiz__off")?.fields.config, '{"q":1}');
  assert.equal(s.get(DESIGN, "quiz_editor")?.fields.config, '{"all":1}', "the editor copy stays");
  assert.equal(s.get(DESIGN, "image_carousel_2"), null);
  assert.equal(s.get(DESIGN, "shoppable"), null);
  assert.equal(s.get(DESIGN, "faq")?.fields.config, '{"free":1}', "free features stay");
  assert.ok(state.parked?.includes("quiz") && state.parked.includes("email_popup"), "every locked handle is remembered");

  state = await applyPlanLimits(s.admin, "starter", sync);
  assert.equal(s.get(DESIGN, "quiz")?.fields.config, '{"q":1}', "back after the upgrade");
  assert.equal(s.get(DESIGN, "quiz__off"), null);
  assert.equal(s.get(DESIGN, "image_carousel_2")?.fields.config, '{"s":[1]}');
  assert.equal(s.get(DESIGN, "shoppable"), null, "a Growth feature stays off on Starter");
  assert.deepEqual(state.parked, ["shoppable", "shoppable_2", "shoppable_3", "shoppable_4", "shoppable_5"]);

  await applyPlanLimits(s.admin, "pro", sync);
  assert.equal(s.get(DESIGN, "shoppable")?.fields.config, '{"d":1}');
  assert.deepEqual(JSON.parse(s.get(DESIGN, "plan_state")!.fields.config).parked, []);
});

test("4.3: running A/B tests pause below Pro and run again after an upgrade", async () => {
  const { applyPlanLimits } = await import("../../app/lib/billing.server");
  const s = fakeStore();
  const tests = [
    { id: "ab_one", name: "Words", offer: "o1", kind: "upsell", status: "running", startedAt: "2026-10-01T00:00:00Z", endedAt: null, winner: null, b: { headline: "New" } },
    { id: "ab_two", name: "Discount", offer: "o2", kind: "cross_sell", status: "running", startedAt: "2026-10-01T00:00:00Z", endedAt: null, winner: null, b: { discountPercent: 20 } },
    { id: "ab_old", name: "Old", offer: "o3", kind: "upsell", status: "stopped", startedAt: "2026-09-01T00:00:00Z", endedAt: "2026-09-10T00:00:00Z", winner: null, b: { headline: "x" } },
  ];
  s.put(DESIGN, "ab_tests_state", { config: JSON.stringify({ tests }) });
  s.put(DESIGN, "plan_state", { config: JSON.stringify({ plan: "pro", paused: [], at: null, parked: [] }) });
  const { calls, sync } = noSync();
  await applyPlanLimits(s.admin, "growth", sync);
  const after = JSON.parse(s.get(DESIGN, "ab_tests_state")!.fields.config).tests;
  assert.deepEqual(after.map((t: { status: string }) => t.status), ["paused", "paused", "stopped"]);
  assert.deepEqual(JSON.parse(s.get(DESIGN, "ab_tests")!.fields.config), {}, "the store shows no version B");
  assert.deepEqual(calls, ["discounts"], "a paused discount test sends the discounts again");
  await applyPlanLimits(s.admin, "pro", sync);
  assert.deepEqual(JSON.parse(s.get(DESIGN, "ab_tests_state")!.fields.config).tests.map((t: { status: string }) => t.status), ["running", "running", "stopped"]);
});

test("8.4: offers over the plan's slots pause (first ones stay) and come back after an upgrade", async () => {
  const { applyPlanLimits } = await import("../../app/lib/billing.server");
  const { PLANS } = await import("../../app/lib/plans");
  const s = fakeStore();
  const slots = PLANS.free.limits.offerSlots!;
  for (let i = 1; i <= slots + 2; i++) s.put("$app:cro_deal", `deal-${i}`, { name: `Deal ${i}`, kind: "volume", active: "true", config: "{}" });
  const { calls, sync } = noSync();
  const state = await applyPlanLimits(s.admin, "free", sync);
  const active = () => [...s.rows.values()].filter((r) => r.type === "$app:cro_deal" && r.fields.active === "true").map((r) => r.handle);
  assert.equal(active().length, slots, "only the plan's slots stay on");
  assert.equal(state.paused.length, 2);
  assert.ok(calls.includes("discounts"));
  await applyPlanLimits(s.admin, "pro", sync);
  assert.equal(active().length, slots + 2, "every paused offer is back");
  assert.deepEqual(JSON.parse(s.get(DESIGN, "plan_state")!.fields.config).paused, []);
});

test("4.2 and the free trial: the tried feature stays on, a feature tried before keeps working until the plan changes", async () => {
  const { applyPlanLimits, setTrialFeature } = await import("../../app/lib/billing.server");
  const s = fakeStore();
  s.put(DESIGN, "quiz", { config: '{"q":1}' });
  s.put(DESIGN, "delivery", { config: '{"d":1}' });
  s.put(DESIGN, "plan_state", { config: JSON.stringify({ plan: "free", paused: [], at: null, trial: "quiz", parked: [] }) });
  const { sync } = noSync();
  await applyPlanLimits(s.admin, "free", sync);
  assert.ok(s.get(DESIGN, "quiz"), "the free trial feature stays on");
  assert.equal(s.get(DESIGN, "delivery"), null, "another Starter feature is moved aside");
  await setTrialFeature(s.admin, "delivery");
  await applyPlanLimits(s.admin, "free", sync);
  assert.ok(s.get(DESIGN, "delivery"), "the new trial feature is back");
  assert.ok(s.get(DESIGN, "quiz"), "the feature tried before keeps working");
  await applyPlanLimits(s.admin, "starter", sync);
  await applyPlanLimits(s.admin, "free", sync);
  assert.equal(s.get(DESIGN, "quiz"), null, "after a plan change only the trial feature stays");
  assert.ok(s.get(DESIGN, "delivery"));
});
