# CRO Toolbox website

The marketing website for the CRO Toolbox Shopify app: static pages built with [Astro](https://astro.build),
in this folder of the app's repo. It has its own `package.json` and is not part of the app's build or its
Render service.

## Commands

Run from the repo root:

| Command | What |
|---|---|
| `npm --prefix site install` | Install the site's packages (once) |
| `npm --prefix site run dev` | Local preview with live reload at http://localhost:4321 |
| `npm --prefix site run build` | Type check (`astro check`) and build to `site/dist`. Must pass before every PR that touches `site/` |
| `npm --prefix site run preview` | Serve the built `site/dist` |

## Where things come from

- **Prices, trials and limits**: imported from `app/lib/plans.ts` at build time. Change a price there and
  the site follows on its next build.
- **Features and areas**: `app/lib/catalog.ts`. **Bundle types**: `app/lib/bundle-recipes.ts`.
  `src/lib/app.ts` is the only file that imports from `app/`.
- **Addresses and contact**: `src/lib/site.ts`: `SITE_URL` (or the `SITE_URL` env var), `INSTALL_URL` (the App
  Store listing; empty until it's live, so Install buttons go to "Get notified" on the home page),
  `SUPPORT_EMAIL`, the header and footer menus.
- **Page titles and descriptions**: `src/lib/pages.ts`. Each page's share image (`/og/<slug>.png`) is drawn
  from them at build time.
- `/llms.txt` and `/llms-full.txt` (for AI assistants), `/robots.txt` and the sitemap are generated at
  build time from the same sources.

## Adding a page

1. Add its title and description to `PAGES` in `src/lib/pages.ts`.
2. Create `src/pages/<name>.astro` using the `Base` layout (or `Doc` for text pages) with `page={PAGES.<name>}`.
3. Add it to `NAV` or `FOOTER` in `src/lib/site.ts` if it belongs in a menu.
4. `npm --prefix site run build`.

## Rules

- Only claim what the app does today. No invented reviews, ratings, store counts or logos.
- No dashes in visible text. Plain, short sentences.
- Every Install button uses `InstallButton` (UTM tags: `utm_source=crotoolbox_site`, `utm_medium` = page type,
  `utm_campaign` = page slug).

## Deploying

Any static host works, with **root directory `site`**, **build command `npm ci && npm run build`**,
**output directory `dist`** and Node 22. Set `SITE_URL` to the site's address (for example
`https://crotoolbox.app`) so canonical links and the sitemap use it. The host and domain are still to be
chosen with Omar.
