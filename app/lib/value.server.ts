/**
 * What the app brought in, measured (never estimated): sales from the app's items in the last 30
 * days, from the order results (results.server.ts). Shared with Home, so the slow order read runs
 * once per shop; pages wait at most `waitMs` for it and show it on the next visit otherwise.
 */
import type { AdminClient } from "./admin.server";
import { getExperiment, getResults, type Results } from "./results.server";
import { remember } from "./short-cache.server";

export function cachedResults(admin: AdminClient, shop: string, waitMs = 3000): Promise<Results | null> {
  return Promise.race([
    remember(shop, "home-results", 10 * 60000, () => getExperiment(admin).then((xp) => getResults(admin, xp)), 60 * 60000),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs)),
  ]).catch(() => null);
}

export type Value = { currency: string; appRevenue: number; appOrders: number };

/** Last 30 days of app sales, or null when orders can't be read (yet). */
export async function getValue(admin: AdminClient, shop: string): Promise<Value | null> {
  const r = await cachedResults(admin, shop);
  if (!r) return null;
  return { currency: r.currency, appRevenue: r.periods.current.appRevenue, appOrders: r.periods.current.appOrders };
}
