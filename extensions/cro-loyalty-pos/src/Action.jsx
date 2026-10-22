import { render } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { loyaltyOf, pts, spend } from './api.js';

export default async () => {
  render(<Extension />, document.body);
};

/** The rewards this customer can get: a code goes on the POS cart, store credit on their account. */
function Extension() {
  const [d, setD] = useState(/** @type {any} */ (null));
  const [busy, setBusy] = useState('');
  /** @param {string} key @param {Record<string, string>} [vars] */
  const t = (key, vars = undefined) => String(shopify.i18n.translate(key, vars));
  const id = shopify.customer.id;
  const load = useCallback(
    /** @returns {Promise<void>} */
    () =>
      loyaltyOf(id)
        .then(setD)
        .catch(() => setD({ ok: false, error: 'network' })),
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);
  const m = d?.member;

  /** @param {{ id: string, title: string, points: number }} r @returns {Promise<void>} */
  const use = async (r) => {
    setBusy(r.id);
    const res = await spend(id, r.id).catch(() => null);
    if (!res?.ok) shopify.toast.show(res?.error && res.error !== 'not enough' && res.error !== 'off' ? res.error : t('failed'));
    else if (res.reward.kind === 'credit') shopify.toast.show(t('credit', { reward: res.reward.title }));
    else {
      const added = await shopify.cart.addCartCodeDiscount(res.reward.code).then(
        () => true,
        () => false,
      );
      shopify.toast.show(added ? t('added', { reward: res.reward.title }) : t('code', { code: res.reward.code }));
    }
    setBusy('');
    await load();
  };

  return (
    <s-page heading={t('title')}>
      <s-scroll-box>
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
            <s-stack gap="base">
              <s-text type="strong">{t('ready', { points: pts(m.points, m.unit) })}</s-text>
              {(d.rewards ?? []).length ? (
                d.rewards.map((r) => (
                  <s-section key={r.id} heading={r.title}>
                    {r.enough ? (
                      <s-button variant="primary" disabled={!!busy} loading={busy === r.id} onClick={() => use(r)}>
                        {t('spend', { points: pts(r.points, m.unit) })}
                      </s-button>
                    ) : (
                      <s-text>{t('more', { points: pts(r.points - m.points, m.unit) })}</s-text>
                    )}
                  </s-section>
                ))
              ) : (
                <s-text>{t('none')}</s-text>
              )}
            </s-stack>
          )}
        </s-box>
      </s-scroll-box>
    </s-page>
  );
}
