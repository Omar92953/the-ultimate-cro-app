/** Sales of one offer from the order results' byOffer list (see results.server.ts for the keys). */
export function offerStats(byOffer: { key: string; orders: number; revenue: number }[] | null | undefined, keys: string[]) {
  if (!byOffer) return undefined;
  let revenue = 0;
  let orders = 0;
  let found = false;
  for (const k of keys) {
    const row = byOffer.find((x) => x.key === k);
    if (!row) continue;
    found = true;
    revenue += row.revenue;
    orders = Math.max(orders, row.orders);
  }
  return found ? { revenue: Math.round(revenue * 100) / 100, orders } : undefined;
}
