/**
 * CRO Toolbox — one-click after-purchase offer. After payment, before the thank-you page, shows the
 * product set in the app at its discount; "Pay now" adds it to the paid order with no new payment
 * details. The shop metafield cro_toolbox.post_purchase says whether there's an offer and where the
 * app server is; the server answers the product as it is in the store now
 * (POST {url}/api/post-purchase/offer) and signs the change (POST {url}/api/post-purchase/sign).
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

extend('Checkout::PostPurchase::ShouldRender', async ({ inputData, storage }) => {
  const offer = readOffer(inputData);
  if (!offer || !offer.on || !offer.product || !offer.url) return { render: false };
  const purchase = inputData.initialPurchase;
  // Not for orders below the minimum, nor when the product is already in the order.
  if (offer.min > 0 && Number(purchase.totalPriceSet.shopMoney.amount) < offer.min) return { render: false };
  if (purchase.lineItems.some((l) => l.product.id === numeric(offer.product.productId))) return { render: false };
  try {
    const res = await fetch(`${offer.url}/api/post-purchase/offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: inputData.token }),
    });
    const body = await res.json();
    if (!res.ok || !body.offer) return { render: false };
    await storage.update({ ...body.offer, url: offer.url });
    return { render: true };
  } catch (e) {
    return { render: false };
  }
});

render('Checkout::PostPurchase::Render', () => <App />);

function changesOf(offer) {
  const change = { type: 'add_variant', variantId: numeric(offer.variantId), quantity: 1 };
  if (offer.pct > 0) change.discount = { value: offer.pct, valueType: 'percentage', title: `${offer.pct}% off — after-purchase offer` };
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
      const res = await fetch(`${offer.url}/api/post-purchase/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inputData.token }),
      });
      const body = await res.json();
      if (!res.ok || !body.token) throw new Error('not signed');
      await applyChangeset(body.token);
      await done();
    } catch (e) {
      setBusy(false);
      setFailed(true);
    }
  }

  return (
    <BlockStack spacing="loose">
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
