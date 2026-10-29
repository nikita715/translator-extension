#!/bin/sh
# Renders Chrome Web Store images from store/src using the real popup and headless Chrome.
# Usage: render.sh [locale...], all interface languages by default. Texts are in src/texts/<locale>.json,
# images go to images/<locale>/
set -e
cd "$(dirname "$0")"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
build=$(mktemp -d)
trap 'rm -rf "$build"' EXIT

cp -R ../_locales ../icons ../engines ../builtInLanguages.js src/* "$build"/
mkdir "$build/popup"
cp ../popup/* "$build/popup"/
# Load the API stub before the popup scripts
sed 's#<script src="../builtInLanguages.js"#<script src="../stub.js"></script>\n  &#' ../popup/popup.html > "$build/popup/popup.html"

render() { # page, output, width, height; Chrome now and then exits without a screenshot, so try again
  rm -f "$2"
  for attempt in 1 2 3; do
    shoot "$@"
    if [ -s "$2" ]; then echo "$2"; return; fi
  done
  echo "Failed: $2" >&2
  return 1
}

shoot() { # screenshots always use the light theme
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --user-data-dir="$build/profile" --blink-settings=preferredColorScheme=1 --window-size="$3,$4" --virtual-time-budget=5000 \
    --screenshot="$2" "file://$build/$1" >/dev/null 2>&1 &
  pid=$!
  # Headless Chrome sometimes hangs after taking the screenshot
  (sleep 25; kill $pid) >/dev/null 2>&1 &
  killer=$!
  wait $pid || true
  { kill $killer && wait $killer; } 2>/dev/null || true
}

render_locale() {
  out="$PWD/images/$1"
  mkdir -p "$out"
  for page in 1-on-page 2-replace 3-settings 4-modes 5-engines; do
    render "$page.html?lang=$1" "$out/$page.png" 1280 800
  done
  render "promo-small.html?lang=$1" "$out/promo-small-440x280.png" 440 280
  render "marquee.html?lang=$1" "$out/marquee-1400x560.png" 1400 560
}

for locale in ${*:-$(ls ../_locales)}; do
  render_locale "$locale"
done
