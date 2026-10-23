/** Public storefront pages and forms follow the plan: after a downgrade a locked feature answers "off" (audit 2026-10-23). Run: npm run test:app */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdminClient } from "../../app/lib/admin.server";

Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });
// No trial feature chosen (the plan state read fails, which counts as none).
const admin = { graphql: async () => { throw new Error("offline"); } } as unknown as AdminClient;

test("the email pop up, the Track page and the Returns page answer only on plans that include them", async () => {
  const { storefrontOpen } = await import("../../app/lib/rules.server");
  const cases: [string, "email_popup" | "track" | "returns", boolean][] = [
    ["free", "email_popup", false],
    ["starter", "email_popup", true],
    ["starter", "track", false],
    ["starter", "returns", false],
    ["growth", "track", true],
    ["growth", "returns", true],
    ["pro", "email_popup", true],
  ];
  for (const [plan, feature, open] of cases) {
    process.env.CRO_PLAN_OVERRIDE = plan;
    assert.equal(await storefrontOpen(admin, `sf-${plan}-${feature}.myshopify.com`, feature), open, `${plan} ${feature}`);
  }
  delete process.env.CRO_PLAN_OVERRIDE;
});
