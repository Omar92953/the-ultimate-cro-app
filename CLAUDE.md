@AGENTS.md

# CRO Toolbox — read this first

Omar's public Shopify app (offers, bundles, storefront widgets, cart drawer, checkout rules,
analytics). **Full guide: `docs/PROJECT-GUIDE.md`** (what the app is, code map, commands, how to ship,
house rules, testing, status, and the plan for the marketing website). Read it before working.

## Status (2026-10-15)

- Live: Shopify app version **cro-toolbox-15**, admin on Render (`https://cro-toolbox.onrender.com`,
  auto-deploys from `main`). Test store: **Testing2** `testing2-j6mmnywm.myshopify.com`.
- Active work: Phase 6 (end-to-end test of the 6 bundle recipes) of `docs/plans/bundles-overhaul.md`.
  Progress list in `docs/PROJECT-GUIDE.md` §10.
- Next project: the marketing website for SEO/GEO (separate repo; plan in the guide §11).

## Rules that matter most

- **Never** modify the live store `ms6vwv-3n.myshopify.com` (Backrooms) or its themes. Test on Testing2.
- **Never** run `shopify app dev clean`.
- Ask Omar before anything paid or permanent in the Partner Dashboard. Never type passwords or
  secrets, never print `.env`.
- One `claude/<topic>` branch per change → checks → PR → merge. If `extensions/`, `theme/` or
  `shopify.app.toml` changed, `shopify app deploy --allow-updates` before merging (prefix
  `NODE_OPTIONS=--dns-result-order=ipv4first`).
- No dashes in UI text. Use `app/components/fields.tsx` wrappers, never raw `onChange` or boolean
  props on `s-*` elements. Never `slot="aside"` on a `large` page; editors use `EditorLayout`.
- Storefront Liquid is edited in `theme/` and built with `npm run build:theme`; 30 of 30 theme blocks
  are used, so new storefront features go into existing blocks/embeds.
- Shopify silently drops Function metafields over 10,000 bytes; `cro.server.ts` enforces 9,500.
- Discount Functions and Cart Transform from custom-distribution apps only run on Plus, so Omar's
  non-Plus store needs the public App Store version.

## Talking to Omar

Short messages, often screenshots. Explain plainly, say exactly what to click, one command at a time.
He likes you to do things yourself ("do it yourself") and to test in the browser before reporting.
