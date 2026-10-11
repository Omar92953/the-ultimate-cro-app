# Plans and billing (Shopify App Pricing)

Everything about prices and limits lives in **`app/lib/plans.ts`** — change a number there and the
whole app follows. Tutorials live in `app/lib/tutorials.ts`. The values there now are the
**proposal** (Free / Starter $9.99 / Growth $24.99 / Pro $49.99, 14-day trial) and still need
Omar's decision.

## How it works

- Billing is **Shopify App Pricing**: plans are created in the Partner Dashboard and Shopify shows
  the plan selection page. The app never charges anyone (no `appSubscriptionCreate`, no
  `billing.request`). Every "Upgrade" / "Change plan" button opens
  `https://admin.shopify.com/store/<store>/charges/<app handle>/pricing_plans` with `target="_top"`.
- `app/lib/billing.server.ts` reads the shop's plan:
  1. **Partner API `activeSubscription`** (what Shopify now recommends) when
     `SHOPIFY_PARTNER_API_TOKEN`, `SHOPIFY_PARTNER_ORG_ID` and `SHOPIFY_APP_GID` are set. The plan
     comes from the subscription's plan handle.
  2. Otherwise the Admin API `currentAppInstallation.activeSubscriptions` (the plan's name).
  - No subscription → **Free**. If the check fails, nothing is locked (a paying store must never
    lose features because of our outage); Home says the plan couldn't be checked.
  - Remembered for 1 minute per shop. When Shopify sends the merchant back with `?plan_handle=…`
    the plan is read again at once.
- **Locked features**: the app frame (`routes/app.tsx`) shows an upgrade card instead of any page
  the plan doesn't include (no 404s or errors), and `shopify.server.ts` refuses saves on those
  pages. Settings a store made before a downgrade **keep working on the store** — they just can't
  be edited until the store upgrades (decision for Omar: keep this, or switch them off).
- **Counted limits** (Free: 1 upsell, 1 cross-sell, 1 bundle or deal — counted when switched on):
  saving one more shows a message with an upgrade button. An offer can always be saved switched off.
- **Downgrade**: nothing is deleted. Per list, the first N items (in the order the app lists them —
  priority for offers, list order for bundles, then deals) stay on; the rest are switched off and
  remembered (`$app:cro_design` "plan_state"). Home shows a banner naming them. After an upgrade
  they're switched back on automatically, up to the new limit. Switching off only happens when
  the plan is confirmed (Partner API, or a subscription found by the Admin API, or the override):
  **set the Partner API variables before launch**, or Free stores won't have extras switched off. Designs 2–5 made before a downgrade
  stay on the store; the editor for them shows an upgrade card.
- **Orders a month** is a soft limit: Home shows a banner when this month's orders pass it. It
  needs `read_orders` (pending Shopify's approval); until then nothing is shown.
- Results' **holdout test** needs Growth to start; a running test can always be stopped.
- **Request a feature** (Starter and up): a card on Home opens an email to `SUPPORT_EMAIL` with the shop's name; we build the requested feature for them. Free stores see the card with an upgrade button.

## Partner Dashboard steps (Omar)

1. Partner Dashboard → **App distribution → All apps → CRO Toolbox → Distribution → Manage listing
   → (language) Edit → Pricing content → Manage → Settings → Pricing method: Shopify App Pricing**.
2. Create the plans with these **plan handles** (they must match `handle` in `plans.ts`):

   | Plan handle | Display name | Monthly | Yearly | Trial |
   |---|---|---|---|---|
   | `free` | Free | $0 | — | — |
   | `starter` | Starter | $9.99 | $99 | 14 days |
   | `growth` | Growth | $24.99 | $249 | 14 days |
   | `pro` | Pro | $49.99 | $499 | 14 days |

   Use the `highlights` lines from `plans.ts` as each plan's "Top features". If a handle has to be
   different, change `handle` in `plans.ts` to match.
3. **Welcome link** for every plan: `/app` (Shopify adds `?plan_handle=…`, and the app re-reads the plan).
4. Find the **app handle** (shown in the app's URL in the Partner Dashboard / `shopify app info`).
   If it isn't `cro-toolbox`, set `CRO_APP_HANDLE` on the server.
5. For the Partner API check: **Settings → Partner API clients → Create** with the
   *Manage apps* permission. Put the token in `SHOPIFY_PARTNER_API_TOKEN`, the number in the
   Partner Dashboard URL in `SHOPIFY_PARTNER_ORG_ID`, and the app id in `SHOPIFY_APP_GID`
   (`gid://shopify/App/<id>` or just the number). Never commit these.
6. Test each plan on the dev store (plans are free on development stores in your organization),
   then publish.

## Testing each plan locally

Set `CRO_PLAN_OVERRIDE` in `.env` (ignored when `NODE_ENV=production`) and restart `shopify app dev`:

```
CRO_PLAN_OVERRIDE=free      # or starter, growth, pro
```

Check on Free: Home shows Free as current; opening Wishlist, Header, Checkout → Payment shows the
upgrade card; saving a second active upsell shows the limit message; "New design" on a design
page becomes "More designs on Starter"; Results' holdout test shows the upgrade card. Then switch
to `starter` and open Home: anything switched off on Free comes back on.

## Referrals

Home shows each shop a code (store handle + random letters, stored in `$app:cro_design`
"referral") and a link to the App Store listing (`REFERRAL.listingUrl` in `plans.ts`). **Rewards
are not applied yet** — TODO(Omar): decide the reward and how it's given (a private plan or a
discount in Shopify App Pricing), and how a referred install is matched to the code.

## Automated checks

`npm run test:app` runs the plan-limit tests (`test/app/plans.test.ts`).
