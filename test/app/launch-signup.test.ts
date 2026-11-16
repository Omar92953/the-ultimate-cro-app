/** The website's "Email me at launch" form (app/routes/site.notify.tsx, app/lib/launch-signup.server.ts). Run: npm run test:app */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "signup-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
type R = typeof import("../../app/lib/launch-signup.server");
let R: R;
before(async () => {
  const sql = fs.readFileSync("prisma/migrations/20261116100000_launch_signup/migration.sql", "utf8");
  for (const stmt of sql.split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  R = await import("../../app/lib/launch-signup.server");
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

let ip = 0;
function post(fields: Record<string, string>, origin: string | null = "https://crotoolbox.com") {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", "x-forwarded-for": `10.0.0.${++ip}` };
  if (origin) headers.origin = origin;
  const request = new Request("https://cro-toolbox.onrender.com/site/notify", { method: "POST", headers, body: new URLSearchParams(fields) });
  return R.handleSignup(request);
}

test("a sign up from the site is saved once, lower case, with its page, and the site may read the answer", async () => {
  const res = await post({ email: " Sara@Example.com ", page: "/pricing/", js: "1" });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "https://crotoolbox.com");
  assert.equal((await res.json()).ok, true);
  await post({ email: "sara@example.com", page: "/", js: "1" });
  const rows = await prisma.launchSignup.findMany();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, "sara@example.com");
  assert.equal(rows[0].page, "/pricing/");
});

test("without JavaScript the browser gets a page back", async () => {
  const res = await post({ email: "nojs@example.com", js: "0" }, "https://www.crotoolbox.com");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  assert.match(await res.text(), /on the list/);
});

test("bad emails, other sites and filled honeypots are not saved", async () => {
  assert.equal((await post({ email: "not-an-email", js: "1" })).status, 400);
  assert.equal((await post({ email: "x@evil.example", js: "1" }, "https://evil.example")).status, 403);
  assert.equal((await post({ email: "x@example.com", js: "1" }, null)).status, 403);
  const bot = await post({ email: "bot@example.com", company: "Acme", js: "1" });
  assert.equal((await bot.json()).ok, true, "bots are told it worked");
  assert.equal(await prisma.launchSignup.count({ where: { email: { in: ["bot@example.com", "x@example.com", "x@evil.example"] } } }), 0);
});

test("preview builds are allowed; a lookalike domain is not", async () => {
  assert.equal((await post({ email: "preview@example.com", js: "1" }, "https://abc123.crotoolbox.pages.dev")).status, 200);
  assert.equal((await post({ email: "fake@example.com", js: "1" }, "https://crotoolbox.com.evil.example")).status, 403);
});
