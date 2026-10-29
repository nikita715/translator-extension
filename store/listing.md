# Chrome Web Store listing

Texts to paste into the developer dashboard. The short description comes from `extDescription` in `_locales`.

## Description

One file per store language in `descriptions/<locale>.txt`, the same languages as `_locales`. Images for each language are made by `render.sh` into `images/<locale>/`.

## What's new in 3.0

• A second offline translator: more languages work without the internet
• When the default translator doesn't support your languages, the other one takes over
• Pick the source language right in the translation popup and next to replaced text
• Asks before downloading language packs
• Google Translate fallback is optional and off by default

## Permission justifications

**activeTab, host permission for translate.google.com** — opens the selected text in Google Translate when the user chooses Google Translate or turns on the fallback.

**storage** — keeps the extension's settings: languages, trigger mode, default engine.

**contextMenus** — adds "Translate" to the right-click menu for selected text.

**offscreen** — Bergamot runs as WebAssembly in a Web Worker. Service workers can't start workers, so the engine runs in an offscreen document with the WORKERS reason.

**Optional host permission for storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/** — downloads Bergamot language models from Mozilla's public storage. The storage doesn't send CORS headers, so the extension needs host access to read the files. It's requested only when the user chooses Bergamot or agrees to download a Bergamot language pack.

**Content script on all sites** — shows the translation next to the selected text or replaces it on any page the user reads. The script reacts only to the user's clicks and selection.

**web_accessible_resources: popup/access-button.html** — the "Download" button shown in the translation popup when Bergamot has no access to its models yet. It's an extension page, so a click on it can request the optional host permission directly.

**Remote code** — none. The Bergamot engine (WebAssembly) is bundled with the extension; only language model data files are downloaded.

**Data usage** — the extension doesn't collect user data. On-page translation happens on the device. Text is sent to Google Translate only when the user chooses Google Translate mode or turns on the fallback: the extension opens translate.google.com with the selected text.
