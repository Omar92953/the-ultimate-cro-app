# Shared by capture.sh and render.sh: finds headless Chrome (set CHROME to override).
if [ -z "${CHROME:-}" ]; then
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$c" >/dev/null 2>&1 || [ -x "$c" ]; then CHROME="$c"; break; fi
  done
fi
[ -n "${CHROME:-}" ] || { echo "Chrome not found: set CHROME=/path/to/chrome" >&2; exit 1; }
shoot() { # shoot <url> <out.png> <width> <height> <scale>
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --force-device-scale-factor="$5" --window-size="$3,$4" --virtual-time-budget=6000 \
    --screenshot="$2" "$1" 2>/dev/null
}
