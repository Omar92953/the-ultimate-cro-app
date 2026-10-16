#!/bin/zsh
# Real screenshots of CRO Toolbox in Omar's Chrome: page area 1292 x 727 pt (16:9) at 2x, saved as the
# 2x crop (hi-res) and a 1600 x 900 PNG for the listing.
S=${0:A:h}; OUT=$1; mkdir -p $OUT/hires
STORE="https://admin.shopify.com/store/testing-3-xsslpo6d/apps/the-ultimate-cro-app"
osascript -e 'tell application "Google Chrome" to activate' -e 'tell application "Google Chrome" to set bounds of window 1 to {0, 25, 1292, 895}'
for pair in "01-create-offer:/app/offers/new" "02-upsell-offers:/app/offers/upsell" "03-bundles:/app/bundles" "04-storefront:/app/storefront" "05-upsell-style:/app/styles/upsell" "06-checkout:/app/checkout" "07-home:/app"; do
  name=${pair%%:*}; p=${pair#*:}
  osascript -e "tell application \"Google Chrome\" to set URL of active tab of window 1 to \"$STORE$p\"" -e 'tell application "Google Chrome" to activate'
  sleep 16
  screencapture -x -R0,25,1292,870 $S/win.png
  top=$(node $S/top.mjs $S/win.png)
  [ "$top" = none ] && { echo "$name: page top not found"; continue; }
  sips --cropOffset $top 0 -c 1454 2584 $S/win.png --out $OUT/hires/$name.png >/dev/null
  sips -z 900 1600 $OUT/hires/$name.png --out $OUT/$name.png >/dev/null
  echo "$name top=$top $(sips -g pixelWidth -g pixelHeight $OUT/$name.png | tail -2 | tr -s ' ' | tr '\n' ' ')"
done
echo DONE
