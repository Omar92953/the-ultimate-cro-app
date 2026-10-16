@AGENTS.md

# CRO Toolbox — read this first

This repo holds Omar's public Shopify app **and** its marketing website (`site/`). Omar manages both
from **three Claude accounts at once**. All three are equal: any account can work on the app or the
website. Only sessions running on Omar's Mac can deploy to Shopify (`docs/TEAM.md`).

**Every session, before anything else:**
1. `git fetch --prune && git checkout main && git pull` (taking over? read `HANDOFF.md` first)
2. Read **`docs/TEAM.md`** (who does what, how not to collide, who deploys) and
   **`docs/WORKBOARD.md`** (the backlog), then run `gh pr list` (work in progress).
3. Read **`docs/PROJECT-GUIDE.md`** for the app (code map, commands, shipping, house rules, testing)
   and **`docs/prompts/build-website.md`** for the website.
4. Claim your task with a draft PR before writing code. Never rely on chat history: other accounts
   can't see it. Leave the state in the PR and the workboard.

## Status (2026-10-15)

- Live: Shopify app version **cro-toolbox-21**, admin on Render (`https://cro-toolbox.onrender.com`,
  auto-deploys from `main`). Test store: **Testing2** `testing2-j6mmnywm.myshopify.com`.
- Bundles overhaul done: all 6 recipes and checkout verified on Testing2 (`docs/PROJECT-GUIDE.md` §10).
  Next: the known gaps in `docs/WORKBOARD.md`.
- Website: PRs 1 to 5 done, live at https://crotoolbox.com; backlog in `docs/WORKBOARD.md`.
- **Waiting: a Shopify deploy from the Mac** for the countdown timer fix (PR #58, merged). Steps in
  `docs/WORKBOARD.md` (the URGENT line).

## Website

- `site/`: Astro static site, its own `package.json`. `npm --prefix site ci`, `npm --prefix site run dev`
  (http://localhost:4321), check with `npm --prefix site run build`. Reads prices and features from
  `app/lib/plans.ts`, `catalog.ts` and `bundle-recipes.ts`, so changing those changes the site too.
- Hosting: Cloudflare Pages (free plan), domain crotoolbox.com. Deploys itself when `main` changes.
- `demos/`: the live demos, served at https://crotoolbox.com/demo/ by the website build
  (`npm --prefix site run build` builds them and copies them into `site/dist/demo/`), hidden from
  search and opened only from the app ("See live demo", `app/lib/site.ts`). The website never links to
  them. Details: `docs/website.md`.

## Rules that matter most

- **Never** modify the live store `ms6vwv-3n.myshopify.com` (Backrooms) or its themes. Test on Testing2.
- **Never** run `shopify app dev clean`.
- Ask Omar before anything paid or permanent in the Partner Dashboard. Never type passwords or
  secrets, never print `.env`.
- One `claude/<topic>` branch per change → checks → PR → merge. If `extensions/`, `theme/` or
  `shopify.app.toml` changed, `shopify app deploy --allow-updates` before merging (prefix
  `NODE_OPTIONS=--dns-result-order=ipv4first`). Only a session running on the Mac can deploy to
  Shopify; cloud sessions add "Needs Shopify deploy" to such PR titles (`docs/TEAM.md`).
- No dashes in UI text. Use `app/components/fields.tsx` wrappers, never raw `onChange` or boolean
  props on `s-*` elements. Never `slot="aside"` on a `large` page; editors use `EditorLayout`.
- Storefront Liquid is edited in `theme/` and built with `npm run build:theme`; 29 of 30 theme blocks
  are used, so new storefront features go into existing blocks/embeds.
- Shopify silently drops Function metafields over 10,000 bytes; `cro.server.ts` enforces 9,500.
- Discount Functions and Cart Transform from custom-distribution apps only run on Plus, so Omar's
  non-Plus store needs the public App Store version.

## Talking to Omar

Short messages, often screenshots. Explain plainly, say exactly what to click, one command at a time.
He likes you to do things yourself ("do it yourself") and to test in the browser before reporting.
