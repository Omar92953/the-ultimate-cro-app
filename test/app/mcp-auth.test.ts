/**
 * The MCP connection flow against a throwaway SQLite database (never the dev one): registration, PKCE, the
 * consent code, token exchange, refresh, personal tokens, disconnect, rate limits and cleanup.
 * Run: npm run test:app
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
process.env.SHOPIFY_APP_URL = "https://app.example";
type Auth = typeof import("../../app/lib/mcp/auth.server");
type Limits = typeof import("../../app/lib/mcp/limits.server");
let A: Auth, L: Limits;

before(async () => {
  const sql = fs.readFileSync("prisma/migrations/20261018000000_mcp/migration.sql", "utf8");
  for (const stmt of sql.split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  A = await import("../../app/lib/mcp/auth.server");
  L = await import("../../app/lib/mcp/limits.server");
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

const verifier = () => randomBytes(32).toString("base64url");
const challenge = (v: string) => createHash("sha256").update(v).digest("base64url");

async function connect(shop: string, scope: "read" | "build", publish: boolean) {
  const client = await A.registerClient({ client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] });
  const v = verifier();
  const req = await A.startRequest({ clientId: client.client_id, redirectUri: "https://claude.ai/api/mcp/auth_callback", state: "xyz", challenge: challenge(v), method: "S256" });
  const back = new URL(await A.approveRequest(req.id, shop, scope, publish));
  const form = (extra: Record<string, string>) => new URLSearchParams({ client_id: client.client_id, redirect_uri: "https://claude.ai/api/mcp/auth_callback", ...extra });
  return { client, v, back, code: back.searchParams.get("code")!, form };
}

test("the whole connect flow: register, approve in the admin, exchange, call, refresh, disconnect", async () => {
  const c = await connect("a.myshopify.com", "build", true);
  assert.equal(c.back.searchParams.get("state"), "xyz");
  const t = await A.exchange(c.form({ grant_type: "authorization_code", code: c.code, code_verifier: c.v }));
  assert.equal(t.expiresIn, 3600);
  const grant = await A.grantFor(`Bearer ${t.access}`);
  assert.deepEqual({ shop: grant?.shop, scope: grant?.scope, allowPublish: grant?.allowPublish }, { shop: "a.myshopify.com", scope: "build", allowPublish: true });
  // A code works once.
  await assert.rejects(A.exchange(c.form({ grant_type: "authorization_code", code: c.code, code_verifier: c.v })), /invalid_grant/);
  // Tokens are stored hashed.
  const row = await prisma.mcpGrant.findFirst({ where: { shop: "a.myshopify.com" } });
  assert.ok(row && !row.tokenHash.includes(t.access) && row.tokenHash.length === 64);
  // Refresh keeps the connection and replaces the tokens.
  const r = await A.exchange(new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refreshToken }));
  assert.equal(await A.grantFor(`Bearer ${t.access}`), null);
  assert.equal((await A.grantFor(`Bearer ${r.access}`))?.id, grant?.id);
  // Disconnect stops everything at once.
  await A.revokeGrant("a.myshopify.com", grant!.id);
  assert.equal(await A.grantFor(`Bearer ${r.access}`), null);
  await assert.rejects(A.exchange(new URLSearchParams({ grant_type: "refresh_token", refresh_token: r.refreshToken })), /invalid_grant/);
});

test("PKCE, the registered address and the connection request are checked", async () => {
  const c = await connect("b.myshopify.com", "read", false);
  await assert.rejects(A.exchange(c.form({ grant_type: "authorization_code", code: c.code, code_verifier: verifier() })), /invalid_grant/);
  await assert.rejects(A.exchange(c.form({ grant_type: "authorization_code", code: "nope", code_verifier: c.v })), /invalid_grant/);
  await assert.rejects(A.startRequest({ clientId: c.client.client_id, redirectUri: "https://evil.example/cb", state: "", challenge: challenge(c.v), method: "S256" }), /redirect address/);
  await assert.rejects(A.startRequest({ clientId: c.client.client_id, redirectUri: "https://claude.ai/api/mcp/auth_callback", state: "", challenge: "short", method: "plain" }), /PKCE/);
  await assert.rejects(A.registerClient({ redirect_uris: ["http://evil.example/cb"] }), /redirect_uris/);
  await A.registerClient({ redirect_uris: ["http://localhost:3000/cb"] });
  // Read only connections cannot be given publishing.
  const g = await A.exchange(c.form({ grant_type: "authorization_code", code: c.code, code_verifier: c.v }));
  assert.equal((await A.grantFor(`Bearer ${g.access}`))?.allowPublish, false);
});

test("a denied request goes back with access_denied and cannot be approved", async () => {
  const client = await A.registerClient({ redirect_uris: ["https://claude.ai/cb"] });
  const req = await A.startRequest({ clientId: client.client_id, redirectUri: "https://claude.ai/cb", state: "s", challenge: challenge(verifier()), method: "S256" });
  assert.match((await A.denyRequest(req.id))!, /error=access_denied&state=s/);
  await assert.rejects(A.approveRequest(req.id, "c.myshopify.com", "read", false), /expired/);
});

test("personal tokens work for one shop and are listed without secrets", async () => {
  const p = await A.createPersonalToken("d.myshopify.com", "My laptop", "build", true);
  const g = await A.grantFor(`Bearer ${p.token}`);
  assert.deepEqual({ shop: g?.shop, kind: g?.kind, name: g?.name, allowPublish: g?.allowPublish }, { shop: "d.myshopify.com", kind: "token", name: "My laptop", allowPublish: true });
  assert.equal(await A.grantFor("Bearer wrong"), null);
  assert.equal(await A.grantFor(null), null);
  const list = await A.listGrants("d.myshopify.com");
  assert.equal(list.length, 1);
  assert.ok(!("tokenHash" in list[0]));
  assert.equal((await A.listGrants("a.myshopify.com")).length, 0);
});

test("rate limits count real calls only, and the audit log is per shop", async () => {
  const shop = "e.myshopify.com";
  assert.equal(await L.checkRate(shop, "g1", false), null);
  for (let i = 0; i < L.LIMITS.buildPerMinute; i++) await L.audit(shop, "g1", "set_design", "faq", "ok", true);
  assert.match((await L.checkRate(shop, "g1", true))!, /Too many changes/);
  assert.equal(await L.checkRate(shop, "g1", false), null);
  assert.equal(await L.checkRate(shop, "g2", true), null);
  for (let i = 0; i < 5; i++) await L.audit(shop, "g1", "set_design", "faq", "limited", true);
  assert.equal((await L.recentAudit(shop)).length, L.LIMITS.buildPerMinute + 5);
  for (let i = 0; i < L.LIMITS.perMinute; i++) await L.audit(shop, "g3", "get_design", "", "ok", false);
  assert.match((await L.checkRate(shop, "g3", false))!, /Too many calls/);
});

test("uninstall removes every grant, request and audit row of the shop", async () => {
  await A.createPersonalToken("f.myshopify.com", "x", "read", false);
  await L.audit("f.myshopify.com", "g", "get_overview", "", "ok", false);
  await A.removeShopMcp("f.myshopify.com");
  assert.equal((await A.listGrants("f.myshopify.com")).length, 0);
  assert.equal((await L.recentAudit("f.myshopify.com")).length, 0);
  assert.equal((await A.listGrants("d.myshopify.com")).length, 1);
});

test("the MCP protocol: initialize, scoped tools, refusals that say why", async () => {
  Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SCOPES: "read_products" });
  const S = await import("../../app/lib/mcp/server.server");
  S.registerTools(
    { name: "t_build", description: "x", needs: "build", schema: {}, run: async () => "built" },
    { name: "t_publish", description: "x", needs: "publish", schema: {}, run: async () => "published" },
  );
  type Grant = import("../../app/lib/mcp/auth.server").Grant;
  const read: Grant = { id: "r1", shop: "p.myshopify.com", kind: "token", name: "r", scope: "read", allowPublish: false };
  const build: Grant = { ...read, id: "b1", scope: "build" };
  const pub: Grant = { ...build, id: "p1", allowPublish: true };
  type Answer = { result: { protocolVersion?: string; tools?: { name: string }[]; isError?: boolean; content: { text: string }[] }; error: { code: number } } | null;
  const rpc = (g: Grant, method: string, params?: Record<string, unknown>, id = 1) => S.handleRpc(g, { jsonrpc: "2.0", id, method, params }) as Promise<Answer>;
  const names = async (g: Grant) => (await rpc(g, "tools/list"))!.result.tools!.map((t) => t.name);

  assert.equal((await rpc(read, "initialize", { protocolVersion: "2025-03-26" }))!.result.protocolVersion, "2025-03-26");
  assert.equal((await rpc(read, "initialize", { protocolVersion: "1999-01-01" }))!.result.protocolVersion, "2025-06-18");
  assert.deepEqual(await rpc(read, "ping"), { jsonrpc: "2.0", id: 1, result: {} });
  assert.equal(await S.handleRpc(read, { jsonrpc: "2.0", method: "notifications/initialized" }), null);
  assert.equal((await rpc(read, "nope"))!.error.code, -32601);

  assert.ok((await names(read)).includes("get_design") && !(await names(read)).includes("t_build"));
  assert.ok((await names(build)).includes("t_build") && !(await names(build)).includes("t_publish"));
  assert.ok((await names(pub)).includes("t_publish"));

  const denied = (await rpc(read, "tools/call", { name: "t_build", arguments: {} }))!.result;
  assert.equal(denied.isError, true);
  assert.match(denied.content[0].text, /read only/);
  const noPublish = (await rpc(build, "tools/call", { name: "t_publish", arguments: {} }))!.result;
  assert.match(noPublish.content[0].text, /Allow publishing/);
  assert.match((await rpc(read, "tools/call", { name: "missing", arguments: {} }))!.result.content[0].text, /Unknown tool/);
  const log = await L.recentAudit("p.myshopify.com");
  assert.deepEqual(log.filter((x) => x.result === "denied").map((x) => x.tool).sort(), ["t_build", "t_publish"]);
  assert.ok(Array.isArray(await S.handleBody(read, [{ jsonrpc: "2.0", id: 1, method: "ping" }, { jsonrpc: "2.0", id: 2, method: "ping" }])));
});

test("the connection code pairs the authorize page with the signed in admin, with no store typed", async () => {
  const client = await A.registerClient({ client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] });
  const req = await A.startRequest({ clientId: client.client_id, redirectUri: "https://claude.ai/api/mcp/auth_callback", state: "s", challenge: challenge(verifier()), method: "S256" });
  const code = A.pairingCode(req.id);
  assert.match(code, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  assert.equal((await A.requestByPairingCode(code.toLowerCase().replace("-", " ")))?.id, req.id, "typing style does not matter");
  assert.equal(await A.requestByPairingCode("AAAAA-AAAAA"), null);
  assert.equal(await A.requestByPairingCode("short"), null);
  // Once the merchant allowed it, or when it expired, the code no longer finds the request.
  await A.approveRequest(req.id, "p.myshopify.com", "read", false);
  assert.equal(await A.requestByPairingCode(code), null);
  const old = await A.startRequest({ clientId: client.client_id, redirectUri: "https://claude.ai/api/mcp/auth_callback", state: "", challenge: challenge(verifier()), method: "S256" });
  await prisma.mcpRequest.update({ where: { id: old.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal(await A.requestByPairingCode(A.pairingCode(old.id)), null);
});

test("a code and a refresh token work once even when two requests arrive together (audit 2026-10-23)", async () => {
  const c = await connect("race.myshopify.com", "read", false);
  const both = await Promise.allSettled([1, 2].map(() => A.exchange(c.form({ grant_type: "authorization_code", code: c.code, code_verifier: c.v }))));
  assert.equal(both.filter((x) => x.status === "fulfilled").length, 1, "one grant from one code");
  const t = (both.find((x) => x.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<Auth["exchange"]>>>).value;
  const again = await Promise.allSettled([1, 2].map(() => A.exchange(new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refreshToken }))));
  assert.equal(again.filter((x) => x.status === "fulfilled").length, 1, "one new token from one refresh token");
  assert.equal(await prisma.mcpGrant.count({ where: { shop: "race.myshopify.com" } }), 1);
});

test("client registration is limited per visitor (audit 2026-10-23)", async () => {
  const body = { client_name: "Spam", redirect_uris: ["https://spam.example/cb"] };
  for (let i = 0; i < 10; i++) await A.registerClient(body, "203.0.113.9");
  await assert.rejects(A.registerClient(body, "203.0.113.9"), /Too many registrations/);
  assert.ok((await A.registerClient(body, "198.51.100.7")).client_id, "another visitor still can");
});
