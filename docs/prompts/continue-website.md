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

## Step 1: PR 2, live demos (the most important part)

- A build step that renders the **real storefront blocks** with demo data, reusing
  `test/storefront/render.mjs` and `test/storefront/sections.mjs` (they already render every block
  from `theme/` with the JS/CSS in `extensions/cro-storefront/assets`). Refactor shared parts into a
  module both the tests and the site can import, without breaking `npm run test:storefront`.
- `/demo/` catalog (filter by area) and `/demo/<feature-key>/` for **every** key in
  `app/lib/catalog.ts` `FEATURES` (underscores become hyphens), all designs stacked with anchors
  `#design-1`, `#design-2`…, bundle recipes at `/demo/bundles/<recipe-key>/` (keys from
  `app/lib/bundle-recipes.ts`). Checkout-only features get faithful visual mocks.
- Interactions must work (picking bundle items, a fake cart, carousels, countdowns, tabs).
- Write `site/public/demo/index.json` (`{ key, title, url, designs }`).
- Images: if the sandbox can't download photos, commit small optimized images you're allowed to use
  (or keep illustrations) and note it in the PR for Omar.
- Now make the home page's feature strip and "See it live" links point to real demo pages (no 404s).

## Step 2: PR 3, bundles hub, features, use cases, comparisons

- Bundles hub with the 6 recipes, each linking to its demo, plus a bundle gallery of examples.
- One page per area and per main feature (what it does, who it's for, options, link to its demo).
- Use case and industry pages ("Bundles for beauty brands", "Raise average order value"…).
- `/compare/cro-toolbox-vs-<app>/` pages with honest, checkable tables; mark anything unverified.
  Never invent facts about competitors.

## Step 3: PR 4, blog, help center, tutorials

- Astro content collection `site/src/content/blog` (title, description, date, category, cover,
  author), `/blog/`, categories, article layout (table of contents, reading time, related articles,
  call to action to the matching demo). Adding an article = adding one Markdown file.
- 6 starter articles from the brief, genuinely useful, with real steps from the app.
- Help center adapted from `docs/README-merchant.md`; tutorials page ready for Omar's videos.
- `docs/website.md`: how to run, build and deploy the site, how to add an article or a demo, and the
  Visibility plan checklist for Omar (Google Search Console, Bing Webmaster Tools, IndexNow, off site
  steps), as the brief describes.

## Step 4: PR 5 (app), "Show live preview" buttons

- `app/lib/site.ts`: `SITE_URL` (`https://crotoolbox.com`) and `demoUrl(featureKey, design?)`.
- A "Show live preview" button that opens the demo in a new tab on each feature page, design page
  and Create bundle recipe card. Use `app/components/fields.tsx` and the existing UI patterns; no
  dashes in text. Run all app checks from `docs/PROJECT-GUIDE.md` §5. This touches `app/` only, so no
  Shopify deploy is needed.

## For every PR

- Branch `claude/<topic>` from an up to date `main`, draft PR first, then build.
- Checks: `npm --prefix site run build` (plus the app checks if you touched anything outside `site/`).
  Look at the pages in a browser at desktop and 375 px phone width: no horizontal scroll, no broken
  links (`/demo/...` included), no dashes in visible text.
- Before merging: `git merge origin/main`, checks again, then `gh pr merge --merge --delete-branch`.
- Update `docs/WORKBOARD.md` (tick the step) and the code map in `docs/PROJECT-GUIDE.md` in the PR.
- If you stop before the end, write in the PR what's done, what's left and how to test, so another
  account can continue.

Report to Omar after each merged PR in short plain sentences: what's new, the local preview command
(`npm --prefix site ci && npm --prefix site run dev`, then http://localhost:4321) and what to check.
