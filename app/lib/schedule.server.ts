/**
 * Scheduled offers (Pro, lib/schedule.ts): saved per offer, and a job every 5 minutes switches offers on at their start
 * and off at their end through the same save functions the editors use, so discounts and the storefront follow.
 */
import db from "../db.server";
import { gql, type AdminClient } from "./admin.server";
import { listBundles, listRules, saveBundle, saveRule } from "./cro.server";
import { listDeals, saveDeal } from "./deals.server";
import { getPlan } from "./billing.server";
import { atLeast, type PlanKey } from "./plans";
import { RuleError } from "./rules";
import { dueAction, onNow, scheduleLabel, scheduleProblem, toInstant, toLocal, type ScheduleInput, type ScheduleType } from "./schedule";

const zones = new Map<string, string>();
/** The store's time zone (Settings → General in Shopify), remembered per server process. */
export async function shopTimeZone(admin: AdminClient, shop: string): Promise<string> {
  const known = zones.get(shop);
  if (known) return known;
  const d = await gql(admin, `#graphql
    query CroShopTimeZone { shop { ianaTimezone } }`);
  const tz = String(d.shop?.ianaTimezone || "UTC");
  zones.set(shop, tz);
  return tz;
}

/** The offer's schedule as the editor shows it, in the store's time zone. */
export async function getSchedule(admin: AdminClient, shop: string, type: ScheduleType, handle: string | null | undefined) {
  const timeZone = await shopTimeZone(admin, shop).catch(() => "UTC");
  const row = handle ? await db.offerSchedule.findUnique({ where: { shop_type_handle: { shop, type, handle } } }) : null;
  return { timeZone, start: toLocal(row?.startsAt, timeZone), end: toLocal(row?.endsAt, timeZone) };
}

/**
 * Checks a schedule before the offer is saved: Pro only, an end in the future, after the start.
 * Returns the moments and whether the offer should be on now (off before its start).
 */
export async function checkSchedule(admin: AdminClient, shop: string, plan: PlanKey, input: ScheduleInput | null | undefined, saved: { type: ScheduleType; handle: string | null | undefined } | null = null, now = new Date()) {
  if (!input || (!input.start && !input.end)) return null;
  if (!atLeast(plan, "pro")) throw new RuleError("Scheduled offers are on the Pro plan.", "plan");
  const timeZone = await shopTimeZone(admin, shop);
  const s = { startsAt: toInstant(input.start, timeZone), endsAt: toInstant(input.end, timeZone) };
  if (input.start && !s.startsAt) throw new RuleError("Choose a start date and time.", "input", false);
  if (input.end && !s.endsAt) throw new RuleError("Choose an end date and time.", "input", false);
  const before = saved?.handle ? await db.offerSchedule.findUnique({ where: { shop_type_handle: { shop, type: saved.type, handle: saved.handle } } }) : null;
  const problem = scheduleProblem(s, now, before?.startsAt ?? null);
  if (problem) throw new RuleError(problem, "input", false);
  return { ...s, activeNow: onNow(s, now) };
}

/** Saves (or, with no start and no end, removes) the schedule of a saved offer. */
export async function saveSchedule(shop: string, type: ScheduleType, handle: string, s: { startsAt: Date | null; endsAt: Date | null } | null, now = new Date()) {
  const where = { shop_type_handle: { shop, type, handle } };
  if (!s || (!s.startsAt && !s.endsAt)) {
    await db.offerSchedule.deleteMany({ where: { shop, type, handle } });
    return;
  }
  // A start already passed is done: the merchant's own on/off choice stands.
  const data = { startsAt: s.startsAt, endsAt: s.endsAt, startDone: !!s.startsAt && s.startsAt.getTime() <= now.getTime(), endDone: false, updatedAt: now };
  await db.offerSchedule.upsert({ where, create: { shop, type, handle, ...data }, update: data });
}

/** The schedules of a store, for the offers list ("Starts …", "Ends …"). */
export async function schedulesFor(shop: string) {
  return db.offerSchedule.findMany({ where: { shop } });
}

async function setActive(admin: AdminClient, type: ScheduleType, handle: string, on: boolean): Promise<boolean> {
  if (type === "rule") {
    const r = (await listRules(admin)).find((x) => x.handle === handle);
    if (!r) return false;
    if (r.active !== on) await saveRule(admin, { ...r, active: on });
  } else if (type === "deal") {
    const d = (await listDeals(admin)).find((x) => x.handle === handle);
    if (!d) return false;
    if (d.active !== on) await saveDeal(admin, { ...d, active: on });
  } else {
    const b = (await listBundles(admin)).find((x) => x.handle === handle);
    if (!b) return false;
    if (b.active !== on) await saveBundle(admin, { ...b, active: on });
  }
  return true;
}

/** Switches every offer whose start or end has come. `adminFor` gives a store's Admin API client; `switcher` is for tests. */
export async function runSchedules(adminFor: (shop: string) => Promise<AdminClient>, now = new Date(), switcher?: (type: ScheduleType, handle: string, on: boolean) => Promise<boolean>) {
  const due = await db.offerSchedule.findMany({ where: { OR: [{ startDone: false, startsAt: { lte: now } }, { endDone: false, endsAt: { lte: now } }] } });
  const byShop = new Map<string, typeof due>();
  for (const r of due) byShop.set(r.shop, [...(byShop.get(r.shop) ?? []), r]);
  let switched = 0;
  for (const [shop, rows] of byShop) {
    try {
      const admin = await adminFor(shop);
      const pro = atLeast((await getPlan(admin, shop)).plan, "pro");
      for (const r of rows) {
        const action = dueAction(r, now);
        const key = { shop_type_handle: { shop, type: r.type, handle: r.handle } };
        // Below Pro the schedule is let go (never switched late after an upgrade).
        const found = pro && action ? await (switcher ? switcher(r.type as ScheduleType, r.handle, action === "on") : setActive(admin, r.type as ScheduleType, r.handle, action === "on")) : true;
        if (!found) await db.offerSchedule.delete({ where: key }).catch(() => null);
        else await db.offerSchedule.update({ where: key, data: action === "off" || !pro ? { startDone: true, endDone: true } : { startDone: true } });
        if (found && pro && action) switched++;
      }
    } catch (e) {
      console.error(`[schedule] ${shop}:`, e);
    }
  }
  return switched;
}

declare global {
  // eslint-disable-next-line no-var
  var croScheduleTimer: ReturnType<typeof setInterval> | undefined;
}

/** Checks the schedules every 5 minutes, once per server process (not in tests or local development). */
export function startSchedules() {
  if (globalThis.croScheduleTimer || process.env.NODE_ENV !== "production") return;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const { unauthenticated } = await import("../shopify.server");
      const n = await runSchedules(async (shop) => (await unauthenticated.admin(shop)).admin as AdminClient);
      if (n) console.log(`[schedule] switched ${n} offers`);
    } catch (e) {
      console.error("[schedule] run failed:", e);
    } finally {
      running = false;
    }
  };
  setTimeout(run, 30_000);
  globalThis.croScheduleTimer = setInterval(run, 5 * 60_000);
}

/** Adds "Starts …" or "Ends …" to the offers list rows that have a schedule coming. */
export async function withScheduleLabels<R extends { type: string; href: string; where: string }>(admin: AdminClient, shop: string, rows: R[], now = new Date()): Promise<R[]> {
  const list = await schedulesFor(shop).catch(() => []);
  if (!list.length) return rows;
  const timeZone = await shopTimeZone(admin, shop).catch(() => "UTC");
  const typeOf = (t: string): ScheduleType | null => (t === "upsell" || t === "cross_sell" ? "rule" : t === "bundle" ? "bundle" : ["fixed", "bogo", "volume", "gift", "upgrade"].includes(t) ? "deal" : null);
  return rows.map((r) => {
    const type = typeOf(r.type);
    const handle = r.href.split("/").pop();
    const s = type && list.find((x) => x.type === type && x.handle === handle);
    const label = s ? scheduleLabel(s, timeZone, now) : null;
    return label ? { ...r, where: `${r.where} · ${label}` } : r;
  });
}

/** shop/redact: the store's offer schedules. */
export async function removeShopSchedules(shop: string) {
  await db.offerSchedule.deleteMany({ where: { shop } });
}
