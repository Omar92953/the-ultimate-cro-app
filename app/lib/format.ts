/** Money and change texts shared by Home, Offers and Analytics. */

/** "$1,240" (no cents from 1,000 up), in the store's currency. */
export const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
};

/** Percent change against the period before; null when there's nothing to compare. */
export const change = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
