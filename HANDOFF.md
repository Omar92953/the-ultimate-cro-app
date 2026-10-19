# Handoff: CRO Toolbox lead role (2026-10-19)

Written by the supervisor session (Omar's Mac, Claude desktop app) that ran reviews, Shopify deploys and
Testing 3 checks from 2026-10-15 to 2026-10-19. The next session takes over ALL of that work. Everything is in
the repo; never rely on old chats. Trust `CLAUDE.md` and `docs/WORKBOARD.md` over this file where they differ.

## How to start

1. Claude desktop app → **Code** tab → new session in `~/Workspace/the-ultimate-cro-app` (or
   `~/Workspace/cro-terminal`, a second full clone of the same repo) → model **Opus 5.5**.
2. Say: **"Read HANDOFF.md and CLAUDE.md and follow them."**
3. `git fetch --prune && git checkout main && git pull`, then read `docs/TEAM.md`, `docs/WORKBOARD.md`
   (sections "Review run 2026-10-19" and "Verified on Testing 3, 2026-10-18"), `docs/submission-review.md`,
   `docs/PROJECT-GUIDE.md`, then `gh pr list`.

## Your role (what the supervisor did)

- Build, review and ship. One `claude/<topic>` branch per change → all checks → PR → (Shopify deploy if
  `extensions/`, `theme/` or `shopify.app.toml` changed) → merge → verify on Testing 3 → note it on the workboard.
- Checks: `npm run typecheck`, `lint`, `test:app`, `build`, `graphql-codegen`, `build:theme`,
  `test:storefront`, `test:functions`, `npm --prefix site run build`, `shopify app config validate`,
  `shopify theme check --path extensions/cro-storefront`. If typecheck complains about Prisma models, run
  `npx prisma generate` first.
- Deploy from the Mac: `NODE_OPTIONS=--dns-result-order=ipv4first shopify app deploy --allow-updates --message "..."`
  (deploy the reviewed commit, then merge). `shopify app versions list` shows what is live.
- Render (`https://cro-toolbox.onrender.com`) auto-deploys `main` (service `srv-db5plrnavr4c739kvhh0`). If it skips
  a merge: Render dashboard → Manual Deploy → Deploy latest commit. Server timing logs: search `[timing]`.
  `SCOPES` comes from `render.yaml` (Blueprint) and must equal `shopify.app.toml` scopes.
- Optional helper: the second Claude account runs headless from a terminal tab:
  `cd ~/Workspace/cro-terminal && claude2 -p "Read .claude-task.md and do the task in it." --model claude-opus-5-5 --permission-mode auto 2>&1 | tee .claude2-log.txt`
  (write the task to `.claude-task.md`, which is git-excluded; ask it to end with a `REPORT:` block; it cannot
  merge its own PRs, you review and merge). It is not required: you can do the work yourself.

## Testing

- **Testing 3**: `testing-3-xsslpo6d.myshopify.com`. Always use store URLs
  `admin.shopify.com/store/testing-3-xsslpo6d/...` (a store-less admin URL can land on another store).
- It is on the **Pro** test plan ($0 on dev stores). Omar approved switching plans on test stores without asking:
  `.../charges/the-ultimate-cro-app/plans/<free|starter|growth|pro>?interval=EVERY_30_DAYS|ANNUAL`.
- Storefront password: Omar types it himself in the browser pane (never type passwords).
- Test orders: Draft orders → customer Ayumu Hirano → product → Collect payment → Mark as paid, then fulfil and
  mark delivered. Orders #1001 to #1006 are used up (returns done). Returns page: `/pages/returns`;
  Track page: `/pages/track-your-order`.
- Test data on Testing 3: mix and match bundle "Guard test box" ($30, pick 2); A/B test ended with version B
  headline on the "You and your friend" upsell; #1006 has UPS test tracking 1Z999AA10123456784; Live tracking is on.
- Never modify the live store `ms6vwv-3n` (Backrooms). Never `shopify app dev clean`.

## Where things stand (2026-10-19)

- Live: Shopify **cro-toolbox-38**, Render on `main`. Website crotoolbox.com live (Cloudflare Pages).
- Shopify AI self review (`shopify doc fetch --url https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements`,
  AI Toolkit skill "App Store Review"): passes except Omar's Partner Dashboard items. Fixed 2026-10-19:
  1.1.15 (refunds only via returnProcess; no gift card or discount code paybacks; `write_gift_cards` removed) and
  2.3.1 (no typed store address on `/mcp/authorize`; one click "Open CRO Toolbox in Shopify" plus a code backup).
- Guest returns: "Refund to my original payment" or "Sign in to get store credit" (unverified whether sign in links
  a guest order; credit only when the order has a customer).
- All 54 admin pages open; 8 storefront pages show no app errors. Storefront impact estimated well under 10
  Lighthouse points (`docs/submission-review.md`).
- Live tracking: 17TRACK API trial (200 numbers, account 17track@crotoolbox.com), `TRACKING_PROVIDER_KEY` and
  `TRACKING_KEY_SECRET` set on Render.
- Email: support@, info@, features@, pro@, 17track@crotoolbox.com forward to crotoolbox.app@gmail.com.
- App Pricing plans exist in the Partner Dashboard (Free, Starter $5.99, Growth $14.99, Pro $24.99, 14 day trial),
  seen on Testing 3 on 2026-10-19. Yearly prices and the growth/free handles not yet checked.
- Omar's decisions: keep all scopes required at install (no optional scopes for launch); no feature requests
  promise anywhere (features@ is only "Suggest a feature"); UI text neutral, never first person, no dashes.

## Open work, in order

1. **Done 2026-10-19 (#198, see WORKBOARD "Plans page only").** Omar's request (2026-10-19): "I don't want Shopify's pricing_plans page to be where people subscribe, I want
   our page." Make sure every in-app link goes to `/app/plans`, whose buttons open the direct approval page
   (`planApproveUrl` in `app/lib/plans.ts`), never `/charges/<handle>/pricing_plans`; add a test. Check Shopify's
   App Pricing docs for any setting (welcome link / landing page) that keeps merchants out of the hosted page on
   install; tell Omar plainly what Shopify controls and cannot be changed. Verify yearly prices and all 4 handles
   on Testing 3 without approving anything.
2. **Omar's Partner Dashboard steps** (guide him click by click): post purchase extension access (rule 5.8.1),
   `read_all_orders` request (reason: Track page, returns and "Check against orders" beyond 60 days), then the
   App Store listing (icon, 3 to 6 screenshots 1600x900, optional video, demo screencast; text in
   `docs/listing.md`), public distribution, submit.
   Open question for Omar: ship the first version without the after purchase offer if that approval is late?
3. Needs Omar: test Connect Claude end to end (claude.ai → Settings → Connectors → `https://cro-toolbox.onrender.com/mcp`).
4. After launch: review request in the app, own style per offer type, booster CSS only where used, optional scopes if
   installs drop, blog and GEO routines, Omar's videos in the video carousel demo, Built for Shopify (50 paid installs
   and 5 reviews first). See `docs/WORKBOARD.md`.

## Talking to Omar

Short messages, often screenshots. Explain plainly, say exactly what to click, one step at a time. He likes you
to do things yourself and to test in the browser before reporting. Ask only when he must choose; when a fix forces
him to give something up, explain the trade off and ask.
