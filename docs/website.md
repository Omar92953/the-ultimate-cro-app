# Website and live demos

Two separate static sites live in this repo, next to the app. Both deploy on Cloudflare Pages (free
plan), each as its own project.

| | Website | Live demos |
|---|---|---|
| Folder | `site/` (Astro) | `demos/` (Node script, renders the real theme blocks) |
| Address | https://crotoolbox.com | https://demo.crotoolbox.com |
| Public? | Yes: sitemap, robots.txt, llms.txt, made to rank | **No**: every page `noindex, nofollow`, robots.txt `Disallow: /`, no sitemap or list of demos, `/` redirects to crotoolbox.com |
| Opened from | search, AI assistants, links | **only** the app's "See live demo" buttons (`demoUrl()` in `app/lib/site.ts`) |
| Cloudflare project | `crotoolbox` (live) | `cro-toolbox-demos` (to set up) |

The website never links to the demos, and the demos don't link to each other or to the website pages
(only the "Install CRO Toolbox" button to the App Store listing).

## Run and check locally

From the repo root:

```bash
npm --prefix site ci && npm --prefix site run dev          # website at http://localhost:4321
npm --prefix site run build                                 # must pass before merging (type check + build)

npm --prefix demos ci && npm --prefix demos run build       # demos into demos/dist (fails if out of sync, see below)
npm --prefix demos run preview                              # http://localhost:4322/upsell/ etc.
```

The demo build needs Node 22.18 or newer (it loads the app's TypeScript files directly).

## The live demos

- Addresses: `/<feature>/` for every feature key of `app/lib/catalog.ts`, underscores as hyphens
  (`cross_sell` → `/cross-sell/`), each design as `#design-1`, `#design-2`…; bundle recipes at
  `/bundles/<recipe>/` (`fbt`, `kit`, `mixmatch`, `growing`, `browse`, `any-n`). Build them in code with
  `demoUrl(featureKey, design?, recipe?)` from `app/lib/site.ts`.
- Each page: a top bar (feature name, Desktop/Phone, Install CRO Toolbox), then every design stacked,
  each one a demo store page ("Lumen Goods") in an iframe. Interactions work: add to cart, bundles,
  carousels, countdowns, tabs; a fake store backend in the page answers the storefront scripts.
- What is real: the Liquid blocks from `theme/`, the JS and CSS from `extensions/cro-storefront/assets`,
  the designs made with the app's own templates and save functions (`app/lib/*-design.ts`). Checkout
  features (payment and delivery rules, order limits, thank-you page, after-purchase offer) are faithful
  pictures, since checkout only runs inside Shopify.
- Product pictures are drawn as SVG (`site/src/lib/art.ts`); the video carousel uses public domain
  (CC0) sample clips from MDN until Omar has product videos.
- Kept in sync: `DEMOS` and `DEMO_RECIPES` in `app/lib/site.ts` list what has a demo (the app shows the
  button only for those). The demo build fails when a catalog feature has no demo, a demo isn't in
  `DEMOS`, or `DEMOS` lists something without a demo. It also fails on invalid JSON passed to a
  storefront script and on any page without `noindex`.

### Adding or changing a demo

- A new feature: add it to `demos/src/features.mjs` (render its block with the app's templates, like
  the others) and to `DEMOS` in `app/lib/site.ts`, then `npm --prefix demos run build` and look at it.
- Demo products, reviews, questions: `demos/src/data.mjs`. The demo store page: `demos/src/shell.mjs`.
  The viewer page (top bar): `demos/src/viewer.mjs`. Checkout pictures: `demos/src/checkout.mjs`.
- The shared Liquid engine is `test/storefront/engine.mjs` (also used by `npm run test:storefront`).

## Deploying on Cloudflare Pages (Omar does this once in the dashboard)

Never type passwords for Claude; these are clicks in your own Cloudflare account.

### 1. The website (crotoolbox.com): live since 2026-10-15

Cloudflare Pages project `crotoolbox`: root directory `site`, build command `npm run build`, output
directory `dist`, environment variable `NODE_VERSION` = `22`, custom domains crotoolbox.com and
www.crotoolbox.com. It rebuilds on every push to `main`.

### 2. The live demos (demo.crotoolbox.com): to set up

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → the repo
   `Omar92953/the-ultimate-cro-app`.
2. Project name `cro-toolbox-demos`, production branch `main`.
3. Build settings: Framework preset **None**; Root directory `demos`; Build command `npm run build`;
   Build output directory `dist`.
4. Environment variables (Production and Preview): `NODE_VERSION` = `22` (the build needs 22.18 or
   newer; `22` gives the newest 22).
5. **Save and Deploy.** Until the domain is ready the demos work at `cro-toolbox-demos.pages.dev`
   (for example `https://cro-toolbox-demos.pages.dev/upsell/`).
6. Project → **Custom domains** → **Set up a custom domain** → `demo.crotoolbox.com`. The domain is at
   Cloudflare, so the DNS record is added for you.
7. Optional, saves build minutes: Settings → Builds → **Build watch paths**, include `demos/*`,
   `theme/*`, `extensions/cro-storefront/*`, `app/lib/*`, `test/storefront/*`, `site/src/lib/art.ts`.

Both projects rebuild on every merge to `main`. Branch previews also get `*.pages.dev` addresses;
the demos stay `noindex` there too (the `_headers` file applies to every deployment).

### Check after the first deploy

- `https://demo.crotoolbox.com/` goes to crotoolbox.com.
- `https://demo.crotoolbox.com/robots.txt` says `Disallow: /`.
- Response headers of any demo page include `X-Robots-Tag: noindex, nofollow`.
- `https://crotoolbox.com/sitemap-index.xml` and `/llms.txt` don't mention demos.
