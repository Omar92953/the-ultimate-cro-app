/**
 * A "no subscription" answer from the Admin API (no Partner API keys) switches a store to Free limits only once it is
 * confirmed: by Shopify's app_subscriptions/update webhook, or by an hour of the same answer (audit 2026-11-14, A6).
 * Run: npm run test:app
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdminClient } from "../../app/lib/admin.server";
import type { PlanInfo } from "../../app/lib/billing.server";

Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });

// Every Admin API call fails: only whether the plan limits start is checked (their failure is caught and logged).
const admin = { graphql: async () => { throw new Error("offline"); } } as unknown as AdminClient;
const info = (source: PlanInfo["source"], plan: PlanInfo["plan"] = "free"): PlanInfo => ({ plan, source, subscription: null, trialEndsAt: null, yearly: false, planUrl: "" });
const quiet = async (p: Promise<unknown> | undefined) => {
  const log = console.error;
  console.error = () => {};
  try {
    await p;
  } finally {
    console.error = log;
  }
};

test("no subscription starts the Free limits only after an hour of the same answer", async () => {
  const { keepWithinPlan } = await import("../../app/lib/billing.server");
  const t0 = Date.now();
  assert.equal(keepWithinPlan(admin, "a.myshopify.com", info("none"), { now: t0 }), undefined, "first answer: wait");
  assert.equal(keepWithinPlan(admin, "a.myshopify.com", info("none"), { now: t0 + 30 * 60_000 }), undefined, "half an hour: still waiting");
  const run = keepWithinPlan(admin, "a.myshopify.com", info("none"), { now: t0 + 61 * 60_000 });
  assert.ok(run instanceof Promise, "an hour later: Free is applied");
  await quiet(run);
});

test("a paid answer in between starts the hour again", async () => {
  const { keepWithinPlan } = await import("../../app/lib/billing.server");
  const t0 = Date.now();
  keepWithinPlan(admin, "b.myshopify.com", info("none"), { now: t0 });
  await quiet(keepWithinPlan(admin, "b.myshopify.com", info("admin", "pro"), { now: t0 + 10 * 60_000 }));
  assert.equal(keepWithinPlan(admin, "b.myshopify.com", info("none"), { now: t0 + 61 * 60_000 }), undefined);
});

test("the webhook's ended subscription confirms Free at once; a failed check never does", async () => {
  const { keepWithinPlan } = await import("../../app/lib/billing.server");
  assert.equal(keepWithinPlan(admin, "c.myshopify.com", info("error", "pro")), undefined);
  const run = keepWithinPlan(admin, "c.myshopify.com", info("none"), { confirmed: true });
  assert.ok(run instanceof Promise);
  await quiet(run);
});
