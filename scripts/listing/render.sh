#!/usr/bin/env bash
# Renders branding/listing/templates/<name>.html to branding/listing/out/<name>.png at exactly 1600 x 900.
# Usage: scripts/listing/render.sh feature screenshot-1-bundles ...   (no names = every template)
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/listing/_chrome.sh
mkdir -p branding/listing/out
names=("$@"); [ ${#names[@]} -gt 0 ] || names=($(cd branding/listing/templates && ls *.html | sed 's/\.html$//'))
for n in "${names[@]}"; do
  shoot "file://$PWD/branding/listing/templates/$n.html" "$PWD/branding/listing/out/$n.png" 1600 900 1
  echo "✓ branding/listing/out/$n.png"
done
