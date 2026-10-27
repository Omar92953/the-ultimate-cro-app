# Listing images: design system

The style for every App Store listing image (the feature image and the 6 screenshots), approved by Omar on
2026-10-19. Any account can rebuild or extend the images from this folder alone.

## The look

- **Size:** exactly 1600 x 900 PNG (Shopify's size for the feature image and screenshots).
- **Background:** near black `#0b0b0f` with a soft green glow at the top (`#1d2a22`).
- **One accent colour:** green `#3ddc84`, used for one highlighted word in the headline, the check marks and the tags.
- **Type:** Inter (system fallback), headline 800 weight, white. Sub text `#c9d1cc`.
- **Widgets:** real crops from the live demos, shown as white cards (18px corners, deep shadow) with a green
  pill tag on the top edge naming the feature.
- **Words:** short and factual. No numbers, prices, "best", "#1", "increase sales by", reviews counts or the
  Shopify logo (App Store rules 4.x, `docs/listing.md`). No dashes in text.

All of it lives in `styles.css`. Change the look there, not in the templates.

## Files

| Path | What |
|---|---|
| `styles.css` | Colours, type, card, tag and both layouts |
| `logo.svg` | White wordmark |
| `templates/feature.html` | The feature image: centred headline, check line, collage of 6 widget cards |
| `templates/screenshot-example.html` | Screenshot layout: text left, one or two big widget cards right. Copy it per screenshot |
| `widgets.txt` | Which demo and which box each widget crop comes from |
| `widgets/*.png` | The crops (2x, so they stay sharp) |
| `out/` | Rendered PNGs (not committed) |

## Make or update the images

```bash
scripts/listing/capture.sh
```

Re-captures every widget from https://crotoolbox.com/demo/ (or pass names: `capture.sh fbt qty`). After the demos
change, open the new PNGs and fix any box in `widgets.txt` that no longer fits.

```bash
scripts/listing/render.sh
```

Renders every template to `out/<name>.png` (or pass names: `render.sh feature`). Look at each PNG before
handing it over.

New screenshot: copy `templates/screenshot-example.html` to `templates/screenshot-<n>-<name>.html`, change the
headline, sentence, checks and widget, add a crop to `widgets.txt` if needed, then capture and render.

Needs Google Chrome (set `CHROME=/path` if it's not found) and, off macOS, ImageMagick for cropping. On Linux,
headless Chrome lays the page out a little shorter than `--window-size`, which leaves a white strip at the
bottom of `render.sh` output: render with an exact 1600 x 900 viewport there instead (Playwright
`page.setViewportSize`, then a screenshot). Chrome as root also needs `--no-sandbox` (wrap it in a small
script and pass it as `CHROME`).

## Status

- Feature image approved (`branding/feature/feature-banner.png`), built from the current demos.
- 2026-10-20: demos show real product photos (`demos/IMAGES.md`). Widgets re-captured (4 new: `mixmatch`,
  `benefits`, `delivery`, `thanks`), feature image rendered again, and the 6 screenshots designed:
  `templates/screenshot-1-bundles.html` to `screenshot-6-sections.html`, rendered to
  `branding/screenshots/storefront/`. Waiting on Omar to look at them and upload.
- 2026-10-24: three more candidates, Track page, Returns and Loyalty (`screenshot-7-track.html` to
  `screenshot-9-loyalty.html`), from crops that need a lookup or a click first: `live.mjs` lists them and
  `node scripts/listing/capture-live.mjs` takes them (it opens each demo's design page, runs the steps, waits for the
  pictures). The listing takes 6 screenshots at most: Omar picks which 6 of the 9.

- 2026-10-27: the 6 listing screenshots Omar asked for, centred like the feature image (`templates/shot-1-offers.html` to
  `shot-6-analytics.html`, rendered to `branding/screenshots/listing-2026-10-27/`), with the demos switched to fragrance
  products (`demos/IMAGES.md`). The Analytics one is drawn like the app's Analytics page with example numbers and says
  "Example data". The feature image was rendered again with the same products.

- 2026-10-27 (rules pass, App Store requirements 4.3.3, 4.3.4, 4.3.6 and 5.1.4): the feature image headline no longer
  says "5+ apps" (a number) but "Your whole sales toolkit in one app"; its Reviews card and shot 3's customer review
  (a quote could read as a testimonial) are replaced by the Thank you page and an FAQ; the thank you crop is taken
  without the demo's green "CRO Toolbox" marks (the real extension never shows the app name to buyers); the Analytics
  tiles in shot 6 no longer show comparisons (+18%, +11%, "$49.10 without"). "One click offer after purchase" in
  shot 1 stays: the app has a real `checkout_post_purchase` extension (`extensions/cro-post-purchase`).
  Feature image alt text: "Bundles, upsells, thank you page, delivery estimate, stock message, free shipping bar,
  cross sells, loyalty, order tracking and returns".

## Alt text for the 2026-10-27 screenshots

1. `shot-1-offers.png`: "Frequently bought together, quantity breaks and cart offers"
2. `shot-2-loyalty.png`: "The rewards panel with ways to earn points and rewards to spend them on"
3. `shot-3-sections.png`: "Benefits row, an FAQ, a delivery estimate, a stock message and a free shipping bar"
4. `shot-4-tracking.png`: "Track order page on its way and delivered, with a next order code and a review link"
5. `shot-5-returns.png`: "Returns page offering store credit with a bonus, a refund or an exchange"
6. `shot-6-analytics.png`: "Analytics page with sales from the app, offer results and an A/B test"

## Screenshot alt text (for the listing editor)

1. `1-bundles.png`: "Frequently bought together and mix and match bundles on a product page"
2. `2-upsells.png`: "Quantity breaks with a saving next to Add to cart"
3. `3-cart.png`: "Free shipping bar and cross sell offers in the theme's cart drawer"
4. `4-after-purchase.png`: "One click offer after payment and a next order code on the thank you page"
5. `5-product-page.png`: "A stock message and a delivery estimate on a product page"
6. `6-sections.png`: "A benefits row section in a store theme"
7. `7-track.png`: "A Track order page with the delivery status, a next order code and offers, on its way and delivered"
8. `8-returns.png`: "A returns page offering store credit with a bonus, a refund or an exchange"
9. `9-loyalty.png`: "The rewards panel with ways to earn points and rewards to spend them on"
- Uploading is done by Omar in the listing editor (the browser pane cannot upload files).
