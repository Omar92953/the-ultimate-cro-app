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

## Status (2026-10-24)

- Live: Shopify app version **cro-toolbox-72**, admin on Render (`https://cro-toolbox.onrender.com`,
  auto-deploys from `main`; if Render skips the last merge, Manual Deploy → Deploy latest commit).
  Test store: **Testing 3** `testing-3-xsslpo6d`, on the **Pro** test plan.
- Loyalty is complete on Growth and Pro (`docs/plans/loyalty.md`): parts 1 to 11, languages (#295, 7 built in
  translations, right to left #296), guest checkouts (#298, Earn points → Orders placed as a guest; the program's
  count-from date `LoyaltyProgram.countFrom`), and the Points shop (`docs/plans/points-shop.md`: #292, #300, #299,
  live fixes #301 to #303). Usage limits and extras per plan (#271).
- Deep audit 2026-10-23 to 24 done: `docs/audit-2026-10-23.md` (#274 to #291).
- Discount code box has its own card in the Cart group (#294). Website: loyalty pages live (#293).
- Testing 3 test data: Points shop on with The Collection Snowboard: Hydrogen (only with points, 2,500 points, in the
  "Points shop" collection); loyalty language Arabic saved; test discount GUARDTEST100 (100% off two collections)
  still active: deactivate it in Discounts when done.
- The second account (claude2) is no longer used (Omar, 2026-10-24): the lead does all the work.
- Waiting for Omar: Postmark tokens in Render (emails send nothing until then), App Events API key in Render (usage
  billing), installing Shopify Flow on Testing 3, the single Partner Dashboard update (new prices, usage meters,
  protected customer data, network access, listing). New prices are in the code only.
- Website: keyword pages and alternative pages live (SEO plan `docs/plans/seo-geo.md`).
- Email: support@, info@, features@, pro@, 17track@, omar@, postmark@crotoolbox.com forward to crotoolbox.app@gmail.com (Cloudflare Email Routing).
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
- Storefront Liquid is edited in `theme/` and built with `npm run build:theme`; 29 of 30 theme blocks (Header back as its own block, 2026-10-19; one shared "CRO section" block for 8 sections, 2026-10-20; Hero banners removed and Image carousel 2 `ucs-coverflow` added, 2026-10-21) and 91 of 100 KB of Liquid (both enforced by Shopify; counted 2026-10-21)
  are used, so new storefront features go into existing blocks/embeds.
- Shopify silently drops Function metafields over 10,000 bytes; `cro.server.ts` enforces 9,500.
- Discount Functions and Cart Transform from custom-distribution apps only run on Plus, so Omar's
  non-Plus store needs the public App Store version.

## Talking to Omar

Short messages, often screenshots. Explain plainly, say exactly what to click, one command at a time.
He likes you to do things yourself ("do it yourself") and to test in the browser before reporting.
Ask questions as plain text he can answer freely, never as boxes with prebuilt answer buttons (Omar, 2026-10-20).
