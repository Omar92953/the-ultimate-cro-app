# Paid features: what each needs outside the code (2026-10-29)

Written after the 2026-10-28 submission was withdrawn: every paid feature must work as the app says, including the
keys, accounts and quotas it needs outside the code. Check this list before every submission.

| Feature (plan) | Needs outside the code | State |
|---|---|---|
| Plans and billing (all) | Partner Dashboard App Pricing plans with the same handles as `plans.ts`; optional `SHOPIFY_PARTNER_API_TOKEN`, `SHOPIFY_PARTNER_ORG_ID`, `SHOPIFY_APP_GID` (without them the plan is read from the Admin API) | Plans set 2026-10-25. **Remove the live-shipments meter** from Growth and Pro (live tracking is off) |
| Allow extra, usage billing (Growth, Pro monthly) | `APP_EVENTS_CLIENT_ID` and `APP_EVENTS_CLIENT_SECRET` in Render (Dev Dashboard API key) | **Missing.** Usage goes on, nothing is billed. Omar keeps the switch; add the key before the first paying store |
| Loyalty orders limit (Growth 500, Pro 2,000) | Nothing more | Works; extras billed once the App Events key is there |
| Loyalty emails (Growth, Pro) | `POSTMARK_SERVER_TOKEN`, `POSTMARK_ACCOUNT_TOKEN` in Render; Postmark account approved | **Missing.** Hidden in the app until the token is there (#321), so nothing promises them |
| Live tracking from our account | `TRACKING_PROVIDER_KEY` (17TRACK, paid quota) | **Off** (`LIVE_TRACKING`, #336) until a paying store |
| Track page tracking (Growth) | Shopify's data: nothing. Merchant's own key: `TRACKING_KEY_SECRET` in Render (encrypts keys) | Set (workboard). Ways to connect: courier's Shopify app, own key, webhook, carrier link, typed updates |
| Track and Returns pages (Growth) | Protected customer data: email approved (names not, the app never reads them) | Approved for dev stores; reviewed again at submission |
| Store credit, exchanges, auto approve (Pro) | `read_store_credit_accounts`, `write_store_credit_account_transactions`, returns scopes (in `shopify.app.toml`) | Tested on Testing 3 (workboard) |
| Klaviyo, Omnisend, Judge.me (Pro loyalty) | The merchant's own keys | Merchant side |
| Plus checkout points, customer account (loyalty) | Network access for the extensions (Partner Dashboard) | Done 2026-10-25 |
| A/B tests, up to 4 versions (Pro) | The app's discount engine (Settings → Checkout discounts) for versions that change the price | Shipped cro-toolbox-74 (#349); a live 4 version test still to run |
| Scheduled offers (Pro) | The server job (every 5 minutes, Render keeps one long running server) | Shipped (#348, #350, #351); live switch test on Testing 3 |
| Connect an AI assistant (Starter and up) | Nothing more | Tracking tools added (#336); a live connection with an AI app still to run |

## After approval

- Add to the existing order from the Track page (`docs/WORKBOARD.md`, Later).
- Live tracking from our account again once a store pays (`LIVE_TRACKING = true`, 17TRACK quota bought).
