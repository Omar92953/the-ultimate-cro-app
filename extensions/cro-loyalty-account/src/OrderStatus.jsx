import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { parse, pts } from './loyalty.js';

export default async () => {
  render(<Extension />, document.body);
};

/** What this order earned (from the member's metafield, once the app has read the order) and the balance. */
function Extension() {
  const entries = shopify.appMetafields.value;
  const find = (type) => parse(entries.find((x) => x.target.type === type && x.metafield.namespace === '$app' && x.metafield.key === 'loyalty')?.metafield.value);
  const shop = find('shop');
  const m = find('customer');
  if (!shop?.on || !m || m.b) return null;
  const orderId = String(shopify.order.value?.id ?? '').split('/').pop();
  const earned = orderId && m.o ? m.o[orderId] : null;
  const t = shopify.i18n.translate;
  return (
    <s-banner tone="success">
      <s-stack gap="small-200">
        {earned ? <s-text type="strong">{t(earned.pe ? 'earnedPending' : 'earned', { points: pts(earned.p, m.u) })}</s-text> : null}
        <s-text>{t('balance', { points: pts(m.p ?? 0, m.u) })}</s-text>
      </s-stack>
    </s-banner>
  );
}
