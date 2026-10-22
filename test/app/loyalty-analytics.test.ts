/** Loyalty part 10: analytics maths, members CSV export, and the points import with its preview. Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import type { AdminClient } from "../../app/lib/admin.server";
import { DEFAULT_LOYALTY, type LoyaltyConfig } from "../../app/lib/loyalty/config";

// The database is set before anything that imports it.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loyalty-analytics-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
type A = typeof import("../../app/lib/loyalty/analytics.server");
type C = typeof import("../../app/lib/loyalty/csv.server");
type P = typeof import("../../app/lib/loyalty/program.server");
let A: A, C: C, P: P;
before(async () => {
  for (const m of fs.readdirSync("prisma/migrations").filter((x) => x.includes("loyalty")).sort()) {
    const sql = fs.readFileSync(`prisma/migrations/${m}/migration.sql`, "utf8");
    for (const stmt of sql.split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  }
  [A, C, P] = await Promise.all([import("../../app/lib/loyalty/analytics.server"), import("../../app/lib/loyalty/csv.server"), import("../../app/lib/loyalty/program.server")]);
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

const NOW = new Date("2026-10-23T12:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000);
const cfg: LoyaltyConfig = { ...DEFAULT_LOYALTY, tiers: { ...DEFAULT_LOYALTY.tiers, list: [{ id: "gold", name: "Gold", min: 100, multiplier: 1, bonus: 0 }] } };

test("summarize: members, points, rewards with their orders, referrals and repeat rates for 30 and 90 days", () => {
  const input = {
    members: [{ customerId: "1", joinedAt: ago(100) }, { customerId: "2", joinedAt: ago(40) }, { customerId: "3", joinedAt: ago(3) }],
    events: [
      { kind: "order", points: 50, createdAt: ago(5) },
      { kind: "signup", points: 10, createdAt: ago(50) },
      { kind: "redeem", points: -30, createdAt: ago(4) },
      { kind: "expire", points: -7, createdAt: ago(2) },
      { kind: "refund", points: -5, createdAt: ago(2) },
      { kind: "import", points: 200, createdAt: ago(1) },
      { kind: "adjust", points: -20, createdAt: ago(1) },
    ],
    rewards: [
      { title: "$5 off", kind: "amount", value: 5, createdAt: ago(4) },
      { title: "10% off", kind: "percent", value: 10, createdAt: ago(60) },
      { title: "$5 off", kind: "amount", value: 5, createdAt: ago(10) },
    ],
    codes: ["LOY-ABC", "loy-old"],
    referrals: [
      { kind: "referral", status: "rewarded", amount: 80, createdAt: ago(6) },
      { kind: "referral", status: "refused", amount: 99, createdAt: ago(6) },
      { kind: "affiliate", status: "counted", amount: 40, createdAt: ago(70) },
    ],
    orders: [
      { createdAt: ago(2).toISOString(), total: 60, customerId: "1", codes: ["loy-abc"] },
      { createdAt: ago(9).toISOString(), total: 30, customerId: "1", codes: [] },
      { createdAt: ago(20).toISOString(), total: 25, customerId: "2", codes: ["LOY-OLD"] },
      { createdAt: ago(1).toISOString(), total: 10, customerId: "9", codes: ["OTHER"] },
      { createdAt: ago(80).toISOString(), total: 10, customerId: "9", codes: [] },
      { createdAt: ago(5).toISOString(), total: 15, customerId: null, codes: [] },
    ],
  };
  const s30 = A.summarize(input, 30, NOW);
  assert.equal(s30.members.total, 3);
  assert.equal(s30.members.joined, 1);
  assert.equal(s30.members.growth.length, 5);
  assert.equal(s30.members.growth.at(-1)?.total, 3);
  assert.equal(s30.members.growth.reduce((n, g) => n + g.joined, 0), 1);
  assert.deepEqual(s30.points, { earned: 50, spent: 30, expired: 7, takenBack: 5, byStore: 180 });
  assert.equal(s30.rewards.redeemed, 2);
  assert.equal(s30.rewards.value, 10);
  assert.deepEqual(s30.rewards.top, [{ title: "$5 off", count: 2 }]);
  // A code made before the period still counts when it is used in it; case doesn't matter.
  assert.equal(s30.rewards.orders, 2);
  assert.equal(s30.rewards.revenue, 85);
  assert.deepEqual(s30.referrals, { orders: 1, sales: 80, affiliateOrders: 0, affiliateSales: 0 });
  // Member 1 ordered twice, member 2 once: 50%. The other customer ordered once in 30 days: 0%.
  assert.deepEqual(s30.repeat, { members: 50, others: 0, memberCustomers: 2, otherCustomers: 1 });

  const s90 = A.summarize(input, 90, NOW);
  assert.equal(s90.members.growth.length, 13);
  assert.equal(s90.points.earned, 60);
  assert.equal(s90.rewards.value, 10, "a percent reward is not money");
  assert.equal(s90.referrals.affiliateSales, 40);
  assert.equal(s90.repeat.others, 100);

  const empty = A.summarize({ members: [], events: [], rewards: [], codes: [], referrals: [], orders: [] }, 30, NOW);
  assert.equal(empty.repeat.members, null);
  assert.equal(empty.members.growth.every((g) => g.total === 0), true);
});

test("loyaltyAnalytics reads the orders once and still answers when they can't be read", async () => {
  let calls = 0;
  const ok = { graphql: async () => (calls++, { json: async () => ({ data: { orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [{ createdAt: ago(1).toISOString(), cancelledAt: null, discountCodes: [], totalPriceSet: { shopMoney: { amount: "20.00" } }, customer: { id: "gid://shopify/Customer/5" } }, { createdAt: ago(1).toISOString(), cancelledAt: ago(1).toISOString(), discountCodes: [], totalPriceSet: { shopMoney: { amount: "99.00" } }, customer: null }] } } }) }) } as unknown as AdminClient;
  const r = await A.loyaltyAnalytics(ok, "an-a.myshopify.com", NOW);
  assert.equal(calls, 1);
  assert.equal(r.ordersError, null);
  assert.equal(r.periods[30].repeat.otherCustomers, 1, "the cancelled order is left out");
  const broken = { graphql: async () => { throw new Error("Access denied for orders"); } } as unknown as AdminClient;
  const r2 = await A.loyaltyAnalytics(broken, "an-b.myshopify.com", NOW);
  assert.match(r2.ordersError ?? "", /Access denied/);
  assert.equal(r2.periods[90].members.total, 0);
});

test("CSV cells are quoted and can't run as spreadsheet formulas; the parser reads quotes, commas and semicolons", () => {
  assert.equal(C.cell('say "hi"'), '"say ""hi"""');
  assert.equal(C.cell("=HYPERLINK(1)"), `"'=HYPERLINK(1)"`);
  assert.equal(C.cell("-5"), `"'-5"`);
  assert.deepEqual(C.parseCsv('﻿email,points\r\n"a, b@x.com",5\n\n"q""t@x.com","1,200"\n'), [["email", "points"], ["a, b@x.com", "5"], ['q"t@x.com', "1,200"]]);
  assert.deepEqual(C.parseCsv("Email;Balance\nx@y.com;7"), [["Email", "Balance"], ["x@y.com", "7"]]);
});

test("readImport: needs email and points columns, skips bad lines with a reason, keeps the first of a repeated email, stops at 5,000 rows", () => {
  const r = C.readImport("Points Balance,Name,E-mail\n10,A,x@y.com");
  assert.match(r.error ?? "", /email column/);
  const ok = C.readImport("name,EMAIL,points\nA,Sara@Example.com,120\nB,not-an-email,5\nC,c@x.com,1.5\nD,sara@example.com,9\nE,d@x.com,\"1,000\"");
  assert.equal(ok.error, null);
  assert.deepEqual(ok.rows, [{ line: 2, email: "sara@example.com", points: 120 }, { line: 6, email: "d@x.com", points: 1000 }]);
  assert.deepEqual(ok.problems.map((p) => p.line), [3, 4, 5]);
  assert.match(ok.problems[2].reason, /line 2/);
  const big = C.readImport(["email,points", ...Array.from({ length: C.MAX_IMPORT_ROWS + 1 }, (_, i) => `u${i}@x.com,1`)].join("\n"));
  assert.match(big.error ?? "", /5,000 rows/);
  assert.equal(C.readImport("email,points\n").error, "The file has no rows under the first one.");
});

/** A store whose customers are found by email (only those listed). */
const customersAdmin = (list: { id: string; email: string; tags?: string[] }[]) => {
  const queries: string[] = [];
  const admin = {
    graphql: async (_q: string, o: { variables: { q: string } }) => {
      queries.push(o.variables.q);
      const wanted = [...o.variables.q.matchAll(/email:"([^"]+)"/g)].map((m) => m[1]);
      const nodes = list.filter((c) => wanted.includes(c.email)).map((c) => ({ id: `gid://shopify/Customer/${c.id}`, locale: "en", tags: c.tags ?? [], defaultEmailAddress: { emailAddress: c.email.toUpperCase(), marketingState: "SUBSCRIBED" } }));
      return { json: async () => ({ data: { customers: { nodes } } }) };
    },
  } as unknown as AdminClient;
  return { admin, queries };
};

test("import: preview shows what changes, then set and add are applied once as import rows that don't count toward tiers", async () => {
  const shop = "imp.myshopify.com";
  const sara = (await P.memberFor(shop, { id: "1", email: "sara@example.com", firstName: "", locale: "en", tags: [] }, true))!;
  const omar = (await P.memberFor(shop, { id: "2", email: "omar@example.com", firstName: "", locale: "en", tags: [] }, true))!;
  const blocked = (await P.memberFor(shop, { id: "3", email: "b@example.com", firstName: "", locale: "en", tags: [] }, true))!;
  await P.setBlocked(shop, blocked.id, true);
  await P.record(shop, sara.id, { kind: "order", points: 40 });
  const { admin, queries } = customersAdmin([{ id: "10", email: "new@example.com" }, { id: "11", email: "vip@example.com", tags: ["staff"] }]);
  const c: LoyaltyConfig = { ...cfg, excludeTags: "staff" };
  const text = "email,points\nsara@example.com,100\nomar@example.com,0\nb@example.com,50\nnew@example.com,25\nnobody@example.com,5\nvip@example.com,9";

  const read = C.readImport(text);
  const plan = await C.planImport(admin, shop, c, read.rows, "set");
  assert.deepEqual(plan.map((p) => [p.email, p.status, p.current, p.next]), [
    ["sara@example.com", "change", 40, 100],
    ["omar@example.com", "same", 0, 0],
    ["b@example.com", "blocked", 0, 50],
    ["new@example.com", "new", 0, 25],
    ["nobody@example.com", "no_customer", 0, 5],
    ["vip@example.com", "excluded", 0, 9],
  ]);
  assert.equal(queries.length, 1, "unknown emails are looked up together");
  const pv = C.previewOf(plan, read.problems);
  assert.equal(pv.change, 1);
  assert.equal(pv.created, 1);
  assert.equal(pv.delta, 85);

  // Applied twice with the same preview token: once.
  const done = await C.applyImport(admin, shop, c, text, "set", "tok12345");
  assert.deepEqual(done, { changed: 1, created: 1 });
  await C.applyImport(admin, shop, c, text, "set", "tok12345");
  const s = await prisma.loyaltyMember.findUniqueOrThrow({ where: { id: sara.id } });
  assert.equal(s.points, 100);
  assert.equal(s.lifetime, 40, "imported points don't count as earned");
  const made = await prisma.loyaltyMember.findFirstOrThrow({ where: { shop, customerId: "10" } });
  assert.equal(made.points, 25);
  assert.equal(made.email, "new@example.com");
  assert.equal(made.firstName, "", "names are never read");
  assert.equal(await prisma.loyaltyMember.count({ where: { shop, customerId: "11" } }), 0);
  assert.equal((await prisma.loyaltyMember.findUniqueOrThrow({ where: { id: blocked.id } })).points, 0);
  const rows = await prisma.loyaltyEvent.findMany({ where: { shop, kind: "import" } });
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.memberId === sara.id)?.points, 60);

  // Add mode: negative takes away, never below zero.
  await C.applyImport(admin, shop, c, "email,points\nsara@example.com,-150\nomar@example.com,7", "add", "tok99999");
  assert.equal((await prisma.loyaltyMember.findUniqueOrThrow({ where: { id: sara.id } })).points, 0);
  assert.equal((await prisma.loyaltyMember.findUniqueOrThrow({ where: { id: omar.id } })).points, 7);
  await assert.rejects(C.applyImport(admin, shop, c, text, "set", "bad token!"), /Preview the file again/);

  // Export: every member, the tier by name, dates only.
  await prisma.loyaltyMember.update({ where: { id: omar.id }, data: { tier: "gold" } });
  const ex = await C.membersCsv(shop, c);
  assert.equal(ex.count, 4);
  const lines = ex.csv.split("\r\n");
  assert.equal(lines[0], "email,points,pending,tier,referral_code,joined");
  assert.match(lines.find((l) => l.includes("omar@")) ?? "", /^"omar@example.com","7","0","Gold","[A-Z0-9]+","\d{4}-\d{2}-\d{2}"$/);
});
