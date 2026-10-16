# App Store submission review — CRO Toolbox (2026-10-17)

Replaces the 2026-10-07 review (all its code findings are fixed: no 404 deal pages, privacy
webhooks act on stored data, sales pop-ups show each purchase once, no evergreen countdown, no
review markup for typed reviews). Requirements re-fetched today with `shopify doc fetch`
(app-store-requirements and app-store-ai-self-review-requirements).

## Verdict

**Not ready to submit yet.** The code passes every check, and the Shopify-side basics (session
tokens, GraphQL only, App Pricing, theme app extension only, compliance webhooks with HMAC, TLS)
are in place. Three things would get it rejected, plus the Partner Dashboard steps only Omar can do:

1. **After purchase offer had no CalloutBanner** (rule 5.8.7). Fixed in PR #95; needs a Shopify deploy.
2. **"See live demo" buttons open a dead page** (2.1.1): `crotoolbox.com/demo` does not exist.
3. **Post purchase extensions need Shopify's approval** (5.8.1: `write_checkout_extensions_apis`
   is granted by Shopify after a request). Until it's approved, the after purchase offer can't
   run on merchants' stores.

## Summary

Checks (2026-10-16/17, all pass): typecheck, lint, test:app 35, build, graphql-codegen,
build:theme (29 of 30 blocks, 86.9 KB of 100 KB Liquid), test:storefront, test:functions 71,
`shopify theme check`, `shopify app build`. Storefront JS ≤ 8.2 KB gzipped per file (limit 10).
Function input queries ≤ 805 bytes (limit 3000). No parser blocking scripts, no REST Admin API,
no ScriptTags or theme file writes, 56 theme editor deep links.
Production: `/` 200 in 0.5 s, `/privacy` 200, crotoolbox.com `/privacy/` and `/support/` 200;
`/webhooks/compliance` and `/webhooks/app/uninstalled` answer 401 without a valid HMAC.

## Findings

| # | Severity | Where | What's wrong | Fix |
|---|---|---|---|---|
| 1 | **Blocker** | `extensions/cro-post-purchase/src/index.jsx` | 5.8.7: the offer must show exactly one CalloutBanner at the top with intro text, product name and discount. D6 removed it. | PR #95 brings it back (app preview too). Deploy, then merge. |
| 2 | **Blocker** | `app/lib/site.ts` (`DEMO_URL`), `app/components/DemoButton.tsx` | 2.1.1: every "See live demo" button opens `crotoolbox.com/demo`, which does not resolve. | Create the Cloudflare Pages project `cro-toolbox-demos` (`docs/website.md`), or hide the buttons until it's live. |
| 3 | **Blocker** (Partner Dashboard) | `extensions/cro-post-purchase` | 5.8.1: post purchase extensions need Shopify's access approval (`write_checkout_extensions_apis`). | Request access in the Partner Dashboard, or leave the after purchase offer out of the first submission. |
| 4 | Should fix | `shopify.app.toml` (`read_orders`), `webhooks.orders.create.tsx` | Protected customer data not requested; the `orders/create` subscription is commented out until it is. | Request it (answers in `docs/listing.md` section 4), then turn the webhook back on and deploy. |
| 5 | Should fix | Admin after a save | First page load after a save or plan change takes about 15 s on Testing 3 (repeat visits under 5 s). A reviewer clicking around may see long blank pages (2.1.2). | Block D follow up F3 (terminal account). |
| 6 | Should fix | `app/components/DeleteOffer.tsx` | Deleting an offer with unsaved edits leaves Shopify's "Unsaved changes" bar stuck with a spinning Save (2.1.2 minor error). | Block D follow up F1. |

Passing on review of the code: sales pop-ups use real orders and show each once
(`ucs-boosters.js:185`); countdowns have no per-visitor restart; reviews emit no Review JSON-LD
(only FAQPage on the FAQ block); `Math.random` is used only for element ids and cart line ids;
the after purchase offer has preset "Pay now" / "Decline this offer" buttons, the price
breakdown (subtotal, shipping, taxes, total), one offer at a time and returns via `done()`.

## Partner Dashboard checklist (state on 2026-10-17)

The listing is a **Draft**; distribution is public (App Store).

- [x] Supported API versions, configuration issues fixed
- [ ] Emergency developer contact (email and phone) — Omar types it
- [ ] Listing content (English): text in `docs/listing.md` section 1, icon `branding/app-icon.png`,
      3 to 6 screenshots 1600 x 900, feature image or video, screencast (section 3)
- [ ] Protected customer data request (section 4 answers)
- [ ] Post purchase extension access request (finding 3)
- [ ] Select the app's capabilities, then the embedded app checks
- [ ] AI self review: done as this report; tick "I've reviewed all the App Store Requirements"
- [ ] Automated checks (install, redirect, webhooks, HMAC, TLS): run last, they expire after 30 days
- [ ] Submit for review

## Needs live verification (Testing 3)

Install and reinstall (OAuth straight away, lands in the app), uninstall cleans sessions,
storefront blocks on a product page (needs the storefront password), checkout discounts,
Lighthouse impact of the embeds (≤ 10 points), the setup guide ticking itself (D8).
