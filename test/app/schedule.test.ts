/** Scheduled offers (lib/schedule.ts, schedule.server.ts): store time zones, the checks, and the job. Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { dueAction, onNow, scheduleLabel, scheduleProblem, toInstant, toLocal } from "../../app/lib/schedule";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "schedule-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products", CRO_PLAN_OVERRIDE: "pro" });
let S: typeof import("../../app/lib/schedule.server");
before(async () => {
  const sql = fs.readFileSync("prisma/migrations/20261107000000_offer_schedule/migration.sql", "utf8");
  for (const stmt of sql.split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  S = await import("../../app/lib/schedule.server");
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a store's local time becomes the right moment, in summer, in winter and across a clock change", () => {
  assert.equal(toInstant({ date: "2026-07-03", time: "09:00" }, "Africa/Cairo")?.toISOString(), "2026-07-03T06:00:00.000Z");
  assert.equal(toInstant({ date: "2026-12-03", time: "09:00" }, "Africa/Cairo")?.toISOString(), "2026-12-03T07:00:00.000Z");
  assert.equal(toInstant({ date: "2026-11-01", time: "12:00" }, "America/New_York")?.toISOString(), "2026-11-01T17:00:00.000Z");
  assert.equal(toInstant({ date: "2026-10-31", time: "12:00" }, "America/New_York")?.toISOString(), "2026-10-31T16:00:00.000Z");
  assert.deepEqual(toLocal(new Date("2026-07-03T06:00:00Z"), "Africa/Cairo"), { date: "2026-07-03", time: "09:00" });
  assert.equal(toInstant({ date: "2026-13-40", time: "09:00" }, "UTC"), null);
  assert.equal(toInstant({ date: "2026-04-31", time: "09:00" }, "UTC"), null);
  assert.equal(toInstant({ date: "2026-07-03", time: "25:00" }, "UTC"), null);
});

test("the checks, on now, what the job does and the list label", () => {
  const now = new Date("2026-10-30T10:00:00Z");
  const later = new Date("2026-10-31T10:00:00Z");
  const earlier = new Date("2026-10-29T10:00:00Z");
  assert.match(scheduleProblem({ startsAt: null, endsAt: earlier }, now)!, /past/);
  assert.match(scheduleProblem({ startsAt: later, endsAt: new Date("2026-10-31T09:00:00Z") }, now)!, /after the start/);
  assert.equal(scheduleProblem({ startsAt: now, endsAt: later }, now), null);
  assert.match(scheduleProblem({ startsAt: earlier, endsAt: later }, now)!, /start is in the past/);
  assert.equal(scheduleProblem({ startsAt: earlier, endsAt: later }, now, earlier), null, "a running offer keeps its start");
  assert.equal(onNow({ startsAt: later, endsAt: null }, now), false);
  assert.equal(onNow({ startsAt: earlier, endsAt: later }, now), true);
  assert.equal(dueAction({ startsAt: earlier, endsAt: later, startDone: false, endDone: false }, now), "on");
  assert.equal(dueAction({ startsAt: earlier, endsAt: later, startDone: true, endDone: false }, now), null);
  assert.equal(dueAction({ startsAt: earlier, endsAt: earlier, startDone: false, endDone: false }, now), "off");
  assert.equal(scheduleLabel({ startsAt: later, endsAt: null }, "Africa/Cairo", now), "Starts Sat 31 Oct, 12:00");
  assert.equal(scheduleLabel({ startsAt: earlier, endsAt: later }, "UTC", now), "Ends Sat 31 Oct, 10:00");
  assert.equal(scheduleLabel({ startsAt: earlier, endsAt: null }, "UTC", now), null);
});

test("the job switches an offer on at its start and off at its end, once each, and lets a deleted offer go", async () => {
  const deals = [{ id: "gid://shopify/Metaobject/1", handle: "deal-weekend", kind: "volume", name: "Weekend", active: false, position: 1, config: {} }];
  const saved: { handle: string; active: boolean }[] = [];
  const admin = {
    graphql: async (q: string, o?: { variables?: Record<string, unknown> }) => {
      const data = (d: unknown) => ({ json: async () => ({ data: d }) });
      if (q.includes("CroDeals")) return data({ metaobjects: { nodes: deals.map((d) => ({ id: d.id, handle: d.handle, fields: [{ key: "config", value: JSON.stringify(d) }] })) } });
      if (q.includes("ianaTimezone")) return data({ shop: { ianaTimezone: "UTC" } });
      void o;
      return data({});
    },
  };
  const shop = "s.myshopify.com";
  const start = new Date("2026-10-30T09:00:00Z");
  const end = new Date("2026-10-30T18:00:00Z");
  await S.saveSchedule(shop, "deal", "deal-weekend", { startsAt: start, endsAt: end }, new Date("2026-10-30T08:00:00Z"));
  await S.saveSchedule(shop, "rule", "gone", { startsAt: start, endsAt: null }, new Date("2026-10-30T08:00:00Z"));
  // A fake setActive through the real job: record what would be saved.
  const switched: string[] = [];
  const n = await S.runSchedules(async () => admin as never, new Date("2026-10-30T09:05:00Z"), async (type, handle, on) => {
    switched.push(`${type}:${handle}:${on ? "on" : "off"}`);
    saved.push({ handle, active: on });
    return handle !== "gone";
  });
  assert.equal(n, 1);
  assert.deepEqual(switched.sort(), ["deal:deal-weekend:on", "rule:gone:on"]);
  assert.equal(await prisma.offerSchedule.count({ where: { handle: "gone" } }), 0, "a deleted offer's schedule is let go");
  // Nothing more until the end, then off once.
  assert.equal(await S.runSchedules(async () => admin as never, new Date("2026-10-30T12:00:00Z"), async () => true), 0);
  const offs: string[] = [];
  assert.equal(await S.runSchedules(async () => admin as never, new Date("2026-10-30T18:01:00Z"), async (t, h, on) => (offs.push(`${h}:${on}`), true)), 1);
  assert.deepEqual(offs, ["deal-weekend:false"]);
  assert.equal(await S.runSchedules(async () => admin as never, new Date("2026-10-30T19:00:00Z"), async () => true), 0);
  // Removing both times removes the schedule.
  await S.saveSchedule(shop, "deal", "deal-weekend", { startsAt: null, endsAt: null });
  assert.equal(await prisma.offerSchedule.count({ where: { shop } }), 0);
});
