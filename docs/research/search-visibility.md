# Search visibility: is crotoolbox.com found? (log)

How to check: search `site:crotoolbox.com` on each engine in a normal browser (steps in `docs/website.md`,
"Search engines beyond Google"). Found = at least one crotoolbox.com result. Add a row per check.

## 2026-10-20 (cloud session, PR #218)

**Technical check of the live site (all from https://crotoolbox.com):**

| Check | Result |
|---|---|
| robots.txt | Allows every crawler (and named AI and Bing crawlers); only `/demo/` disallowed; points to the sitemap |
| Sitemap | `sitemap-index.xml` → `sitemap-0.xml`, 120 URLs, no demo pages. Had no `<lastmod>`: **fixed** (every URL has one) |
| Every sitemap URL (120) | 200, one canonical pointing to itself, no `noindex` meta or header, unique title and description, real text in the HTML, one H1 |
| Pages without a link from another page's text | Only `/terms/` (linked from the footer on every page): fine |
| `https://www.crotoolbox.com/` | **200, a full second copy** (canonical points to the main address). Cloudflare Pages' `_redirects` can't redirect a whole domain, so: marked `noindex` in `_headers` now, and a 301 Redirect Rule for Omar to add (checklist step 1) |
| `https://crotoolbox.pages.dev/` | **200, a second copy** (canonical points to the main address): marked `noindex` in `_headers` now |
| `/pricing` (no slash) | 308 to `/pricing/`, one hop. `/sitemap.xml` 301 to `/sitemap-index.xml` |
| http:// | Not testable from the cloud session (only https is allowed out). Cloudflare's "Always Use HTTPS" covers it if on |
| IndexNow | Key file live (200). The GitHub workflow sends all 120 URLs after each website change; `api.indexnow.org` answered **200** (run 56, 2026-10-20). Only ran when `site/` changed: **fixed** (also runs when the app files the site reads change) |
| 404 page | Had a canonical to a page that doesn't exist: **fixed** (noindex, no canonical) |
| About page, contact | Missing: **added** `/about/` (who runs it, contact emails), Organization schema with email and contact point, `sameAs` ready for profiles |

**Found on each engine** (`site:crotoolbox.com`, 2026-10-20):

| Engine | Found | How checked |
|---|---|---|
| Google | Not checked from the cloud (results page needs a browser) | Omar: Search Console shows the property verified on 2026-10-16 |
| Bing | Unknown from the cloud: Bing answers automated requests with unrelated results | Omar reported the site isn't found outside Google |
| DuckDuckGo | Unknown (bot check page) | follows Bing |
| Yandex | Unknown (captcha) | not yet added in Yandex Webmaster |
| Brave | Unknown (rate limited) | |
| Claude's web search tool | **No**: no crotoolbox.com result for `site:crotoolbox.com` or "CRO Toolbox Shopify app" | |

Next check: after Omar's steps 1 to 3, in a browser, about a week later.
