# Testing instructions for App Review (round after the 2026-11-11 pause)

Paste section 1 into the Partner Dashboard submission form (Testing instructions). Section 2 is the screencast
script (requirement 4.5.3), the same steps in the same order. Keep the storefront password out of this file: type it
into the form yourself.

## 1. Text for the submission form

After-purchase offer (one-click upsell after payment, before the Thank you page)

1. Install CRO Toolbox and open it.
2. Go to Cart & Checkout, then After-purchase offer. Click "Choose a product" and pick product A. Keep the discount
   (15%), switch "Offer is on" and click Save. "Test connection" on the same page checks that checkout can reach
   the app.
3. In Shopify admin, open Settings, then Checkout. Under "Post-purchase page", choose CRO Toolbox and save.
4. Turn on test payments: Settings, then Payments, then (for testing) Bogus Gateway.
5. On the storefront, buy a different product B (not product A: Shopify doesn't offer a product that is already in
   the order). Pay with card number 1, any name, any future expiry date, CVV 111.
6. After payment, before the Thank you page, the offer page shows product A with its picture, the discounted price,
   shipping, taxes and total. "Pay now" adds product A to the same order with no new card details; "Decline this
   offer" goes to the Thank you page. After "Pay now", the order in Shopify admin shows product A at the discount.

Thank you page block

7. In the app, go to Cart & Checkout, then Thank-you page, turn on a module (for example the discount code for the
   next order) and save.
8. In Shopify admin, open Settings, then Checkout, then Customize. Switch the page selector to Thank you, click
   Add block and add "CRO Toolbox thank-you page". Save. The block shows on the Thank you page after the next order.

Shopify's own limits for after-purchase offers

- Shown only for orders paid by card (the Bogus Gateway card 1 works in a test store). Shopify skips the page for
  Apple Pay, Google Pay, PayPal, installments, gift cards, cash on delivery and manual payments.
- Not shown when the order already contains the offered product, or when it is below a minimum order value the
  merchant set (none by default).
- Only for Online Store orders.

## 2. Screencast script (2 to 3 minutes, English)

Record at 1080p on a fresh development store. Speak slowly and say what you click.

| Time | Screen | Say and do |
|---|---|---|
| 0:00 | Shopify admin, Apps | "This is CRO Toolbox. I'll set up the after-purchase offer and show it at checkout." Open the app. |
| 0:15 | Cart & Checkout → After-purchase offer | "I choose the product to offer, product A." Choose a product, keep 15%, switch the offer on, Save. Click Test connection: every line shows OK. |
| 0:45 | Settings → Checkout | "Under Post-purchase page I choose CRO Toolbox." Select it and save. |
| 1:00 | Settings → Payments | "For testing, the Bogus Gateway is on." Show it. |
| 1:10 | Storefront | "I buy a different product, product B." Add B to the cart, check out, card number 1, pay. |
| 1:35 | Offer page | "Right after payment, the offer: product A, its picture, the discounted price, shipping, taxes and total." Click Pay now. |
| 1:55 | Thank you page, then the order in admin | "The Thank you page. In the order, product A was added at 15% off, with no new card details." |
| 2:15 | Checkout editor | "The Thank you page block: Settings, Checkout, Customize, Thank you, Add block, CRO Toolbox thank-you page." Save. |
| 2:40 | Close | "Thank you for reviewing CRO Toolbox." |
