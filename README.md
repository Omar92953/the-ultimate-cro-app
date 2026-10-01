# The Ultimate CRO App

Cross-sell, quantity upsell, shoppable video carousel and mix-and-match bundles for any Online Store
2.0 theme. It's a public-distribution-ready Shopify app, built on the official React Router template.

- **Merchant guide:** [docs/README-merchant.md](docs/README-merchant.md)
- **Testing (Step 3):** [docs/testing-checklist.md](docs/testing-checklist.md)
- **Hosting:** [docs/hosting.md](docs/hosting.md) · **Scopes:** [docs/scopes.md](docs/scopes.md)

## How it fits together

```
Dashboard (embedded, Polaris web components)            Storefront (any OS 2.0 theme)
app/routes/app.*.tsx                                     extensions/cro-storefront  (theme app extension)
      │  saves                                             blocks: ucro-cross-sell · ucro-upsell ·
      ▼                                                            ucro-video-carousel · ucro-bundle-builder
$app metaobjects in the merchant's store  ─── Liquid reads ──▶      ucro-cart-offers (app embed)
(cro_rule, cro_slide, cro_carousel,                      no calls to our server
 cro_bundle, cro_bundle_step, cro_settings)
      │  compact copy written on every save
      ├──▶ automatic app discount metafield ──▶ extensions/cro-discount (Discount Function)
      └──▶ cart transform metafield         ──▶ extensions/cro-bundles  (Cart Transform Function)
Database (Prisma): sessions only.
```

- `shopify.app.toml` declares the scopes, the webhooks (including the three privacy topics) and all
  `$app` metaobject definitions.
- `app/lib/cro.server.ts` does every read and write, and syncs the two Function configurations.
- `app/lib/validate.ts` holds the rule and bundle validation, shared by the UI and the server.
- `app/components/fields.tsx` wraps Polaris web components for React 18 (value/checked are set as
  properties, and native events are used; React 18's `onChange` doesn't fire on custom elements).

## Commands

| Command | What it does |
|---|---|
| `shopify app config link` | **Once, interactive:** attach this folder to an app in your Partner org |
| `shopify app dev` | Run against a development store (tunnel + local SQLite) |
| `npm run test:functions` | Build both Functions to Wasm and run their fixture tests |
| `npm run test:storefront` | Render the blocks with mock data into `test/storefront/out/` (open the HTML files through any local web server) |
| `npm run graphql-codegen` | Validate every Admin GraphQL operation against the schema |
| `npm run typecheck` / `npm run lint` / `npm run build` | The usual checks |
| `npm run build:production` / `npm run start:production` | Postgres (Supabase) build and start, used by `render.yaml` and the `Dockerfile` |
| `shopify app deploy` | Release a version to Shopify. **Ask the owner first** |

## Rules for working on this project

- Never modify the merchant's live theme. `_reference/` (not in the repo) holds read-only pulls of the merchant's
  themes, for comparison only (they're git-ignored and not deployed).
- Ask before `shopify app deploy`, before choosing a distribution method (permanent), and before
  creating anything paid.
- Keep `extensions/cro-storefront/assets/ucro-bundle.js` (writer) and
  `extensions/cro-bundles/src/cart_transform_run.js` (validator) in sync on the
  `_bundle_components` format: `variantId,variantId|variantId`, one group per step.
- Storefront prices shown for discounts are computed in Liquid with the same percentages the
  discount Function applies. If you change one side, change the other.
