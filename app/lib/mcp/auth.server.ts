/**
 * Who may talk to the MCP server, and for which shop (docs/plans/mcp-server.md §2).
 *   - OAuth 2.1 with PKCE and dynamic client registration, for claude.ai and Claude Desktop connectors.
 *   - A personal access token the merchant makes in Settings, for developer clients.
 * Tokens, refresh tokens and codes are random, shown once and stored only as SHA-256 hashes.
 * Every grant belongs to one shop; tools never take a shop argument.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import db from "../../db.server";

export type McpScope = "read" | "build";
export type Grant = { id: string; shop: string; kind: "oauth" | "token"; name: string; scope: McpScope; allowPublish: boolean };

const ACCESS_MS = 60 * 60 * 1000;
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_MS = 365 * 24 * 60 * 60 * 1000;
const REQUEST_MS = 10 * 60 * 1000;

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const random = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const appUrl = () => (process.env.SHOPIFY_APP_URL ?? "").replace(/\/$/, "");

/* ---------------------------------------------------------- registration -- */
const validRedirect = (u: string) => {
  try {
    const url = new URL(u);
    // https for hosted assistants, http only for a program on the same computer (Claude Desktop, developer tools).
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  } catch {
    return false;
  }
};

export async function registerClient(body: { client_name?: unknown; redirect_uris?: unknown }) {
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (!uris.length || uris.length > 10 || !uris.every(validRedirect)) throw new Error("redirect_uris must be https (or http on localhost) addresses.");
  const name = typeof body.client_name === "string" && body.client_name.trim() ? body.client_name.trim().slice(0, 80) : "AI assistant";
  const id = `mcpc_${random(12)}`;
  await db.mcpClient.create({ data: { id, name, redirectUris: JSON.stringify(uris) } });
  return { client_id: id, client_name: name, redirect_uris: uris, token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] };
}

/** A started connect: checked against the client's registered addresses, kept 10 minutes. */
export async function startRequest(p: { clientId: string; redirectUri: string; state: string; challenge: string; method: string }) {
  const client = await db.mcpClient.findUnique({ where: { id: p.clientId } });
  if (!client) throw new Error("Unknown application.");
  if (!(JSON.parse(client.redirectUris) as string[]).includes(p.redirectUri)) throw new Error("The redirect address is not the one this application registered.");
  if (p.method !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(p.challenge)) throw new Error("PKCE with S256 is required.");
  const id = random(18);
  await db.mcpRequest.create({ data: { id, clientId: client.id, redirectUri: p.redirectUri, state: p.state.slice(0, 500), challenge: p.challenge, expiresAt: new Date(Date.now() + REQUEST_MS) } });
  return { id, clientName: client.name };
}

/**
 * A short code that pairs the page the assistant opened (/mcp/authorize, which does not know the store) with the merchant's own admin
 * (Settings → Connect an AI assistant, where the store is known from the signed in session). It is derived from the request id with
 * the app secret, so nothing more is stored; 50 bits, and the admin page limits the tries.
 */
const PAIR_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function pairingCode(requestId: string) {
  const h = createHmac("sha256", process.env.SHOPIFY_API_SECRET ?? "").update(`mcp-pair:${requestId}`).digest();
  let out = "";
  for (let i = 0; i < 10; i++) out += PAIR_ALPHABET[h[i] % PAIR_ALPHABET.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}
const normalizeCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** The waiting request (not yet allowed, not expired) that a code from the authorize page belongs to, or null. */
export async function requestByPairingCode(input: string) {
  const want = normalizeCode(input);
  if (want.length !== 10) return null;
  const waiting = await db.mcpRequest.findMany({ where: { codeHash: "", expiresAt: { gt: new Date() } }, take: 500 });
  const hit = waiting.find((r) => normalizeCode(pairingCode(r.id)) === want);
  return hit ? { id: hit.id } : null;
}

export async function getRequest(id: string) {
  const r = await db.mcpRequest.findUnique({ where: { id } });
  if (!r || r.expiresAt < new Date() || r.codeHash) return null;
  const client = await db.mcpClient.findUnique({ where: { id: r.clientId } });
  return { ...r, clientName: client?.name ?? "AI assistant" };
}

/** The merchant said yes (in the admin): the code to send the assistant back with. */
export async function approveRequest(id: string, shop: string, scope: McpScope, allowPublish: boolean) {
  const r = await getRequest(id);
  if (!r) throw new Error("This connection request expired. Start it again from your assistant.");
  const code = random(24);
  await db.mcpRequest.update({ where: { id }, data: { shop, scope, allowPublish: scope === "build" && allowPublish, codeHash: sha(code), expiresAt: new Date(Date.now() + REQUEST_MS) } });
  const to = new URL(r.redirectUri);
  to.searchParams.set("code", code);
  if (r.state) to.searchParams.set("state", r.state);
  return to.toString();
}

export async function denyRequest(id: string) {
  const r = await getRequest(id);
  if (!r) return null;
  await db.mcpRequest.delete({ where: { id } }).catch(() => null);
  const to = new URL(r.redirectUri);
  to.searchParams.set("error", "access_denied");
  if (r.state) to.searchParams.set("state", r.state);
  return to.toString();
}

/* ---------------------------------------------------------------- tokens -- */
async function issue(grantFields: { shop: string; kind: "oauth" | "token"; name: string; scope: McpScope; allowPublish: boolean }, expiresMs: number | null, refresh: boolean, reuseId?: string) {
  const access = `mcp_${random()}`;
  const refreshToken = refresh ? `mcr_${random()}` : "";
  const data = {
    ...grantFields,
    tokenHash: sha(access),
    refreshHash: refresh ? sha(refreshToken) : "",
    expiresAt: expiresMs ? new Date(Date.now() + expiresMs) : null,
    refreshExpires: refresh ? new Date(Date.now() + REFRESH_MS) : null,
  };
  const id = reuseId ?? `g_${random(10)}`;
  if (reuseId) await db.mcpGrant.update({ where: { id }, data });
  else await db.mcpGrant.create({ data: { id, ...data } });
  return { id, access, refreshToken, expiresIn: expiresMs ? Math.floor(expiresMs / 1000) : null };
}

const pkceOk = (verifier: string, challenge: string) => /^[A-Za-z0-9._~-]{43,128}$/.test(verifier) && createHash("sha256").update(verifier).digest("base64url") === challenge;

/** The token endpoint: authorization_code (with PKCE) or refresh_token. */
export async function exchange(form: URLSearchParams) {
  const type = form.get("grant_type");
  if (type === "authorization_code") {
    const code = form.get("code") ?? "";
    const r = code ? await db.mcpRequest.findFirst({ where: { codeHash: sha(code) } }) : null;
    if (!r || r.expiresAt < new Date() || r.clientId !== form.get("client_id") || r.redirectUri !== form.get("redirect_uri") || !pkceOk(form.get("code_verifier") ?? "", r.challenge)) throw new Error("invalid_grant");
    await db.mcpRequest.delete({ where: { id: r.id } }); // a code works once
    const client = await db.mcpClient.findUnique({ where: { id: r.clientId } });
    return issue({ shop: r.shop, kind: "oauth", name: client?.name ?? "AI assistant", scope: r.scope === "build" ? "build" : "read", allowPublish: r.allowPublish }, ACCESS_MS, true);
  }
  if (type === "refresh_token") {
    const g = await db.mcpGrant.findFirst({ where: { refreshHash: sha(form.get("refresh_token") ?? ""), kind: "oauth", revokedAt: null } });
    if (!g || !g.refreshExpires || g.refreshExpires < new Date()) throw new Error("invalid_grant");
    return issue({ shop: g.shop, kind: "oauth", name: g.name, scope: g.scope === "build" ? "build" : "read", allowPublish: g.allowPublish }, ACCESS_MS, true, g.id);
  }
  throw new Error("unsupported_grant_type");
}

/** A personal access token (for developer clients): shown once. */
export async function createPersonalToken(shop: string, name: string, scope: McpScope, allowPublish: boolean) {
  const t = await issue({ shop, kind: "token", name: name.trim().slice(0, 60) || "Personal token", scope, allowPublish: scope === "build" && allowPublish }, TOKEN_MS, false);
  return { id: t.id, token: t.access };
}

/** The grant behind a bearer token, or null (unknown, expired or disconnected). */
export async function grantFor(authorization: string | null): Promise<Grant | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(authorization ?? "");
  if (!m) return null;
  const g = await db.mcpGrant.findUnique({ where: { tokenHash: sha(m[1]) } });
  if (!g || g.revokedAt || (g.expiresAt && g.expiresAt < new Date())) return null;
  // lastUsedAt is only for the Settings list: a failure to write it must not stop the call.
  db.mcpGrant.update({ where: { id: g.id }, data: { lastUsedAt: new Date() } }).catch(() => null);
  return { id: g.id, shop: g.shop, kind: g.kind === "token" ? "token" : "oauth", name: g.name, scope: g.scope === "build" ? "build" : "read", allowPublish: g.allowPublish };
}

/* -------------------------------------------------------------- settings -- */
export function listGrants(shop: string) {
  return db.mcpGrant.findMany({ where: { shop, revokedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, kind: true, name: true, scope: true, allowPublish: true, createdAt: true, lastUsedAt: true } });
}
export async function revokeGrant(shop: string, id: string) {
  await db.mcpGrant.updateMany({ where: { id, shop }, data: { revokedAt: new Date() } });
}
/** Uninstall and shop redact: every grant, request and audit row of the shop. */
export async function removeShopMcp(shop: string) {
  await db.mcpGrant.deleteMany({ where: { shop } });
  await db.mcpRequest.deleteMany({ where: { shop } });
  await db.mcpAudit.deleteMany({ where: { shop } });
}
/** Expired requests, old audit rows (90 days) and dead grants: swept now and then. */
export async function sweepMcp() {
  const now = new Date();
  await db.mcpRequest.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.mcpAudit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86_400_000) } } });
  await db.mcpGrant.deleteMany({ where: { OR: [{ revokedAt: { lt: new Date(Date.now() - 30 * 86_400_000) } }, { kind: "oauth", refreshExpires: { lt: now } }] } });
}
