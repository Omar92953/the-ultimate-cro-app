/**
 * A/B tests for offers (Pro), see lib/ab-tests.ts. Kept in two places:
 *   $app:cro_design "ab_tests_state": every test (running, stopped, applied), for the app;
 *   $app:cro_design "ab_tests":       the running ones by offer handle, with B's full values, for the offer blocks.
 * The discount engine reads B's discount from the offer discount's configuration (buildDiscountConfig).
 * Results come from real data only: shoppers counted by the offer blocks (AbView) and the store's own orders
 * (the cart attribute _cro_ab).
 */
import db from "../db.server";
import { AdminError, gql, type AdminClient } from "./admin.server";
import { AB_KINDS, MAX_RUNNING_TESTS, MAX_VERSIONS, applyOverrides, changesDiscount, cleanOverrides, compareVersions, groupsOf, isGroup, overridesOf, testChangesDiscount, toStorefrontAbTests, validateVersions, type AbGroup, type AbOverrides, type AbResult, type AbTest, type GroupStats } from "./ab-tests";
import { getDiscountStatus, listRules, saveRule, syncDiscounts, upsert } from "./cro.server";
import type { PlanKey } from "./plans";
import { RuleError, requireFeature } from "./rules";
import type { Rule } from "./types";

const STATE = "ab_tests_state";
const MAX_KEPT = 30;

export async function listTests(admin: AdminClient): Promise<AbTest[]> {
  const d = await gql(admin, `#graphql
    query CroAbState($handle: String!) { metaobjectByHandle(handle: { type: "$app:cro_design", handle: $handle }) { field(key: "config") { value } } }`, { handle: STATE });
  try {
    const raw = JSON.parse(d.metaobjectByHandle?.field?.value ?? "{}")?.tests;
    return (Array.isArray(raw) ? raw : []).flatMap((t: Partial<AbTest>): AbTest[] => {
      if (!t?.id || !t.offer || !(AB_KINDS as readonly string[]).includes(String(t.kind))) return [];
      const kind = t.kind as AbTest["kind"];
      return [{ id: String(t.id), name: String(t.name ?? "").slice(0, 80), offer: String(t.offer), kind, status: t.status === "stopped" || t.status === "applied" || t.status === "paused" ? t.status : "running", startedAt: String(t.startedAt ?? ""), endedAt: t.endedAt ? String(t.endedAt) : null, winner: isGroup(t.winner) ? t.winner : null, b: cleanOverrides(kind, t.b), ...(Array.isArray(t.more) && t.more.length ? { more: t.more.slice(0, MAX_VERSIONS - 2).map((o) => cleanOverrides(kind, o)) } : {}) }];
    });
  } catch {
    return [];
  }
}

async function write(admin: AdminClient, tests: AbTest[], rules: Rule[]) {
  const live = (t: AbTest) => t.status === "running" || t.status === "paused";
  const kept = [...tests.filter(live), ...tests.filter((t) => !live(t)).slice(0, MAX_KEPT - 5)].slice(0, MAX_KEPT);
  await upsert(admin, "$app:cro_design", STATE, { config: JSON.stringify({ tests: kept }) });
  await upsert(admin, "$app:cro_design", "ab_tests", { config: JSON.stringify(toStorefrontAbTests(kept, rules)) });
  return kept;
}

const newId = () => `ab_${Math.random().toString(36).slice(2, 10)}`;

/** `versions`: B, then C and D when wanted (only what differs from the offer). */
export async function createTest(admin: AdminClient, ctx: { plan: PlanKey; trial: null }, input: { name: string; offer: string; versions: unknown[] }) {
  requireFeature(ctx.plan, "ab_tests", ctx.trial);
  const [tests, rules] = await Promise.all([listTests(admin), listRules(admin)]);
  const rule = rules.find((r) => r.handle === input.offer) ?? null;
  if (!rule || !(AB_KINDS as readonly string[]).includes(rule.kind)) throw new RuleError("Choose an upsell or cross sell offer.", "input", false);
  const versions = (Array.isArray(input.versions) ? input.versions : []).slice(0, MAX_VERSIONS - 1).map((v) => cleanOverrides(rule.kind, v));
  const problems = validateVersions(rule, rule.kind, versions);
  if (problems.length) throw new RuleError(problems.join(" "), "input", false);
  if (!rule.active) throw new RuleError("Turn the offer on first: a test needs shoppers to see it.", "input", false);
  if (tests.some((t) => t.status === "running" && t.offer === rule.handle)) throw new RuleError("This offer already has a test running. Stop it first.", "limit", false);
  if (tests.filter((t) => t.status === "running").length >= MAX_RUNNING_TESTS) throw new RuleError(`Up to ${MAX_RUNNING_TESTS} tests can run at once. Stop one first.`, "limit", false);
  const [b, ...more] = versions;
  if (versions.some(changesDiscount)) {
    if (rule.kind === "cross_sell" && rule.placements.includes("drawer")) throw new RuleError("This cross sell also shows in the cart drawer, which cannot show another version's discount. Test the words and style, or remove the drawer from the offer first.", "input", false);
    if ((await getDiscountStatus(admin)).engine !== "function") throw new RuleError("Testing a discount needs the app's own discount engine. Open Settings, Checkout discounts, and choose the app's engine.", "input", false);
  }
  const test: AbTest = { id: newId(), name: input.name.trim().slice(0, 80) || rule.name, offer: rule.handle!, kind: rule.kind, status: "running", startedAt: new Date().toISOString(), endedAt: null, winner: null, b, ...(more.length ? { more } : {}) };
  const saved = await write(admin, [test, ...tests], rules);
  if (testChangesDiscount(test)) await syncDiscounts(admin);
  return { test, tests: saved };
}

async function finish(admin: AdminClient, id: string, status: "stopped" | "applied", winner: AbGroup | null) {
  const [tests, rules] = await Promise.all([listTests(admin), listRules(admin)]);
  const test = tests.find((t) => t.id === id);
  if (!test || test.status !== "running") throw new RuleError("That test is not running.", "input", false);
  test.status = status;
  test.winner = winner;
  test.endedAt = new Date().toISOString();
  return { test, tests, rules };
}

/** Stops the test: every shopper sees the offer as saved (version A) again. */
export async function stopTest(admin: AdminClient, id: string) {
  const { test, tests, rules } = await finish(admin, id, "stopped", null);
  await write(admin, tests, rules);
  if (testChangesDiscount(test)) await syncDiscounts(admin);
}

/** Ends the test with a winner: that version's changes become the offer; A leaves it as it is. */
export async function applyWinner(admin: AdminClient, id: string, winner: AbGroup) {
  const known = (await listTests(admin)).find((t) => t.id === id);
  if (known && !groupsOf(known).includes(winner)) throw new RuleError(`This test has no version ${winner}.`, "input", false);
  const { test, tests, rules } = await finish(admin, id, "applied", winner);
  const rule = rules.find((r) => r.handle === test.offer);
  const chosen = overridesOf(test, winner);
  if (chosen) {
    if (!rule) throw new RuleError("The offer no longer exists.", "input", false);
    // The test is already over in the storefront copy before the offer changes, so nobody sees a version twice.
    await write(admin, tests, rules);
    await saveRule(admin, applyOverrides(rule, chosen));
    return;
  }
  await write(admin, tests, rules);
  if (testChangesDiscount(test)) await syncDiscounts(admin);
}

/**
 * Below Pro running tests pause (every shopper sees the offer as saved); after an upgrade they run again, with the same
 * groups. True when a paused or resumed test changes a discount (the discount engine must be sent again).
 */
export async function setTestsPaused(admin: AdminClient, paused: boolean) {
  const [tests, rules] = await Promise.all([listTests(admin), listRules(admin)]);
  const from = paused ? "running" : "paused";
  const moved = tests.filter((t) => t.status === from);
  if (!moved.length) return { moved: 0, discounts: false };
  for (const t of moved) t.status = paused ? "paused" : "running";
  await write(admin, tests, rules);
  return { moved: moved.length, discounts: moved.some(testChangesDiscount) };
}

/* ------------------------------------------------------------------ views -- */
export async function countView(shop: string, test: string, grp: AbGroup) {
  const day = new Date().toISOString().slice(0, 10);
  await db.abView.upsert({ where: { shop_test_grp_day: { shop, test, grp, day } }, create: { shop, test, grp, day, count: 1 }, update: { count: { increment: 1 } } });
}

export async function removeShopAb(shop: string) {
  await db.abView.deleteMany({ where: { shop } });
}

/* ---------------------------------------------------------------- results -- */
type AbOrder = { createdAt: string; cancelledAt: string | null; totalPriceSet: { shopMoney: { amount: string } }; customAttributes: { key: string; value: string }[]; lineItems: { nodes: { customAttributes: { key: string; value: string }[] }[] } };

export const parseGroups = (value: string | undefined) => {
  const out: Record<string, AbGroup> = {};
  for (const part of String(value ?? "").split(",")) {
    const [id, g] = part.split(":");
    if (id && isGroup(g)) out[id.trim()] = g;
  }
  return out;
};

/** Each test's numbers from the shop's orders since it started (the last 60 days at most) and the counted views. */
export async function testResults(admin: AdminClient, shop: string, tests: AbTest[]): Promise<Record<string, AbResult>> {
  if (!tests.length) return {};
  const first = Math.max(Date.now() - 60 * 864e5, Math.min(...tests.map((t) => Date.parse(t.startedAt) || Date.now())));
  const orders: AbOrder[] = [];
  let after: string | null = null;
  for (let page = 0; page < 12; page++) {
    const data: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: AbOrder[] } } = await gql(admin, `#graphql
      query CroAbOrders($after: String, $q: String) {
        orders(first: 25, after: $after, query: $q, sortKey: CREATED_AT, reverse: true) {
          pageInfo { hasNextPage endCursor }
          nodes { createdAt cancelledAt totalPriceSet { shopMoney { amount } } customAttributes { key value } lineItems(first: 30) { nodes { customAttributes { key value } } } }
        }
      }`, { after, q: `created_at:>='${new Date(first).toISOString()}' test:false` });
    orders.push(...data.orders.nodes.filter((o) => !o.cancelledAt));
    if (!data.orders.pageInfo.hasNextPage) break;
    after = data.orders.pageInfo.endCursor;
  }
  const views = await db.abView.findMany({ where: { shop, test: { in: tests.map((t) => t.id) } } });
  const out: Record<string, AbResult> = {};
  for (const t of tests) {
    const g: Partial<Record<AbGroup, GroupStats>> = Object.fromEntries(groupsOf(t).map((x) => [x, { views: 0, orders: 0, revenue: 0, adds: 0 }]));
    for (const v of views) if (v.test === t.id && isGroup(v.grp) && g[v.grp]) g[v.grp]!.views += v.count;
    const from = Date.parse(t.startedAt), to = t.endedAt ? Date.parse(t.endedAt) : Infinity;
    for (const o of orders) {
      const at = Date.parse(o.createdAt);
      if (at < from || at > to) continue;
      const group = parseGroups(o.customAttributes.find((x) => x.key === "_cro_ab")?.value)[t.id];
      const stats = group ? g[group] : undefined;
      if (!stats) continue;
      stats.orders += 1;
      stats.revenue += Number(o.totalPriceSet.shopMoney.amount) || 0;
      if (o.lineItems.nodes.some((l) => l.customAttributes.some((x) => x.key === "_source" && x.value === t.kind))) stats.adds += 1;
    }
    out[t.id] = compareVersions(g);
  }
  return out;
}

export { AdminError };
export type { AbOverrides };
