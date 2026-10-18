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

/**
 * The money line on an exchange's card in Returns. `owed` is what Shopify says the order still owes (known only for an approved
 * exchange the shopper owes for); once it is 0, or the exchange was sent, the line says it was paid instead of "owes".
 */
export function exchangeMoneyLine(o: { diff: number; status: string; currency: string; owed?: number }): string {
  const { diff, status, currency } = o;
  if (Math.abs(diff) < 0.005) return "An even exchange.";
  if (diff < 0) return status === "requested" ? `${(-diff).toFixed(2)} ${currency} is refunded to the shopper when you approve.` : `${(-diff).toFixed(2)} ${currency} was refunded to the shopper.`;
  if (status === "exchanged") return `Paid: the shopper paid the extra ${diff.toFixed(2)} ${currency} and the exchange was sent.`;
  if (status === "approved" && o.owed !== undefined) {
    return o.owed <= 0.005
      ? `Paid: the shopper paid the extra ${diff.toFixed(2)} ${currency}. Ship the exchange once the items arrive.`
      : `The shopper owes ${o.owed.toFixed(2)} ${currency}: send them an invoice from the order in Shopify, the shipment stays on hold until it is paid.`;
  }
  return `The shopper owes ${diff.toFixed(2)} ${currency}: send them an invoice from the order in Shopify, the shipment stays on hold until it is paid.`;
}
