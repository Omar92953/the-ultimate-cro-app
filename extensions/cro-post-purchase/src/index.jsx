/**
 * CRO Toolbox — one-click after-purchase offer. After payment, before the thank-you page, shows the
 * product set in the app at its discount; "Pay now" adds it to the paid order with no new payment
 * details. The shop metafield cro_toolbox.post_purchase says whether there's an offer and where the
 * app server is; the server answers the product as it is in the store now
 * (POST {url}/api/post-purchase/offer) and signs the change (POST {url}/api/post-purchase/sign).
 * Every reason the offer isn't shown is written to the browser console.
 * App Store rules for post-purchase (5.8): fixed accept/decline wording, the store's own product
 * name, picture and price, a callout banner with the product and discount, and the price
 * breakdown before paying.
 */
// eslint-disable-next-line no-unused-vars -- React 17: JSX needs React in scope
import React, { useEffect, useState } from 'react';
import {
  extend,
  render,
  useExtensionInput,
  BlockStack,
  Button,
  CalloutBanner,
  Heading,
  Image,
  Layout,
  Separator,
  Text,
  TextBlock,
  TextContainer,
  Tiles,
  View,
} from '@shopify/post-purchase-ui-extensions-react';

function readOffer(inputData) {
  const m = (inputData.shop.metafields || []).find((x) => x.namespace === 'cro_toolbox' && x.key === 'post_purchase');
  try {
    return m ? JSON.parse(m.value) : null;
  } catch (e) {
    return null;
  }
}

const numeric = (gid) => Number(String(gid).split('/').pop());

/**
 * POST to the app server. Sent as text/plain: a "simple" cross-origin request with no preflight, so a
 * proxy or server that mishandles OPTIONS can't block it (the server also answers the preflight,
 * lib/cors.ts). The server reads the body as JSON whatever its type. Gives up after 4 seconds, so a
 * slow server means no offer rather than a long wait.
 */
async function callApp(url, path, token) {
  const abort = typeof AbortController === 'function' ? new AbortController() : null;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (abort) abort.abort();
      reject(new Error('timeout'));
    }, 4000);
  });
  try {
    const res = await Promise.race([
      fetch(`${url}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ token }),
        signal: abort ? abort.signal : undefined,
      }),
      timeout,
    ]);
    const body = await Promise.race([res.json(), timeout]);
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

// Each skip says why in the console (no tokens or shopper data), to make "the offer didn't show" easy to check.
const skip = (reason) => {
  console.warn(`CRO Toolbox after-purchase offer not shown: ${reason}`);
  return { render: false };
};

extend('Checkout::PostPurchase::ShouldRender', async ({ inputData, storage }) => {
  const offer = readOffer(inputData);
  if (!offer) return skip('no saved offer (save it in the app: Cart & Checkout, After-purchase offer)');
  if (!offer.on) return skip('the offer is turned off in the app');
  if (!offer.product) return skip('no product is chosen');
  if (!offer.url) return skip('the app address is missing; save the offer again');
  const purchase = inputData.initialPurchase;
  // Not for orders below the minimum, nor when the product is already in the order.
  if (offer.min > 0 && Number(purchase.totalPriceSet.shopMoney.amount) < offer.min) return skip(`the order is below the minimum of ${offer.min}`);
  if (purchase.lineItems.some((l) => l.product.id === numeric(offer.product.productId))) return skip('the offered product is already in this order');
  try {
    const res = await callApp(offer.url, '/api/post-purchase/offer', inputData.token);
    if (!res.ok) return skip(`the app server answered ${res.status}`);
    if (!res.body.offer) return skip('the product is not active, out of stock, or the offer is off');
    await storage.update({ ...res.body.offer, url: offer.url });
    return { render: true };
  } catch (e) {
    return skip(`the app server could not be reached (${e && e.message ? e.message : 'network error'})`);
  }
});

render('Checkout::PostPurchase::Render', () => <App />);

function changesOf(offer) {
  const change = { type: 'add_variant', variantId: numeric(offer.variantId), quantity: 1 };
  if (offer.pct > 0) change.discount = { value: offer.pct, valueType: 'percentage', title: `${offer.pct}% off, after purchase offer` };
  return [change];
}

export function App() {
  const { storage, inputData, calculateChangeset, applyChangeset, done } = useExtensionInput();
  const offer = storage.initialData;
  const [calculated, setCalculated] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    calculateChangeset({ changes: changesOf(offer) })
      .then((r) => setCalculated(r.calculatedPurchase || null))
      .catch(() => setCalculated(null));
  }, [calculateChangeset, offer]);

  const money = (amount, currency) => {
    try {
      return new Intl.NumberFormat(inputData.locale, { style: 'currency', currency }).format(Number(amount));
    } catch (e) {
      return String(amount);
    }
  };
  const line = calculated && calculated.updatedLineItems && calculated.updatedLineItems[0];
  const currency = calculated ? calculated.totalOutstandingSet.presentmentMoney.currencyCode : inputData.initialPurchase.totalPriceSet.presentmentMoney.currencyCode;
  const was = line ? line.priceSet.presentmentMoney.amount : null;
  const now = line ? line.totalPriceSet.presentmentMoney.amount : null;
  const shipping = calculated && calculated.addedShippingLines[0] ? calculated.addedShippingLines[0].priceSet.presentmentMoney.amount : 0;
  const taxes = calculated && calculated.addedTaxLines[0] ? calculated.addedTaxLines[0].priceSet.presentmentMoney.amount : 0;
  const total = calculated ? calculated.totalOutstandingSet.presentmentMoney.amount : null;

  async function accept() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await callApp(offer.url, '/api/post-purchase/sign', inputData.token);
      if (!res.ok || !res.body.token) throw new Error(`not signed (${res.status})`);
      await applyChangeset(res.body.token);
      await done();
    } catch (e) {
      console.warn(`CRO Toolbox after-purchase offer could not be added: ${e && e.message ? e.message : 'error'}`);
      setBusy(false);
      setFailed(true);
    }
  }

  return (
    <BlockStack spacing="loose">
      {/* App Store rule 5.8.7: exactly one CalloutBanner at the top, with intro text, the product name and the discount. */}
      <CalloutBanner title={offer.heading}>
        {offer.text}
        {offer.pct > 0 ? (
          <Text emphasized>
            {' '}
            Get {offer.pct}% off {offer.title}.
          </Text>
        ) : null}
      </CalloutBanner>
      <Layout
        maxInlineSize={0.95}
        media={[
          { viewportSize: 'small', sizes: [1, 30, 1] },
          { viewportSize: 'medium', sizes: [300, 30, 0.5] },
          { viewportSize: 'large', sizes: [400, 30, 0.33] },
        ]}
      >
        <View>{offer.image ? <Image source={offer.image} description={offer.alt} /> : null}</View>
        <View />
        <BlockStack spacing="xloose">
          <TextContainer>
            <Heading>{offer.title}</Heading>
            {offer.variantTitle ? <TextBlock subdued>{offer.variantTitle}</TextBlock> : null}
            <TextBlock>
              {was && Number(was) > Number(now) ? (
                <Text role="deletion" size="large">
                  {money(was, currency)}{' '}
                </Text>
              ) : null}
              {now ? (
                <Text emphasized size="large" appearance="critical">
                  {money(now, currency)}
                </Text>
              ) : null}
            </TextBlock>
          </TextContainer>
          {calculated ? (
            <BlockStack>
              <Separator />
              <Tiles>
                <TextBlock>Subtotal</TextBlock>
                <TextBlock>{money(now, currency)}</TextBlock>
              </Tiles>
              <Tiles>
                <TextBlock>Shipping</TextBlock>
                <TextBlock>{money(shipping, currency)}</TextBlock>
              </Tiles>
              <Tiles>
                <TextBlock>Taxes</TextBlock>
                <TextBlock>{money(taxes, currency)}</TextBlock>
              </Tiles>
              <Separator />
              <Tiles>
                <TextBlock emphasized>Total</TextBlock>
                <TextBlock emphasized>{money(total, currency)}</TextBlock>
              </Tiles>
            </BlockStack>
          ) : null}
          {failed ? <TextBlock appearance="critical">This offer couldn’t be added. Your order is not affected.</TextBlock> : null}
          <BlockStack>
            <Button submit loading={busy} disabled={!calculated} onPress={accept}>
              Pay now{total ? ` · ${money(total, currency)}` : ''}
            </Button>
            <Button subdued disabled={busy} onPress={() => done()}>
              Decline this offer
            </Button>
          </BlockStack>
        </BlockStack>
      </Layout>
    </BlockStack>
  );
}
