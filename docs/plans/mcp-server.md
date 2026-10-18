# MCP server and custom AI sections (G9): design for approval

Status: **design only, nothing built.** Omar approves (or changes) this before any code. Items 1 to 6 are the
MCP server, item 7 is the custom section block. Questions for Omar are in section 9.

## 1. What it is

A remote MCP server inside the existing admin app on Render, at `https://cro-toolbox.onrender.com/mcp`
(streamable HTTP). A merchant connects Claude (claude.ai or Claude Desktop custom connector) to their own
store's CRO Toolbox. Then they can say "make a 10% bundle for my two best sellers and a size guide for my
shirts" and Claude builds them as **drafts** in the app. The merchant sees them in the app and publishes.

Claude's custom connectors accept remote servers over streamable HTTP, authless or OAuth, and register
themselves with Dynamic Client Registration. They call the server from Anthropic's cloud, so the server must
be public (it is). Source: Anthropic's help article "Building custom connectors via remote MCP servers"
(support.claude.com/en/articles/11503834). The claude.ai connector screen has no field for a custom
header, so a per shop token would only work for developer clients (Claude Code, Cursor). **OAuth is the
way merchants connect.**

## 2. Connecting and security

- **Settings → "Connect an AI assistant"** (new section in `app.settings.tsx`, Starter plan and up, off by
  default). Shows the connector URL, a copy button, a short how to for claude.ai and Claude Desktop, the list
  of connected assistants with "Disconnect", and the audit log (section 6).
- **OAuth 2.1 with PKCE, DCR** served by the same Remix/React Router app: `/.well-known/oauth-protected-resource`,
  `/.well-known/oauth-authorization-server`, `/mcp/register`, `/mcp/authorize`, `/mcp/token`.
  The `authorize` step requires the merchant to be inside the Shopify admin session (the existing
  `authenticate.admin`), shows "Claude wants to manage CRO Toolbox on <shop>" with a read only or read and
  build choice, and issues a code. Tokens: short lived access token (1 hour), refresh token (30 days), both
  stored hashed in a new `McpGrant` table (shop, client name, scope, created, last used, revoked).
- **A token is bound to one shop.** Every tool resolves the shop from the token, then gets an Admin API client
  with the shop's stored offline session (`unauthenticated.admin(shop)`, already in `shopify.server.ts`). No tool
  takes a shop argument, so one merchant can never reach another's store.
- **Scopes**: `read` (list and inspect) and `build` (create and change drafts, publish). Default is `read`
  plus drafts; **publish needs an explicit "allow publishing" tick** at connect time, so an assistant cannot
  change the live store unless the merchant allowed it.
- Developer clients (Claude Code): the same OAuth works, plus an optional "personal access token" button for
  those who prefer a header. Same table, same scopes.
- Prompt injection: tool results contain merchant data (product titles, review text). Tool descriptions say
  so, and the server never returns secrets, tokens or customer personal data (no orders, emails, names).
  Read tools are limited to what the app already shows (offers, designs, products, themes).

## 3. Tools

All tools are thin wrappers over the **same lib functions the admin routes use**. Today many checks live in
route actions (`app/routes/app.*.tsx`); step one of the build is to move them into `app/lib` so both paths
call one function (see section 5).

**Read** (`read` scope)
- `get_overview`: plan, features and which are on, offers count, theme blocks installed.
- `list_features`: catalog (`catalog.ts`): key, title, area, plan needed, can use now (plan gate).
- `list_templates(feature)`: the presets of a feature (e.g. size guide has 4), with their key.
- `get_design(feature)`: the current saved design and the current draft (the `*_editor` and `*_draft` values).
- `list_offers`, `get_offer(id)`: upsells, cross sells, bundles, discounts (the same shapes as the app).
- `search_products(query)`, `list_collections`: handle, title, price, image (read only, for building offers).
- `check_limits`: slots left, styles left, checkout rules left (from `plans.ts`).

**Build** (`build` scope; everything is created as a **draft**)
- `set_design(feature, patch | template)`: start from a template key and/or change values; the input goes through
  the feature's `with<Feature>Defaults()` cleaner, which already clamps, trims and drops unknown fields, and
  the result is stored as `<feature>_draft` only (the existing "Preview on store" mechanism).
- `create_offer(type, values)`, `update_offer(id, values)`: upsell, cross sell, bundle recipes, discounts. New
  offers are created **inactive** (draft) with the same validators and the offer slot check as the admin.
- `create_discount(type, values)`, `update_discount(id, values)` (built): buy X get Y, volume discounts, gift with
  purchase and upgrades, as drafts (off). Same checks as the app's deal page (`requireDeal` in `rules.server.ts`:
  the plan's feature, complete settings, offer slots). A deal that is on can only be changed with the allow
  publishing tick; `publish_offer` switches a deal on.
- `create_bundle(recipe, …)`, `update_bundle(id, …)` (built): all six recipes (`fbt`, `kit`, `mixmatch`, `browse`,
  `growing`, `anyN`) as drafts: the bundle is off and its bundle product is a Shopify **draft product** (not active,
  not on the Online Store); `publish_offer` activates the product and switches the bundle on. Checks:
  `requireBundle` / `requireKit` / `requireDeal` in `rules.server.ts`, the same ones the app's pages run. Bundles
  are placed on their bundle product's page; putting one on a store page is done in the app.
- `create_custom_section(name, html, css)`: see section 7.
- `discard_draft(feature)`.

**Place and preview**
- `get_preview_link(feature)`: the theme editor deep link with the draft active (the links from
  `sectionLinks()`), plus the admin screen in the app. Drafts are only visible to someone inside the theme editor.
- `get_place_link(feature)`: the "Add to theme" deep link (the app cannot edit theme files; the merchant clicks).

**Publish** (`build` scope and the "allow publishing" tick)
- `publish(feature)`: copies the draft to live (what Save does today) after re-running the full validation and
  plan gate. `publish_offer(id)`: turns an offer on, subject to the offer slot limit. Both return exactly what
  the admin would say on failure ("Free plans can have 3 offers on at once").

No delete tools in v1. Nothing touches checkout Functions, billing, discounts codes, or the live store theme
files.

## 4. Where it runs

- One route `app/routes/mcp.tsx` (resource route, no UI) using the official TypeScript MCP SDK
  (`@modelcontextprotocol/sdk`, `StreamableHTTPServerTransport`) in **stateless mode** (a new transport per
  request), which suits Render and needs no sticky sessions. Free Render instances sleep; the first call after
  idle takes up to a minute (same as the admin today). Worth the Starter instance once merchants use it.
- Tool definitions live in `app/lib/mcp/` (one file per group), each with a zod schema; the catalog
  (`catalog.ts`) generates the feature enum so a new feature is automatically available.
- Merchant docs: a help article "Connect Claude to CRO Toolbox" on the site and a short in-app guide.

## 5. Same rules as the admin (the prerequisite refactor)

An AI must never get a back door around plan limits. Before any tool is written:
1. Move the checks that live in route actions into lib functions: plan gate (`canUse`, `isLocked`), offer slots
   (`offerSlots`), per section style limit (`designsPerSection`), checkout rule limit, metafield size cap (the
   9,500 byte rule in `cro.server.ts`), max counts (charts, rows, items).
2. Each lib function takes `(admin, shop, plan, input)` and throws a typed `RuleError` with the merchant
   facing message. The routes catch it as today; the MCP tools return it as the tool error text.
3. Add tests that call each lib function through both the route action and the MCP tool with the same bad
   input and expect the same error (one parameterised test file).
This refactor is useful on its own and ships as its own PR first.

## 6. Audit log, limits, abuse

- `McpAudit` table: time, shop, grant, tool, a short summary of the input (never the full text of sections),
  result (ok, rule error, error). Shown in Settings (last 100), kept 90 days.
- Rate limits per grant: 60 tool calls a minute, 20 build calls a minute, 200 build calls a day; per shop 600
  calls a day. Returns a plain "slow down" message.
- Revoking a grant in Settings invalidates its tokens at once; uninstalling the app deletes all grants
  (extend the `app/uninstalled` webhook and the data deletion webhooks).
- Request size cap 256 KB; custom section HTML/CSS cap in section 7.
- Costs: no model calls on our side (the assistant is the merchant's own Claude), so no AI bill for us.

## 7. Custom AI sections ("design beyond the built in designs")

A new **"Custom section"** that renders HTML and CSS written by the assistant (or by hand).

**Storage**: a metaobject `$app:cro_custom` per section (name, `html`, `css`, `draft_html`, `draft_css`,
status), up to 10 per store.

**Theme block**: one new block `ucs-custom` (28 of 30 blocks after size guide, 82 KB Liquid; this uses 1
slot, leaving 2). Its setting picks which custom section to show; it prints the **sanitized** HTML inside
`<div class="ucs-cx" data-id>` plus a scoped `<style>`. In the theme editor it shows the draft; on the live
store only the published version.

**Sanitizing, on save, on the server, every time** (never trusted from the client or the assistant):
- HTML: an allow list parser (e.g. `sanitize-html`, strict config). Allowed tags: structural and text tags
  (div, section, span, p, h1 to h6, ul, ol, li, a, strong, em, br, hr, img, picture, source, figure,
  figcaption, table parts, button, details, summary, svg basic shapes). **No** script, style (CSS is a separate
  field), iframe, object, embed, form, input, link, meta, base, template, noscript.
  Attributes: class, id (prefixed), alt, title, href, src, srcset, width, height, role, aria-*, data-ucs-*,
  open. All `on*` attributes removed. `href` only `https:`, `mailto:`, `tel:` or a relative path; `src`
  only `https:` images from Shopify's CDN or the merchant's own domains (shopify files), no `data:` except
  small `data:image/svg+xml` is rejected as well.
- CSS: parsed with a real CSS parser (postcss). Every selector is **prefixed with the block's own scope**
  (`.ucs-cx[data-id="…"] `) so it cannot restyle the rest of the store. Removed: `@import`, `@font-face` with
  external urls, `behavior`, `-moz-binding`, `expression()`, any `url()` that is not an https Shopify CDN
  image, `position: fixed` and very large `z-index` (so a section cannot cover the whole page or checkout
  links), `@keyframes` allowed but names are prefixed.
- Size: HTML 30 KB, CSS 20 KB, so the metaobject and the page stay small.
- No JavaScript at all, ever. Interactivity is limited to `<details>`, links and CSS `:hover`.
- Every save stores the cleaned result and a short report of what was removed; the assistant gets that report
  as the tool answer so it can fix its output.

**Draft and publish**: `create_custom_section` writes the draft; the app has a "Custom sections" page
(Section library, new card) with the live preview (an iframe `srcdoc` with the same sanitized output), the
removed-items report, Publish and Revert. Publishing copies draft to live. Plan: **Pro**, since it is the most
open ended feature.

**Shopify App Store rules (check before building)**: The app already ships blocks whose content comes from
metaobjects the merchant edits. Rendering merchant authored markup is common (page builders), but it must be
data that the app sanitizes, not code the app executes. Our rules above (no JS, scoped CSS, allow list)
keep it in that category. I could not confirm the exact wording of Shopify's current review requirements in
this research; **before building, read the current "App Store requirements" (sections on code injection and
data) and, if unclear, ask Shopify support or the Partner community.** The risk is low because no script
is ever injected, but it is the one item that could stop a launch.

## 8. Build order (after approval)

1. PR: move validation and plan checks from routes into `app/lib` + the shared tests (section 5).
2. PR: OAuth, `McpGrant`, `/mcp` with the **read** tools, Settings "Connect an AI assistant", audit log, limits.
3. PR: build tools (drafts), preview and place links, publish with the scope tick.
4. PR: custom sections (storage, sanitizer with a large test list of hostile inputs, block, page).
5. Docs: help article, listing text, "Connect Claude" guide with screenshots; then try it on Testing 3:
   connect Claude, build a section and an offer, see them as drafts in the app, publish.
Each PR is a draft PR with checks; 1 and 2 need no Shopify deploy, 3 and 4 do (the block and a new
metaobject definition in `shopify.app.toml`).

## 9. Questions for Omar

1. **Connect with OAuth only** (recommended), or also the personal token for developers?
2. **Publishing**: keep "assistant can publish only if the merchant ticks it", or drafts only in v1 (the
   merchant always presses Publish in the app)? Recommendation: drafts plus the optional tick.
3. **Plans**: MCP on Starter and up, custom sections on Pro. OK?
4. **Custom section slot**: it takes 1 of the 3 remaining theme block slots (27 of 30 used after the size
   guide). Fine, or should it wait?
5. **Render**: move to a paid always on instance when this ships (first calls after idle are slow)?
6. OK to ask Shopify about the code rendering rules before the custom section PR?

Sources: Anthropic, "Building custom connectors via remote MCP servers" (support.claude.com/en/articles/11503834);
MCP specification (streamable HTTP and authorization, modelcontextprotocol.io).

## 10. Omar's decisions (2026-10-17)

1. **Connect**: OAuth for claude.ai and Claude Desktop, plus the personal access token for developer clients.
2. **Publishing**: drafts always; publishing only when the merchant ticked "allow publishing" at connect time.
3. **Plans**: connecting an assistant on Starter and up; custom sections on Pro.
4. **Custom section block**: first read Shopify's current App Store requirements and ask Shopify (support or
   Partner community) whether sanitized merchant/AI authored HTML and scoped CSS in a theme app block is
   allowed; build PR 4 only once that's clearly yes. PRs 1 to 3 can go ahead now.
5. **Render** is already on the paid Starter instance (`render.yaml` `plan: starter`), so it doesn't sleep.

Build in the order of section 8.

6. ~~`request_feature` tool~~: removed in Oct 2026 with the app's feature requests (no promise to build what merchants ask).
