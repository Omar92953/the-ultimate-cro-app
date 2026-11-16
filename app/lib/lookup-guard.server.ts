/**
 * Order lookups on the Track and Returns pages (number + email) that found nothing, counted per store and typed email in
 * the database, so guessing order numbers for someone else's email is stopped across visitors, addresses and deploys
 * (audit 2026-11-14, A8). The per visitor limit (proxy-guard.server.ts) still applies first. Rows are kept one day
 * (retention.server.ts) and removed by the privacy webhooks.
 */
import db from "../db.server";

/** Misses allowed in an hour for one typed email in one store, and for all of a store's lookups together. */
export const MISSES_PER_EMAIL = 20;
export const MISSES_PER_STORE = 300;
const HOUR = 60 * 60_000;

/** True when this email (or the whole store) has had too many lookups that found nothing in the last hour. */
export async function lookupBlocked(shop: string, email: string, now = new Date()) {
  const since = new Date(now.getTime() - HOUR);
  const mine = await db.lookupMiss.count({ where: { shop, email: email.toLowerCase(), createdAt: { gte: since } } });
  if (mine >= MISSES_PER_EMAIL) return true;
  return (await db.lookupMiss.count({ where: { shop, createdAt: { gte: since } } })) >= MISSES_PER_STORE;
}

/** Counts one lookup that found nothing. A failure never stops the answer to the shopper. */
export async function countMiss(shop: string, email: string, now = new Date()) {
  await db.lookupMiss.create({ data: { shop, email: email.toLowerCase(), createdAt: now } }).catch((e) => console.error("[lookup guard]", e instanceof Error ? e.message : e));
}

export const redactLookupEmail = (shop: string, email: string) => db.lookupMiss.deleteMany({ where: { shop, email: email.toLowerCase() } });
export const removeShopLookups = (shop: string) => db.lookupMiss.deleteMany({ where: { shop } });
