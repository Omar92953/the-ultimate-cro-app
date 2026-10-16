# Prompt: build the CRO Toolbox website

Paste this into a Claude Code session connected to `github.com/Omar92953/the-ultimate-cro-app`
(or tell it: "Read docs/prompts/build-website.md and do it").

---

You are building the marketing website for **CRO Toolbox**, the Shopify app in this repo. Before
anything else read `CLAUDE.md` and `docs/PROJECT-GUIDE.md` (rules, code map, plans and prices,
features, how to ship). Follow every house rule there, especially: never touch the live store
`ms6vwv-3n`, no dashes in visible text, ask Omar before anything paid (domain, hosting plan) or
permanent, never type passwords, one `claude/<topic>` branch per change with a PR.

## Goal

A fast, good-looking website that ranks on Google (SEO), gets quoted by AI assistants (GEO), shows
every feature of the app (screenshots and short videos), and sends visitors to install the app.
Separately, **live demos** of every feature run on their own hidden subdomain for merchants inside
the app (see "Live demos" below; decided by Omar on 2026-10-15). Study these two sites in a
browser first and match everything they offer, with a similar layout and quality:

- **https://section.store/** (a Shopify sections app). It has: a hero with "Install free on
  Shopify" and "Browse sections", rating and store count line; a strip of section cards ("Tap a
  section to preview") that open **a live page per section** (e.g. `/pages/hero-pro`) showing the
  section really working, several designs stacked one under another; a catalog page of all sections
  (`/pages/all-sections`) with filters; "Not a page builder / what is a section" explainer; speed
  claim; pricing; extras (bundles, cart drawer); a **guides/blog** grid by topic; a final call to
  action; TikTok and YouTube links.
- **https://www.simplebundles.com/** (a Shopify bundles app). It has: hero with "Watch demo" and
  "Get started"; three value cards; a Features section (each with a picture); merchant logos;
  results numbers; reviews ("Fan mail"); pricing cards (monthly and yearly); a **bundle gallery**;
  case studies; an FAQ; blog teasers; about us; **comparison pages** (`/compare/simplebundles-vs-…`,
  one per competitor); pages per **use case** (subscriptions, POS, 3PL) and per **industry** (beauty,
  fashion, food, home, jewelry, technology…); help center, video tutorials, ebooks, integrations;
  legal pages; a second language.

Copy the structure and the kinds of pages, never their text, images or brand. Write our own copy.

## Where and how

- Build it in a new folder **`site/`** in this repo (its own `package.json`, not part of the root npm
  workspaces, so the app build and Render deploy of the app are untouched). The live demos are a
  second static build in **`demos/`**, next to the app so they reuse the real storefront code.
- Use **Astro** (static output, content collections for articles, great for SEO). TypeScript. Plain
  CSS or Tailwind, your choice; keep pages fast (aim for Lighthouse 95+).
- Hosting (decided with Omar, 2026-10-15): **Cloudflare Pages, free plan** (upgrade at app launch if
  needed), domain **crotoolbox.com** bought by Omar at Cloudflare Registrar. Build command
  `npm --prefix site ci && npm --prefix site run build`, output `site/dist`, root of the repo as the
  project root. Omar connects the GitHub repo in the Cloudflare dashboard (he must click it; never
  type his passwords). Until the domain is connected, use the free `*.pages.dev` preview URL.
  Big videos (over 25 MB) go on YouTube and are embedded, not stored on the site.
- Add `site` checks to your PRs: `npm --prefix site run build` must pass. Don't change the app's
  checks or `render.yaml` service for the app.

## Pages

1. **Home**: hero (one line on what CRO Toolbox does, "Install free on Shopify", "See all features"),
   trust line (only true facts: "Built for any Online Store 2.0 theme", plan prices; no invented
   ratings or store counts), a strip of feature cards with small pictures (like Section Store's), value cards, a
   features overview by area (Offers, Storefront, Cart, Checkout, Analytics), "how it works" in 3
   steps (install, pick a feature, it shows in your theme; no code), pricing teaser, articles teaser,
   FAQ, final call to action.
2. (No demo pages on the website: the live demos are separate and hidden, see below.)
3. **Bundles** hub: the 6 bundle recipes from `docs/PROJECT-GUIDE.md` §6 (Frequently bought together,
   kit, mix & match, growing discount, build while browsing, any N for one price), each with
   screenshots or a short video, plus a **bundle gallery** of example bundles (like Simple Bundles').
4. **Features**: one page per area and per main feature (upsell, cross-sell, bundles, discounts, cart
   drawer, reviews, countdown, video carousel...), each explaining what it does, who it's for, the
   options, and screenshots or short videos of the storefront and the admin.
5. **Pricing**: Free, Starter $5.99, Growth $14.99, Pro $24.99 (yearly $59 / $149 / $249), 14-day
   trial, orders per month 50 / 500 / 1,000 / unlimited, what each plan includes. Read the numbers
   from `app/lib/plans.ts` (import it at build time if practical, so the site never goes out of date).
6. **Compare**: `/compare/cro-toolbox-vs-<app>/` pages (Bundler, Simple Bundles, Fast Bundle, Kaching,
   BOGOS, Rebuy, Vitals, Section Store...) with honest, checkable feature and price tables. Mark
   anything you couldn't verify; no false claims about competitors.
7. **Use cases and industries**: pages like "Bundles for beauty brands", "Upsells for fashion",
   "Food and beverage mixed cases", "Raise average order value".
8. **Articles** (blog): `/blog/` with categories (Bundles & AOV, Product pages, Cart & checkout,
   Store design, Guides) and `/blog/<slug>/`. Use an Astro content collection (`site/src/content/blog`,
   Markdown or MDX with title, description, date, category, cover image, author) so Omar or Claude can
   add an article by adding one file. Article layout: table of contents, reading time, related
   articles, a call to action box linking to the matching feature page and the App Store. Write **6
   starter articles** (useful how-to guides, e.g. "How to add Frequently bought together to a Shopify
   theme", "Mix and match bundles on Shopify: a complete guide", "Quantity breaks that raise AOV",
   "Cart drawer upsells that work", "Countdown timers without fake urgency", "Best Shopify bundle
   apps compared") and leave the collection ready for many more.
9. **Help center**: getting started and one guide per feature, adapted from
   `docs/README-merchant.md`. **Tutorials** page ready for videos (Omar will add them).
10. **About, contact/support (support email from Omar), privacy policy, terms**. The App Store
    listing needs the privacy policy and support URLs (`docs/listing.md`).
11. 404 page, sitemap, robots.txt, `llms.txt`.

## Live demos (hidden, opened from the app: "See live demo")

Decided by Omar on 2026-10-15: the live demos live on their own subdomain, **crotoolbox.com/demo**,
and are **not part of the public website**. Nobody finds them by browsing or searching; they open
only when a merchant clicks "See live demo" inside the app. Built in `demos/` (see `docs/website.md`).

- Reuse the real storefront code: the Liquid in `theme/blocks` and `theme/snippets`, the JS/CSS in
  `extensions/cro-storefront/assets`, the shared renderer `test/storefront/engine.mjs` (also used by
  `npm run test:storefront`), and the app's own design templates and save functions, with good demo
  data. Interactions must work (pick bundle items, add to a fake cart, carousels, tabs, countdowns).
- One page per feature key of `app/lib/catalog.ts` at `/<feature-key>/` (underscores as hyphens,
  e.g. `/cross-sell/`), every design stacked as `#design-1`, `#design-2`…, bundle recipes at
  `/bundles/<recipe-key>/` (keys from `app/lib/bundle-recipes.ts`, `anyN` as `any-n`). Checkout-only
  features (payment_rules, delivery_rules, order_limits, thank_you, post_purchase) get faithful
  visual mocks, since checkout can't run outside Shopify.
- Each page: the real block on a realistic product or collection mock, and a small top bar with the
  feature name, a Desktop/Phone toggle and an "Install CRO Toolbox" link to the App Store listing
  (`APP_STORE_URL`, a placeholder until the listing is live). No site navigation, no links to other
  demos.
- Hidden: every page `<meta name="robots" content="noindex, nofollow">`, a Cloudflare `_headers` file
  adding `X-Robots-Tag: noindex, nofollow` to all paths, robots.txt `Disallow: /`. No sitemap, no
  llms.txt entry, no index page or list of demos (no index.json): `/` redirects to crotoolbox.com.
- The website (`site/`) has **no links** to crotoolbox.com/demo and no `/demo/` pages; its sitemap and
  llms.txt don't mention demos.
- Deployed as a second Cloudflare Pages project (`cro-toolbox-demos`) from this repo with the custom
  domain crotoolbox.com/demo; until then its `*.pages.dev` address works. Steps for Omar in
  `docs/website.md`.

**In the app**: `app/lib/site.ts` has `SITE_URL` (`https://crotoolbox.com`), `DEMO_URL`
(`https://crotoolbox.com/demo`), `demoUrl(featureKey, design?, recipe?)` and `DEMOS` (the keys with a
demo; the demo build fails if a catalog feature has no demo or a demo has no catalog feature).
A **"See live demo"** button (new tab) on each feature's main page, each design page (opens that
design's `#design-N`) and each bundle recipe card in Bundles → Create bundle, shown only for keys in
`DEMOS`. Use `app/components/fields.tsx` Button, no dashes in text, and run the app checks from
`docs/PROJECT-GUIDE.md` §5. A separate small PR; app only, so no Shopify deploy is needed.

## SEO and GEO

- Unique title and meta description per page, one H1, clean URLs, canonical tags, Open Graph and
  Twitter images (generate per page), sitemap.xml, robots.txt, internal links between features,
  articles and comparisons, breadcrumbs.
- Structured data: `SoftwareApplication` (with the real prices), `FAQPage`, `Article`,
  `BreadcrumbList`, `Organization`.
- GEO: plain factual statements AI assistants can quote (exact prices, limits, what each feature
  does, works with any Online Store 2.0 theme, no code), question headings with a direct first
  sentence answer, an `llms.txt` (and `llms-full.txt`) summarising the app, features, pricing and
  key URLs, consistent naming "CRO Toolbox".
- Speed: static HTML, optimized images (Astro image), minimal JS, lazy load videos below the fold.

## Visibility plan (SEO + being recommended by AI assistants)

AI assistants find apps through live web search (ChatGPT uses **Bing**, Google AI answers use
**Google**, Perplexity its own) and through what the web says about the app. Mentions on other sites
count more than our own pages. Build the site so all of this works:

- **Search engine registration**: add `site/public/` verification support (a meta tag or file for
  Google Search Console and Bing Webmaster Tools, values from Omar) and an **IndexNow** key file, and
  ping IndexNow on deploy so Bing sees new pages within hours. Write a short step list for Omar in
  `docs/website.md` (create both accounts, verify crotoolbox.com through Cloudflare DNS, submit
  `https://crotoolbox.com/sitemap.xml`).
- **One shared description**, used word for word everywhere (site meta, App Store, YouTube, social):
  "CRO Toolbox is a Shopify app for bundles, upsells and cross-sells." Keep it in one constant
  (`site/src/lib/brand.ts`) and in `docs/listing.md`.
- **Articles**: 1 or 2 a week after launch, each answering one real merchant question; the question
  as the H1/H2, a direct answer in the first sentence, exact facts, real screenshots. Never mass
  generated thin articles.
- **Comparison pages** ("CRO Toolbox vs <app>") with honest tables; AI is often asked "X vs Y".
- **Structured data** and `llms.txt` as listed under SEO and GEO.
- **Analytics**: Cloudflare Web Analytics (free, no cookie banner). Track installs per page with the
  UTM tags below, and visits referred by chatgpt.com, perplexity.ai and gemini.google.com.
- **Off site work for Omar** (write it as a checklist in `docs/website.md`, not code): App Store
  listing with the main words in the name line (e.g. "CRO Toolbox: Bundles & Upsell"); ask happy
  merchants for reviews; outreach to authors of "best Shopify bundle apps" lists; helpful answers on
  r/shopify and the Shopify Community (no spam); short YouTube tutorials; Product Hunt on launch day;
  free profiles on G2, Capterra and SaaSworthy; a monthly check asking ChatGPT, Gemini and Perplexity
  "best Shopify bundle app".
- **In the app** (separate PR, after launch): a gentle review request ("Enjoying CRO Toolbox?") shown
  once after a success such as the first bundle sale, linking to the App Store review page; never
  blocking, easy to dismiss.

## Calls to action

- Every "Install" button goes to the App Store listing with UTM tags
  (`?utm_source=crotoolbox_site&utm_medium=<page type>&utm_campaign=<page slug>`). The listing isn't
  live yet: keep the URL in one constant (`INSTALL_URL`), and until Omar gives the real listing link,
  point it to a "Coming soon, get notified" section (no third party form without asking Omar).

## Honesty

Only claim what the app really does today (check the code and `docs/README-merchant.md`). No made up
reviews, ratings, store counts, logos or results numbers. Leave clearly marked placeholders
(e.g. "Reviews will appear here after launch") where the reference sites show social proof.

## Design

Modern and premium, like the two references: generous spacing, large clear headings, rounded cards,
soft shadows, a consistent accent color, real product style imagery, dark and light sections
alternating, mobile first (check at 375 px), accessible (contrast, focus states, alt text). Keep the
site's look consistent with the app's preview style. Show Omar screenshots (desktop and phone) of
the home page early and adjust from his feedback.

## Deliverables and order

1. PR 1: `site/` scaffold, layout, home, pricing, legal pages, sitemap/robots/llms.txt, deploy
   preview. Ask Omar about domain and host.
2. PR 2: the hidden live demos in `demos/` (every feature and bundle recipe), `app/lib/site.ts`
   (`DEMOS`, `demoUrl()`), no demo links on the website, `docs/website.md` with the Cloudflare steps.
3. PR 3: bundles hub, features, use cases, comparisons.
4. PR 4: blog (collection, layout, 6 articles), help center, tutorials page.
5. PR 5 (app): "See live demo" buttons using `demoUrl()`, only for keys in `DEMOS`.
6. Keep `docs/website.md` and `docs/PROJECT-GUIDE.md` (§11 and the code map) up to date: how the site
   and the demos work, how to add an article or a demo, and how to deploy them.

Report to Omar after each PR in short plain sentences with the preview link and what to check.
