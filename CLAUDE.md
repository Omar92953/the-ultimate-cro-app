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

## Status (2026-10-18)

- Live: Shopify app version **cro-toolbox-34**, admin on Render (`https://cro-toolbox.onrender.com`,
  auto-deploys from `main`; if Render skips the last merge, Manual Deploy → Deploy latest commit).
  Test store: **Testing 3** `testing-3-xsslpo6d` (back on the Free plan; switch to a $0 test plan to test paid features).
- Block G done: G1 to G11, MCP read/build tools (offers, discounts, bundles). Tested on Testing 3 on
  2026-10-18: Track page (prices, next order code, buy again, timeline by webhook), returns (request,
  approve, refund confirm, Shopify reason), wishlist page, cart discount box, size guide. Open bugs in
  `docs/WORKBOARD.md` ("Testing 3 run 2026-10-18").
- Website: keyword pages and alternative pages live (SEO plan `docs/plans/seo-geo.md`).
- Email: support@, info@, features@, pro@, 17track@, omar@crotoolbox.com forward to crotoolbox.app@gmail.com (Cloudflare Email Routing).
- Partner Dashboard: protected customer data saved (works on dev stores; reviewed at submission).

## Website

- `site/`: Astro static site, its own `package.json`. `npm --prefix site ci`, `npm --prefix site run dev`
  (http://localhost:4321), check with `npm --prefix site run build`. Reads prices and features from
  `app/lib/plans.ts`, `catalog.ts` and `bundle-recipes.ts`, so changing those changes the site too.
- Hosting: Cloudflare Pages (free plan), domain crotoolbox.com. Deploys itself when `main` changes.
- `demos/`: the live demos, served at https://crotoolbox.com/demo/ by the website build
  (`npm --prefix site run build` builds them and copies them into `site/dist/demo/`), hidden from
  search and opened only from the app ("See live demo", `app/lib/site.ts`). The website links to them
  only from the keyword pages (`rel="nofollow"`, new tab; Omar, 2026-10-18). Details: `docs/website.md`.

## App Store listing images

Design system for the feature image and screenshots: `branding/listing/README.md` (approved style, templates,
`scripts/listing/capture.sh` and `render.sh`). Use it for any listing or marketing image.

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
