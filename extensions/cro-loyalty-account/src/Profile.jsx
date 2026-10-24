/* eslint-disable react/prop-types -- small blocks, their props are documented in loyalty.js */
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { parse, pts } from './loyalty.js';

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const [data, setData] = useState(/** @type {{ m: any, on: boolean } | null} */ (null));
  useEffect(() => {
    // The Customer Account API (signed in customer only; Shopify adds the authentication, no network access needed).
    fetch('shopify://customer-account/api/2026-07/graphql.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'query CroLoyaltyProfile { customer { loyalty: metafield(namespace: "$app", key: "loyalty") { value } } shop { loyalty: metafield(namespace: "$app", key: "loyalty") { value } } }' }),
    })
      .then((r) => r.json())
      .then((/** @type {{ data?: any }} */ { data }) => setData({ m: parse(data?.customer?.loyalty?.value), on: !!parse(data?.shop?.loyalty?.value)?.on }))
      .catch(() => setData(null));
  }, []);
  const m = data?.m;
  if (!data?.on || !m || m.b) return null;
  const t = shopify.i18n.translate;
  return (
    <s-section heading={t('title')}>
      <s-stack gap="base">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-heading>{t('ready', { points: pts(m.p ?? 0, m.u) })}</s-heading>
          {m.t ? <s-badge tone="neutral">{t('tier', { tier: m.t })}</s-badge> : null}
        </s-stack>
        {m.pe ? <s-text color="subdued">{t('pending', { points: pts(m.pe, m.u) })}</s-text> : null}
        {Array.isArray(m.rw) && m.rw.length ? (
          <s-stack gap="small-200">
            <s-text type="strong">{t('codes')}</s-text>
            {m.rw.map((r) => (
              <Copyable key={r.c} label={r.t} text={r.c} note={r.e ? t('until', { date: shopify.i18n.formatDate(new Date(`${r.e}T12:00:00Z`)) }) : ''} />
            ))}
          </s-stack>
        ) : null}
        {m.l ? (
          <s-stack gap="small-200">
            <s-text type="strong">{t('refer')}</s-text>
            <s-text color="subdued">{t('referText')}</s-text>
            <Copyable label="" text={m.l} note="" />
          </s-stack>
        ) : null}
      </s-stack>
    </s-section>
  );
}

/** A code or link in a box, with a copy button. */
function Copyable({ label, text, note }) {
  const [copied, setCopied] = useState(false);
  const id = `cro-loy-${text.replace(/[^A-Za-z0-9]/g, '').slice(-24)}`;
  return (
    <s-stack direction="inline" gap="base" alignItems="center">
      {label ? <s-text>{label}</s-text> : null}
      <s-box padding="small-100 base" border="base" borderRadius="base">
        <s-text type="strong">{text}</s-text>
      </s-box>
      <s-button variant="secondary" command="--copy" commandFor={id}>
        {copied ? shopify.i18n.translate('copied') : shopify.i18n.translate('copy')}
      </s-button>
      <s-clipboard-item id={id} text={text} onCopy={() => setCopied(true)} />
      {note ? <s-text color="subdued">{note}</s-text> : null}
    </s-stack>
  );
}
