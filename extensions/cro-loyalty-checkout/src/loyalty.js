/*
 * Shared by the blocks: the app's metafields $app:loyalty (app/lib/loyalty/account.ts) on the customer (only when
 * the buyer is signed in) and the shop. Member: { p, pe, t, x (tier multiplier), u: [one, many], b, rw: [{ t, c, e }] }.
 * Shop: { on, u: { one, many }, per (points per 1 of the currency), sh, tx, cb (cashback percent), rw: [{ id, t, p, k }] }.
 */
export function parse(value) {
  try {
    const v = typeof value === 'string' ? JSON.parse(value) : value;
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

export function loyalty() {
  const entries = shopify.appMetafields.value;
  const find = (type) => parse(entries.find((x) => x.target.type === type && x.metafield.namespace === '$app' && x.metafield.key === 'loyalty')?.metafield.value);
  const shop = find('shop');
  const member = find('customer');
  return { shop: shop?.on ? shop : null, member: member && !member.b ? member : null };
}

/** "1 point" / "1,250 points", in the store's own words for points. */
export function pts(n, unit) {
  const [one, many] = Array.isArray(unit) ? unit : [unit?.one, unit?.many];
  return `${shopify.i18n.formatNumber(n)} ${n === 1 ? one || 'point' : many || 'points'}`;
}
