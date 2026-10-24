/*
 * The app's loyalty endpoint for POS (app/routes/api.loyalty.pos.tsx). A relative address goes to the app, and POS
 * adds the session token by itself.
 */
/** @returns {Promise<any>} */
export async function loyaltyOf(customerId) {
  const r = await fetch(`/api/loyalty/pos?customer=${encodeURIComponent(String(customerId))}`);
  return r.json();
}

/** @returns {Promise<any>} */
export async function spend(customerId, rewardId) {
  const r = await fetch('/api/loyalty/pos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: String(customerId), reward: rewardId }) });
  return r.json();
}

/** "1 point" / "1,250 points", in the store's own words for points. */
export function pts(n, unit) {
  return `${Number(n).toLocaleString()} ${n === 1 ? unit?.one || 'point' : unit?.many || 'points'}`;
}
