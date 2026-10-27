#!/usr/bin/env bash
# Re-captures the widget crops in branding/listing/widgets/ from the live demos, as listed in
# branding/listing/widgets.txt. Usage: scripts/listing/capture.sh [name ...]   (no names = all)
# Base URL: DEMO_URL (default https://crotoolbox.com/demo).
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/listing/_chrome.sh
BASE="${DEMO_URL:-https://crotoolbox.com/demo}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
grep -v '^#' branding/listing/widgets.txt | while read -r name demo x0 y0 x1 y1 win; do
  [ -n "$name" ] || continue
  if [ $# -gt 0 ] && [[ " $* " != *" $name "* ]]; then continue; fi
  shot="$TMP/${demo//\//_}-${win:-1600}.png"   # demo can be a sub page, e.g. bundles/mixmatch
  shoot "$BASE/$demo/" "$shot" "${win:-1600}" 1100 2
  w=$(( (x1 - x0) * 2 )); h=$(( (y1 - y0) * 2 ))
  out="branding/listing/widgets/$name.png"
  if command -v magick >/dev/null; then magick "$shot" -crop "${w}x${h}+$((x0*2))+$((y0*2))" +repage "$out"
  elif command -v convert >/dev/null; then convert "$shot" -crop "${w}x${h}+$((x0*2))+$((y0*2))" +repage "$out"
  else sips --cropOffset $((y0*2)) $((x0*2)) -c "$h" "$w" "$shot" --out "$out" >/dev/null; fi
  echo "✓ $out"
done
