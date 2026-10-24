/**
 * How long the app keeps shoppers' personal data, and the daily cleanup that enforces it (privacy page:
 * "How long we keep it"; Shopify's protected customer data form: retention periods). Uninstall and
 * customer redaction requests still delete everything at once (webhooks.compliance.tsx).
 *
 * Runs once soon after the server starts and then every 24 hours (Render keeps one long-running server).
 */
import db from "../db.server";
import { RETENTION_DAYS } from "./retention";
import { sweepTracking } from "./tracking/tracking.server";
import { sweepMcp } from "./mcp/auth.server";

const DAY = 864e5;

export async function pruneOldData(now = new Date()) {
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const d = RETENTION_DAYS;
  const results = await Promise.all([
    db.stockAlert.deleteMany({ where: { notifiedAt: { lt: ago(d.stockAlertSent) } } }),
    db.stockAlert.deleteMany({ where: { notifiedAt: null, createdAt: { lt: ago(d.stockAlertWaiting) } } }),
    db.returnRequest.deleteMany({ where: { createdAt: { lt: ago(d.returnRequest) } } }),
    db.reviewerEmail.deleteMany({ where: { createdAt: { lt: ago(d.reviewerEmail) } } }),
    db.trackingCache.deleteMany({ where: { checkedAt: { lt: ago(d.trackingCache) } } }),
    db.trackCode.deleteMany({ where: { endsAt: { lt: ago(d.trackCode) } } }),
  ]);
  return results.reduce((n, r) => n + r.count, 0);
}

/** The daily run: the retention periods, then old tracking usage and expired assistant connections. Each part on its own. */
export async function dailyCleanup(now = new Date()) {
  const n = await pruneOldData(now).catch((e) => (console.error("[retention] cleanup failed:", e), 0));
  await sweepTracking(now).catch((e) => console.error("[retention] tracking sweep failed:", e));
  await sweepMcp().catch((e) => console.error("[retention] assistant sweep failed:", e));
  return n;
}

declare global {
  // eslint-disable-next-line no-var
  var croRetentionTimer: ReturnType<typeof setInterval> | undefined;
}

/** Starts the daily cleanup once per server process (not in tests or local development). */
export function startRetention() {
  if (globalThis.croRetentionTimer || process.env.NODE_ENV !== "production") return;
  const run = () => dailyCleanup().then((n) => n && console.log(`[retention] deleted ${n} old records`));
  setTimeout(run, 60_000);
  globalThis.croRetentionTimer = setInterval(run, DAY);
}
