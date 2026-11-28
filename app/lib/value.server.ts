/**
 * What the app brought in, measured (never estimated): sales from the app's items in the last 30
 * days, from the order results (results.server.ts). Shared with Home, so the slow order read runs
 * once per shop; pages wait at most `waitMs` for a first read and show it on the next visit otherwise.
 */
import type { AdminClient } from "./admin.server";
import { getExperiment, getResults, type Results } from "./results.server";
import { rememberLive } from "./short-cache.server";

/**
 * A read up to 10 minutes old is used as is. An older one, or one from before a new order, is read
 * again: Home waits up to 1.5 s for it and otherwise shows the last numbers while the read goes on.
 */
export function cachedResults(admin: AdminClient, shop: string, waitMs = 3000): Promise<Results | null> {
  return Promise.race([
    rememberLive(shop, "home-results", 10 * 60000, () => getExperiment(admin).then((xp) => getResults(admin, xp, shop)), 1500).then((r) => r.value),
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
