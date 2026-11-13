# IP allowlist (Shopify deadline: 2026-11-20, 11:59 PM ET): **on since 2026-11-13**

Shopify now requires every public app that calls the Admin API to turn on an IP allowlist (changelog, 2026-11-05:
https://shopify.dev/changelog/ip-allowlists-are-now-required-for-public-apps). With it on, the app's tokens only
work from the addresses listed, so a leaked token is useless anywhere else.

- **Our deadline is 2026-11-20.** The 2026-11-12 deadline is only for apps that run bulk operations, and CRO Toolbox
  runs none (no `bulkOperationRunQuery` or `bulkOperationRunMutation` in `app/`, `extensions/` or `scripts/`,
  checked 2026-11-13).
- Missing it: delisted from the App Store and no new installs from 2026-11-20 (that would also stop the review),
  flagged in merchants' Settings → Apps, and Admin API calls fail from 2027-04-01.
- Separate deadline in the same post: expiring offline access tokens by 2027-01-01.

## Where the app calls the Admin API with its tokens

| Source | Calls the Admin API? | Allow it? |
|---|---|---|
| Render web service `cro-toolbox` (region Virginia): admin pages, webhooks, the app proxy, the 5 minute scheduled offers job, loyalty jobs, post-purchase routes, MCP tools | Yes, all of it | **Yes**: its outbound IP ranges |
| Background jobs | Run inside the same Render service (no separate cron or worker service in `render.yaml`) | Covered by the line above |
| GitHub Actions: `indexnow.yml` (this repo), "Nightly database backup" (`Omar92953/cro-toolbox-backups`) | No: IndexNow pings and a database dump, no Shopify tokens | No |
| Checkout, customer account and theme extensions | They call Shopify's own APIs from the shopper's browser or the app server, never with the app's offline tokens | No |
| `scripts/dev/seed-sections.mjs` and `shopify app dev` on Omar's Mac | Yes, but only in local development (there is one app config, `shopify.app.toml`, so local development uses the same app) | No (see "Local development" below) |

## The list to paste

Render shows the service's fixed outbound addresses: Render dashboard → `cro-toolbox` → **Connect** (top right) →
**Outbound** (read 2026-11-13). Render shares these ranges with its other services in Virginia; a Dedicated IP
(paid) would make them unique to us.

```
74.220.49.0/24
74.220.57.0/24
```

Prefer these fixed ranges over the ASN option: an ASN allows the whole hosting provider's network (every other
Render customer too), which is what Shopify suggests only for serverless hosts with changing IPs. Render gives fixed
ranges, so use them.

## Done on 2026-11-13

Ranges saved and **Enforcement on**. The test against the last 30 days: 24,703 of 25,491 Admin API calls came from
Render; the 788 others came from home connections in Egypt (Omar's Mac: local development and scripts), which are
now refused. After saving, the app loaded and saved on Testing 3 as before.

## Steps in the Dev Dashboard (to change it later)

1. Open the Dev Dashboard (dev.shopify.com) → CRO Toolbox → **Settings** → **IP allowlist** → **Manage**.
2. Add each Render outbound range from above.
3. Click **Run test**. It checks the app's Admin API traffic over the last 30 days against the list and shows any
   request that came from somewhere else. Expected: only Render traffic, plus Omar's Mac on days with local
   development.
4. Turn on **Enforcement** and **Save**.
5. Check right away: open the app on Testing 3 (Home, Offers, Loyalty) and the Track page on the storefront. A
   blocked call shows as an error in the app.

## Local development once Enforcement is on

The Dev Dashboard says dev previews on dev stores (`shopify app dev`) and Direct API access from embedded pages are
always allowed. `shopify app dev` and `scripts/dev/seed-sections.mjs` run on Omar's Mac and call the Admin API with the same app's
tokens, so they are refused from a home connection. Options: add the Mac's public IP temporarily while developing
(it changes with the internet provider), or create a separate development app (its own `shopify.app.dev.toml` and
client ID) that is never listed, so it has its own allowlist settings (check Shopify's rules for it first). Don't run `shopify app dev` against the live app during
review anyway: it rewrites the app URLs to a tunnel.

If anything looks suspicious: partner-security-reports@shopify.com.
