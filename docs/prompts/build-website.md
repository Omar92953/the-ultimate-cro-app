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
**every feature of the app live**, and sends visitors to install the app. Study these two sites in a
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
  workspaces, so the app build and Render deploy of the app are untouched). Living next to the app
  lets the live demos reuse the real storefront code.
- Use **Astro** (static output, content collections for articles, great for SEO). TypeScript. Plain
  CSS or Tailwind, your choice; keep pages fast (aim for Lighthouse 95+).
- Hosting: a static host (Render static site, Cloudflare Pages, Netlify or Vercel) with root
  directory `site/`. **Ask Omar** which one and which domain (suggested `crotoolbox.app`) before
  buying or connecting anything. Until then, give him a local preview and a free preview URL if the
  host offers one.
- Add `site` checks to your PRs: `npm --prefix site run build` must pass. Don't change the app's
  checks or `render.yaml` service for the app.

## Pages

1. **Home**: hero (one line on what CRO Toolbox does, "Install free on Shopify", "See it live"),
   trust line (only true facts: "Built for any Online Store 2.0 theme", plan prices; no invented
   ratings or store counts), a strip of live feature cards (like Section Store's), value cards, a
   features overview by area (Offers, Storefront, Cart, Checkout, Analytics), "how it works" in 3
   steps (install, pick a feature, it shows in your theme; no code), pricing teaser, articles teaser,
   FAQ, final call to action.
2. **Live demos** (the most important part, see below): `/demo/` catalog of every feature with
   filters by area, and `/demo/<feature>/` one page per feature.
3. **Bundles** hub: the 6 bundle recipes from `docs/PROJECT-GUIDE.md` §6 (Frequently bought together,
   kit, mix & match, growing discount, build while browsing, any N for one price), each with its
   live demo, plus a **bundle gallery** of example bundles (like Simple Bundles').
4. **Features**: one page per area and per main feature (upsell, cross-sell, bundles, discounts, cart
   drawer, reviews, countdown, video carousel...), each explaining what it does, who it's for, the
   options, screenshots of the admin, and a link to its live demo.
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
   articles, a call to action box linking to the matching live demo and the App Store. Write **6
   starter articles** (useful how-to guides, e.g. "How to add Frequently bought together to a Shopify
   theme", "Mix and match bundles on Shopify: a complete guide", "Quantity breaks that raise AOV",
   "Cart drawer upsells that work", "Countdown timers without fake urgency", "Best Shopify bundle
   apps compared") and leave the collection ready for many more.
9. **Help center**: getting started and one guide per feature, adapted from
   `docs/README-merchant.md`. **Tutorials** page ready for videos (Omar will add them).
10. **About, contact/support (support email from Omar), privacy policy, terms**. The App Store
    listing needs the privacy policy and support URLs (`docs/listing.md`).
11. 404 page, sitemap, robots.txt, `llms.txt`.

## Live demos ("Show live preview" from the app)

Every section and widget the app adds to a store must have a live page on the site that shows it
really working, with all its designs stacked like Section Store's section pages.

- Reuse the real storefront code: the Liquid in `theme/blocks` and `theme/snippets`, and the JS/CSS
  in `extensions/cro-storefront/assets`. `test/storefront/render.mjs` and
  `test/storefront/sections.mjs` already render the real blocks with mock shop data into HTML pages
  (`npm run test:storefront`, output in `test/storefront/out/`). Build on that renderer: generate the
  demo HTML at site build time (or as a step that copies its output into `site/`), wrap it in the
  site's layout, and use good demo data (pleasant product photos you are allowed to use, e.g.
  Unsplash with attribution where required, realistic names and prices). Interactions must work
  (pick bundle items, add to a fake cart, carousels, tabs, countdowns).
- One page per feature key from `app/lib/catalog.ts` (`FEATURES`): upsell, cross_sell, bundles (one
  demo per recipe), discounts, addons, personalize, cart_tools, cart_offers, cart_extras, reviews,
  product_reviews, sales_pop, trust_badges, logos, announcements, countdown, shipping_bar,
  stock_urgency, sticky_atc, quick_add, delivery, stock, wishlist, hero, image_carousel, videos, faq,
  quiz, collection_pills, header, footer, contact, track, returns. Checkout-only features
  (payment_rules, delivery_rules, order_limits, thank_you, post_purchase) get a page with a faithful
  visual mock and screenshots, since checkout can't run outside Shopify.
- **Stable URLs**: `/demo/<feature-key>/` with the key exactly as in `catalog.ts` (underscores
  become hyphens, e.g. `/demo/cross-sell/`), designs as anchors `#design-1`, `#design-2`... and
  bundle recipes as `/demo/bundles/<recipe-key>/` (keys from `app/lib/bundle-recipes.ts`). Write the
  list to `site/public/demo/index.json` (`{ key, title, url, designs }`) so the app can check links.
- Each demo page: title, one line on what it does, the live demo, "Install free on Shopify" and
  "How to set it up" (help article), and links to related features.

**In the app**, add a "Show live preview" button that opens the demo in a new tab:
- One constant for the site address (e.g. `SITE_URL` in `app/lib/site.ts`, default to the chosen
  domain) and a helper `demoUrl(featureKey, design?)`.
- Show it on each feature's page and design page (the area hubs, `FeatureNav`, the Design pages next
  to the design picker) and in the Create bundle recipe cards. Use the existing UI patterns
  (`app/components/fields.tsx` Button, `LinkTiles`), no dashes in text, and run all app checks from
  `docs/PROJECT-GUIDE.md` §5. This is a separate PR from the site.

## SEO and GEO

- Unique title and meta description per page, one H1, clean URLs, canonical tags, Open Graph and
  Twitter images (generate per page), sitemap.xml, robots.txt, internal links between features,
  demos, articles and comparisons, breadcrumbs.
- Structured data: `SoftwareApplication` (with the real prices), `FAQPage`, `Article`,
  `BreadcrumbList`, `Organization`.
- GEO: plain factual statements AI assistants can quote (exact prices, limits, what each feature
  does, works with any Online Store 2.0 theme, no code), question headings with a direct first
  sentence answer, an `llms.txt` (and `llms-full.txt`) summarising the app, features, pricing and
  key URLs, consistent naming "CRO Toolbox".
- Speed: static HTML, optimized images (Astro image), minimal JS outside the live demos, lazy load
  demos below the fold.

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
the home page and one demo page early and adjust from his feedback.

## Deliverables and order

1. PR 1: `site/` scaffold, layout, home, pricing, legal pages, sitemap/robots/llms.txt, deploy
   preview. Ask Omar about domain and host.
2. PR 2: live demo pipeline and the demo catalog + every demo page.
3. PR 3: bundles hub, features, use cases, comparisons.
4. PR 4: blog (collection, layout, 6 articles), help center, tutorials page.
5. PR 5 (app): "Show live preview" buttons using `demoUrl()`.
6. Update `docs/PROJECT-GUIDE.md` (§11 and the code map) with how the site works, how to add an
   article, how to add a demo, and how to deploy it.

Report to Omar after each PR in short plain sentences with the preview link and what to check.
