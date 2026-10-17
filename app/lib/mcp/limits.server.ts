/**
 * Audit log and rate limits (docs/plans/mcp-server.md §6). Limits are counted from the audit rows
 * themselves, so they hold across restarts: 60 calls a minute and 600 a day per shop; build calls
 * 20 a minute and 200 a day per connection. Refused calls are logged too, but do not count.
 */
import db from "../../db.server";

export const LIMITS = { perMinute: 60, buildPerMinute: 20, buildPerDay: 200, shopPerDay: 600 };

export async function checkRate(shop: string, grantId: string, build: boolean): Promise<string | null> {
  const minute = new Date(Date.now() - 60_000), day = new Date(Date.now() - 86_400_000);
  const counted = { result: { not: "limited" } };
  const [perMinute, shopDay] = await Promise.all([
    db.mcpAudit.count({ where: { grantId, createdAt: { gt: minute }, ...counted } }),
    db.mcpAudit.count({ where: { shop, createdAt: { gt: day }, ...counted } }),
  ]);
  if (perMinute >= LIMITS.perMinute) return "Too many calls this minute. Wait a minute and try again.";
  if (shopDay >= LIMITS.shopPerDay) return "This store reached today's limit for assistant calls. Try again tomorrow.";
  if (build) {
    const [m, d] = await Promise.all([
      db.mcpAudit.count({ where: { grantId, build: true, createdAt: { gt: minute }, ...counted } }),
      db.mcpAudit.count({ where: { grantId, build: true, createdAt: { gt: day }, ...counted } }),
    ]);
    if (m >= LIMITS.buildPerMinute) return "Too many changes this minute. Wait a minute and try again.";
    if (d >= LIMITS.buildPerDay) return "This connection reached today's limit for changes. Try again tomorrow.";
  }
  return null;
}

/** result: "ok", "rule" (a plan or input rule said no), "error", "denied" (scope) or "limited". */
export async function audit(shop: string, grantId: string, tool: string, summary: string, result: string, build: boolean) {
  await db.mcpAudit.create({ data: { shop, grantId, tool, summary: summary.slice(0, 200), result, build } }).catch(() => null);
}

export const recentAudit = (shop: string) => db.mcpAudit.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 100 });
