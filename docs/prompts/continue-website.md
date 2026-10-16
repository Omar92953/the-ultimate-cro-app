# Prompt: finish the website (PR 1 merge, then PRs 2 to 5)

Paste this into any Claude Code session connected to `github.com/Omar92953/the-ultimate-cro-app`
(or tell it: "Read docs/prompts/continue-website.md and do it").

---

You are finishing the CRO Toolbox marketing website in `site/`. Several Claude accounts work on this
repo at once, so start exactly like this:

1. `git fetch --prune && git checkout main && git pull`
2. Read `CLAUDE.md`, `docs/TEAM.md`, `docs/WORKBOARD.md`, then run `gh pr list`. Don't work on files
   another open PR is changing; claim each step below with a draft PR before writing code.
3. Read the full brief `docs/prompts/build-website.md` (pages, live demos, SEO/GEO, visibility plan,
   honesty and design rules) and `docs/PROJECT-GUIDE.md` (house rules: no dashes in visible text,
   never touch the live store, ask Omar before anything paid).

Decisions already made by Omar: hosting **Cloudflare Pages (free plan)**, domain **crotoolbox.com**
(Omar buys it and connects the repo himself). Until then, `INSTALL_URL` stays empty ("Get notified").

## Step 0: merge website PR 1

PR #36 (`claude/great-bardeen-gngjx1`, "Website PR 1") is open. Check it out, merge `origin/main`
into it, run `npm --prefix site ci && npm --prefix site run build` and the app checks it touched
(`npx tsc --noEmit`, `npm run lint`, `npm run test:app`, `npm run build`), fix anything, push, then
`gh pr merge 36 --merge --delete-branch`. If it was already merged, skip this.

## Step 1: PR 2, live demos on crotoolbox.com/demo (hidden)

Changed by Omar on 2026-10-15: the live demos are **not part of the public website**. They live on
their own subdomain, crotoolbox.com/demo, open only from the app's "See live demo" buttons, and are
hidden from search. Full rules in `docs/prompts/build-website.md` ("Live demos") and `docs/website.md`.

- A separate static build in `demos/` (output `demos/dist`) that renders the **real storefront
  blocks** with demo data through the shared renderer `test/storefront/engine.mjs` (also used by
  `npm run test:storefront`, which must keep passing).
- `/<feature-key>/` for **every** key in `app/lib/catalog.ts` `FEATURES` (underscores become hyphens),
  designs stacked as `#design-1`, `#design-2`…, bundle recipes at `/bundles/<recipe-key>/` (keys from
  `app/lib/bundle-recipes.ts`). Checkout-only features get faithful visual mocks. A top bar with the
  feature name, Desktop/Phone and "Install CRO Toolbox"; no navigation between demos.
- Hidden: `noindex, nofollow` on every page, `_headers` with `X-Robots-Tag`, robots.txt `Disallow: /`,
  no sitemap, no list of demos, `/` redirects to crotoolbox.com.
- `app/lib/site.ts`: `SITE_URL`, `DEMO_URL`, `APP_STORE_URL`, `demoUrl()`, `DEMOS`; the demo build fails
  when `DEMOS` and the built demos differ.
- The website (`site/`) has no links to the demos and no `/demo/` pages.
- `docs/website.md`: how to build both, and the Cloudflare steps for Omar (second Pages project
  `cro-toolbox-demos`, root `demos`, custom domain crotoolbox.com/demo).

## Step 2: PR 3, bundles hub, features, use cases, comparisons

- Bundles hub with the 6 recipes (screenshots or short videos), plus a bundle gallery of examples.
- One page per area and per main feature (what it does, who it's for, options, screenshots or short
  videos). No links to the live demos.
- Use case and industry pages ("Bundles for beauty brands", "Raise average order value"…).
- `/compare/cro-toolbox-vs-<app>/` pages with honest, checkable tables; mark anything unverified.
  Never invent facts about competitors.

## Step 3: PR 4, blog, help center, tutorials

- Astro content collection `site/src/content/blog` (title, description, date, category, cover,
  author), `/blog/`, categories, article layout (table of contents, reading time, related articles,
  call to action to the matching feature page and the App Store). Adding an article = adding one Markdown file.
- 6 starter articles from the brief, genuinely useful, with real steps from the app.
- Help center adapted from `docs/README-merchant.md`; tutorials page ready for Omar's videos.
- Extend `docs/website.md` (made in PR 2): how to add an article, and the Visibility plan checklist for Omar (Google Search Console, Bing Webmaster Tools, IndexNow, off site
  steps), as the brief describes.

## Step 4: PR 5 (app), "See live demo" buttons

- `app/lib/site.ts` (made in PR 2) has `SITE_URL`, `DEMO_URL`, `demoUrl(featureKey, design?, recipe?)`
  and `DEMOS`.
- A "See live demo" button that opens the demo in a new tab (`target="_blank"`) on each feature's main
  page, each design page (that design's `#design-N`) and each recipe card in Bundles → Create bundle,
  shown only for keys in `DEMOS`. Use `app/components/fields.tsx` Button and the existing UI patterns;
  no dashes in text. Run all app checks from `docs/PROJECT-GUIDE.md` §5. App only, so no Shopify
  deploy is needed; it can merge on its own.

## For every PR

- Branch `claude/<topic>` from an up to date `main`, draft PR first, then build.
- Checks: `npm --prefix site run build`, `npm --prefix demos run build` when demos or the storefront
  code changed (plus the app checks if you touched anything outside `site/` and `demos/`). Look at
  the pages in a browser at desktop and 375 px phone width: no horizontal scroll, no broken links,
  no dashes in visible text, and no link from the website to the demos.
- Before merging: `git merge origin/main`, checks again, then `gh pr merge --merge --delete-branch`.
- Update `docs/WORKBOARD.md` (tick the step) and the code map in `docs/PROJECT-GUIDE.md` in the PR.
- If you stop before the end, write in the PR what's done, what's left and how to test, so another
  account can continue.

Report to Omar after each merged PR in short plain sentences: what's new, the local preview command
(`npm --prefix site ci && npm --prefix site run dev`, then http://localhost:4321) and what to check.
