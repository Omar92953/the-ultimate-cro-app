/** The bundle guard: the stamp token and how the guard validation is configured (lib/cro.server.ts, lib/checkout-rules.server.ts). Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdminClient } from "../../app/lib/admin.server";

Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

type Call = { op: string; vars: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
function fake(guard: { id: string; enabled: boolean } | null) {
  const calls: Call[] = [];
  const admin = {
    graphql: async (query: string, o?: { variables?: Record<string, any> }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const op = /(?:mutation|query)\s+(\w+)/.exec(query)?.[1] ?? "";
      calls.push({ op, vars: o?.variables ?? {} });
      const data = (d: unknown) => ({ json: async () => ({ data: d }) });
      switch (op) {
        case "CroBundleGuard": return data({ validations: { nodes: guard ? [{ id: guard.id, title: "CRO Toolbox bundle guard", enabled: guard.enabled, shopifyFunction: { app: { apiKey: "k" } } }] : [] } });
        case "CroGuardCreate": return data({ validationCreate: { validation: { id: "gid://shopify/Validation/1" }, userErrors: [] } });
        case "CroGuardSet": return data({ metafieldsSet: { userErrors: [] } });
        case "CroGuardOn": case "CroGuardOff": return data({ validationUpdate: { userErrors: [] } });
        default: return data({});
      }
    },
  };
  return { admin: admin as unknown as AdminClient, calls };
}

test("the stamp is stable for a shop, different between shops and between secrets, and not guessable from the shop name", async () => {
  const { bundleStamp } = await import("../../app/lib/cro.server");
  const a = bundleStamp("secret", "a.myshopify.com");
  assert.equal(a, bundleStamp("secret", "a.myshopify.com"));
  assert.notEqual(a, bundleStamp("secret", "b.myshopify.com"));
  assert.notEqual(a, bundleStamp("other", "a.myshopify.com"));
  assert.match(a, /^[0-9a-f]{24}$/);
  assert.notEqual(a, "1");
});

test("the guard is made with the mix and match bundle ids and the stamp", async () => {
  const { syncBundleGuard } = await import("../../app/lib/checkout-rules.server");
  const a = fake(null);
  await syncBundleGuard(a.admin, ["7", "9"], "tok");
  const input = a.calls.find((c) => c.op === "CroGuardCreate")!.vars.input;
  assert.equal(input.functionHandle, "cro-validation");
  assert.equal(input.blockOnFailure, false, "if the Function ever errors, checkout goes ahead");
  assert.deepEqual(JSON.parse(input.metafields[0].value), { bundles: ["7", "9"], st: "tok" });
});

test("an existing guard gets the new ids and stamp and is switched on; no ids switches it off", async () => {
  const { syncBundleGuard } = await import("../../app/lib/checkout-rules.server");
  const on = fake({ id: "gid://shopify/Validation/1", enabled: false });
  await syncBundleGuard(on.admin, ["7"], "tok");
  assert.deepEqual(JSON.parse(on.calls.find((c) => c.op === "CroGuardSet")!.vars.metafields[0].value), { bundles: ["7"], st: "tok" });
  assert.ok(on.calls.some((c) => c.op === "CroGuardOn"));
  const off = fake({ id: "gid://shopify/Validation/1", enabled: true });
  await syncBundleGuard(off.admin, [], "tok");
  assert.ok(off.calls.some((c) => c.op === "CroGuardOff"));
  assert.ok(!off.calls.some((c) => c.op === "CroGuardSet"));
  const none = fake(null);
  await syncBundleGuard(none.admin, [], "tok");
  assert.ok(!none.calls.some((c) => c.op === "CroGuardCreate"), "nothing to guard: nothing is made");
});
