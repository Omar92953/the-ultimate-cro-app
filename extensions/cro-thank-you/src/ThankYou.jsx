/* eslint-disable react/prop-types -- each module gets its saved config as `m`, documented above */
/*
 * CRO Toolbox — thank-you page modules. The merchant picks and orders the modules in the app
 * (Checkout → Thank-you page); they are saved in the shop metafield $app:thank_you:
 * { "modules": [
 *     { "type": "code", "on": true, "heading": "…", "text": "…", "code": "THANKS10" },
 *     { "type": "note", "on": true, "heading": "…", "text": "…", "tone": "info" | "success" },
 *     { "type": "social", "on": true, "heading": "…", "links": [{ "label": "Instagram", "url": "https://…" }] },
 *     { "type": "products", "on": true, "heading": "…", "collection": "best-sellers", "count": 3 }
 * ] }
 */
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export default async () => {
  render(<Extension />, document.body);
};

function config() {
  const entry = shopify.appMetafields.value.find((m) => m.target.type === 'shop' && m.metafield.namespace === '$app' && m.metafield.key === 'thank_you');
  try {
    const value = entry ? JSON.parse(String(entry.metafield.value)) : null;
    return Array.isArray(value?.modules) ? value.modules.filter((m) => m && m.on !== false) : [];
  } catch {
    return [];
  }
}

function Extension() {
  const modules = config();
  if (!modules.length) return null;
  return (
    <s-stack gap="large-200">
      {modules.map((m, i) =>
        m.type === 'code' ? <Code key={i} m={m} /> : m.type === 'note' ? <Note key={i} m={m} /> : m.type === 'social' ? <Social key={i} m={m} /> : m.type === 'products' ? <Products key={i} m={m} /> : null,
      )}
    </s-stack>
  );
}

/** A discount code for the next order, with a copy button. */
function Code({ m }) {
  const [copied, setCopied] = useState(false);
  if (!m.code) return null;
  const id = `cro-code-${m.code}`;
  return (
    <s-section heading={m.heading || undefined}>
      <s-stack gap="base">
        {m.text ? <s-text>{m.text}</s-text> : null}
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-box padding="small-100 base" border="base" borderRadius="base">
            <s-text type="strong">{m.code}</s-text>
          </s-box>
          <s-button variant="secondary" command="--copy" commandFor={id}>
            {copied ? shopify.i18n.translate('copied') : shopify.i18n.translate('copy')}
          </s-button>
          <s-clipboard-item id={id} text={m.code} onCopy={() => setCopied(true)} />
        </s-stack>
      </s-stack>
    </s-section>
  );
}

/** A message from the store (e.g. when the order ships). */
function Note({ m }) {
  if (!m.text && !m.heading) return null;
  return (
    <s-banner heading={m.heading || undefined} tone={m.tone === 'success' ? 'success' : 'info'}>
      {m.text ? <s-text>{m.text}</s-text> : null}
    </s-banner>
  );
}

/** Links to the store's social pages. */
function Social({ m }) {
  const links = (Array.isArray(m.links) ? m.links : []).filter((l) => l && l.url && /^https:\/\//.test(l.url));
  if (!links.length) return null;
  return (
    <s-section heading={m.heading || undefined}>
      <s-stack gap="base">
        {m.text ? <s-text>{m.text}</s-text> : null}
        <s-stack direction="inline" gap="base">
          {links.map((l) => (
            <s-button key={l.url} variant="secondary" href={l.url} target="_blank">
              {l.label || l.url}
            </s-button>
          ))}
        </s-stack>
      </s-stack>
    </s-section>
  );
}

/** "You may also like": products from a collection, linking to the store. */
function Products({ m }) {
  const [items, setItems] = useState([]);
  const count = Math.min(6, Math.max(1, Number(m.count) || 3));
  useEffect(() => {
    if (!m.collection) return;
    shopify
      .query(
        `query CroThankYouProducts($handle: String!, $first: Int!) {
          collection(handle: $handle) {
            products(first: $first) { nodes { id title onlineStoreUrl featuredImage { url altText } priceRange { minVariantPrice { amount currencyCode } } } }
          }
        }`,
        { variables: { handle: m.collection, first: count + 4 } },
      )
      .then((/** @type {{ data?: any }} */ { data }) => {
        // Not the products just bought, and only products that are on the online store.
        const bought = new Set((shopify.lines?.value ?? []).map((l) => l.merchandise?.product?.id));
        const nodes = data?.collection?.products?.nodes ?? [];
        setItems(nodes.filter((p) => p.onlineStoreUrl && !bought.has(p.id)).slice(0, count));
      })
      .catch(() => setItems([]));
  }, [m.collection, count]);
  if (!items.length) return null;
  return (
    <s-section heading={m.heading || undefined}>
      <s-grid gridTemplateColumns={items.length > 1 ? '1fr 1fr' : '1fr'} gap="base">
        {items.map((p) => (
          <s-stack key={p.id} gap="small-200">
            {p.featuredImage ? <s-image src={p.featuredImage.url} alt={p.featuredImage.altText || p.title} aspectRatio="1" objectFit="cover" borderRadius="base" /> : null}
            <s-text type="strong">{p.title}</s-text>
            <s-text>{shopify.i18n.formatCurrency(Number(p.priceRange.minVariantPrice.amount), { currency: p.priceRange.minVariantPrice.currencyCode })}</s-text>
            <s-link href={p.onlineStoreUrl} target="_blank">
              {m.button || shopify.i18n.translate('shop')}
            </s-link>
          </s-stack>
        ))}
      </s-grid>
    </s-section>
  );
}
