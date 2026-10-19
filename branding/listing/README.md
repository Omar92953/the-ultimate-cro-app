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

Needs Google Chrome (set `CHROME=/path` if it's not found) and, off macOS, ImageMagick for cropping.

## Status

- Feature image approved (`branding/feature/feature-banner.png`), built from the current demos.
- Waiting: Omar wants the demos to show a real product collection's photos first. After that: capture again,
  render the feature image again and design the 6 screenshots (`docs/WORKBOARD.md`, "App Store listing images").
- Uploading is done by Omar in the listing editor (the browser pane cannot upload files).
