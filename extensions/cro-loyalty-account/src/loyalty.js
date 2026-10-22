/*
 * Shared by the blocks: reads the app's metafields $app:loyalty (written by app/lib/loyalty/account.server.ts).
 * Member: { p: points, pe: pending, t: tier, r: referral code, l: referral link, u: [one, many], b: blocked,
 *           rw: [{ t: title, c: code, e: "YYYY-MM-DD" | null }], o: { orderId: { p: points, pe: pending } } }
 * Shop:   { on, u: { one, many }, per, ... }
 */
export function parse(value) {
  try {
    const v = typeof value === 'string' ? JSON.parse(value) : value;
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

/** "1 point" / "1,250 points", in the store's own words for points. */
export function pts(n, unit) {
  const [one, many] = Array.isArray(unit) ? unit : [unit?.one, unit?.many];
  return `${shopify.i18n.formatNumber(n)} ${n === 1 ? one || 'point' : many || 'points'}`;
}
