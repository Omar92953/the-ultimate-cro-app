/**
 * The after-purchase offer's server routes answer the browser's CORS preflight (App Store rejection 5.6.1,
 * 2026-11-11: React Router sends OPTIONS to the loader, which answered 405, so the extension's fetch failed and
 * the offer never showed). Run: npm run test:app
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-cors-test-"));
const prisma = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, "t.db")}` } } });
(globalThis as unknown as { prismaGlobal: PrismaClient }).prismaGlobal = prisma;
Object.assign(process.env, { SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "s", SHOPIFY_APP_URL: "https://app.example", SCOPES: "read_products" });
before(async () => {
  for (const m of fs.readdirSync("prisma/migrations").filter((x) => /^\d/.test(x)).sort()) {
    const sql = fs.readFileSync(`prisma/migrations/${m}/migration.sql`, "utf8");
    for (const stmt of sql.split(";").map((x) => x.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await prisma.$executeRawUnsafe(stmt);
  }
});
after(async () => {
  await prisma.$disconnect();
  fs.rmSync(dir, { recursive: true, force: true });
});

const URL_OF = { offer: "https://app.example/api/post-purchase/offer", sign: "https://app.example/api/post-purchase/sign" };
// The routes (.tsx) are thin: their loader is postOnlyLoader and their action the functions below (checked at the end).
const routes = async () => {
  const { postOnlyLoader } = await import("../../app/lib/cors");
  const api = await import("../../app/lib/post-purchase-api.server");
  return {
    offer: { loader: (r: Request) => postOnlyLoader({ request: r }), action: api.offerAction },
    sign: { loader: (r: Request) => postOnlyLoader({ request: r }), action: api.signAction },
  };
};
const args = (request: Request) => request;
const preflightRequest = (url: string) =>
  new Request(url, { method: "OPTIONS", headers: { Origin: "https://extensions.shopifycdn.com", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
const post = (url: string, body: unknown) => new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function assertCors(res: Response) {
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(res.headers.get("Access-Control-Allow-Methods") ?? "", /POST/);
  assert.match(res.headers.get("Access-Control-Allow-Headers") ?? "", /Content-Type/i);
}

test("the loader answers the OPTIONS preflight with 204 and the CORS headers", async () => {
  const r = await routes();
  for (const name of ["offer", "sign"] as const) {
    const res = await r[name].loader(args(preflightRequest(URL_OF[name])));
    assert.equal(res.status, 204, name);
    assertCors(res);
    assert.equal(res.headers.get("Access-Control-Max-Age"), "86400");
  }
});

test("GET still answers 405, with the CORS headers", async () => {
  const r = await routes();
  for (const name of ["offer", "sign"] as const) {
    const res = await r[name].loader(args(new Request(URL_OF[name])));
    assert.equal(res.status, 405, name);
    assertCors(res);
  }
});

test("a POST with a bad token answers 401 with the CORS headers, so the extension can read it", async () => {
  const r = await routes();
  for (const name of ["offer", "sign"] as const) {
    const res = await r[name].action(args(post(URL_OF[name], { token: "not-a-token" })));
    assert.equal(res.status, 401, name);
    assertCors(res);
  }
  const bad = await r.offer.action(args(new Request(URL_OF.offer, { method: "POST", body: "{" })));
  assert.equal(bad.status, 400);
  assertCors(bad);
});

test("a POST with a valid token passes the check and reaches the offer logic", async () => {
  const token = await new SignJWT({ input_data: { shop: { domain: "reviewer-store.myshopify.com" }, initialPurchase: { referenceId: "ref-1" } } })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(new TextEncoder().encode("s"));
  const r = await routes();
  // No session is stored for this test shop, so the offer logic can't read the store: it answers "nothing to show"
  // (offer route) or "no offer" (sign route), never 401.
  const offer = await r.offer.action(args(post(URL_OF.offer, { token })));
  assert.equal(offer.status, 200);
  assert.deepEqual(await offer.json(), { offer: null });
  assertCors(offer);
  const sign = await r.sign.action(args(post(URL_OF.sign, { token })));
  assert.equal(sign.status, 404);
  assertCors(sign);
});

test("both routes use the preflight loader and the shared actions", () => {
  for (const [file, fn] of [["offer", "offerAction"], ["sign", "signAction"]]) {
    const src = fs.readFileSync(`app/routes/api.post-purchase.${file}.tsx`, "utf8");
    assert.match(src, /export const loader = postOnlyLoader;/);
    assert.match(src, new RegExp(`export const action = \\(\\{ request \\}: ActionFunctionArgs\\) => ${fn}\\(request\\);`));
  }
});
