#!/bin/sh
# Renders Chrome Web Store images from store/src using the real popup and headless Chrome
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

render() { # page, output, width, height; screenshots always use the light theme
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --user-data-dir="$build/profile" --blink-settings=preferredColorScheme=1 --window-size="$3,$4" --virtual-time-budget=2000 \
    --screenshot="$2" "file://$build/$1" >/dev/null 2>&1 &
  pid=$!
  # Headless Chrome sometimes hangs after taking the screenshot
  (sleep 15; kill $pid 2>/dev/null) &
  wait $pid || true
  echo "$2"
}

for page in 1-on-page 2-replace 3-settings 4-modes; do
  render "$page.html" "$PWD/screenshots/$page.png" 1280 800
done
render promo-small.html "$PWD/promo-small-440x280.png" 440 280
render marquee.html "$PWD/marquee-1400x560.png" 1400 560
