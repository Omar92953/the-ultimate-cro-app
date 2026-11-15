# Product pictures for the website and the live demos

Drop real product photos in this folder. The website (`ProductArt.astro`) and the live demos
(`demos/build.mjs`, crotoolbox.com/demo) both read it, so adding a file here changes both.
Without a file, the drawn pictures (`site/src/lib/art.ts`) are used. The photos here now are free
Burst stock photos; each one's source and licence is listed in `demos/IMAGES.md` (update it when you
change a file).

## File names

One file per product kind, named after the kind:

`serum`, `cream`, `candle`, `mug`, `tote`, `soap`, `bottle`, `tee`, `socks`, `gift`, `plant`

Example: `serum.jpg`, `candle.webp`.

The demo store has several products of one kind (for example eight socks in different colours). They
all use `socks.<ext>` unless a file named after the product handle exists, for example
`navy-socks.jpg`, `care-kit.jpg`. Handles are in `demos/src/data.mjs`.

## Format

- JPG, WebP or PNG (WebP is preferred: smallest). If one name has several, WebP wins, then JPG, then PNG.
- Square, 1200 x 1200 px (they are shown from 40 px up to about 600 px; the site crops to a square).
- Product centred on a plain or soft background, about 10% margin around it.
- Under 200 KB each (compress before adding). No text or logos in the picture.

Do not add anything else here: every file in this folder is published as is.

The hero banner of the demo store (`hero-desktop.svg`, `hero-mobile.svg`) is still drawn from the
SVG art; it needs its own wide pictures (2400 x 1000 and 1000 x 1250) and a change in `demos/build.mjs`.

## Small copies

The website loads small copies in the widget cards: `site/public/img/products/<kind>-160.webp`, `-400.webp` and `-600.webp`.
After changing a photo here, make them again (from `site/`):

```bash
for k in serum cream candle mug tote soap bottle tee socks gift plant; do for w in 160 400 600; do cwebp -quiet -q 80 -resize $w $w public/products/$k.webp -o public/img/products/$k-$w.webp; done; done
```
