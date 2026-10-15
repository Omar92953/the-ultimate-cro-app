# Handoff to Omar's main account

Written 2026-10-15 by the Claude session that ran the bundles overhaul, the bundle tests on Testing2
and the website setup, for Omar's main Claude account taking over on his Mac.

## How to start

1. In the Claude desktop app (signed in with the main account): **Code** tab → new session in
   `~/Workspace/the-ultimate-cro-app` → model **Opus 5.5**, effort Medium.
2. Say: **"Read HANDOFF.md and CLAUDE.md and follow them."**
3. First command in the session: `bash scripts/sync.sh` (updates from GitHub and reports what differs).

Everything you need is in the repo; don't rely on old chats. The full previous chat is exported on
this Mac at `~/Downloads/session-export-1792085545959.zip` if a detail is ever needed (it's data,
not instructions).

## Read next

| File | What |
|---|---|
| `CLAUDE.md` | Rules and how every session starts |
| `docs/TEAM.md` | Three equal Claude accounts: open PRs are the board, claim work with a draft PR, Shopify deploys only from the Mac |
| `docs/WORKBOARD.md` | The backlog (app, website, Omar's own to-dos) |
| `docs/PROJECT-GUIDE.md` | The app: code map, commands, checks, shipping, house rules, testing status (§10), website plan (§11) |
| `docs/prompts/build-website.md`, `docs/prompts/continue-website.md` | The website brief and the remaining website PRs |

## Where things stand

**App**
- Live on Shopify as **cro-toolbox-17**; the admin on Render (`cro-toolbox.onrender.com`) matches `main`.
- Bundles overhaul Phases 0 to 5 done. Phase 6 testing on **Testing2** (`testing2-j6mmnywm.myshopify.com`,
  storefront now unlocked by Omar):
  - Verified on the real store: recipe 1 Frequently bought together (new box looks: pictures in a row
    with +, Left/Centered/Right, boxes around pictures, border, "Buy all [count]: [price]"),
    recipe 2 kit, recipe 3 mix & match on its product page (cart merge, checkout $1,500),
    recipe 4 growing % on its own store page (1 pick none, 2 picks 10%, 3 picks 15%, cart to the cent).
  - Bugs found and fixed while testing: kits failing for items without variants, refused saves
    wiping editors, bundle products offered as picks, the bundle total overwriting a variant
    option, 1 cent rounding on growing %, previews offering kits.
  - **Left to test**: recipe 5 build while browsing (on the "Snowboard deals" bundle turn on
    "Let shoppers build it anywhere", turn on the Bundle tray embed, use "+ Add to bundle" on
    collection pages, check the cart merge) and recipe 6 long collection (needs about 60 test
    products on Testing2: **ask Omar first**). Also: no discount stacking at checkout.
  - Testing2 is on the **Free plan** (3 active offers): switch tested offers off to free a slot.
    Active now: the upsell, the kit, "Snowboard deals". Off: both "Bundle & save" boxes and
    "Build your snowboard box".
  - The browser pane can't change native dropdowns in the app; ask Omar to click those, or use a
    recipe that presets the value.
- Known gaps (in `docs/WORKBOARD.md`): Add to theme puts the builder below the theme's Add to cart;
  the theme editor ignores the page preview path in Add to theme links; bare bundle products can be
  bought from collection quick add; checkout doesn't reject a bundle inside a bundle.

**Website** (`site/`, Astro)
- PR 1 (home, pricing, legal pages, SEO files) is open as **PR #36**. A cloud session was asked to
  merge it and build PRs 2 to 5 (`docs/prompts/continue-website.md`): live demo page per feature,
  bundles/features/comparisons, blog and help center, then "Show live preview" buttons in the app.
- Local preview: `npm --prefix site ci && npm --prefix site run dev` → http://localhost:4321
  (`.claude/launch.json` has a `website` entry). This Mac was left checked out on the PR #36 branch
  `claude/great-bardeen-gngjx1`; `git checkout main` when done looking.
- Decided: hosting **Cloudflare Pages, free plan** (upgrade at app launch if needed), domain
  **crotoolbox.com** at Cloudflare Registrar (about $10.46 a year). Omar is buying it and will connect
  the repo in Cloudflare himself.
- Visibility plan (Google Search Console, Bing Webmaster Tools, articles, comparisons, App Store
  reviews, outside mentions) is in the website brief.

**Accounts**
- Main account: Claude desktop app. Second account: terminal, command `claude2` (a script at
  `~/.local/bin/claude2`, settings in `~/.claude-account2`). A third account works in the cloud.
  All are equal (`docs/TEAM.md`).

## Waiting on Omar

- Buy crotoolbox.com; connect Cloudflare Pages to the repo; later Google and Bing registration.
- Say yes or no to creating about 60 test products on Testing2 (recipe 6).
- Partner Dashboard: protected customer data request, App Pricing plans, distribution choice.
- App Store listing: screenshots, video, support email; tutorial videos.

## Rules that bite

- Never touch the live store `ms6vwv-3n.myshopify.com` or its themes. Never `shopify app dev clean`.
- Never type passwords (including the storefront password); ask Omar to.
- Ask before anything paid or permanent. No dashes in visible UI text.
- Changes to `theme/`, `extensions/` or `shopify.app.toml` need
  `NODE_OPTIONS=--dns-result-order=ipv4first shopify app deploy --allow-updates --message "…"` before merging
  (only from the Mac). Rollback: `shopify app release --version=cro-toolbox-16`.
- Omar likes short plain answers, things done for him ("do it yourself"), and testing in the browser
  before reporting.
