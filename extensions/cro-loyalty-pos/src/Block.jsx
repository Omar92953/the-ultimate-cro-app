import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { loyaltyOf, pts } from './api.js';

export default async () => {
  render(<Extension />, document.body);
};

/** The customer's points, pending points and tier, with "Use points" to spend them. */
function Extension() {
  const [d, setD] = useState(/** @type {any} */ (null));
  const t = shopify.i18n.translate;
  const id = shopify.customer.id;
  useEffect(() => {
    loyaltyOf(id)
      .then(setD)
      .catch(() => setD({ ok: false, error: 'network' }));
  }, [id]);
  const m = d?.member;
  return (
    <s-pos-block heading={t('title')}>
      {m && !m.blocked ? (
        <s-button slot="secondary-actions" onClick={() => shopify.action.presentModal()}>
          {t('use')}
        </s-button>
      ) : null}
      <s-box padding="base">
        {!d ? (
          <s-text>{t('loading')}</s-text>
        ) : !d.ok ? (
          <s-text>{d.error === 'off' ? t('off') : t('error')}</s-text>
        ) : !m ? (
          <s-text>{t('notMember')}</s-text>
        ) : m.blocked ? (
          <s-text>{t('blocked')}</s-text>
        ) : (
          <s-stack gap="small-200">
            <s-text type="strong">{t('ready', { points: pts(m.points, m.unit) })}</s-text>
            {m.pending ? <s-text>{t('pending', { points: pts(m.pending, m.unit) })}</s-text> : null}
            {m.tier ? <s-badge>{t('tier', { tier: m.tier })}</s-badge> : null}
          </s-stack>
        )}
      </s-box>
    </s-pos-block>
  );
}
