# Tracking and returns: competitor research (G3)

For Omar's scope decision before G4 (the Tracking & Returns product on the Growth plan).
Written 2026-10-17 from the vendors' own pages, Shopify's developer docs and app listings. Prices change
and several sources disagree (noted below); **confirm any price before quoting it**. Where I could not read
a vendor's own page (AfterShip's pricing page returned 403), the figure comes from its help center or app
listing as found in search results.

## 1. What CRO Toolbox has today

- **Track order page** (`ucs-order-page` block, `proxy.track`): the shopper types order number and email;
  the app reads the order (Admin API) and shows the Shopify fulfillment's `displayStatus`, carrier, tracking
  number and link, delivered and estimated dates. No carrier API: it only knows what Shopify knows.
- **Returns page** (same block, `proxy.returns`): the shopper looks up the order, picks items and a reason;
  the request is saved in the app's database and listed under Returns. **Nothing happens in Shopify**: no
  Shopify return, no refund, no label, no email. Returns plans: Starter feature today.
- Limits from the code map: needs protected customer data approval; only the last 60 days of orders (no
  `read_all_orders`); the deep link puts the block on every standard page; the Returns link opens a Track
  page; styles 2 to 5 are ignored for the return window.

## 2. Vendors

Short version of each, then the comparison table in section 3.

### AfterShip Tracking
- **What**: the market's best known tracking platform. Branded tracking page, shipment notifications
  (email, SMS), delivery date estimates, analytics, carrier-delay alerts. Free tier lists 983 carriers.
- **Price** (help center and Capterra): Essentials $11/month (100 to 5,000 shipments, priced per shipment
  volume), Pro $119, Premium $239, Enterprise custom; annual billing 18% off; overage per shipment beyond the
  plan.
- **Setup**: install, pick carriers; AfterShip gets tracking numbers from the Shopify fulfillments and then
  polls the carriers' own APIs itself (its own carrier connections), pushing events back.
- **Merchant provides**: nothing beyond tracking numbers on fulfillments; own email domain for notifications
  on higher plans.

### AfterShip Returns (separate product)
- **What**: returns portal, rules, automation, return labels, exchanges, store credit, analytics.
- **Price** (help center vs Shopify listing disagree): Essentials $9 to $11/month, Pro $49 to $59, Premium
  $199 to $239, Enterprise custom; quotas of 20/100/200 returns **per month** (listing) or 240/1,200/2,400
  **per year** (help center); extra returns $0.50 (Essentials, Pro) or $1.00 (Premium). A free plan of about 3
  returns a month is reported.
- **Plan gating** (listing): prepaid in-app return labels in the middle plan; refunds to store credit and
  returns tracking at Pro; "exchange for other items" and on-store exchanges at Premium.
- **Needs**: return policy and rules, return address, a label provider (AfterShip Shipping or your own
  carrier account).

### Parcel Panel (now CWILL Post-Purchase)
- **Price** (vendor page): Free $0 (20 orders/month, branded tracking page, 1,694+ carriers); Essential $11
  (200 orders; EDD, custom status, notifications, upsell blocks); Professional $59 (2,000 orders; Klaviyo,
  Gorgias, API, branding removed); Enterprise $479 (25,000). Extra orders $0.05. One credit per order whatever
  the shipments. 7 day trial. Returns is a separate product with no price on that page.
- **Tracking data**: Shopify fulfillments plus its own carrier network.

### Track123
- **Price** (Shopify listing and vendor): Starter free (50 orders/month, branded multilingual tracking page);
  Growth $9 (300 orders); Advanced $49 (2,000 orders); Enterprise custom (a third party says $399 to $699).
  Overage $0.05 per order on monthly billing. Tracking first, returns as an add on.

### 17TRACK
- **What**: a tracking data provider first (a Tracking API with webhooks), plus a Shopify app.
- **Price**: the Shopify app lists Free (50 shipments), Basic $9 (200), Pro $49 (1,000) (older figures differ).
  **API price is "on request"**, so we cannot plan on it without talking to them. Claims 2,800+ carriers
  (others say 1,500).

### Loop Returns
- **What**: the premium returns platform. Refunds, store credit, exchanges (variant, advanced, instant), Keep
  Item, Shop Now, bonus credit, label rate shopping, label free and printerless returns, fraud and analytics.
- **Price**: Essential from $155/month, Advanced from $340/month (monthly list only); aimed at stores with
  about 20,000 orders a year and up. A free "Checkout+" tier exists where the shopper pays for return
  shipping or a checkout fee covers it. Loop Core Tracking is sold alongside.
- **Setup**: Shopify integration, return policy, label carriers (US and Canada domestic labels with negotiated
  rates).

### Redo
- **What**: returns and exchanges portal plus checkout and support add ons.
- **Price**: the returns portal is free for merchants. Revenue comes from a return protection fee shown at
  checkout (about $2, calculated per merchant) or a small flat fee per return and exchange. Add ons per order:
  checkout optimization $0.40, one click upsell $0.06, order tracking $0.08 per tracked order, support
  resolutions $0.20 (AI $0.85). Two of Redo's own pages disagree on some of these.

### ReturnGO
- **Price** (Shopify listing and review sites, conflicting): Starter about $23 (20 returns, then $1.25 each);
  Premium $147 (110 returns; exchanges, Shop Now, white label); Pro $297 (300 returns; automation, API);
  Enterprise custom. Prepaid labels through "Ship by ReturnGO" on every tier.
- **Strong at**: auto approve, auto refund, auto exchange, rules per product and reason.

### Shopify's own returns (free, built in)
- **Admin**: create a return, send shipping instructions, refund after inspection. Return, refund and exchange.
- **Self serve**: shoppers request a return (and cancel unfulfilled orders) from their **order status page**
  (customer accounts); merchant sets return rules (eligible items and the time window). No separate portal
  or branding, only for shoppers who log in or use the order status link.
- **Labels**: Shopify Shipping labels where available, or the merchant uploads a label or tracking.
- **API** (what an app can drive, from the developer docs): `returnableFulfillments`, `returnRequest`
  (creates `REQUESTED`), `returnApproveRequest` (to `OPEN`, creates the reverse fulfillment order),
  `returnDeclineRequest`, `returnCreate` (straight to `OPEN`, optional `notifyCustomer`), `returnCancel`,
  `returnProcess` (refund tied to the return lines, with dispositions such as restocked, `notifyCustomer`),
  `returnClose` and `returnReopen`, plus reverse deliveries for labels and tracking. Statuses: REQUESTED, OPEN,
  DECLINED, CLOSED, CANCELED. Exchange items create fulfillment orders on hold until the returned items
  arrive. Return webhooks exist. Needs return scopes, which require Shopify review.

## 3. Comparison

| | Tracking data comes from | Branded tracking page | Notifications | Returns portal | Real Shopify return + refund | Labels | Exchanges | Entry price |
|---|---|---|---|---|---|---|---|---|
| AfterShip | its own carrier network (polls carriers) | yes | email, SMS | separate product | yes | in app, own shipping | Premium plan | $11 (tracking); $9 to $11 (returns, 20 a month) |
| Parcel Panel / CWILL | Shopify + own carrier network | yes | email, SMS (paid) | separate product | yes | via partners | yes | free (20 orders), $11 |
| Track123 | own carrier network | yes | yes | add on | yes | partners | yes | free (50 orders), $9 |
| 17TRACK | its own API (2,800+ carriers claimed) | yes | basic | no | no | no | no | free (50), $9; API on request |
| Loop Returns | Loop Core Tracking add on | yes | yes | yes, premium | yes | yes, rate shopping | all kinds | $155 |
| Redo | Redo tracking add on | yes | yes | yes | yes | yes, shopper fee funds it | yes | free portal |
| ReturnGO | Shopify | n/a | yes | yes | yes | Ship by ReturnGO | Premium plan | about $23 |
| Shopify built in | Shopify fulfillments | order status page | Shopify emails | order status page, logged in | yes | Shopify Shipping | yes | free |
| **CRO Toolbox today** | **Shopify fulfillments** | yes | **none** | yes | **no** | **no** | **no** | Starter |

How merchants set them up: install, connect carriers (tracking) or set a return policy, address and label
provider (returns), and for email branding add their own domain.

## 4. Gaps against CRO Toolbox

1. Returns do not become Shopify returns or refunds (all returns apps do this).
2. No notifications at all (order shipped, delivered, return received, refunded).
3. No return rules (window, eligible products, reasons, who pays shipping) and no auto approve.
4. No labels; no exchanges or store credit.
5. Tracking only knows the fulfillment status Shopify holds. Without carrier events the page often says
   "Fulfilled" until delivered, and there is no delay alert or delivery estimate of our own.
6. No dashboard of shipments and returns: status overview, delayed orders, return reasons.
7. Limited to the last 60 days of orders and needs the protected customer data approval.

## 5. What we can build with Shopify APIs only (no paid carrier API)

- **Tracking**: Shopify fulfillment data (`displayStatus`, tracking numbers and links, estimated and delivered
  dates, fulfillment events Shopify or the carrier app wrote). A branded page, a "carrier link" fallback
  when we have no live events, delay warnings from the estimate vs today, per shop lookups.
  Shopify only has live events when the merchant ships with Shopify Shipping or a carrier app that writes
  `fulfillmentEvents`; with a manual tracking number there are none. This is the real limit of "no carrier API".
- **Returns**: the full flow on Shopify's own objects: shopper request, `returnRequest`, merchant approve or
  decline in the app (`returnApproveRequest` / `returnDeclineRequest`), the reverse fulfillment order, merchant
  uploads a label or tracking (or shopper ships on their own), then `returnProcess` with a refund and restock,
  `returnClose`. Return rules (window, product and reason rules, auto approve) live in our app.
- **Notifications**: Shopify sends its own customer emails for `returnCreate` and `returnProcess`
  (`notifyCustomer`). Own branded emails or SMS need an email sender (see below).
- **Dashboard**: status overview, requests list, reasons report, from the same data.

## 6. What needs a third party

- **Live carrier tracking** for stores that use a manual tracking number: a tracking data provider (17TRACK
  API on request, AfterShip, Track123 or Parcel Panel APIs), billed per shipment. Not needed for v1 if we say
  clearly that status comes from Shopify and the carrier link.
- **Prepaid return labels**: a label provider (Shopify Shipping, EasyPost, Shippo, or a local carrier). The
  merchant needs their own account; US and Canada first. Not needed for v1 (merchant uploads labels).
- **Branded emails and SMS**: an email service (Resend, Postmark, SES) and a verified sender domain per
  merchant; SMS needs a provider and consent rules. Shopify's own emails cover v1.
- **Exchanges and store credit**: Shopify supports exchange items on a return and store credit through gift
  cards or store credit accounts; building the UI is ours but it is a large piece.

## 7. Recommended v1 scope (for Omar to decide)

**In v1 (Shopify APIs only, Growth plan):**
1. A real return flow on Shopify returns: shopper request, merchant approve or decline in the app, Shopify
   return and reverse fulfillment, refund and restock with `returnProcess`, close.
2. Return rules: return window, eligible products and collections, reasons list (and photo upload if
   feasible), who pays for shipping, auto approve for chosen reasons.
3. Merchant uploads the return label or tracking (or tells the shopper the address); the shopper sees the
   status on the Returns page.
4. Tracking page from Shopify fulfillment data, delay and delivered states, carrier link; no paid carrier API.
5. Customer notifications through Shopify's own emails (`notifyCustomer`) for return created and refunded;
   a "request received" message on the page.
6. New "Tracking & Returns" menu area: status overview, setup checklist, the two pages, requests list, a
   reasons report; page styles for both pages (all 5 styles respected).
7. Fix the 60 day limit with the right scope request (`read_all_orders`) and make the protected customer data
   requirements part of the setup checklist; the block goes only on the page the merchant chooses.

**Later (v2, needs third parties):** live carrier tracking through a data provider (priced per shipment),
prepaid label purchase, exchanges and store credit, branded email and SMS, return protection fee at checkout.

**Decisions for Omar:**
- Is v1 limited to refunds (no exchanges)? Recommended yes.
- Is "status comes from Shopify and the carrier link" acceptable for tracking, or do you want a paid tracking
  provider in v1 (adds a cost per shipment we would have to pass on)?
- Plan: tracking and returns both move to Growth (already in the brief). Free preview on the locked page.
- Do we ask Shopify for `read_all_orders` (review needed) so older orders can be looked up?

## Sources
- AfterShip help center, Plans & Billing: tracking-helpcenter.aftership.com (Essentials $11, Pro $119, Premium $239)
- AfterShip Returns help center and Shopify listing: returns-helpcenter.aftership.com, apps.shopify.com/returns-center-by-aftership
- Parcel Panel / CWILL pricing: parcelpanel.com/pricing
- Track123 Shopify listing and pricing: apps.shopify.com/track123, intercom.help/track123
- 17TRACK Shopify listing: apps.shopify.com/17track
- Loop Returns pricing: loopreturns.com/pricing
- Redo (reviews and AfterShip comparison, August 2026): ecommercefastlane.com/redo-review, aftership.com/blog/aftership-vs-redo
- ReturnGO Shopify listing: apps.shopify.com/returngo
- Shopify returns help and developer docs: help.shopify.com (returns), shopify.dev (returns apps, FulfillmentEvent)

## 8. Omar's decisions (2026-10-17)

- **Returns v1: refunds only.** Real Shopify returns, approve/decline, refund and restock, return rules.
  Exchanges and store credit are v2.
- **Tracking: Shopify data only.** Status, tracking number, carrier link, estimated and delivered dates
  from Shopify fulfillments; no paid carrier API. The page says clearly when only the carrier link is known.
- **Request `read_all_orders`** so older orders can be tracked and returned (Shopify reviews it; the reason
  is order lookup for the shopper's own order). Until approved, the lookup stays at 60 days.
- **Labels: the merchant uploads them** (or the shopper ships to the return address). No label provider in v1.

G4 builds section 7's v1 with these choices.

## 9. Live tracking decisions (2026-10-17, replaces "Shopify data only" in section 8)

Omar wants the Track page to show the delivery date and where the package is now, for every country,
with an easy setup. Decisions:

1. **Setup step 1 asks where tracking comes from** (changeable later in Tracking & Returns settings):
   - **Shopify data** (default, every plan, every country, free): fulfillment status, `estimatedDeliveryAt`,
     `inTransitAt`, `deliveredAt` and fulfillment `events` (status, city, province, country, message, time).
   - **Live tracking, included on Pro** with a monthly limit per store (start with 500 shipments a month,
     shown in the app as "x of 500 used"). We hold one tracking data provider account. Over the limit, or
     if the provider fails, the page falls back to Shopify data.
   - **Your own key**: the merchant pastes an API key from their shipping company or tracking service.
     No limit from us. Any plan with Tracking & Returns.
   - **Webhook link**: for carriers that push status updates; we give a per shop URL with a secret.
2. **White label.** The app and the store never name the provider: the merchant sees "CRO Toolbox live
   tracking", the shopper sees the store's own Track page. Conditions:
   - pick a provider whose terms allow white label use inside our product (check the ToS before signing up);
   - list it as a subprocessor in the privacy policy (crotoolbox.com/privacy and `/privacy`), as the App
     Store and data rules require; the UI stays unbranded;
   - send only the tracking number, carrier and destination country, never names, emails or addresses.
3. **No list of companies in the UI.** One set of generic steps ("Sign in to your shipping company or
   tracking service, open Settings → API or Developers, create a key, paste it here"). The app tests the
   key against each supported service and shows "Connected" or a clear error. Carrier is detected from
   the tracking number and Shopify's carrier name.
4. **Data order:** webhook updates, then own key, then included live tracking (Pro), then Shopify data. One
   format for all: status (Info received, In transit, Out for delivery, Delivered, Problem), current place,
   estimated delivery and the full timeline, translated to the store's language. The carrier link is
   always shown too.
5. **Polling, not live calls:** register each new fulfillment with the provider (push/webhook where the
   provider has it), cache events in our DB, refresh at most a few times a day; the shopper's page reads the
   cache. Stop after delivery or 60 days. Keys stored encrypted, shown as last 4 characters only.

### Provider prices found (third party pages, confirm on each vendor's own page before signing up)

| Provider | API on free plan | Entry API price | Note |
|---|---|---|---|
| 17TRACK | no | reportedly $119 a year for 5,000 numbers (about 2.4 cents each) | prepaid yearly packs, no rollover; cheapest for "included on Pro" |
| Ship24 | no (10 shipments) | $39 a month for 1,000 shipments, $0.045 over | monthly, per shipment |
| TrackingMore | no | reportedly $74 Pro | |
| AfterShip | unclear | from $29 a month, API maybe on a higher plan | |

Cost to us at 500 shipments a month per Pro store: about $12 a month at most at 17TRACK's pack price,
usually less. Revisit the limit once real volumes are known.
