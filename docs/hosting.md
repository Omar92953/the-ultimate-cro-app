# Hosting recommendation: Render + Supabase

Checked against Render's and Supabase's own docs on 2026-09-23. Prices change, so confirm on their
pricing pages before paying for anything.

## What actually needs hosting

Only the **admin dashboard** (the React Router app). Everything shoppers touch is hosted by Shopify:

| Part | Hosted by | If your server is down… |
|---|---|---|
| Storefront blocks, CSS and JS (theme app extension) | Shopify CDN | Still works |
| Rules, slides, bundles (metaobjects) | The merchant's store | Still works |
| Checkout discounts (discount Function) | Shopify | Still works |
| Bundle split at checkout (Cart Transform) | Shopify | Still works |
| Dashboard, install/OAuth, webhooks | **Your server** | Merchants can't open the app or install it, and webhooks fail and get retried |

So an outage never breaks a merchant's store. It only breaks the dashboard, installs and webhooks.
App Store review does exercise installs and the privacy webhooks, though, so the server must be up
and respond quickly while the app is under review.

## Render (web service)

- **Free instances spin down after 15 minutes without traffic, and take about a minute to wake**
  (Render docs, "Deploy for free"). A merchant opening the app would wait a minute, and Shopify
  expects webhook responses within seconds. Free is fine for your own testing only.
- **Use a paid instance (Starter or above) for review and real merchants.** `render.yaml` already
  says `plan: starter`. It's a paid plan, so it's your decision.
- Render reads the included `render.yaml` Blueprint: build `npm ci --include=dev && npm run build:production`,
  start `npm run start:production` (runs database migrations, then the server).

## Supabase (Postgres for sessions)

- **Free plan: 500 MB database, 2 projects, and projects pause after 1 week of inactivity.**
  With only a few merchants, a week with nobody opening the dashboard is realistic. A paused
  database means installs and the dashboard fail until you un-pause it by hand.
- **Pro plan: from $25/month**, doesn't pause, includes daily backups.
- Connection strings for Render, a long-running server: use Supabase's **Session pooler**
  (`…pooler.supabase.com:5432/postgres`) for both `DATABASE_URL` and `DIRECT_URL`. The
  transaction pooler on port 6543 is only for serverless hosts. Supabase recommends a separate
  database user for Prisma.

## My recommendation

1. **While building and testing:** `shopify app dev` needs no hosting at all (it tunnels to your
   Mac and uses local SQLite).
2. **For App Store review and launch:** Render **Starter** plus **Supabase Pro**. Or, cheaper and
   simpler, Render Starter with **Render Postgres** on a paid plan, so everything is in one
   dashboard with no inactivity pause.
3. **Avoid** Supabase Free in production (the weekly pause) and Render Postgres Free (Render's docs
   say free databases expire 30 days after creation).

The app stores only sessions, so the smallest paid database tier is plenty. Nothing paid has been
created. Tell me which option you want before I set anything up.

## Environment variables (Render → Environment)

| Variable | Value |
|---|---|
| `SHOPIFY_API_KEY` | Partner Dashboard → your app → Client ID |
| `SHOPIFY_API_SECRET` | Partner Dashboard → your app → Client secret |
| `SHOPIFY_APP_URL` | `https://<your-service>.onrender.com` |
| `SCOPES` | Same list as `shopify.app.toml` (already in `render.yaml`) |
| `DATABASE_URL`, `DIRECT_URL` | Supabase Session pooler URL |
| `NODE_ENV` | `production` |

After the server is live, set `application_url` and `redirect_urls` in `shopify.app.toml` to the
Render URL, then run `shopify app deploy`. I'll ask before running that.
