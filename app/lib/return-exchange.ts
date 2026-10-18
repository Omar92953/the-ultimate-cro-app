/** Exchange details shared by the app, the proxy and the tests (no Shopify calls). */

export type ExchangeLine = { key: string; fli: string; qty: number; title: string; from: string; to: string; variantId: string; oldPrice: number; newPrice: number };
export type ExchangePlan = { lines: ExchangeLine[]; diff: number };

/** What the shopper pays (positive) or gets back (negative) for the change, to the cent. */
export const priceDifference = (lines: Pick<ExchangeLine, "qty" | "oldPrice" | "newPrice">[]) => Math.round(lines.reduce((n, l) => n + (l.newPrice - l.oldPrice) * l.qty, 0) * 100) / 100;

export function parseExchange(raw: string): ExchangePlan | null {
  try {
    const v = JSON.parse(raw) as Partial<ExchangePlan>;
    return v && Array.isArray(v.lines) && v.lines.length ? { lines: v.lines as ExchangeLine[], diff: Number(v.diff) || 0 } : null;
  } catch {
    return null;
  }
}
