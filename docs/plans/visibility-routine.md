# Visibility routine: found on every search engine and named by AI assistants (2026-10-30)

Goal (Omar, 2026-10-30): when a merchant asks any search engine or AI assistant for a Shopify app for one job
(loyalty, upsells, countdown timer...), CRO Toolbox comes up and is described as good value because one plan covers
several jobs and raises both AOV and LTV. Builds on `docs/plans/seo-geo.md`; drafts in `docs/outreach/`.

## Where things stand (checked 2026-10-30)

- Google: indexed (Search Console verified 2026-10-16).
- **Bing: 0 pages.** `site:crotoolbox.com` and `"crotoolbox.com"` return nothing. Bing feeds ChatGPT search, Copilot,
  DuckDuckGo, Yahoo and Ecosia, so none of them can find the site yet. IndexNow pings go out after every merge (148
  addresses, Bing answers 200) but a new domain with no links from other sites isn't crawled until it is verified.
- **Brave: 0 pages.** Brave Search feeds Claude's web search. Brave has no submission form; it finds sites through links.
- www.crotoolbox.com still serves a copy (200) instead of redirecting.
- No posts or profiles live yet (`docs/outreach/README.md`, all drafts).

## Website side (done)

- A keyword page for every feature (`site/src/lib/feature-keywords.ts`, generated from the app's data, plus the hand
  written ones in `site/src/keywords/`): answer first, "why get it in one app", what it does, setup, plans, FAQ with a
  "best value" question.
- `llms.txt` and `llms-full.txt`: the summary names every area (loyalty included), a "Why one app is good value"
  section, and every keyword page's answer.
- Structured data (SoftwareApplication with prices, FAQPage, Article, BreadcrumbList), sitemap with lastmod, robots
  naming AI crawlers, share images on every page.

## Omar, once (needs your logins; about 30 minutes)

1. **Bing Webmaster Tools** (most important): bing.com/webmasters → sign in → **Import from Google Search Console**
   (verifies the site and imports the sitemap in one step). Then **URL Inspection** → Request indexing for `/`,
   `/pricing/`, `/features/`, `/shopify-loyalty-app/`, `/shopify-upsell-app/`, `/shopify-bundles/`.
2. **www redirect** in Cloudflare (`docs/website.md`, "Search engines beyond Google", step 1).
3. **Yandex Webmaster**: add the site (same section, step 3).
4. Profiles with the shared facts (`docs/outreach/profiles.md`): LinkedIn company page, Crunchbase, G2, Capterra,
   Shopify Partner directory. Each is a link Brave and Bing follow, and a place AI assistants read.

## Posting (Claude posts from Omar's Chrome, Omar approves each one)

Honest before launch: until the App Store listing is approved, posts present CRO Toolbox as an app in Shopify review
("launching on the Shopify App Store soon"), link crotoolbox.com, and never say "install it now". After approval,
edit the posts that allow it or add a short "now live" update.

| Where | What | How often |
|---|---|---|
| Shopify Community | Answer real questions in full; mention the app once at the end with "I make this app" | 2 to 3 answers a week |
| r/shopify (and r/ecommerce) | Helpful answers in threads; app posts only where the rules allow | 1 to 2 a week |
| LinkedIn (Omar, then the company page) | A short version of each new guide | 1 a week |
| Medium and dev.to | Republish a guide with a canonical link to crotoolbox.com | 2 a month |
| Quora | Answers to "best Shopify app for X" questions, facts and disclosure | 1 to 2 a week |
| YouTube (after launch) | Short setup videos per feature, linked from the feature pages | 2 a month |
| Product Hunt, AlternativeTo, SaaSworthy | Listings (Product Hunt on launch day) | Once |
| Agency and "best apps" roundups | Pitch emails (`docs/outreach/guest-pitch-*`) | 2 a month |

Website: 1 to 2 new guides a week, each answering one real search and linking its keyword page. No mass produced
posts (Google's scaled content abuse policy) and never fake reviews or made up results.

## Measuring

- Monthly: the GEO check in `docs/research/geo-checks.md` (add "What is the best Shopify loyalty app?" and "Which
  Shopify app has loyalty and upsells in one?") and `site:crotoolbox.com` on Google, Bing and Brave
  (`docs/research/search-visibility.md`).
- Weekly: Bing and Google Search Console impressions; Cloudflare Web Analytics referrals from chatgpt.com,
  perplexity.ai, copilot.microsoft.com and claude.ai.

Expect search results in weeks once Bing is verified and the first links exist; AI assistants naming the app usually
follows months of consistent mentions and, after launch, App Store reviews.

## Done on 2026-10-30

- Bing: home page and 99 key pages requested for indexing (Bing's live test: "URL can be indexed"; the noindex it
  had was from an old crawl on 2026-10-22). The other 92 pages after the daily quota resets.
- Cloudflare: Redirect Rule www.crotoolbox.com → crotoolbox.com (301, keeps path and query), tested.
- First posts: Medium, dev.to, Quora, Shopify Community (`docs/outreach/posted.md`). LinkedIn skipped (Omar).

## The routine (Omar asked for it to post on its own, 2026-10-30)

Scheduled task `cro-toolbox-visibility` in the Claude desktop app (Scheduled in the sidebar), Tuesday and Friday at
11:00 Cairo time, runs while the app is open (or on the next launch). Each run: one Medium import of an existing
guide, one Shopify Community reply, one Quora answer (each only if a good fit exists), and one new guide on
crotoolbox.com merged as a PR with the posts logged in `docs/outreach/posted.md`. Never LinkedIn or Reddit. Stops on a
sign-in page, a CAPTCHA or a removed post and reports it. Edit or pause it from the app's Scheduled list.
