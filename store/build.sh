#!/bin/sh
# Packs the extension for upload to the Chrome Web Store: store/translator-<version>.zip
set -e
cd "$(dirname "$0")/.."
version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json)
zip="store/translator-$version.zip"

rm -f "$zip"
zip -qr "$zip" manifest.json background.js contentScript.js builtInLanguages.js \
  popup _locales icons engines vendor LICENSE -x "*.DS_Store"
echo "$zip ($(du -h "$zip" | cut -f1 | tr -d ' '))"
