# SEO and GEO plan: crotoolbox.com and the App Store listing (2026-10-18)

Goal: when a merchant searches (Google, Bing, the Shopify App Store) or asks an AI assistant (ChatGPT,
Claude, Perplexity, Gemini, Copilot) about upsells, cross sells, bundles, CRO, AOV, order tracking or
returns **for Shopify**, CRO Toolbox shows up and is described correctly.

Not started. Build after the app work in Block G allows, as small website PRs (`site/`).

## What we already have

Sitemap (`@astrojs/sitemap`), `robots.txt` (allows all, hides `/demo/`), `llms.txt` and `llms-full.txt`,
JSON-LD in `Base.astro`, 6 blog posts, `/compare/*`, `/features/*`, `/use-cases/*`, `/pricing`, help center,
an IndexNow style key file in `public/`.

## 1. Shopify App Store listing (biggest and fastest)

Most merchants search inside apps.shopify.com. Name, subtitle, intro, details, feature list and the search
terms field decide it, plus reviews and installs. Put the real words there once each (upsell, cross sell,
bundles, AOV, post purchase, order tracking, returns), no stuffing (Shopify rejects it). Ask the first
merchants for reviews in the app (allowed: no incentives, no gating). Owner: me, in `docs/listing.md`.

## 2. Keyword pages (one page answers one search)

| Page | Main search |
|---|---|
| /shopify-upsell-app | shopify upsell app |
| /shopify-cross-sell | shopify cross sell, frequently bought together |
| /shopify-bundles | shopify bundles app, mix and match, quantity breaks |
| /increase-aov-shopify | increase average order value shopify |
| /shopify-cro | shopify cro app, conversion rate optimization shopify |
| /post-purchase-upsell-shopify | post purchase upsell |
| /shopify-order-tracking-page | shopify order tracking page |
| /shopify-returns-app | shopify returns, exchanges |

Each: answer first in two sentences, what it is, how CRO Toolbox does it (real screenshots and the live
demo), pricing line from `plans.ts`, FAQ (with FAQPage JSON-LD), links to the matching feature, use case,
help article and the App Store listing. Generated from `catalog.ts` where possible so it stays true.

## 3. Comparison and alternative pages

Extend `/compare/*`: "X alternative" pages for the apps merchants switch from (ReConvert, Frequently Bought
Together, Bundler, AfterShip, Loop). Facts only, dated, with sources; no claims we can't back up.

## 4. Guides (blog), 1 to 2 a week

Topics from real searches: "how to increase AOV on Shopify", "upsell vs cross sell", "best bundle offers",
"post purchase upsell examples", "Shopify return policy template", "order tracking page that sells".
Each links to its keyword page. Written by a Claude routine as a PR (`site/src/content/blog/`), Omar
approves and merges; Cloudflare publishes. No auto publishing, no mass produced posts (Google's scaled
content abuse policy).

## 5. Technical SEO

- Google Search Console and Bing Webmaster Tools (Omar signs in; verify with DNS on Cloudflare), submit
  the sitemap. Bing matters for AI: ChatGPT search and Copilot use Bing's index.
- IndexNow ping on deploy (Bing, Yandex) using the key file we have.
- Unique title and description per page, canonical URLs, Open Graph images (`/og` exists), fast pages.
- JSON-LD: Organization, SoftwareApplication (price from `plans.ts`, no review markup until real reviews
  exist on the App Store), FAQPage, BreadcrumbList, Article on blog posts.

## 6. GEO: being found and described by AI assistants

- **Let AI crawlers in on purpose**: list GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User,
  PerplexityBot, Google-Extended, Applebot-Extended, CCBot in `robots.txt` as allowed (today "allow all"
  already does it; naming them makes it explicit and lets us change one later).
- **`llms.txt` and `llms-full.txt`**: keep them generated from `catalog.ts` and `plans.ts`, add the keyword
  pages and an "in one paragraph" description that we repeat word for word everywhere.
- **Pages AI can quote**: answer first, short facts, tables (features, plans, limits), dated "last updated",
  clear names ("CRO Toolbox is a Shopify app for upsells, cross sells, bundles..."). One About page with
  who makes it and contact.
- **Same facts everywhere** (AI trusts what many places agree on): App Store listing, website, G2, Capterra,
  Product Hunt, Crunchbase, LinkedIn page, Shopify Partner directory. Omar makes those accounts.
- **Mentions on trusted sites**: Shopify Community answers, Reddit (r/shopify), YouTube demos, guest posts
  and "best apps" roundups by agencies. Written by Omar (a routine can draft); never automated posting.

## 7. Connecting AI assistants directly (our MCP server)

We already have a remote MCP server (`/mcp`, OAuth, G9). That is the standard ChatGPT apps and Claude
connectors are built on, so the same server can be listed in their directories:
- **Claude**: submit to Anthropic's connectors directory.
- **ChatGPT**: package it as a ChatGPT app (OpenAI's Apps SDK uses MCP) and submit it to the ChatGPT app
  directory.
- **MCP registries**: the public MCP registry and community lists.
Check each directory's current rules before submitting (review, privacy policy, OAuth, branding). This puts
CRO Toolbox inside the assistants merchants already use, and every listing links back to the site.

## 8. Ads (optional, Omar's decision, costs money)

Google Ads and Shopify App Store search ads on "shopify upsell app" and similar terms, for results before
SEO kicks in (3 to 6 months).

## 9. Measuring

- Search Console and Bing: impressions and clicks per keyword page.
- Cloudflare Web Analytics: visits from chatgpt.com, perplexity.ai, claude.ai, copilot.microsoft.com.
- App Store listing analytics: search impressions and installs.
- A monthly Claude routine asks the main assistants 10 fixed questions ("best Shopify upsell app",
  "how to add bundles on Shopify"...) and logs whether CRO Toolbox is named and described correctly, in
  `docs/research/geo-checks.md`.

## Status (2026-10-20)

- §2 keyword pages: all eight live (`site/src/keywords/`).
- §3 comparison and alternative pages: live; alternative pages quote each app's own App Store listing,
  checked 2026-10-20 (`site/src/lib/alternatives.ts`), vs pages in `site/src/lib/competitors.ts`.
- §4 guides: in progress (finish-website-cloud §5, 12 more articles).
- §5 technical: sitemap with lastmod, IndexNow on site and app file changes, canonicals, noindex on the
  www and pages.dev copies, JSON-LD Organization (contact, sameAs), SoftwareApplication (prices from
  `plans.ts`, no rating), FAQPage, BreadcrumbList, Article on posts. Bing and Yandex sign in: Omar
  (`docs/website.md`, "Search engines beyond Google").
- §6 GEO: AI crawlers named in robots.txt; llms.txt and llms-full.txt generated from the app's files with
  keyword answers, bundle types and alternatives; About page; the shared line from `site/src/lib/brand.ts`.
  Profiles and mentions: drafts in `docs/outreach/`, posted by Omar.
- §9 monthly GEO check: `docs/research/geo-checks.md` (run 1 on 2026-10-20).

## Order

1. Listing keywords (me). 2. Search Console, Bing, IndexNow (Omar signs in, I set up). 3. Keyword pages
(one PR each, two at a time). 4. robots, llms.txt, JSON-LD upgrades (one PR). 5. Blog routine. 6. Profiles
on G2, Capterra, Product Hunt (Omar). 7. MCP directory submissions (after the MCP is tested on Testing 3).
8. Monthly GEO check routine.
