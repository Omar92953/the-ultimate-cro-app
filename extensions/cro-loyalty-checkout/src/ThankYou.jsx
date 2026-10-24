import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { loyalty, pts } from './loyalty.js';

export default async () => {
  render(<Extension />, document.body);
};

/**
 * What this order earns, worked out like the app does (points per 1 of the currency on the subtotal, plus shipping
 * and taxes when the store counts them, times the member's tier), before the app reads the order. Product rules
 * and campaigns can change it, so the app's own count is what the member gets. A guest is told how to get them
 * (an account with the checkout email), as the store chose for guest orders (shop `gu`).
 */
function Extension() {
  const { shop, member } = loyalty();
  if (!shop) return null;
  const amount = (m) => Number(m?.value?.amount ?? 0) || 0;
  const base = amount(shopify.cost.subtotalAmount) + (shop.sh ? amount(shopify.cost.totalShippingAmount) : 0) + (shop.tx ? amount(shopify.cost.totalTaxAmount) : 0);
  const t = shopify.i18n.translate;
  const unit = member?.u ?? shop.u;
  let earns = '';
  if (shop.cb > 0) {
    const currency = shopify.cost.totalAmount.value?.currencyCode;
    earns = t('earnsCredit', { amount: shopify.i18n.formatCurrency(Math.round(base * shop.cb) / 100, { currency }) });
  } else if (shop.per > 0) {
    const points = Math.floor(base * shop.per * (member?.x || 1) + 1e-9);
    if (points > 0) earns = t('earns', { points: pts(points, unit) });
  }
  // Not signed in as a member (a guest checkout): as the store chose for guest orders ("off": they earn nothing).
  const guest = !member ? shop.gu ?? 'now' : '';
  if (guest === 'off' || (!earns && !member)) return null;
  return (
    <s-banner tone="success">
      <s-stack gap="small-200">
        {earns ? <s-text type="strong">{earns}</s-text> : null}
        {earns ? <s-text color="subdued">{t(guest === 'account' ? 'guestAccount' : guest ? 'guestNow' : 'after')}</s-text> : null}
        {member ? <s-text>{t('balance', { points: pts(member.p ?? 0, unit) })}</s-text> : null}
      </s-stack>
    </s-banner>
  );
}
