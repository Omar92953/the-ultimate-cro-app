# Bare mix and match bundle product bought alone: proposal

Status: **proposal, no code yet** (draft PR). Omar picks the option; the plan below says what each needs to deploy.

## The gap

A mix and match bundle has a bundle product (tag `cro-bundle`, one variant at the bundle price, stock not tracked, "keep selling"). The
shopper never adds it: the builder adds the **picks** as separate lines with the hidden property `_bundle`, and the cart transform
(`extensions/cro-bundles`) merges a complete group into one line of the bundle product at the bundle price.

A theme's own quick add on a collection page, search, or a product card adds the bundle product's variant **by itself**: one line of the bundle
product, no `_bundle`, nothing picked. The shopper pays the bundle price and receives no items. The app's own quick add already opens the
page instead, but a theme's cannot be changed.

Two things make the obvious fix hard:
- **Kits are also tagged `cro-bundle`** (`kits.server.ts`) and are real products that **are** bought as one line. A guard keyed on the tag would
  refuse kits. It must key on the mix and match bundle product ids (the ids in the cart transform's `$app.bundles` config), and be off in
  "line" mode (non Plus custom installs, where a bundle is sold as one line on purpose).
- The earlier checkout guard (PR #45) read Shopify's validation input and saw a merged real bundle as **one line with no picks under it**
  (`parentRelationship` is empty), so it refused real bundles. It was switched off (`cro.server.ts`, `syncBundles` passes no ids).

## Options

| | What | Blocks a bare buy? | Risk | Deploy |
|---|---|---|---|---|
| A | Cart transform gives a bare bundle line a price nobody would pay (`lineUpdate` fixed price) | No, it only makes it silly; the shopper can still check out | Confusing cart, an order with a nonsense price | extension deploy |
| B | Hide bundle products from collections and search | Only partly: a smart collection with "all products", the theme's recommendations, a direct link and `/cart/add` still reach it; hiding means editing the merchant's own collections | Touches things the merchant owns | app server only |
| **C (recommended)** | **Stamp, then validate.** The cart transform adds an attribute to every merged bundle line it makes (`linesMerge.attributes: [{ key: "_cro_merged", value: "1" }]`). The validation (re-enabled bundle guard) refuses a line of a mix and match bundle product that has no stamp, with the existing message "Pick its items on its page, then add it to your cart." | **Yes, at checkout, for every theme and every way of adding** | One thing to prove first: that Shopify's validation input shows the stamp on the merged line (spike below) | `shopify app deploy` (cro-bundles + cro-validation), then the guard is switched back on by the app on the next bundle save (Render) |
| D | Make the bundle product's variant **unavailable to add** (stock tracked, 0, "stop selling"), so Shopify refuses a bare add at the cart | Yes, before the cart | Unknown whether Shopify lets the transform merge into an out of stock parent variant, and the bundle page would read "Sold out" in themes that show availability | extension deploy at most, plus a data change on every bundle product |
| E | Storefront cleanup: `ucs-cart-guard.js` removes a bare bundle line from the cart and shows a short note | Not at checkout (needs JavaScript and the theme's cart events); good extra layer | Low | theme extension deploy |

**Recommendation: C, plus E as a second layer if wanted.** C is the only option that is a real barrier. A is not a barrier, B is not reliable
and edits the merchant's collections, D depends on an unproven Shopify behaviour and changes how the bundle page looks.

## Plan for C

1. **Spike (Testing 3, before any real code)**: deploy a version of `cro-bundles` that stamps merged lines, and of `cro-validation` that reads
   `attribute(key: "_cro_merged")` and returns an error for a line of a bundle product without it. Check on Testing 3:
   1. build a complete mix and match bundle and check out: checkout must work (the validation sees the stamp);
   2. add the bundle product alone through a collection card quick add (or `/cart/add.js` with the bundle variant id): checkout must be refused with the message;
   3. a kit, and a normal product, still check out.
   If step 1 is refused (the validation cannot see the stamp), C is dead and the answer is D (spike it the same way) or A with a warning. Nothing else changes.
2. **Cart transform** (`cart_transform_run.js`): `merge.attributes = [{ key: "_cro_merged", value: "1" }]`. Test in `test/functions` that every merge carries it.
3. **Validation** (`cart_validations_generate_run.{graphql,js}`): read `merged: attribute(key: "_cro_merged")`; `checkBundles` refuses a line whose product id is in `config.bundles`
   and has no stamp (replace the `parentRelationship` logic). Tests: stamped line passes, bare line fails, a kit and a normal product pass, a line created with a
   forged `_cro_merged` by the shopper is the one gap (see below).
4. **App** (`cro.server.ts`): `syncBundles` passes the mix and match bundle product ids to `syncBundleGuard` again (merge mode only; "line" mode keeps it off). The guard
   validation already exists (`syncBundleGuard`); no new scope (`write_validations` is granted).
5. Docs: `docs/PROJECT-GUIDE.md` §10 known gap becomes fixed; this file becomes the record.

**Forged stamp.** A shopper's browser can set a cart line property, but `_cro_merged` is written by the transform onto the merged line only; a shopper
adding the bundle variant with `_cro_merged=1` as a property is a line *attribute* from the browser, so the check must read the stamp **only on lines
the transform made**. The spike also tests this: add the bundle variant with property `_cro_merged=1` and see whether the validation can tell (if it cannot,
use a value only the function knows, derived from the cart line id and a secret, or accept the gap: a shopper who forges it only buys what they already
could by editing the page, paying the bundle price for nothing, and the merchant sees it as an order of the bundle product with no picks).

## What it needs to deploy

- **Shopify deploy** (`shopify app deploy --allow-updates`, from the Mac): `extensions/cro-bundles` and `extensions/cro-validation` change. This PR (docs only) needs none.
- **Render**: the app change in step 4 (auto deploys from `main`). No new scopes, no migration, no new Render variables.
- **Omar on Testing 3** for the spike (a few clicks, listed above), then the real PR.
- Rollback: `shopify app release --version=<previous>`; switching the guard off is `syncBundleGuard(admin, [])`.

## Questions for Omar

1. Go with C (and the spike first)? 
2. Add E (storefront cleanup) now or later?
3. If the spike fails, is D (unavailable parent variant) worth a second spike, or do you prefer to leave the gap and keep the known gap line on the workboard?
