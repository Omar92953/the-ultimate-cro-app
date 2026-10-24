import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { loyalty, pts } from './loyalty.js';

/** The app (shopify.app.toml application_url). */
const APP = 'https://cro-toolbox.onrender.com';

export default async () => {
  render(<Extension />, document.body);
};

/** Under the discount field (Shopify Plus): apply a reward code the member has, or spend points on a new one. */
function Extension() {
  const { shop, member } = loyalty();
  const [rewards, setRewards] = useState(/** @type {any[]} */ ([]));
  const [points, setPoints] = useState(member?.p ?? 0);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ tone: '', text: '' });
  const t = shopify.i18n.translate;
  const canUpdate = shopify.instructions.value.discounts.canUpdateDiscountCodes;

  const active = !!(shop && member && canUpdate);
  // Rewards to spend points on: from the app (needs network access); without it, only the codes show.
  useEffect(() => {
    if (!active) return;
    call('GET')
      .then((d) => {
        if (d?.ok) {
          setRewards(d.rewards ?? []);
          if (typeof d.member?.points === 'number') setPoints(d.member.points);
        }
      })
      .catch(() => setRewards([]));
  }, [active]);

  if (!shop || !member || !canUpdate) return null;
  const applied = new Set(shopify.discountCodes.value.map((d) => d.code.toUpperCase()));
  const codes = (Array.isArray(member.rw) ? member.rw : []).filter((r) => !applied.has(String(r.c).toUpperCase()));
  if (!codes.length && !rewards.length) return null;
  const unit = member.u ?? shop.u;

  const apply = async (code) => {
    const r = await shopify.applyDiscountCodeChange({ type: 'addDiscountCode', code });
    return r.type !== 'error';
  };
  const applyCode = async (code) => {
    setBusy(code);
    const ok = await apply(code);
    setMessage(ok ? { tone: 'success', text: t('applied') } : { tone: 'critical', text: t('codeFailed') });
    setBusy('');
  };
  const spend = async (reward) => {
    setBusy(reward.id);
    const d = await call('POST', { reward: reward.id }).catch(() => null);
    const ok = !!(d?.ok && d.reward?.code && (await apply(d.reward.code)));
    if (d?.ok) setPoints(d.points ?? points);
    setMessage(ok ? { tone: 'success', text: t('applied') } : { tone: 'critical', text: t('failed') });
    setBusy('');
  };

  return (
    <s-stack gap="base">
      {message.text ? <s-banner tone={message.tone === 'success' ? 'success' : 'critical'}>{message.text}</s-banner> : null}
      {codes.length ? (
        <s-stack gap="small-200">
          <s-text type="strong">{t('codes')}</s-text>
          {codes.map((r) => (
            <s-stack key={r.c} direction="inline" gap="base" alignItems="center">
              <s-text>{`${r.t} · ${r.c}`}</s-text>
              <s-button variant="secondary" loading={busy === r.c} disabled={!!busy} onClick={() => applyCode(r.c)}>
                {t('apply')}
              </s-button>
            </s-stack>
          ))}
        </s-stack>
      ) : null}
      {rewards.length ? (
        <s-stack gap="small-200">
          <s-text type="strong">{t('spend', { unit: Array.isArray(unit) ? unit[1] : unit.many })}</s-text>
          <s-text color="subdued">{t('balanceShort', { points: pts(points, unit) })}</s-text>
          {rewards.map((r) => (
            <s-stack key={r.id} direction="inline" gap="base" alignItems="center">
              <s-text>{r.title}</s-text>
              {points >= r.points ? (
                <s-button variant="secondary" loading={busy === r.id} disabled={!!busy} onClick={() => spend(r)}>
                  {t('use', { points: pts(r.points, unit) })}
                </s-button>
              ) : (
                <s-text color="subdued">{t('notEnough', { points: pts(r.points - points, unit) })}</s-text>
              )}
            </s-stack>
          ))}
        </s-stack>
      ) : null}
    </s-stack>
  );
}

/**
 * The app, with the checkout session token (it names the store and the signed in customer).
 * @param {'GET' | 'POST'} method
 * @param {Record<string, unknown>} [body]
 * @returns {Promise<any>}
 */
async function call(method, body = undefined) {
  const token = await shopify.sessionToken.get();
  const r = await fetch(`${APP}/api/loyalty/checkout`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return r.json();
}
