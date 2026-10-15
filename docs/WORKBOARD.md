# Workboard

The backlog for all accounts (see `docs/TEAM.md`). What's being worked on right now is in the open
pull requests (`gh pr list`). Update this file in the PR that finishes or adds an item.
Updated 2026-10-15.

## App

- [x] Bundles overhaul Phases 0 to 5 (`docs/plans/bundles-overhaul.md`)
- [ ] **Phase 6 testing on Testing2** (needs a session on the Mac): recipes 1 to 5 verified; left: recipe 6 long collection (needs about 60 test products;
      ask Omar), checkout with no discount stacking. Status in `docs/PROJECT-GUIDE.md` §10.
- [ ] "See live demo" buttons in the app (`demoUrl()` and `DEMOS` in `app/lib/site.ts`), opening
      the hidden demos on demo.crotoolbox.com (website PR 5)
- [ ] Review request in the app ("Enjoying CRO Toolbox?"), after launch
- [ ] Known gaps: Add to theme places the builder below the theme's Add to cart; a bare bundle
      product can be bought through collection quick add buttons; checkout doesn't reject a bundle
      product picked inside a bundle

## Website (`site/`, brief: `docs/prompts/build-website.md`, next steps: `docs/prompts/continue-website.md`)

- [x] PR 1: scaffold, home, pricing, legal pages, sitemap, llms.txt (PR #36)
- [x] PR 2: hidden live demos for every feature in `demos/` (demo.crotoolbox.com), `app/lib/site.ts`,
      no demo links on the website, `docs/website.md` (PR #43)
- [ ] PR 3: bundles hub, features, use cases, comparisons
- [ ] PR 4: blog (6 articles), help center, tutorials page
- [ ] PR 5 (app): "See live demo" buttons
- [ ] Deploy on Cloudflare Pages (free plan): `cro-toolbox-site` with crotoolbox.com and
      `cro-toolbox-demos` with demo.crotoolbox.com (Omar connects both; steps in `docs/website.md`)
- [ ] Demos: replace the MDN sample clips in the video carousel demo with Omar's product videos

## Omar (outside the code)

- [ ] Buy crotoolbox.com at Cloudflare Registrar, create the two Cloudflare Pages projects
      (`docs/website.md`)
- [ ] Google Search Console and Bing Webmaster Tools once the site is live
- [ ] Partner Dashboard: protected customer data request, App Pricing plans, distribution
- [ ] App Store listing: screenshots, video, support email; tutorial videos
